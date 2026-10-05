from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from backend.app.db.session import get_db
from backend.app.db.models import User
from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.core.passport_service import passport_service
from backend.app.schemas.passport_schemas import (
    EvidencePassportResponse,
    GovernanceActionRequest,
    ReviewQueueResponse,
    ReviewQueueStats
)

router = APIRouter(prefix="/governance", tags=["Human Governance & Review Queue"])

@router.get("/review-queue", response_model=ReviewQueueResponse)
async def get_review_queue(
    verdict: Optional[str] = Query(None, description="Filter by AI verdict: REVIEW, ABSTAIN, or ALL"),
    status: Optional[str] = Query("PENDING", description="Filter by status: PENDING, ADJUDICATED, or ALL"),
    centre_id: Optional[str] = Query(None, description="Filter by Training Centre ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the Human Governance Review Queue containing REVIEW and ABSTAIN cases
    where human intervention is required, along with aggregate triage statistics.
    """
    try:
        stats, items = await passport_service.get_review_queue(
            db=db,
            verdict=verdict,
            status=status,
            centre_id=centre_id,
            limit=limit,
            offset=offset
        )
        return ReviewQueueResponse(
            stats=ReviewQueueStats(**stats),
            items=items
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch review queue: {str(e)}")

@router.get("/stats", response_model=ReviewQueueStats)
async def get_governance_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns high-level triage statistics for the human review queue.
    """
    try:
        stats, _ = await passport_service.get_review_queue(db=db, limit=1)
        return ReviewQueueStats(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate governance stats: {str(e)}")

@router.get("/passports/{passport_id}", response_model=EvidencePassportResponse)
async def inspect_passport_for_review(
    passport_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Provides the complete Evidence Passport for officer inspection before making a governance decision.
    Inspectable evidence components:
    - Original AI verdict (immutable) and evidence score
    - Multi-factor contributing scores (camera trust, observability, detection quality, temporal, etc.)
    - Visual keyframes (raw and annotated)
    - Complete decision history timeline
    - Cryptographic verification signatures
    """
    passport = await passport_service.get_passport(db, passport_id)
    if not passport:
        raise HTTPException(status_code=404, detail=f"Evidence Passport {passport_id} not found")
    return passport

@router.post("/passports/{passport_id}/action", response_model=EvidencePassportResponse)
async def execute_governance_action(
    passport_id: str,
    req: GovernanceActionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["OFFICER"]))
):
    """
    Executes a formal Human Governance decision on a compliance event.
    Permitted Reviewer Actions:
    - CONFIRM: Confirms compliance finding/breach
    - REJECT: Rejects the compliance finding
    - REQUEST INSPECTION: Mandates physical on-site vigilance inspection

    Guarantees:
    - Reviewer identity is derived EXCLUSIVELY from current_user.username (JWT claim)
    - Client-supplied reviewer fields are completely ignored to prevent impersonation
    - The original AI decision (`passport.verdict`) is NEVER overwritten
    - Complete decision history is preserved in chronological order
    - Appends a cryptographically chained entry in the audit ledger
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    # Reviewer identity derived strictly from authenticated token
    authenticated_reviewer = current_user.username
    try:
        updated_passport = await passport_service.execute_governance_action(
            db=db,
            passport_id=passport_id,
            reviewer=authenticated_reviewer,
            action=req.action,
            reason=req.reason,
            client_ip=client_ip
        )
        return updated_passport
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute governance action: {str(e)}")
