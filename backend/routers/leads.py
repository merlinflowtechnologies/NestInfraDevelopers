from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api/leads", tags=["leads"])


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


class SiteVisitIn(BaseModel):
    visit_date: str
    assigned_agent: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "scheduled"  # scheduled | completed | cancelled


class LeadIn(BaseModel):
    name: str
    mobile: str
    email: Optional[str] = ""
    project_id: Optional[str] = ""
    project_name: Optional[str] = ""
    budget: Optional[float] = 0.0
    preferred_plot_size: Optional[str] = ""
    source: str = "Direct Walk-in"  # Direct Walk-in | Website | Referral | Social Media | Channel Partner
    status: str = "new"  # new | contacted | site_visit_scheduled | negotiation | won | lost
    assigned_agent_code: Optional[str] = ""
    assigned_agent_name: Optional[str] = ""
    notes: Optional[str] = ""


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    budget: Optional[float] = None
    preferred_plot_size: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    assigned_agent_code: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_leads(
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    agent_code: Optional[str] = None,
    user=Depends(get_current_user),
):
    query = {}
    if user.get("role") == "agent":
        query["assigned_agent_code"] = user.get("agent_code", "")
    elif user.get("role") == "team_lead":
        lead_code = user.get("agent_code")
        team_id = user.get("team_id", "")
        # Team lead sees leads assigned to their team agents or unassigned
        member_codes = [a["agent_code"] async for a in db.agents.find({"$or": [{"lead_code": lead_code}, {"team_id": team_id}, {"agent_code": lead_code}]})]
        if agent_code and agent_code in member_codes:
            query["assigned_agent_code"] = agent_code
        else:
            query["$or"] = [{"assigned_agent_code": {"$in": member_codes}}, {"assigned_agent_code": ""}, {"assigned_agent_code": None}]
    elif agent_code:
        query["assigned_agent_code"] = agent_code

    if status and status != "all":
        query["status"] = status
    if project_id and project_id != "all":
        query["project_id"] = project_id

    leads = [out(doc) async for doc in db.leads.find(query).sort("created_at", -1)]
    return leads


@router.post("")
async def create_lead(body: LeadIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    now = datetime.now(timezone.utc).isoformat()
    doc["created_at"] = now
    doc["updated_at"] = now
    doc["site_visits"] = []

    # If project_id provided but not name, resolve it
    if doc.get("project_id") and not doc.get("project_name"):
        p = await db.projects.find_one({"_id": oid(doc["project_id"])})
        if p:
            doc["project_name"] = p["name"]

    # Auto assign agent if created by agent
    if user.get("role") == "agent" and not doc.get("assigned_agent_code"):
        doc["assigned_agent_code"] = user.get("agent_code", "")
        doc["assigned_agent_name"] = user.get("name", "")
    elif doc.get("assigned_agent_code") and not doc.get("assigned_agent_name"):
        ag = await db.agents.find_one({"agent_code": doc["assigned_agent_code"]})
        if ag:
            doc["assigned_agent_name"] = ag["name"]

    res = await db.leads.insert_one(doc)
    return out(await db.leads.find_one({"_id": res.inserted_id}))


@router.get("/{lid}")
async def get_lead(lid: str, user=Depends(get_current_user)):
    doc = await db.leads.find_one({"_id": oid(lid)})
    if not doc:
        raise HTTPException(404, "Lead not found")
    
    if user.get("role") == "agent" and doc.get("assigned_agent_code") != user.get("agent_code"):
        raise HTTPException(403, "Access denied")
    return out(doc)


@router.put("/{lid}")
async def update_lead(lid: str, body: LeadUpdate, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"_id": oid(lid)})
    if not lead:
        raise HTTPException(404, "Lead not found")
    
    if user.get("role") == "agent" and lead.get("assigned_agent_code") != user.get("agent_code"):
        raise HTTPException(403, "Access denied")

    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()

    if upd.get("project_id") and not upd.get("project_name"):
        p = await db.projects.find_one({"_id": oid(upd["project_id"])})
        if p:
            doc_pname = p["name"]
            upd["project_name"] = doc_pname

    if upd.get("assigned_agent_code"):
        ag = await db.agents.find_one({"agent_code": upd["assigned_agent_code"]})
        if ag:
            upd["assigned_agent_name"] = ag["name"]

    await db.leads.update_one({"_id": lead["_id"]}, {"$set": upd})
    return out(await db.leads.find_one({"_id": lead["_id"]}))


@router.post("/{lid}/site-visits")
async def add_site_visit(lid: str, body: SiteVisitIn, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"_id": oid(lid)})
    if not lead:
        raise HTTPException(404, "Lead not found")

    visit_entry = body.model_dump()
    visit_entry["id"] = str(ObjectId())
    visit_entry["created_at"] = datetime.now(timezone.utc).isoformat()
    if not visit_entry.get("assigned_agent"):
        visit_entry["assigned_agent"] = lead.get("assigned_agent_name") or user.get("name", "")

    await db.leads.update_one(
        {"_id": lead["_id"]},
        {
            "$push": {"site_visits": visit_entry},
            "$set": {
                "status": "site_visit_scheduled" if body.status == "scheduled" else lead.get("status"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )
    return out(await db.leads.find_one({"_id": lead["_id"]}))


@router.delete("/{lid}")
async def delete_lead(lid: str, user=Depends(require_admin)):
    await db.leads.delete_one({"_id": oid(lid)})
    return {"ok": True}
