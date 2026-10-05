from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.db.models import User
from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.core.passport_service import passport_service
from backend.app.core.crypto_signer import VerificationResult
from backend.app.schemas.passport_schemas import (
    GeneratePassportRequest,
    EvidencePassportResponse,
    AdjudicatePassportRequest,
    AuditTrailResponse
)

router = APIRouter(prefix="/passports", tags=["Evidence Passports & Audit"])

@router.post("/generate", response_model=EvidencePassportResponse, status_code=201)
async def generate_passport(
    req: GeneratePassportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates an Evidence Passport when the Evidence Sufficiency Engine produces a decision.
    - Stores evidence features, decision, reasons, and timestamps
    - Generates SHA-256 evidence hashes and HMAC digital signature
    - Seals the record and logs the initial AuditTrail event with authenticated actor
    """
    try:
        passport = await passport_service.create_passport(
            db=db,
            req=req,
            actor_id=current_user.username,
            actor_role=current_user.role
        )
        return passport
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate passport: {str(e)}")

@router.get("", response_model=List[EvidencePassportResponse])
async def list_passports(
    centre_id: Optional[str] = Query(None, description="Filter by Training Centre ID"),
    verdict: Optional[str] = Query(None, description="Filter by verdict: VERIFIED, REVIEW, ABSTAIN"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists generated Evidence Passports with optional filtering and pagination.
    Requires authenticated user (ADMIN or OFFICER).
    """
    passports = await passport_service.list_passports(
        db, centre_id=centre_id, verdict=verdict, limit=limit, offset=offset
    )
    return passports

@router.get("/{passport_id}", response_model=EvidencePassportResponse)
async def get_passport(
    passport_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves full Evidence Passport details along with its complete, tamper-evident audit history.
    Requires authenticated user.
    """
    passport = await passport_service.get_passport(db, passport_id)
    if not passport:
        raise HTTPException(status_code=404, detail="Evidence Passport not found")
    return passport

@router.post("/{passport_id}/verify", response_model=VerificationResult)
async def verify_passport(
    passport_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographic Integrity Verification API.
    Demonstrates:
    Original evidence -> hash -> stored hash -> verification & detects modification.
    """
    try:
        res = await passport_service.verify_passport_integrity(db, passport_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

@router.post("/{passport_id}/adjudicate", response_model=EvidencePassportResponse)
async def adjudicate_passport(
    passport_id: str,
    req: AdjudicatePassportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["OFFICER"]))
):
    """
    Records human officer adjudication (CONFIRMED / DISMISSED / INSPECTION_MANDATED).
    Chains the officer's signature and action into the immutable audit trail.
    Officer ID is derived strictly from the authenticated JWT.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    authenticated_officer = current_user.username
    try:
        passport = await passport_service.adjudicate_passport(
            db=db,
            passport_id=passport_id,
            officer_id=authenticated_officer,
            review_status=req.review_status,
            officer_remarks=req.officer_remarks,
            client_ip=client_ip
        )
        return passport
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adjudication failed: {str(e)}")
