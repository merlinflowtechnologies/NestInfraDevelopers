from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api", tags=["transactions"])


def out(d):
    if not d:
        return d
    d["id"] = str(d.pop("_id"))
    return d


def oid(i: str) -> ObjectId:
    try:
        return ObjectId(i)
    except Exception:
        raise HTTPException(400, "Invalid ID")


# ---------------- Commission rules ----------------
class RuleIn(BaseModel):
    name: str
    level: str = "agent"  # agent | team_leader | project | team
    rule_type: str = "percentage"  # percentage | fixed
    value: float = 0
    basis: str = "sale_value"  # sale_value | collection
    project_id: str = ""
    active: bool = True


@router.get("/commission-rules")
async def list_rules(user=Depends(get_current_user)):
    rules = [out(r) async for r in db.commission_rules.find().sort("name", 1)]
    projects = {str(p["_id"]): p["name"] async for p in db.projects.find()}
    for r in rules:
        r["project_name"] = projects.get(r.get("project_id", ""), "")
    return rules


@router.post("/commission-rules")
async def create_rule(body: RuleIn, user=Depends(require_admin)):
    if body.level == "project" and not body.project_id:
        raise HTTPException(400, "Project rule requires a project")
    doc = body.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.commission_rules.insert_one(doc)
    return out(await db.commission_rules.find_one({"_id": res.inserted_id}))


@router.put("/commission-rules/{rid}")
async def update_rule(rid: str, body: RuleIn, user=Depends(require_admin)):
    r = await db.commission_rules.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(404, "Rule not found")
    if body.level == "project" and not body.project_id:
        raise HTTPException(400, "Project rule requires a project")
    await db.commission_rules.update_one({"_id": r["_id"]}, {"$set": body.model_dump()})
    return out(await db.commission_rules.find_one({"_id": r["_id"]}))


@router.delete("/commission-rules/{rid}")
async def delete_rule(rid: str, user=Depends(require_admin)):
    await db.commission_rules.delete_one({"_id": oid(rid)})
    return {"ok": True}


async def compute_commission(project_id: str, sale_amount: float, amount_collected: float):
    agent_c = 0.0
    team_c = 0.0
    rules = await db.commission_rules.find({"active": True}).to_list(100)
    for r in rules:
        base = sale_amount if r.get("basis", "sale_value") == "sale_value" else amount_collected
        if r.get("level") == "project" and r.get("project_id") and r.get("project_id") != project_id:
            continue
        val = base * float(r["value"]) / 100 if r["rule_type"] == "percentage" else float(r["value"])
        if r.get("level") in ("agent", "project"):
            agent_c += val
        else:
            team_c += val
    return round(agent_c, 2), round(team_c, 2)


# ---------------- Sales ----------------
class SaleIn(BaseModel):
    date: str
    project_id: str
    plot_number: str
    customer_name: str
    customer_mobile: str = ""
    agent_code: str
    team_id: str = ""
    sale_amount: float
    booking_amount: float = 0
    amount_collected: Optional[float] = None
    status: str = "booked"
    booking_mode: str = "UPI"


