from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.logging_config import logger
from backend.app.db.init_db import init_db
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.centres import router as centres_router
from backend.app.api.v1.cameras import router as cameras_router
from backend.app.api.v1.evidence import router as evidence_router
from backend.app.api.v1.passports import router as passports_router
from backend.app.api.v1.governance import router as governance_router
from backend.app.api.v1.evidence_vault import router as evidence_vault_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} in [{settings.APP_ENV}] mode...")
    try:
        await init_db()
    except Exception as e:
        logger.error(f"Error initializing database during startup: {e}")
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SIH26245: AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(centres_router, prefix=settings.API_V1_PREFIX)
app.include_router(cameras_router, prefix=settings.API_V1_PREFIX)
app.include_router(evidence_router, prefix=settings.API_V1_PREFIX)
app.include_router(passports_router, prefix=settings.API_V1_PREFIX)
app.include_router(governance_router, prefix=settings.API_V1_PREFIX)
app.include_router(evidence_vault_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "problem_statement": "SIH26245",
        "title": "AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance",
        "phases_active": [
            "Phase 1 - Foundational Backend & Management",
            "Phase 2 - Edge AI Perception Pipeline",
            "Phase 3 - Evidence Sufficiency Engine",
            "Phase 4 - Evidence Passport & Cryptographic Audit Trail",
            "Phase 5 - Human Governance & Adjudication Queue"
        ],
        "docs_url": "/docs",
        "governance_queue_url": f"{settings.API_V1_PREFIX}/governance/review-queue",
        "health_url": f"{settings.API_V1_PREFIX}/health"
    }
