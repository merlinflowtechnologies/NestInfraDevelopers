from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import client, db
from auth import auth_router, seed_admin
from routers.masters import router as masters_router
from routers.transactions import router as transactions_router
from routers.insights import router as insights_router
from routers.uploads import router as uploads_router
from seed import seed_sample_data

app = FastAPI(title="Nest Infra CRM")

for r in (auth_router, masters_router, transactions_router, insights_router, uploads_router):
    app.include_router(r)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("agent_code")
    await db.login_attempts.create_index("identifier")
    await db.agents.create_index("agent_code", unique=True)
    await db.sales.create_index([("project_id", 1), ("plot_number", 1)])
    await db.sales.create_index("month")
    await db.payments.create_index("month")
    await db.expenses.create_index("month")
    await db.salary.create_index("month")
    await seed_admin()
    await seed_sample_data()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
