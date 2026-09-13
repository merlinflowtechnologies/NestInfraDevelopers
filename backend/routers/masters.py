from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin, hash_password

router = APIRouter(prefix="/api", tags=["masters"])


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


# ---------------- Projects ----------------
class ProjectIn(BaseModel):
    name: str
    location: str
    project_type: str
    price: float
    plot_sizes: str = ""
    total_plots: int
    images: List[str] = []
    layout_image: Optional[str] = ""
    brochure_url: Optional[str] = ""
    description: str = ""
    map_url: str = ""


@router.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    return [out(p) async for p in db.projects.find().sort("name", 1)]


@router.post("/projects")
async def create_project(body: ProjectIn, user=Depends(require_admin)):
    if await db.projects.find_one({"name": body.name.strip()}):
        raise HTTPException(400, "Project with this name already exists")
    doc = body.model_dump()
    doc.update(
        {
            "name": body.name.strip(),
            "available_plots": body.total_plots,
            "booked_plots": 0,
            "sold_plots": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    res = await db.projects.insert_one(doc)
    return out(await db.projects.find_one({"_id": res.inserted_id}))


@router.put("/projects/{pid}")
async def update_project(pid: str, body: ProjectIn, user=Depends(require_admin)):
    p = await db.projects.find_one({"_id": oid(pid)})
    if not p:
        raise HTTPException(404, "Project not found")
    diff = body.total_plots - p.get("total_plots", 0)
    upd = body.model_dump()
    upd["available_plots"] = max(0, p.get("available_plots", 0) + diff)
    await db.projects.update_one({"_id": p["_id"]}, {"$set": upd})
    return out(await db.projects.find_one({"_id": p["_id"]}))


@router.delete("/projects/{pid}")
async def delete_project(pid: str, user=Depends(require_admin)):
    sales = await db.sales.count_documents({"project_id": pid, "status": {"$ne": "cancelled"}})
    if sales:
        raise HTTPException(400, "Cannot delete project with active sales")
    await db.projects.delete_one({"_id": oid(pid)})
    return {"ok": True}


# ---------------- Agents ----------------
class AgentIn(BaseModel):
    agent_code: str
    name: str
    mobile: str
    team_id: str = ""
    designation: str = ""
    joining_date: str = ""
    commission_plan: str = ""
    status: str = "active"
    password: str = ""


async def ensure_agent_user(code: str, name: str, password: str = ""):
    pw = password or "nest@123"
    await db.users.update_one(
        {"agent_code": code},
        {
            "$set": {
                "email": f"{code.lower()}@nestinfra.in",
                "name": name,
                "role": "agent",
                "agent_code": code,
            },
            "$setOnInsert": {
                "password_hash": hash_password(pw),
                "password_changed": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        },
        upsert=True,
    )


@router.get("/agents")
async def list_agents(user=Depends(get_current_user)):
    agents = [out(a) async for a in db.agents.find().sort("agent_code", 1)]
    teams = {str(t["_id"]): t["name"] async for t in db.teams.find()}
    for a in agents:
        a["team_name"] = teams.get(a.get("team_id", ""), "")
    return agents


@router.post("/agents")
async def create_agent(body: AgentIn, user=Depends(require_admin)):
    code = body.agent_code.strip().upper()
    if await db.agents.find_one({"agent_code": code}):
        raise HTTPException(400, "Agent code already exists")
    doc = body.model_dump()
    doc.pop("password")
    doc["agent_code"] = code
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.agents.insert_one(doc)
    await ensure_agent_user(code, body.name, body.password)
    return out(await db.agents.find_one({"_id": res.inserted_id}))


@router.put("/agents/{aid}")
async def update_agent(aid: str, body: AgentIn, user=Depends(require_admin)):
    a = await db.agents.find_one({"_id": oid(aid)})
    if not a:
        raise HTTPException(404, "Agent not found")
    doc = body.model_dump()
    pw = doc.pop("password")
    doc["agent_code"] = a["agent_code"]
    await db.agents.update_one({"_id": a["_id"]}, {"$set": doc})
    if pw:
        await db.users.update_one(
            {"agent_code": a["agent_code"]},
            {"$set": {"password_hash": hash_password(pw), "password_changed": False}}
        )
    await db.users.update_one({"agent_code": a["agent_code"]}, {"$set": {"name": body.name}})
    return out(await db.agents.find_one({"_id": a["_id"]}))


@router.delete("/agents/{aid}")
async def delete_agent(aid: str, user=Depends(require_admin)):
    a = await db.agents.find_one({"_id": oid(aid)})
    if not a:
        raise HTTPException(404, "Agent not found")
    sales = await db.sales.count_documents({"agent_code": a["agent_code"], "status": {"$ne": "cancelled"}})
    if sales:
        raise HTTPException(400, "Cannot delete agent with active sales")
    await db.agents.delete_one({"_id": a["_id"]})
    await db.users.delete_many({"agent_code": a["agent_code"]})
    return {"ok": True}


@router.get("/agents/{code}/dashboard")
async def agent_dashboard(code: str, month: Optional[str] = None, user=Depends(get_current_user)):
    if user.get("role") == "agent" and user.get("agent_code") != code:
        raise HTTPException(403, "Access denied")
    month = month or datetime.now().strftime("%Y-%m")
    sales = await db.sales.find({"agent_code": code, "status": {"$ne": "cancelled"}}).to_list(None)
    payments = await db.payments.find({"agent_code": code}).to_list(None)
    month_sales = [s for s in sales if s.get("month") == month]
    agent = await db.agents.find_one({"agent_code": code})
    earned = sum(s.get("agent_commission", 0) for s in sales)
    paid = sum(s.get("agent_commission_paid", 0) for s in sales)
    leader_sales = await db.sales.find({"leader_code": code, "status": {"$ne": "cancelled"}}).to_list(None)
    leader_earned = sum(s.get("team_commission", 0) for s in leader_sales)
    leader_paid = sum(s.get("team_commission_paid", 0) for s in leader_sales)
    return {
        "agent": out(agent) if agent else None,
        "month": month,
        "total_sales": sum(s["sale_amount"] for s in sales),
        "monthly_sales": sum(s["sale_amount"] for s in month_sales),
        "total_bookings": len(sales),
        "total_collection": sum(p["amount"] for p in payments),
        "monthly_collection": sum(p["amount"] for p in payments if p.get("month") == month),
        "commission_earned": earned + leader_earned,
        "commission_paid": paid + leader_paid,
        "commission_pending": (earned + leader_earned) - (paid + leader_paid),
        "recent_sales": [out(s) for s in sorted(sales, key=lambda x: x["date"], reverse=True)[:10]],
    }


# ---------------- Teams ----------------
class TeamIn(BaseModel):
    name: str
    leader_code: str = ""
    monthly_target: float = 0


@router.get("/teams")
async def list_teams(month: Optional[str] = None, user=Depends(get_current_user)):
    month = month or datetime.now().strftime("%Y-%m")
    teams = [out(t) async for t in db.teams.find().sort("name", 1)]
    sales = await db.sales.find({"status": {"$ne": "cancelled"}}).to_list(None)
    expenses = await db.expenses.find({"month": month}).to_list(None)
    agents = await db.agents.find().to_list(None)
    for t in teams:
        ts = [s for s in sales if s.get("team_id") == t["id"]]
        ms = [s for s in ts if s.get("month") == month]
        if user.get("role") == "admin":
            t["team_expenses"] = sum(e.get("amount", 0) for e in expenses if e.get("team_id") == t["id"])
        t["team_sales"] = sum(s["sale_amount"] for s in ms)
        t["team_sales_total"] = sum(s["sale_amount"] for s in ts)
        t["team_bookings"] = len(ms)
        t["team_collection"] = sum(s.get("amount_collected", 0) for s in ms)
        t["team_commission"] = sum(
            s.get("agent_commission", 0) + s.get("team_commission", 0) for s in ms
        )
        target = t.get("monthly_target", 0)
        t["achievement"] = round(t["team_sales"] / target * 100, 1) if target else 0
        members = [a for a in agents if a.get("team_id") == t["id"]]
        t["members"] = [{"agent_code": a["agent_code"], "name": a["name"], "designation": a.get("designation", "")} for a in members]
        leader = next((a for a in agents if a["agent_code"] == t.get("leader_code")), None)
        t["leader_name"] = leader["name"] if leader else ""
    return teams


@router.post("/teams")
async def create_team(body: TeamIn, user=Depends(require_admin)):
    if await db.teams.find_one({"name": body.name.strip()}):
        raise HTTPException(400, "Team with this name already exists")
    doc = body.model_dump()
    doc["name"] = body.name.strip()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.teams.insert_one(doc)
    return out(await db.teams.find_one({"_id": res.inserted_id}))


@router.put("/teams/{tid}")
async def update_team(tid: str, body: TeamIn, user=Depends(require_admin)):
    t = await db.teams.find_one({"_id": oid(tid)})
    if not t:
        raise HTTPException(404, "Team not found")
    await db.teams.update_one({"_id": t["_id"]}, {"$set": body.model_dump()})
    return out(await db.teams.find_one({"_id": t["_id"]}))


@router.delete("/teams/{tid}")
async def delete_team(tid: str, user=Depends(require_admin)):
    await db.agents.update_many({"team_id": tid}, {"$set": {"team_id": ""}})
    await db.teams.delete_one({"_id": oid(tid)})
    return {"ok": True}
