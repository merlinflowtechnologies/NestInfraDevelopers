import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from datetime import datetime
import pandas as pd

from database import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api", tags=["insights"])


def out(d):
    if not d:
        return d
    d["id"] = str(d.pop("_id"))
    return d


def month_key(offset: int) -> str:
    now = datetime.now()
    m = now.month - offset
    y = now.year
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


# ---------------- Dashboard ----------------
@router.get("/dashboard")
async def dashboard(month: Optional[str] = None, user=Depends(get_current_user)):
    month = month or datetime.now().strftime("%Y-%m")
    is_admin = user.get("role") == "admin"
    agent_code = None if is_admin else user.get("agent_code")

    projects = [out(p) async for p in db.projects.find()]
    sales_q = {"status": {"$ne": "cancelled"}}
    if agent_code:
        sales_q["agent_code"] = agent_code
    sales = await db.sales.find(sales_q).to_list(None)
    pays_q = {} if is_admin else {"agent_code": agent_code}
    payments = await db.payments.find(pays_q).to_list(None)

    msales = [s for s in sales if s.get("month") == month]
    mpays = [p for p in payments if p.get("month") == month]

    if agent_code:
        leader_sales = [s for s in sales if s.get("leader_code") == agent_code]
        m_commission = sum(
            s.get("agent_commission", 0) for s in msales
        ) + sum(s.get("team_commission", 0) for s in leader_sales if s.get("month") == month)
    else:
        m_commission = sum(s.get("agent_commission", 0) + s.get("team_commission", 0) for s in msales)

    result = {
        "month": month,
        "role": user.get("role"),
        "inventory": {
            "total_projects": len(projects),
            "total_plots": sum(p.get("total_plots", 0) for p in projects),
            "available_plots": sum(p.get("available_plots", 0) for p in projects),
            "booked_plots": sum(p.get("booked_plots", 0) for p in projects),
            "sold_plots": sum(p.get("sold_plots", 0) for p in projects),
        },
        "monthly_sales": sum(s["sale_amount"] for s in msales),
        "monthly_collection": sum(p["amount"] for p in mpays),
        "monthly_commission": m_commission,
        "total_sales": sum(s["sale_amount"] for s in sales),
        "total_collection": sum(p["amount"] for p in payments),
        "total_bookings": len(sales),
        "recent_sales": [out(s) for s in sorted(sales, key=lambda x: x["date"], reverse=True)[:6]],
        "recent_payments": [out(p) for p in sorted(payments, key=lambda x: x["date"], reverse=True)[:6]],
    }

    if is_admin:
        salaries = await db.salary.find({"month": month}).to_list(None)
        expenses = await db.expenses.find({"month": month}).to_list(None)
        m_salary = sum(s.get("net", 0) for s in salaries)
        m_expenses = sum(e.get("amount", 0) for e in expenses)
        result["monthly_salary"] = m_salary
        result["monthly_expenses"] = m_expenses
        result["estimated_profit"] = (
            result["monthly_collection"] - m_commission - m_salary - m_expenses
        )
        # top agents / teams by all-time sales
        agent_map = {}
        for s in sales:
            a = agent_map.setdefault(
                s["agent_code"], {"agent_code": s["agent_code"], "name": s.get("agent_name", ""), "sales": 0, "bookings": 0}
            )
            a["sales"] += s["sale_amount"]
            a["bookings"] += 1
        result["top_agents"] = sorted(agent_map.values(), key=lambda x: x["sales"], reverse=True)[:5]
        team_map = {}
        for s in sales:
            if not s.get("team_id"):
                continue
            t = team_map.setdefault(
                s["team_id"], {"team_id": s["team_id"], "name": s.get("team_name", ""), "sales": 0, "bookings": 0}
            )
            t["sales"] += s["sale_amount"]
            t["bookings"] += 1
        result["top_teams"] = sorted(team_map.values(), key=lambda x: x["sales"], reverse=True)[:5]

    # last 6 months chart
    chart = []
    for i in range(5, -1, -1):
        mk = month_key(i)
        chart.append(
            {
                "month": mk,
                "sales": sum(s["sale_amount"] for s in sales if s.get("month") == mk),
                "collections": sum(p["amount"] for p in payments if p.get("month") == mk),
            }
        )
    result["chart"] = chart
    return result


