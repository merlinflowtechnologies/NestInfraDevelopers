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
    team_id: str = ""
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
    doc["team_name"] = ""
    if doc.get("team_id"):
        t = await db.teams.find_one({"_id": oid(doc["team_id"])})
        doc["team_name"] = t["name"] if t else ""
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


# ---------------- Plot Layout & Matrix ----------------
FACINGS = ["East", "West", "North", "South", "North-East (Corner)", "South-East", "North-West", "South-West"]


@router.get("/projects/{pid}/plots")
async def get_project_plots(pid: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"_id": oid(pid)})
    if not project:
        raise HTTPException(404, "Project not found")

    total_plots = int(project.get("total_plots", 100))
    # Fetch all active sales for this project
    sales = [s async for s in db.sales.find({"project_id": pid, "status": {"$ne": "cancelled"}})]
    sales_by_plot = {str(s.get("plot_number")).strip(): s for s in sales}

    # Plot size parsing
    sizes_str = project.get("plot_sizes", "167, 200, 267 sq.yds")
    size_list = [s.strip().replace("sq.yds", "").strip() for s in sizes_str.split(",") if s.strip()]
    if not size_list:
        size_list = ["200"]

    plots = []
    for i in range(1, total_plots + 1):
        plot_no = str(i)
        sale = sales_by_plot.get(plot_no)
        facing = FACINGS[(i - 1) % len(FACINGS)]
        size_sqyd = float(size_list[(i - 1) % len(size_list)])
        price_per_yd = float(project.get("price", 15000))
        total_val = round(size_sqyd * price_per_yd, 2)

        if sale:
            status = sale.get("status", "booked")
            plots.append({
                "plot_number": plot_no,
                "status": status,
                "facing": facing,
                "size_sqyd": size_sqyd,
                "price_per_yd": price_per_yd,
                "total_price": float(sale.get("sale_amount", total_val)),
                "customer_name": sale.get("customer_name", ""),
                "customer_mobile": sale.get("customer_mobile", ""),
                "agent_name": sale.get("agent_name", ""),
                "agent_code": sale.get("agent_code", ""),
                "booking_date": sale.get("date", ""),
                "sale_id": str(sale.get("_id", "")),
                "amount_collected": float(sale.get("amount_collected", 0)),
                "balance": float(sale.get("balance", 0)),
            })
        else:
            plots.append({
                "plot_number": plot_no,
                "status": "available",
                "facing": facing,
                "size_sqyd": size_sqyd,
                "price_per_yd": price_per_yd,
                "total_price": total_val,
                "customer_name": "",
                "customer_mobile": "",
                "agent_name": "",
                "agent_code": "",
                "booking_date": "",
                "sale_id": "",
                "amount_collected": 0,
                "balance": total_val,
            })

    return {
        "project_id": pid,
        "project_name": project.get("name", ""),
        "total_plots": total_plots,
        "available_plots": project.get("available_plots", 0),
        "booked_plots": project.get("booked_plots", 0),
        "sold_plots": project.get("sold_plots", 0),
        "price_per_yd": project.get("price", 0),
        "plots": plots,
    }


# ---------------- Payment Receipt Voucher ----------------
def number_to_words(num: float) -> str:
    """Helper to convert rupee amount to readable words format"""
    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    num = int(num)
    if num == 0:
        return "Zero Rupees Only"

    def two_digits(n):
        if n < 10:
            return units[n]
        elif 10 <= n < 20:
            return teens[n - 10]
        else:
            return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")

    def three_digits(n):
        h = n // 100
        rest = n % 100
        res = ""
        if h > 0:
            res += units[h] + " Hundred"
            if rest > 0:
                res += " and "
        if rest > 0:
            res += two_digits(rest)
        return res

    crores = num // 10000000
    rem = num % 10000000
    lakhs = rem // 100000
    rem = rem % 100000
    thousands = rem // 1000
    rem = rem % 1000

    parts = []
    if crores > 0:
        parts.append(two_digits(crores) + " Crore")
    if lakhs > 0:
        parts.append(two_digits(lakhs) + " Lakh")
    if thousands > 0:
        parts.append(two_digits(thousands) + " Thousand")
    if rem > 0:
        parts.append(three_digits(rem))

    return "Rupees " + " ".join(parts) + " Only"


