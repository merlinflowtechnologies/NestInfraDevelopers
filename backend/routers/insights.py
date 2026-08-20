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


# ---------------- Dashboard helpers ----------------
def inventory_summary(projects: list) -> dict:
    return {
        "total_projects": len(projects),
        "total_plots": sum(p.get("total_plots", 0) for p in projects),
        "available_plots": sum(p.get("available_plots", 0) for p in projects),
        "booked_plots": sum(p.get("booked_plots", 0) for p in projects),
        "sold_plots": sum(p.get("sold_plots", 0) for p in projects),
    }


def six_month_chart(sales: list, payments: list) -> list:
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
    return chart


def top_by(sales: list, key: str, name_key: str, limit: int = 5) -> list:
    grouped = {}
    for s in sales:
        k = s.get(key)
        if not k:
            continue
        g = grouped.setdefault(k, {key: k, "name": s.get(name_key, ""), "sales": 0, "bookings": 0})
        g["sales"] += s["sale_amount"]
        g["bookings"] += 1
    return sorted(grouped.values(), key=lambda x: x["sales"], reverse=True)[:limit]


def month_commission(sales: list) -> float:
    return sum(s.get("agent_commission", 0) + s.get("team_commission", 0) for s in sales)


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
        m_commission = sum(s.get("agent_commission", 0) for s in msales) + sum(
            s.get("team_commission", 0)
            for s in sales
            if s.get("leader_code") == agent_code and s.get("month") == month
        )
    else:
        m_commission = month_commission(msales)

    result = {
        "month": month,
        "role": user.get("role"),
        "inventory": inventory_summary(projects),
        "monthly_sales": sum(s["sale_amount"] for s in msales),
        "monthly_collection": sum(p["amount"] for p in mpays),
        "monthly_commission": m_commission,
        "total_sales": sum(s["sale_amount"] for s in sales),
        "total_collection": sum(p["amount"] for p in payments),
        "total_bookings": len(sales),
        "recent_sales": [out(s) for s in sorted(sales, key=lambda x: x["date"], reverse=True)[:6]],
        "recent_payments": [out(p) for p in sorted(payments, key=lambda x: x["date"], reverse=True)[:6]],
        "chart": six_month_chart(sales, payments),
    }

    if is_admin:
        salaries = await db.salary.find({"month": month}).to_list(None)
        expenses = await db.expenses.find({"month": month}).to_list(None)
        result["monthly_salary"] = sum(s.get("net", 0) for s in salaries)
        result["monthly_expenses"] = sum(e.get("amount", 0) for e in expenses)
        result["estimated_profit"] = (
            result["monthly_collection"] - m_commission - result["monthly_salary"] - result["monthly_expenses"]
        )
        result["top_agents"] = top_by(sales, "agent_code", "agent_name")
        result["top_teams"] = top_by(sales, "team_id", "team_name")
    return result


# ---------------- Monthly accounts ----------------
@router.get("/accounts/summary")
async def accounts_summary(month: str, user=Depends(require_admin)):
    sales = await db.sales.find({"month": month, "status": {"$ne": "cancelled"}}).to_list(None)
    payments = await db.payments.find({"month": month}).to_list(None)
    salaries = await db.salary.find({"month": month}).to_list(None)
    expenses = await db.expenses.find({"month": month}).to_list(None)
    collections = sum(p["amount"] for p in payments)
    commission = month_commission(sales)
    salary_total = sum(s.get("net", 0) for s in salaries)
    expense_total = sum(e.get("amount", 0) for e in expenses)
    return {
        "month": month,
        "total_sales": sum(s["sale_amount"] for s in sales),
        "total_collections": collections,
        "total_commission": commission,
        "total_salaries": salary_total,
        "total_expenses": expense_total,
        "total_outstanding": sum(s.get("balance", 0) for s in sales),
        "estimated_profit": collections - commission - salary_total - expense_total,
    }


# ---------------- Report builders ----------------
REPORT_TYPES = {
    "sales", "agent-sales", "team-sales", "commission", "salary",
    "expenses", "collections", "projects", "profit-summary",
}
ADMIN_ONLY_REPORTS = ("salary", "expenses", "profit-summary")


def report_sales(fsales: list) -> list:
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