# ---------------- Monthly accounts ----------------
@router.get("/accounts/summary")
async def accounts_summary(month: str, user=Depends(require_admin)):
    sales = await db.sales.find({"month": month, "status": {"$ne": "cancelled"}}).to_list(None)
    payments = await db.payments.find({"month": month}).to_list(None)
    salaries = await db.salary.find({"month": month}).to_list(None)
    expenses = await db.expenses.find({"month": month}).to_list(None)
    total_sales = sum(s["sale_amount"] for s in sales)
    collections = sum(p["amount"] for p in payments)
    commission = sum(s.get("agent_commission", 0) + s.get("team_commission", 0) for s in sales)
    salary_total = sum(s.get("net", 0) for s in salaries)
    expense_total = sum(e.get("amount", 0) for e in expenses)
    outstanding = sum(s.get("balance", 0) for s in sales)
    return {
        "month": month,
        "total_sales": total_sales,
        "total_collections": collections,
        "total_commission": commission,
        "total_salaries": salary_total,
        "total_expenses": expense_total,
        "total_outstanding": outstanding,
        "estimated_profit": collections - commission - salary_total - expense_total,
    }


# ---------------- Reports ----------------
REPORT_TYPES = {
    "sales", "agent-sales", "team-sales", "commission", "salary",
    "expenses", "collections", "projects", "profit-summary",
}