async def create_sale_record(data: dict, created_by: str = "admin") -> dict:
    project = await db.projects.find_one({"_id": oid(data["project_id"])})
    if not project:
        raise HTTPException(404, f"Project not found for sale {data.get('plot_number')}")
    dup = await db.sales.find_one(
        {"project_id": data["project_id"], "plot_number": data["plot_number"], "status": {"$ne": "cancelled"}}
    )
    if dup:
        raise HTTPException(400, f"Plot {data['plot_number']} already booked/sold in {project['name']}")
    agent = await db.agents.find_one({"agent_code": data["agent_code"]})
    team = None
    team_id = data.get("team_id") or (agent.get("team_id", "") if agent else "")
    if team_id:
        team = await db.teams.find_one({"_id": oid(team_id)})
    sale_amount = float(data["sale_amount"])
    amount_collected = data.get("amount_collected")
    if amount_collected is None:
        amount_collected = float(data.get("booking_amount") or 0)
    amount_collected = float(amount_collected)
    balance = sale_amount - amount_collected
    status = data.get("status") or ("sold" if balance <= 0 else "booked")
    if status not in ("booked", "sold", "cancelled"):
        status = "booked"
    agent_c, team_c = await compute_commission(data["project_id"], sale_amount, amount_collected)
    now = datetime.now(timezone.utc).isoformat()
    sale = {
        "date": data["date"],
        "month": data["date"][:7],
        "project_id": data["project_id"],
        "project_name": project["name"],
        "plot_number": data["plot_number"],
        "customer_name": data["customer_name"],
        "customer_mobile": data.get("customer_mobile", ""),
        "agent_code": data["agent_code"],
        "agent_name": agent["name"] if agent else "",
        "team_id": str(team["_id"]) if team else "",
        "team_name": team["name"] if team else "",
        "leader_code": team.get("leader_code", "") if team else "",
        "sale_amount": sale_amount,
        "booking_amount": float(data.get("booking_amount") or 0),
        "amount_collected": amount_collected,
        "balance": balance,
        "status": status,
        "eligible_amount": sale_amount,
        "agent_commission": agent_c,
        "team_commission": team_c,
        "agent_commission_paid": 0.0,
        "team_commission_paid": 0.0,
        "created_at": now,
    }
    res = await db.sales.insert_one(sale)
    if status != "cancelled":
        incf = "sold_plots" if status == "sold" else "booked_plots"
        await db.projects.update_one({"_id": project["_id"]}, {"$inc": {incf: 1, "available_plots": -1}})
    if sale["booking_amount"] > 0:
        await db.payments.insert_one(
            {
                "date": data["date"],
                "month": data["date"][:7],
                "sale_id": str(res.inserted_id),
                "customer_name": sale["customer_name"],
                "project_id": sale["project_id"],
                "project_name": sale["project_name"],
                "plot_number": sale["plot_number"],
                "amount": sale["booking_amount"],
                "mode": data.get("booking_mode", "UPI"),
                "reference": "Booking amount",
                "received_by": created_by,
                "agent_code": sale["agent_code"],
                "team_id": sale["team_id"],
                "created_at": now,
            }
        )
    sale["id"] = str(res.inserted_id)
    sale.pop("_id", None)
    return sale


@router.get("/sales")
async def list_sales(
    month: Optional[str] = None,
    project_id: Optional[str] = None,
    agent_code: Optional[str] = None,
    user=Depends(get_current_user),
):
    q = {}
    if user.get("role") == "agent":
        q["agent_code"] = user.get("agent_code")
    elif agent_code:
        q["agent_code"] = agent_code
    if month:
        q["month"] = month
    if project_id:
        q["project_id"] = project_id
    sales = [out(s) async for s in db.sales.find(q).sort("date", -1)]
    return sales


@router.post("/sales")
async def create_sale(body: SaleIn, user=Depends(require_admin)):
    return await create_sale_record(body.model_dump(), created_by=user.get("name", "admin"))


class SaleUpdate(BaseModel):
    date: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    status: Optional[str] = None


STATUS_COUNTER = {"booked": "booked_plots", "sold": "sold_plots"}


@router.put("/sales/{sid}")
async def update_sale(sid: str, body: SaleUpdate, user=Depends(require_admin)):
    sale = await db.sales.find_one({"_id": oid(sid)})
    if not sale:
        raise HTTPException(404, "Sale not found")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    new_status = upd.get("status")
    if new_status and new_status != sale["status"]:
        inc = {}
        old_c = STATUS_COUNTER.get(sale["status"])
        new_c = STATUS_COUNTER.get(new_status)
        if old_c:
            inc[old_c] = inc.get(old_c, 0) - 1
        if new_c:
            inc[new_c] = inc.get(new_c, 0) + 1
        if (sale["status"] == "cancelled") != (new_status == "cancelled"):
            inc["available_plots"] = -1 if sale["status"] == "cancelled" else 1
        if inc:
            await db.projects.update_one({"_id": oid(sale["project_id"])}, {"$inc": inc})
        upd["status"] = new_status
    if "date" in upd:
        upd["month"] = upd["date"][:7]
    if upd:
        await db.sales.update_one({"_id": sale["_id"]}, {"$set": upd})
    return out(await db.sales.find_one({"_id": sale["_id"]}))