def report_agent_sales(fsales: list) -> list:
    amap = {}
    for s in fsales:
        a = amap.setdefault(s["agent_code"], {"Agent Code": s["agent_code"], "Agent": s.get("agent_name", ""), "Team": s.get("team_name", ""), "Bookings": 0, "Sales": 0, "Collection": 0, "Commission": 0})
        a["Bookings"] += 1
        a["Sales"] += s["sale_amount"]
        a["Collection"] += s.get("amount_collected", 0)
        a["Commission"] += s.get("agent_commission", 0)
    return sorted(amap.values(), key=lambda x: x["Sales"], reverse=True)


def report_team_sales(fsales: list) -> list:
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


def report_commission(fsales: list) -> list:
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


async def report_salary(month) -> list:
    q = {"month": month} if month else {}
    rows = await db.salary.find(q).sort("employee", 1).to_list(None)
    return [
        {"Month": s["month"], "Employee": s["employee"], "Designation": s.get("designation", ""),
         "Basic": s["basic"], "Bonus": s.get("bonus", 0), "Deduction": s.get("deduction", 0),
         "Net Salary": s.get("net", 0), "Status": s.get("payment_status", ""), "Payment Date": s.get("payment_date", "")}
        for s in rows
    ]


async def report_expenses(month) -> list:
    q = {"month": month} if month else {}
    rows = await db.expenses.find(q).sort("date", -1).to_list(None)
    return [
        {"Date": e["date"], "Month": e["month"], "Category": e["category"], "Description": e.get("description", ""),
         "Project": e.get("project_name", ""), "Amount": e["amount"], "Mode": e.get("mode", ""), "Paid By": e.get("paid_by", "")}
        for e in rows
    ]


def report_collections(payments: list) -> list:
    return [
        {"Date": p["date"], "Customer": p["customer_name"], "Project": p["project_name"],
         "Plot": p["plot_number"], "Amount": p["amount"], "Mode": p.get("mode", ""),
         "Reference": p.get("reference", ""), "Received By": p.get("received_by", "")}
        for p in sorted(payments, key=lambda x: x["date"], reverse=True)
    ]


async def report_projects(sales: list) -> list:
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


async def report_profit_summary(sales: list, payments: list) -> list:
    expenses = await db.expenses.find().to_list(None)
    salaries = await db.salary.find().to_list(None)
    months = sorted({d.get("month") for d in sales + payments + expenses + salaries if d.get("month")})
    result = []
    for mk in months:
        sms = [s for s in sales if s.get("month") == mk]
        sal = sum(x.get("net", 0) for x in salaries if x.get("month") == mk)
        exp = sum(x.get("amount", 0) for x in expenses if x.get("month") == mk)
        comm = month_commission(sms)
        coll = sum(p["amount"] for p in payments if p.get("month") == mk)
        result.append({
            "Month": mk, "Sales": sum(s["sale_amount"] for s in sms), "Collections": coll,
            "Commission": comm, "Salaries": sal, "Expenses": exp,
            "Outstanding": sum(s.get("balance", 0) for s in sms),
            "Estimated Profit": coll - comm - sal - exp,
        })
    return result


async def filter_sales(month, agent, team, project, user) -> list:
    is_admin = user.get("role") == "admin"
    sales = await db.sales.find({"status": {"$ne": "cancelled"}}).to_list(None)

    def keep(s):
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

    return [s for s in sales if keep(s)]


async def build_report(rtype: str, month, agent, team, project, user) -> list:
    is_admin = user.get("role") == "admin"
    if rtype == "salary":
        return await report_salary(month)
    if rtype == "expenses":
        return await report_expenses(month)
    fsales = await filter_sales(month, agent, team, project, user)
    if rtype == "sales":
        return report_sales(fsales)
    if rtype == "agent-sales":
        return report_agent_sales(fsales)
    if rtype == "team-sales":
        return report_team_sales(fsales)
    if rtype == "commission":
        return report_commission(fsales)
    if rtype == "projects":
        return await report_projects(fsales)
    payments = await db.payments.find().to_list(None)
    if rtype == "collections":
        rows = [p for p in payments if (not month or p.get("month") == month) and (is_admin or p.get("agent_code") == user.get("agent_code"))]
        return report_collections(rows)
    if rtype == "profit-summary":
        return await report_profit_summary(fsales, payments)
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
    if rtype in ADMIN_ONLY_REPORTS and user.get("role") != "admin":
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
