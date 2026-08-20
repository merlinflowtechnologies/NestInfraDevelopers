import io
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
import pandas as pd

from database import db
from auth import require_admin
from routers.masters import ensure_agent_user
from routers.transactions import create_sale_record, record_payment

router = APIRouter(prefix="/api/admin", tags=["uploads"])

ENTITIES = ["projects", "agents", "teams", "commission", "sales", "payments", "salary", "expenses"]

REQUIRED = {
    "projects": ["name", "location", "project_type", "price", "total_plots"],
    "agents": ["agent_code", "name", "mobile"],
    "teams": ["name"],
    "commission": ["name", "level", "rule_type", "value"],
    "sales": ["date", "project", "plot_number", "customer_name", "agent", "sale_amount"],
    "payments": ["date", "project", "plot_number", "amount"],
    "salary": ["month", "employee", "basic"],
    "expenses": ["date", "category", "amount"],
}

SAMPLE_COLUMNS = {
    "projects": "name, location, project_type, price, plot_sizes, total_plots, images(; separated), description, map_url",
    "agents": "agent_code, name, mobile, team(name), designation, joining_date, commission_plan, status, password(optional)",
    "teams": "name, leader(agent_code), monthly_target",
    "commission": "name, level(agent/team_leader/project/team), rule_type(percentage/fixed), value, basis(sale_value/collection), project(optional name)",
    "sales": "date(YYYY-MM-DD), project(name), plot_number, customer_name, customer_mobile, agent(agent_code), sale_amount, booking_amount, amount_collected(optional), status(booked/sold)",
    "payments": "date(YYYY-MM-DD), project(name), plot_number, amount, mode, reference, received_by",
    "salary": "month(YYYY-MM), employee, agent_code(optional), designation, basic, bonus, deduction, payment_status, payment_date",
    "expenses": "date(YYYY-MM-DD), category, description, project(optional name), amount, mode, paid_by",
}


def fnum(v, default=0.0):
    try:
        return float(str(v).replace(",", "").replace("₹", "").strip() or default)
    except Exception:
        return default


def s(v):
    return str(v).strip() if v is not None else ""


def normalize_rows(df: pd.DataFrame) -> list:
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("/", "_") for c in df.columns]
    rows = []
    for rec in df.to_dict("records"):
        r = {}
        for k, v in rec.items():
            if pd.isna(v):
                r[k] = ""
            elif isinstance(v, pd.Timestamp):
                r[k] = v.strftime("%Y-%m-%d")
            elif isinstance(v, float) and v.is_integer():
                r[k] = int(v)
            else:
                r[k] = v
        rows.append(r)
    return rows


@router.get("/upload/template-info")
async def template_info(user=Depends(require_admin)):
    return {"entities": ENTITIES, "columns": SAMPLE_COLUMNS}