@router.get("/payments/{pay_id}/receipt")
async def get_payment_receipt(pay_id: str, user=Depends(get_current_user)):
    payment = await db.payments.find_one({"_id": oid(pay_id)})
    if not payment:
        raise HTTPException(404, "Payment record not found")

    sale = None
    if payment.get("sale_id"):
        sale = await db.sales.find_one({"_id": oid(payment["sale_id"])})

    project = None
    if payment.get("project_id"):
        project = await db.projects.find_one({"_id": oid(payment["project_id"])})

    # Find total payments made for this sale
    all_payments = []
    total_paid = 0.0
    if sale:
        all_payments = [out(p) async for p in db.payments.find({"sale_id": str(sale["_id"])}).sort("date", 1)]
        total_paid = sum(float(p.get("amount", 0)) for p in all_payments)

    sale_amount = float(sale.get("sale_amount", 0)) if sale else float(payment.get("amount", 0))
    balance_remaining = max(0.0, sale_amount - total_paid)

    receipt_no = f"REC-{str(payment['_id'])[-6:].upper()}"

    return {
        "receipt_number": receipt_no,
        "payment_id": str(payment["_id"]),
        "date": payment.get("date", ""),
        "amount": float(payment.get("amount", 0)),
        "amount_in_words": number_to_words(payment.get("amount", 0)),
        "mode": payment.get("mode", "UPI"),
        "reference": payment.get("reference", ""),
        "received_by": payment.get("received_by", "Admin"),
        "customer_name": payment.get("customer_name", sale.get("customer_name", "") if sale else ""),
        "customer_mobile": sale.get("customer_mobile", "") if sale else "",
        "project_name": payment.get("project_name", project.get("name", "") if project else ""),
        "project_location": project.get("location", "") if project else "Telangana",
        "plot_number": payment.get("plot_number", ""),
        "agent_name": sale.get("agent_name", "") if sale else "",
        "agent_code": sale.get("agent_code", "") if sale else "",
        "sale_total_amount": sale_amount,
        "total_paid_to_date": total_paid,
        "balance_remaining": balance_remaining,
        "payment_history": all_payments,
        "company": {
            "name": "Nest Infra Developers Pvt. Ltd.",
            "tagline": "Building Tomorrow's Infrastructure Today",
            "address": "Plot #104, Cyber Towers Road, Madhapur, Hyderabad, Telangana - 500081",
            "phone": "+91 98480 11000",
            "email": "nestinfradevelopers39@gmail.com",
            "website": "www.nestinfradevelopers.com",
            "gstin": "36AAACN1234F1Z5",
        }
    }


# ---------------- Cost Sheet Calculator ----------------
class CostSheetIn(BaseModel):
    project_id: str
    size_sqyd: float
    is_corner: bool = False
    is_east_facing: bool = False
    clubhouse_charges: float = 50000.0


@router.post("/calculate-cost-sheet")
async def calculate_cost_sheet(body: CostSheetIn, user=Depends(get_current_user)):
    project = await db.projects.find_one({"_id": oid(body.project_id)})
    if not project:
        raise HTTPException(404, "Project not found")

    base_rate = float(project.get("price", 15000))
    premium_per_yd = 0.0
    if body.is_corner:
        premium_per_yd += 500.0
    if body.is_east_facing:
        premium_per_yd += 300.0

    final_rate = base_rate + premium_per_yd
    base_cost = round(body.size_sqyd * final_rate, 2)
    infra_dev_charges = round(body.size_sqyd * 400.0, 2)  # 400 per sq yd
    clubhouse = body.clubhouse_charges
    gross_total = round(base_cost + infra_dev_charges + clubhouse, 2)
    est_registration = round(gross_total * 0.075, 2)  # ~7.5% stamp duty & registration in Telangana
    documentation = 10000.0
    net_grand_total = round(gross_total + est_registration + documentation, 2)

    return {
        "project_name": project.get("name", ""),
        "size_sqyd": body.size_sqyd,
        "base_rate": base_rate,
        "premium_rate": premium_per_yd,
        "final_rate": final_rate,
        "base_cost": base_cost,
        "infra_dev_charges": infra_dev_charges,
        "clubhouse_charges": clubhouse,
        "gross_total": gross_total,
        "est_registration_charges": est_registration,
        "documentation_charges": documentation,
        "net_grand_total": net_grand_total,
    }

