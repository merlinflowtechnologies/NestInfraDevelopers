from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId

from database import db
from auth import require_admin, get_current_user, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin_settings"])


def out(d):
    if not d:
        return d
    d["id"] = str(d.pop("_id"))
    return d


class CompanySettings(BaseModel):
    name: str = "Nest Infra Developers Pvt. Ltd."
    tagline: str = "Plots. People. Performance."
    gstin: str = "36AAACN1234F1Z5"
    rera_number: str = "P02400001234"
    phone: str = "+91 98480 12345"
    email: str = "info@nestinfradevelopers.in"
    website: str = "https://nestinfradevelopers.in"
    address: str = "Plot #42, Road #12, Banjara Hills, Hyderabad, Telangana - 500034"
    bank_name: str = "HDFC Bank"
    account_number: str = "50200012345678"
    ifsc_code: str = "HDFC0001234"
    branch: str = "Banjara Hills, Hyderabad"
    receipt_terms: str = "1. Cheque/Draft is subject to realization.\n2. Booking advance is non-refundable upon cancellation after 15 days.\n3. Registration charges and stamp duty are additional as per government rates."


@router.get("/company-settings")
async def get_company_settings(user=Depends(get_current_user)):
    settings = await db.company_settings.find_one({})
    if not settings:
        default = CompanySettings().model_dump()
        default["created_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.company_settings.insert_one(default)
        settings = await db.company_settings.find_one({"_id": res.inserted_id})
    return out(settings)


@router.post("/company-settings")
async def update_company_settings(body: CompanySettings, user=Depends(require_admin)):
    doc = body.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.company_settings.update_one({}, {"$set": doc}, upsert=True)
    settings = await db.company_settings.find_one({})
    return out(settings)


class BulkPlotGen(BaseModel):
    project_id: str
    start_plot: int = 1
    total_plots: int = 50
    default_size_sqyd: float = 167.0
    default_rate: float = 18000.0
    facing_pattern: str = "alternating"  # alternating | east | west | north | south
    prefix: str = ""


@router.post("/bulk-generate-plots")
async def bulk_generate_plots(body: BulkPlotGen, user=Depends(require_admin)):
    try:
        pid = ObjectId(body.project_id)
    except Exception:
        raise HTTPException(400, "Invalid project ID")

    project = await db.projects.find_one({"_id": pid})
    if not project:
        raise HTTPException(404, "Project not found")

    plots = []
    facings = ["East", "West", "North", "South"]

    for i in range(body.total_plots):
        pnum = body.start_plot + i
        if body.facing_pattern == "alternating":
            facing = facings[i % 2]  # East / West alternating
        elif body.facing_pattern == "east":
            facing = "East"
        elif body.facing_pattern == "west":
            facing = "West"
        elif body.facing_pattern == "north":
            facing = "North"
        else:
            facing = "South"

        rate = body.default_rate or project.get("price", 18000.0)
        size = body.default_size_sqyd
        total_price = size * rate

        p_str = f"{body.prefix}{pnum}" if body.prefix else str(pnum)
        plots.append({
            "plot_number": p_str,
            "size_sqyd": size,
            "facing": facing,
            "rate_per_sqyd": rate,
            "total_price": total_price,
            "status": "available",
            "is_corner": (pnum % 10 == 0 or pnum % 10 == 1),
        })

    # Update project with new plot count and generated plots
    await db.projects.update_one(
        {"_id": pid},
        {
            "$set": {
                "total_plots": len(plots),
                "available_plots": len(plots),
                "booked_plots": 0,
                "sold_plots": 0,
                "custom_plots": plots,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    return {
        "ok": True,
        "message": f"Successfully generated {len(plots)} plots for project {project['name']}",
        "total_plots": len(plots),
    }


class ResetRequest(BaseModel):
    mode: str  # "transactions_only" | "full_reset"
    confirm_phrase: str


@router.post("/reset-data")
async def reset_data(body: ResetRequest, user=Depends(require_admin)):
    if body.confirm_phrase != "CONFIRM_RESET":
        raise HTTPException(400, "Invalid confirmation phrase. Type 'CONFIRM_RESET' to proceed.")

    if body.mode == "transactions_only":
        # Delete demo transactions but keep projects, agents, and teams
        await db.sales.delete_many({})
        await db.payments.delete_many({})
        await db.expenses.delete_many({})
        await db.salary.delete_many({})
        await db.leads.delete_many({})

        # Reset all project plot counters
        async for p in db.projects.find({}):
            tot = p.get("total_plots", 0)
            custom_plots = p.get("custom_plots", [])
            for c in custom_plots:
                c["status"] = "available"
            await db.projects.update_one(
                {"_id": p["_id"]},
                {
                    "$set": {
                        "available_plots": tot,
                        "booked_plots": 0,
                        "sold_plots": 0,
                        "custom_plots": custom_plots,
                    }
                }
            )

        return {
            "ok": True,
            "message": "Demo transactions (sales, payments, leads, expenses, salary) successfully cleared. Projects and Agent directory preserved.",
        }

    elif body.mode == "full_reset":
        # Keep only admin users
        await db.sales.delete_many({})
        await db.payments.delete_many({})
        await db.expenses.delete_many({})
        await db.salary.delete_many({})
        await db.leads.delete_many({})
        await db.projects.delete_many({})
        await db.agents.delete_many({})
        await db.teams.delete_many({})
        await db.commission_rules.delete_many({})
        # Delete non-admin users
        await db.users.delete_many({"role": {"$ne": "admin"}})

        return {
            "ok": True,
            "message": "Full database reset complete. All mock data cleared. Ready for fresh company setup.",
        }

    raise HTTPException(400, "Invalid reset mode")