@router.post("/upload/{entity}")
async def upload_preview(entity: str, file: UploadFile = File(...), user=Depends(require_admin)):
    if entity not in ENTITIES:
        raise HTTPException(404, f"Unknown entity. Use one of: {', '.join(ENTITIES)}")
    raw = await file.read()
    try:
        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw))
        else:
            df = pd.read_excel(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")
    rows = normalize_rows(df)
    required = REQUIRED[entity]
    errors = []
    for i, row in enumerate(rows):
        missing = [c for c in required if s(row.get(c)) == ""]
        if missing:
            errors.append({"row": i + 2, "message": f"Missing required: {', '.join(missing)}"})
    duplicates = []
    if entity == "projects":
        names = [s(r.get("name")) for r in rows]
        existing = {p["name"] async for p in db.projects.find({"name": {"$in": names}})}
        duplicates = [{"row": i + 2, "message": f"Project '{n}' already exists"} for i, n in enumerate(names) if n in existing]
    elif entity == "agents":
        codes = [s(r.get("agent_code")).upper() for r in rows]
        existing = {a["agent_code"] async for a in db.agents.find({"agent_code": {"$in": codes}})}
        duplicates = [{"row": i + 2, "message": f"Agent code '{c}' already exists"} for i, c in enumerate(codes) if c in existing]
    elif entity == "teams":
        names = [s(r.get("name")) for r in rows]
        existing = {t["name"] async for t in db.teams.find({"name": {"$in": names}})}
        duplicates = [{"row": i + 2, "message": f"Team '{n}' already exists"} for i, n in enumerate(names) if n in existing]
    elif entity == "sales":
        for i, r in enumerate(rows):
            p = await db.projects.find_one({"name": s(r.get("project"))})
            if not p:
                errors.append({"row": i + 2, "message": f"Project '{s(r.get('project'))}' not found"})
            else:
                dup = await db.sales.find_one({"project_id": str(p["_id"]), "plot_number": s(r.get("plot_number")), "status": {"$ne": "cancelled"}})
                if dup:
                    duplicates.append({"row": i + 2, "message": f"Plot {s(r.get('plot_number'))} already sold/booked"})
    elif entity == "salary":
        for i, r in enumerate(rows):
            dup = await db.salary.find_one({"month": s(r.get("month")), "employee": s(r.get("employee"))})
            if dup:
                duplicates.append({"row": i + 2, "message": f"Salary for {s(r.get('employee'))} in {s(r.get('month'))} exists"})
    err_rows = {e["row"] for e in errors}
    dup_rows = {d["row"] for d in duplicates}
    return {
        "entity": entity,
        "total": len(rows),
        "rows": rows,
        "errors": errors,
        "duplicates": duplicates,
        "valid": len(rows) - len(err_rows | dup_rows),
        "columns_hint": SAMPLE_COLUMNS[entity],
    }


class ConfirmBody(BaseModel):
    rows: List[dict]


async def is_duplicate(entity: str, row: dict) -> bool:
    if entity == "projects":
        return await db.projects.find_one({"name": s(row.get("name"))}) is not None
    if entity == "agents":
        return await db.agents.find_one({"agent_code": s(row.get("agent_code")).upper()}) is not None
    if entity == "teams":
        return await db.teams.find_one({"name": s(row.get("name"))}) is not None
    if entity == "salary":
        return await db.salary.find_one({"month": s(row.get("month"))[:7], "employee": s(row.get("employee"))}) is not None
    if entity == "sales":
        p = await db.projects.find_one({"name": s(row.get("project"))})
        if p:
            return await db.sales.find_one({"project_id": str(p["_id"]), "plot_number": s(row.get("plot_number")), "status": {"$ne": "cancelled"}}) is not None
    return False


@router.post("/upload/{entity}/confirm")
async def upload_confirm(entity: str, body: ConfirmBody, user=Depends(require_admin)):
    if entity not in ENTITIES:
        raise HTTPException(404, "Unknown entity")
    required = REQUIRED[entity]
    inserted, failed = 0, []
    for i, row in enumerate(body.rows):
        if any(s(row.get(c)) == "" for c in required):
            failed.append({"row": i + 2, "error": "Missing required fields"})
            continue
        if await is_duplicate(entity, row):
            failed.append({"row": i + 2, "error": "Duplicate record — already exists"})
            continue
        try:
            await insert_row(entity, row)
            inserted += 1
        except HTTPException as e:
            failed.append({"row": i + 2, "error": e.detail})
        except Exception as e:
            failed.append({"row": i + 2, "error": str(e)})
    return {"inserted": inserted, "failed": failed}


async def insert_row(entity: str, row: dict):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    if entity == "projects":
        total = int(fnum(row.get("total_plots")))
        images = [i.strip() for i in s(row.get("images")).split(";") if i.strip()]
        await db.projects.insert_one({
            "name": s(row.get("name")), "location": s(row.get("location")),
            "project_type": s(row.get("project_type")), "price": fnum(row.get("price")),
            "plot_sizes": s(row.get("plot_sizes")), "total_plots": total,
            "available_plots": total, "booked_plots": 0, "sold_plots": 0,
            "images": images, "description": s(row.get("description")), "map_url": s(row.get("map_url")),
            "created_at": now,
        })
    elif entity == "agents":
        code = s(row.get("agent_code")).upper()
        team_id = ""
        if s(row.get("team")):
            t = await db.teams.find_one({"name": s(row.get("team"))})
            team_id = str(t["_id"]) if t else ""
        await db.agents.insert_one({
            "agent_code": code, "name": s(row.get("name")), "mobile": s(row.get("mobile")),
            "team_id": team_id, "designation": s(row.get("designation")),
            "joining_date": s(row.get("joining_date")), "commission_plan": s(row.get("commission_plan")),
            "status": s(row.get("status")) or "active", "created_at": now,
        })
        await ensure_agent_user(code, s(row.get("name")), s(row.get("password")))
    elif entity == "teams":
        await db.teams.insert_one({
            "name": s(row.get("name")), "leader_code": s(row.get("leader")).upper(),
            "monthly_target": fnum(row.get("monthly_target")), "created_at": now,
        })
    elif entity == "commission":
        project_id = ""
        if s(row.get("project")):
            p = await db.projects.find_one({"name": s(row.get("project"))})
            project_id = str(p["_id"]) if p else ""
        await db.commission_rules.insert_one({
            "name": s(row.get("name")), "level": s(row.get("level")) or "agent",
            "rule_type": s(row.get("rule_type")) or "percentage", "value": fnum(row.get("value")),
            "basis": s(row.get("basis")) or "sale_value", "project_id": project_id,
            "active": True, "created_at": now,
        })
    elif entity == "sales":
        p = await db.projects.find_one({"name": s(row.get("project"))})
        if not p:
            raise HTTPException(400, f"Project '{s(row.get('project'))}' not found")
        data = {
            "date": s(row.get("date"))[:10], "project_id": str(p["_id"]),
            "plot_number": s(row.get("plot_number")), "customer_name": s(row.get("customer_name")),
            "customer_mobile": s(row.get("customer_mobile")), "agent_code": s(row.get("agent")).upper(),
            "team_id": "", "sale_amount": fnum(row.get("sale_amount")),
            "booking_amount": fnum(row.get("booking_amount")),
            "amount_collected": fnum(row.get("amount_collected")) if s(row.get("amount_collected")) else None,
            "status": s(row.get("status")) or "booked",
        }
        await create_sale_record(data, created_by="bulk-upload")
    elif entity == "payments":
        p = await db.projects.find_one({"name": s(row.get("project"))})
        if not p:
            raise HTTPException(400, f"Project '{s(row.get('project'))}' not found")
        sale = await db.sales.find_one({"project_id": str(p["_id"]), "plot_number": s(row.get("plot_number")), "status": {"$ne": "cancelled"}})
        if not sale:
            raise HTTPException(400, f"No active sale for plot {s(row.get('plot_number'))}")
        await record_payment({
            "date": s(row.get("date"))[:10], "sale_id": str(sale["_id"]),
            "amount": fnum(row.get("amount")), "mode": s(row.get("mode")) or "UPI",
            "reference": s(row.get("reference")), "received_by": s(row.get("received_by")),
        })
    elif entity == "salary":
        basic = fnum(row.get("basic"))
        bonus = fnum(row.get("bonus"))
        deduction = fnum(row.get("deduction"))
        await db.salary.insert_one({
            "month": s(row.get("month"))[:7], "employee": s(row.get("employee")),
            "agent_code": s(row.get("agent_code")).upper(), "designation": s(row.get("designation")),
            "basic": basic, "bonus": bonus, "deduction": deduction,
            "net": round(basic + bonus - deduction, 2),
            "payment_status": s(row.get("payment_status")) or "pending",
            "payment_date": s(row.get("payment_date")), "created_at": now,
        })
    elif entity == "expenses":
        project_id, project_name = "", ""
        if s(row.get("project")):
            p = await db.projects.find_one({"name": s(row.get("project"))})
            if p:
                project_id, project_name = str(p["_id"]), p["name"]
        await db.expenses.insert_one({
            "date": s(row.get("date"))[:10], "month": s(row.get("date"))[:7],
            "category": s(row.get("category")), "description": s(row.get("description")),
            "project_id": project_id, "project_name": project_name,
            "amount": fnum(row.get("amount")), "mode": s(row.get("mode")) or "Cash",
            "paid_by": s(row.get("paid_by")), "created_at": now,
        })