async def build_report(rtype: str, month, agent, team, project, user) -> list:
    is_admin = user.get("role") == "admin"
    sales = await db.sales.find({"status": {"$ne": "cancelled"}}).to_list(None)
    payments = await db.payments.find().to_list(None)

    def keep_sale(s):
        if month and s.get("month") != month:
            return False
        if agent and s.get("agent_code") != agent:
            return False
        if team and s.get("team_id") != team:
            return False
        if project and s.get("project_id") != project:
            return False
        if not is_admin and s.get("agent_code") != user.get("agent_code"):
            return False
        return True

    fsales = [s for s in sales if keep_sale(s)]

    if rtype == "sales":
        return [
            {
                "Date": s["date"], "Project": s["project_name"], "Plot": s["plot_number"],
                "Customer": s["customer_name"], "Mobile": s.get("customer_mobile", ""),
                "Agent": s.get("agent_name", s["agent_code"]), "Team": s.get("team_name", ""),
                "Sale Amount": s["sale_amount"], "Collected": s.get("amount_collected", 0),
                "Balance": s.get("balance", 0), "Status": s["status"],
            }
            for s in sorted(fsales, key=lambda x: x["date"], reverse=True)
        ]
    if rtype == "agent-sales":
        amap = {}
        for s in fsales:
            a = amap.setdefault(s["agent_code"], {"Agent Code": s["agent_code"], "Agent": s.get("agent_name", ""), "Team": s.get("team_name", ""), "Bookings": 0, "Sales": 0, "Collection": 0, "Commission": 0})
            a["Bookings"] += 1
            a["Sales"] += s["sale_amount"]
            a["Collection"] += s.get("amount_collected", 0)
            a["Commission"] += s.get("agent_commission", 0)
        return sorted(amap.values(), key=lambda x: x["Sales"], reverse=True)
    if rtype == "team-sales":
        tmap = {}
        for s in fsales:
            if not s.get("team_id"):
                continue
            t = tmap.setdefault(s["team_id"], {"Team": s.get("team_name", ""), "Bookings": 0, "Sales": 0, "Collection": 0, "Commission": 0})
            t["Bookings"] += 1
            t["Sales"] += s["sale_amount"]
            t["Collection"] += s.get("amount_collected", 0)
            t["Commission"] += s.get("agent_commission", 0) + s.get("team_commission", 0)
        return sorted(tmap.values(), key=lambda x: x["Sales"], reverse=True)
    if rtype == "commission":
        return [
            {
                "Date": s["date"], "Project": s["project_name"], "Plot": s["plot_number"],
                "Agent": s.get("agent_name", s["agent_code"]), "Sale Amount": s["sale_amount"],
                "Eligible Amount": s.get("eligible_amount", s["sale_amount"]),
                "Agent Commission": s.get("agent_commission", 0),
                "Agent Paid": s.get("agent_commission_paid", 0),
                "Agent Pending": s.get("agent_commission", 0) - s.get("agent_commission_paid", 0),
                "Team/Leader Commission": s.get("team_commission", 0),
                "Team Paid": s.get("team_commission_paid", 0),
                "Team Pending": s.get("team_commission", 0) - s.get("team_commission_paid", 0),
            }
            for s in sorted(fsales, key=lambda x: x["date"], reverse=True)
        ]
    if rtype == "salary":
        q = {"month": month} if month else {}
        rows = await db.salary.find(q).sort("employee", 1).to_list(None)
        return [
            {"Month": s["month"], "Employee": s["employee"], "Designation": s.get("designation", ""),
             "Basic": s["basic"], "Bonus": s.get("bonus", 0), "Deduction": s.get("deduction", 0),
             "Net Salary": s.get("net", 0), "Status": s.get("payment_status", ""), "Payment Date": s.get("payment_date", "")}
            for s in rows
        ]
    if rtype == "expenses":
        q = {"month": month} if month else {}
        rows = await db.expenses.find(q).sort("date", -1).to_list(None)
        return [
            {"Date": e["date"], "Month": e["month"], "Category": e["category"], "Description": e.get("description", ""),
             "Project": e.get("project_name", ""), "Amount": e["amount"], "Mode": e.get("mode", ""), "Paid By": e.get("paid_by", "")}
            for e in rows
        ]
    if rtype == "collections":
        rows = [p for p in payments if (not month or p.get("month") == month) and (is_admin or p.get("agent_code") == user.get("agent_code"))]
        return [
            {"Date": p["date"], "Customer": p["customer_name"], "Project": p["project_name"],
             "Plot": p["plot_number"], "Amount": p["amount"], "Mode": p.get("mode", ""),
             "Reference": p.get("reference", ""), "Received By": p.get("received_by", "")}
            for p in sorted(rows, key=lambda x: x["date"], reverse=True)
        ]
    if rtype == "projects":
        prows = await db.projects.find().sort("name", 1).to_list(None)
        result = []
        for p in prows:
            ps = [s for s in sales if s.get("project_id") == str(p["_id"])]
            result.append({
                "Project": p["name"], "Location": p["location"], "Type": p["project_type"],
                "Price": p["price"], "Total Plots": p["total_plots"], "Available": p.get("available_plots", 0),
                "Booked": p.get("booked_plots", 0), "Sold": p.get("sold_plots", 0),
                "Sales Value": sum(s["sale_amount"] for s in ps),
                "Collected": sum(s.get("amount_collected", 0) for s in ps),
                "Outstanding": sum(s.get("balance", 0) for s in ps),
            })
        return result
    if rtype == "profit-summary":
        months = sorted({s.get("month") for s in sales} | {p.get("month") for p in payments} | {e.get("month") for e in await db.expenses.find().to_list(None)} | {s.get("month") for s in await db.salary.find().to_list(None)})
        months = [m for m in months if m]
        result = []
        for mk in months:
            sms = [s for s in sales if s.get("month") == mk]
            sp = [p for p in payments if p.get("month") == mk]
            sal = sum(x.get("net", 0) for x in await db.salary.find({"month": mk}).to_list(None))
            exp = sum(x.get("amount", 0) for x in await db.expenses.find({"month": mk}).to_list(None))
            comm = sum(s.get("agent_commission", 0) + s.get("team_commission", 0) for s in sms)
            coll = sum(p["amount"] for p in sp)
            result.append({
                "Month": mk, "Sales": sum(s["sale_amount"] for s in sms), "Collections": coll,
                "Commission": comm, "Salaries": sal, "Expenses": exp,
                "Outstanding": sum(s.get("balance", 0) for s in sms),
                "Estimated Profit": coll - comm - sal - exp,
            })
        return result
    return []


@router.get("/reports/{rtype}")
async def get_report(
    rtype: str,
    month: Optional[str] = None,
    agent: Optional[str] = None,
    team: Optional[str] = None,
    project: Optional[str] = None,
    format: str = "json",
    user=Depends(get_current_user),
):
    if rtype not in REPORT_TYPES:
        raise HTTPException(404, "Unknown report type")
    if rtype in ("salary", "expenses", "profit-summary") and user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    rows = await build_report(rtype, month, agent, team, project, user)
    if format == "json":
        return {"rows": rows, "count": len(rows)}
    df = pd.DataFrame(rows)
    fname = f"{rtype}_{month or 'all'}"
    if format == "csv":
        return Response(
            content=df.to_csv(index=False),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={fname}.csv"},
        )
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}.xlsx"},
    )
