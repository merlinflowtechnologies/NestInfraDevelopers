import os
from pathlib import Path
from datetime import datetime, timezone

from database import db
from routers.masters import ensure_agent_user
from routers.transactions import create_sale_record

IMG1 = "https://images.unsplash.com/photo-1774697443203-0f54409d1613?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxhZXJpYWwlMjB2aWV3JTIwcmVzaWRlbnRpYWwlMjBwbG90cyUyMGxheW91dCUyMGluZGlhfGVufDB8fHx8MTc4NzIxMDcwOHww&ixlib=rb-4.1.0&q=85"
IMG2 = "https://images.pexels.com/photos/31737842/pexels-photo-31737842.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
IMG3 = "https://images.unsplash.com/photo-1589473933604-5c3aa659adc0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxhZXJpYWwlMjB2aWV3JTIwcmVzaWRlbnRpYWwlMjBwbG90cyUyMGxheW91dCUyMGluZGlhfGVufDB8fHx8MTc4NzIxMDcwOHww&ixlib=rb-4.1.0&q=85"

AGENTS = [
    ("NIA001", "Rajesh Kumar", "9848011001", "Team Leader", "2023-04-10"),
    ("NIA002", "Priya Sharma", "9848011002", "Senior Sales Executive", "2023-06-15"),
    ("NIA003", "Arun Reddy", "9848011003", "Sales Executive", "2024-01-05"),
    ("NIA004", "Suresh Babu", "9848011004", "Team Leader", "2022-11-20"),
    ("NIA005", "Divya Nair", "9848011005", "Senior Sales Executive", "2023-08-01"),
    ("NIA006", "Kiran Patel", "9848011006", "Sales Executive", "2024-03-12"),
    ("NIA007", "Anitha Rao", "9848011007", "Team Leader", "2023-02-14"),
    ("NIA008", "Vikram Singh", "9848011008", "Sales Executive", "2024-07-22"),
    ("NIA009", "Meena Iyer", "9848011009", "Sales Executive", "2025-01-08"),
]

BASIC_BY_DESIG = {"Team Leader": 45000, "Senior Sales Executive": 30000, "Sales Executive": 22000}


def month_key(offset: int) -> str:
    now = datetime.now(timezone.utc)
    m, y = now.month - offset, now.year
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


