import time
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import client, db
from auth import auth_router, seed_admin
from routers.masters import router as masters_router
from routers.transactions import router as transactions_router
from routers.insights import router as insights_router
from routers.uploads import router as uploads_router
from routers.leads import router as leads_router
from routers.admin_settings import router as admin_settings_router
from seed import seed_sample_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nest_crm")

app = FastAPI(
    title="Nest Infra CRM",
    description="Commercial Real Estate & Infrastructure Management System API",
    version="1.0.0",
)

# Request Timing & Performance Middleware
@app.middleware("http")
async def add_process_time_and_logging(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    if request.url.path not in ("/api/health", "/docs", "/openapi.json"):
        logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({process_time:.4f}s)")
    return response

# Standardized Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    logger.error(f"Unhandled Exception on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )

for r in (auth_router, masters_router, transactions_router, insights_router, uploads_router, leads_router, admin_settings_router):
    app.include_router(r)

cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=r"https://.*\.nestinfradevelopers\.in|https://.*\.vercel\.app|http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = datetime.now(timezone.utc)

@app.get("/api/health", tags=["system"])
async def health_check():
    db_status = "healthy"
    try:
        await client.admin.command("ping")
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    uptime_seconds = int((datetime.now(timezone.utc) - START_TIME).total_seconds())
    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "service": "Nest Infra CRM Backend",
        "version": "1.0.0",
        "database": db_status,
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


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
    await db.leads.create_index("status")
    await db.leads.create_index("assigned_agent_code")
    await seed_admin()
    logger.info("Application startup and database indexes initialized successfully.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Database connection closed gracefully.")