@router.delete("/sales/{sid}")
async def delete_sale(sid: str, user=Depends(require_admin)):
    sale = await db.sales.find_one({"_id": oid(sid)})
    if not sale:
        raise HTTPException(404, "Sale not found")
    if sale["status"] != "cancelled":
        incf = STATUS_COUNTER.get(sale["status"], "booked_plots")
        await db.projects.update_one(
            {"_id": oid(sale["project_id"])}, {"$inc": {incf: -1, "available_plots": 1}}
        )
    await db.payments.delete_many({"sale_id": sid})
    await db.sales.delete_one({"_id": sale["_id"]})
    return {"ok": True}


class PayCommissionIn(BaseModel):
    sale_id: str
    who: str = "agent"  # agent | team
    amount: float


@router.post("/commission/pay")
async def pay_commission(body: PayCommissionIn, user=Depends(require_admin)):
    sale = await db.sales.find_one({"_id": oid(body.sale_id)})
    if not sale:
        raise HTTPException(404, "Sale not found")
    total_f = "agent_commission" if body.who == "agent" else "team_commission"
    paid_f = f"{total_f}_paid"
    pending = sale.get(total_f, 0) - sale.get(paid_f, 0)
    amount = min(body.amount, pending)
    if amount <= 0:
        raise HTTPException(400, "No pending commission")
    await db.sales.update_one({"_id": sale["_id"]}, {"$inc": {paid_f: amount}})
    return out(await db.sales.find_one({"_id": sale["_id"]}))


# ---------------- Payments ----------------
class PaymentIn(BaseModel):
    date: str
    sale_id: str
    amount: float
    mode: str = "UPI"
    reference: str = ""
    received_by: str = ""


async def record_payment(data: dict, received_by: str = "admin") -> dict:
    sale = await db.sales.find_one({"_id": oid(data["sale_id"])})
    if not sale:
        raise HTTPException(404, "Sale not found")
    now = datetime.now(timezone.utc).isoformat()
    pay = {
        "date": data["date"],
        "month": data["date"][:7],
        "sale_id": data["sale_id"],
        "customer_name": sale["customer_name"],
        "project_id": sale["project_id"],
        "project_name": sale["project_name"],
        "plot_number": sale["plot_number"],
        "amount": float(data["amount"]),
        "mode": data.get("mode", "UPI"),
        "reference": data.get("reference", ""),
        "received_by": data.get("received_by") or received_by,
        "agent_code": sale["agent_code"],
        "team_id": sale.get("team_id", ""),
        "created_at": now,
    }
    res = await db.payments.insert_one(pay)
    new_collected = sale.get("amount_collected", 0) + pay["amount"]
    new_balance = sale["sale_amount"] - new_collected
    upd = {"amount_collected": new_collected, "balance": new_balance}
    if new_balance <= 0 and sale["status"] == "booked":
        upd["status"] = "sold"
        await db.projects.update_one(
            {"_id": oid(sale["project_id"])}, {"$inc": {"sold_plots": 1, "booked_plots": -1}}
        )
    await db.sales.update_one({"_id": sale["_id"]}, {"$set": upd})
    pay["id"] = str(res.inserted_id)
    pay.pop("_id", None)
    return pay


