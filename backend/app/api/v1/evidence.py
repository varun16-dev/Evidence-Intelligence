from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from backend.app.core.sufficiency_engine import (
    EvidenceSufficiencyEngine, SufficiencyVerdictOutput
)

router = APIRouter(prefix="/evaluate", tags=["Evidence Evaluation"])

class EvaluateSufficiencyRequest(BaseModel):
    camera_trust: float = Field(..., ge=0.0, le=1.0)
    observability: float = Field(..., ge=0.0, le=1.0)
    detection_quality: float = Field(..., ge=0.0, le=1.0)
    temporal_persistence: float = Field(..., ge=0.0, le=1.0)
    scene_stability: float = Field(..., ge=0.0, le=1.0)
    record_agreement: float = Field(..., ge=0.0, le=1.0)
    anti_spoof: float = Field(..., ge=0.0, le=1.0)
    hard_veto_reason: Optional[str] = None

engine = EvidenceSufficiencyEngine()

@router.post("/sufficiency", response_model=SufficiencyVerdictOutput)
async def evaluate_sufficiency(req: EvaluateSufficiencyRequest):
    """
    Evaluates evidentiary sufficiency across the 7 dimensions.
    Returns deterministic VERIFIED, REVIEW, or ABSTAIN with complete reasons.
    Every decision and reason is durably stored in the engine's audit history.
    """
    verdict = engine.evaluate(
        camera_trust=req.camera_trust,
        observability=req.observability,
        detection_quality=req.detection_quality,
        temporal_persistence=req.temporal_persistence,
        scene_stability=req.scene_stability,
        record_agreement=req.record_agreement,
        anti_spoof=req.anti_spoof,
        hard_veto_reason=req.hard_veto_reason
    )
    return verdict

@router.get("/history")
async def get_sufficiency_history(limit: int = 50):
    """
    Retrieves the chronological audit ledger of evaluated decisions with reasons.
    """
    return engine.get_decision_history(limit=limit)

@router.get("/history/{evaluation_id}")
async def get_sufficiency_evaluation(evaluation_id: str):
    """
    Retrieves a specific evaluation record and its causal reasons by evaluation_id.
    """
    record = engine.get_decision(evaluation_id)
    if not record:
        raise HTTPException(status_code=404, detail="Evaluation record not found")
    return record
