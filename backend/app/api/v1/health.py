from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.app.db.session import get_db
from backend.app.config import settings
from datetime import datetime, timezone

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "HEALTHY"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"UNHEALTHY: {str(e)}"

    return {
        "status": "ONLINE" if "UNHEALTHY" not in db_status else "DEGRADED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project": settings.PROJECT_NAME,
        "environment": settings.APP_ENV,
        "database": db_status
    }