@router.get("/payments")
async def list_payments(month: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if user.get("role") == "agent":
        q["agent_code"] = user.get("agent_code")
    if month:
        q["month"] = month
    return [out(p) async for p in db.payments.find(q).sort("date", -1)]


@router.post("/payments")
async def create_payment(body: PaymentIn, user=Depends(require_admin)):
    return await record_payment(body.model_dump(), received_by=user.get("name", "admin"))


@router.delete("/payments/{pid}")
async def delete_payment(pid: str, user=Depends(require_admin)):
    pay = await db.payments.find_one({"_id": oid(pid)})
    if not pay:
        raise HTTPException(404, "Payment not found")
    sale = await db.sales.find_one({"_id": oid(pay["sale_id"])})
    if sale:
        new_collected = max(0, sale.get("amount_collected", 0) - pay["amount"])
        new_balance = sale["sale_amount"] - new_collected
        upd = {"amount_collected": new_collected, "balance": new_balance}
        if new_balance > 0 and sale["status"] == "sold":
            upd["status"] = "booked"
            await db.projects.update_one(
                {"_id": oid(sale["project_id"])}, {"$inc": {"sold_plots": -1, "booked_plots": 1}}
            )
        await db.sales.update_one({"_id": sale["_id"]}, {"$set": upd})
    await db.payments.delete_one({"_id": pay["_id"]})
    return {"ok": True}


# ---------------- Salary ----------------
class SalaryIn(BaseModel):
    month: str
    employee: str
    agent_code: str = ""
    designation: str = ""
    basic: float = 0
    bonus: float = 0
    deduction: float = 0
    payment_status: str = "pending"
    payment_date: str = ""


def salary_doc(body: SalaryIn) -> dict:
    doc = body.model_dump()
    doc["net"] = round(body.basic + body.bonus - body.deduction, 2)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    return doc


@router.get("/salary")
async def list_salary(month: Optional[str] = None, user=Depends(require_admin)):
    q = {"month": month} if month else {}
    return [out(s) async for s in db.salary.find(q).sort("employee", 1)]


@router.post("/salary")
async def create_salary(body: SalaryIn, user=Depends(require_admin)):
    res = await db.salary.insert_one(salary_doc(body))
    return out(await db.salary.find_one({"_id": res.inserted_id}))


@router.put("/salary/{sid}")
async def update_salary(sid: str, body: SalaryIn, user=Depends(require_admin)):
    s = await db.salary.find_one({"_id": oid(sid)})
    if not s:
        raise HTTPException(404, "Salary record not found")
    await db.salary.update_one({"_id": s["_id"]}, {"$set": salary_doc(body)})
    return out(await db.salary.find_one({"_id": s["_id"]}))


@router.delete("/salary/{sid}")
async def delete_salary(sid: str, user=Depends(require_admin)):
    await db.salary.delete_one({"_id": oid(sid)})
    return {"ok": True}


# ---------------- Expenses ----------------
class ExpenseIn(BaseModel):
    date: str
    category: str
    description: str = ""
    project_id: str = ""
    amount: float = 0
    mode: str = "Cash"
    paid_by: str = ""


async def expense_doc(body: dict) -> dict:
    doc = dict(body)
    doc["month"] = doc["date"][:7]
    doc["amount"] = float(doc.get("amount") or 0)
    doc["project_name"] = ""
    if doc.get("project_id"):
        p = await db.projects.find_one({"_id": oid(doc["project_id"])})
        doc["project_name"] = p["name"] if p else ""
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    return doc


@router.get("/expenses")
async def list_expenses(month: Optional[str] = None, user=Depends(require_admin)):
    q = {"month": month} if month else {}
    return [out(e) async for e in db.expenses.find(q).sort("date", -1)]


@router.post("/expenses")
async def create_expense(body: ExpenseIn, user=Depends(require_admin)):
    res = await db.expenses.insert_one(await expense_doc(body.model_dump()))
    return out(await db.expenses.find_one({"_id": res.inserted_id}))


@router.put("/expenses/{eid}")
async def update_expense(eid: str, body: ExpenseIn, user=Depends(require_admin)):
    e = await db.expenses.find_one({"_id": oid(eid)})
    if not e:
        raise HTTPException(404, "Expense not found")
    await db.expenses.update_one({"_id": e["_id"]}, {"$set": await expense_doc(body.model_dump())})
    return out(await db.expenses.find_one({"_id": e["_id"]}))


@router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(require_admin)):
    await db.expenses.delete_one({"_id": oid(eid)})
    return {"ok": True}