async def seed_sample_data():
    if await db.projects.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    M0, M1, M2, M3 = month_key(0), month_key(1), month_key(2), month_key(3)

    projects = [
        {"name": "Nest Green Valley", "location": "Kompally, Hyderabad", "project_type": "Open Plots",
         "price": 18000, "plot_sizes": "167, 200, 267 sq.yds", "total_plots": 120,
         "images": [IMG1], "map_url": "https://maps.google.com/?q=Kompally,Hyderabad",
         "description": "HMDA approved open plots near Kompally with 40ft roads, avenue plantation, park and underground drainage."},
        {"name": "Nest Lake View Enclave", "location": "Shamshabad, Hyderabad", "project_type": "Gated Community Plots",
         "price": 22000, "plot_sizes": "200, 267, 300 sq.yds", "total_plots": 100,
         "images": [IMG2], "map_url": "https://maps.google.com/?q=Shamshabad,Hyderabad",
         "description": "Premium gated community villa plots near the airport with clubhouse, compound wall and 24x7 security."},
        {"name": "Nest Sunrise County", "location": "Yadadri, Telangana", "project_type": "Villa Plots",
         "price": 15000, "plot_sizes": "150, 183, 240 sq.yds", "total_plots": 80,
         "images": [IMG3], "map_url": "https://maps.google.com/?q=Yadadri,Telangana",
         "description": "DTCP approved villa plots close to Yadadri temple town. High appreciation corridor with clear titles."},
    ]
    pids = []
    for p in projects:
        p.update({"available_plots": p["total_plots"], "booked_plots": 0, "sold_plots": 0, "created_at": now})
        res = await db.projects.insert_one(p)
        pids.append(str(res.inserted_id))

    teams = [
        {"name": "Falcons", "leader_code": "NIA001", "monthly_target": 5000000, "created_at": now},
        {"name": "Titans", "leader_code": "NIA004", "monthly_target": 4000000, "created_at": now},
        {"name": "Strikers", "leader_code": "NIA007", "monthly_target": 3000000, "created_at": now},
    ]
    tids = []
    for t in teams:
        res = await db.teams.insert_one(t)
        tids.append(str(res.inserted_id))

    for idx, (code, name, mobile, desig, joining) in enumerate(AGENTS):
        await db.agents.insert_one({
            "agent_code": code, "name": name, "mobile": mobile, "team_id": tids[idx // 3],
            "designation": desig, "joining_date": joining, "commission_plan": "Standard 2%",
            "status": "active", "created_at": now,
        })
        await ensure_agent_user(code, name)

    await db.commission_rules.insert_many([
        {"name": "Agent Commission 2%", "level": "agent", "rule_type": "percentage", "value": 2,
         "basis": "sale_value", "project_id": "", "active": True, "created_at": now},
        {"name": "Team Leader 0.5%", "level": "team_leader", "rule_type": "percentage", "value": 0.5,
         "basis": "sale_value", "project_id": "", "active": True, "created_at": now},
        {"name": "Green Valley Special Bonus", "level": "project", "rule_type": "fixed", "value": 10000,
         "basis": "sale_value", "project_id": pids[0], "active": True, "created_at": now},
    ])

    customers = [
        ("Ramesh Chandra", "9901002001"), ("Sunitha Verma", "9901002002"), ("Abdul Kareem", "9901002003"),
        ("Lakshmi Prasad", "9901002004"), ("Naveen Goud", "9901002005"), ("Fatima Sheikh", "9901002006"),
        ("Srinivas Rao", "9901002007"), ("Pooja Reddy", "9901002008"), ("Manoj Kumar", "9901002009"),
        ("Kavitha Devi", "9901002010"), ("Imran Ali", "9901002011"), ("Shalini Gupta", "9901002012"),
        ("Harish Chandra", "9901002013"), ("Swapna Rani", "9901002014"),
    ]
    # (date, project_idx, plot, agent_idx, sale_amount, booking, collected, status)
    sales_seed = [
        (f"{M3}-05", 0, "GV-101", 0, 3600000, 500000, 2400000, "booked"),
        (f"{M3}-12", 1, "LV-045", 3, 4400000, 500000, 4400000, "sold"),
        (f"{M3}-20", 2, "SC-012", 6, 2745000, 300000, 1500000, "booked"),
        (f"{M2}-02", 0, "GV-102", 1, 3006000, 400000, 1800000, "booked"),
        (f"{M2}-15", 1, "LV-046", 4, 5874000, 600000, 5874000, "sold"),
        (f"{M2}-22", 2, "SC-013", 7, 2250000, 250000, 2250000, "sold"),
        (f"{M1}-06", 0, "GV-115", 2, 3600000, 500000, 2000000, "booked"),
        (f"{M1}-14", 1, "LV-060", 5, 4400000, 500000, 2600000, "booked"),
        (f"{M1}-25", 2, "SC-020", 8, 3600000, 400000, 3600000, "sold"),
        (f"{M0}-03", 0, "GV-120", 0, 4806000, 500000, 1000000, "booked"),
        (f"{M0}-08", 1, "LV-071", 3, 6600000, 700000, 1400000, "booked"),
        (f"{M0}-12", 0, "GV-118", 1, 3006000, 400000, 800000, "booked"),
        (f"{M0}-16", 2, "SC-031", 6, 2745000, 300000, 2745000, "sold"),
        (f"{M0}-19", 1, "LV-075", 4, 4400000, 500000, 500000, "booked"),
    ]
    for i, (date, pi, plot, ai, amt, book, coll, status) in enumerate(sales_seed):
        cname, cmobile = customers[i]
        await create_sale_record({
            "date": date, "project_id": pids[pi], "plot_number": plot,
            "customer_name": cname, "customer_mobile": cmobile,
            "agent_code": AGENTS[ai][0], "team_id": "", "sale_amount": amt,
            "booking_amount": book, "amount_collected": coll, "status": status,
        }, created_by="seed")

    # salaries: last month paid, current month pending
    for month, paid in ((M1, True), (M0, False)):
        for code, name, _, desig, _ in AGENTS:
            basic = BASIC_BY_DESIG[desig]
            bonus = 5000 if desig == "Team Leader" else 0
            await db.salary.insert_one({
                "month": month, "employee": name, "agent_code": code, "designation": desig,
                "basic": basic, "bonus": bonus, "deduction": 0, "net": basic + bonus,
                "payment_status": "paid" if paid else "pending",
                "payment_date": f"{M0}-05" if paid else "",
                "created_at": now,
            })

    expenses = [
        (f"{M3}-01", "Office Rent", "Head office rent", "", 60000, "Bank Transfer", "Admin"),
        (f"{M3}-08", "Google Ads", "Search ads - Green Valley", "Nest Green Valley", 45000, "UPI", "Marketing"),
        (f"{M3}-15", "Meta Ads", "FB/Insta lead gen", "", 38000, "UPI", "Marketing"),
        (f"{M3}-20", "Fuel", "Site visit vehicles", "", 12000, "Cash", "Rajesh Kumar"),
        (f"{M2}-01", "Office Rent", "Head office rent", "", 60000, "Bank Transfer", "Admin"),
        (f"{M2}-09", "Meta Ads", "Lead generation", "", 42000, "UPI", "Marketing"),
        (f"{M2}-12", "Electricity", "Office electricity bill", "", 8500, "UPI", "Admin"),
        (f"{M2}-18", "Travel", "Yadadri site team travel", "Nest Sunrise County", 15000, "Cash", "Suresh Babu"),
        (f"{M1}-01", "Office Rent", "Head office rent", "", 60000, "Bank Transfer", "Admin"),
        (f"{M1}-07", "Google Ads", "Search ads - Lake View", "Nest Lake View Enclave", 48000, "UPI", "Marketing"),
        (f"{M1}-16", "Printing", "Brochures and banners", "", 9500, "Cash", "Admin"),
        (f"{M1}-21", "Fuel", "Site visit vehicles", "", 11000, "Cash", "Arun Reddy"),
        (f"{M0}-01", "Office Rent", "Head office rent", "", 60000, "Bank Transfer", "Admin"),
        (f"{M0}-05", "Google Ads", "Search ads - Lake View", "Nest Lake View Enclave", 50000, "UPI", "Marketing"),
        (f"{M0}-10", "Printing", "Brochures and banners", "", 9500, "Cash", "Admin"),
        (f"{M0}-14", "Internet", "Office broadband", "", 3500, "UPI", "Admin"),
        (f"{M0}-17", "Meta Ads", "Weekend campaign", "", 25000, "UPI", "Marketing"),
    ]
    for date, cat, desc, proj, amt, mode, paid_by in expenses:
        pid, pname = "", ""
        if proj:
            p = await db.projects.find_one({"name": proj})
            if p:
                pid, pname = str(p["_id"]), p["name"]
        await db.expenses.insert_one({
            "date": date, "month": date[:7], "category": cat, "description": desc,
            "project_id": pid, "project_name": pname, "amount": amt, "mode": mode,
            "paid_by": paid_by, "created_at": now,
        })

    # Seed sample leads if empty
    if await db.leads.count_documents({}) == 0:
        p1 = await db.projects.find_one({"name": "Nest Green Valley"})
        p2 = await db.projects.find_one({"name": "Nest Lake View Enclave"})
        sample_leads = [
            {
                "name": "Karthik Varma", "mobile": "9848099001", "email": "karthik.v@gmail.com",
                "project_id": str(p1["_id"]) if p1 else "", "project_name": p1["name"] if p1 else "",
                "budget": 3500000, "preferred_plot_size": "200 sq.yds", "source": "Website",
                "status": "site_visit_scheduled", "assigned_agent_code": "NIA001", "assigned_agent_name": "Rajesh Kumar",
                "notes": "Looking for East facing plot near Kompally. Weekend visit requested.",
                "created_at": now, "updated_at": now,
                "site_visits": [
                    {"id": "v1", "visit_date": f"{M0}-15 10:30 AM", "assigned_agent": "Rajesh Kumar", "notes": "Pickup arranged from Suchitra junction.", "status": "scheduled", "created_at": now}
                ]
            },
            {
                "name": "Srinivas Rao", "mobile": "9848099002", "email": "srinivas.rao@yahoo.com",
                "project_id": str(p2["_id"]) if p2 else "", "project_name": p2["name"] if p2 else "",
                "budget": 4500000, "preferred_plot_size": "267 sq.yds", "source": "Meta Ads",
                "status": "negotiation", "assigned_agent_code": "NIA002", "assigned_agent_name": "Priya Sharma",
                "notes": "Completed site visit last Sunday. Liked plot #45. Discussing payment milestones.",
                "created_at": now, "updated_at": now,
                "site_visits": [
                    {"id": "v2", "visit_date": f"{M0}-08 03:00 PM", "assigned_agent": "Priya Sharma", "notes": "Customer visited with family. Very positive response.", "status": "completed", "created_at": now}
                ]
            },
            {
                "name": "Madhav Reddy", "mobile": "9848099003", "email": "madhav.r@outlook.com",
                "project_id": str(p1["_id"]) if p1 else "", "project_name": p1["name"] if p1 else "",
                "budget": 3000000, "preferred_plot_size": "167 sq.yds", "source": "Direct Walk-in",
                "status": "contacted", "assigned_agent_code": "NIA003", "assigned_agent_name": "Arun Reddy",
                "notes": "Shared layout map and pricing sheet on WhatsApp.",
                "created_at": now, "updated_at": now, "site_visits": []
            },
            {
                "name": "Venkatesh Naidu", "mobile": "9848099004", "email": "v.naidu@gmail.com",
                "project_id": str(p2["_id"]) if p2 else "", "project_name": p2["name"] if p2 else "",
                "budget": 5000000, "preferred_plot_size": "300 sq.yds", "source": "Channel Partner",
                "status": "new", "assigned_agent_code": "NIA001", "assigned_agent_name": "Rajesh Kumar",
                "notes": "NRI buyer looking for investment plot near Shamshabad.",
                "created_at": now, "updated_at": now, "site_visits": []
            }
        ]
        await db.leads.insert_many(sample_leads)

    creds = (
        "# Test Credentials\n\n"
        "## Admin\n"
        f"- Email: {os.environ.get('ADMIN_EMAIL')}\n"
        f"- Password: {os.environ.get('ADMIN_PASSWORD')}\n"
        "- Role: admin\n\n"
        "## Agent (sample)\n"
        "- Login ID: NIA001\n- Password: nest@123\n- Role: agent (Rajesh Kumar, Team Leader - Falcons)\n\n"
        "All seeded agents (NIA001-NIA009) use password: nest@123\n\n"
        "## Auth endpoints\n"
        "- POST /api/auth/login  {identifier, password}\n"
        "- GET /api/auth/me\n"
        "- POST /api/auth/logout\n"
        "- POST /api/auth/change-password\n"
    )
    try:
        mem_dir = Path(__file__).resolve().parent.parent / "memory"
        mem_dir.mkdir(parents=True, exist_ok=True)
        with open(mem_dir / "test_credentials.md", "w") as fh:
            fh.write(creds)
    except Exception:
        pass
