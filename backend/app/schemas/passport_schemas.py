from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.app.core.sufficiency_engine import ContributingFactors, SufficiencyVerdictOutput

class GeneratePassportRequest(BaseModel):
    centre_id: str
    room_id: str
    camera_id: str
    event_type: str = "CLASSROOM_SESSION_ATTENDANCE"
    compliance_finding: str = "Attendance compliance evaluation"
    verdict: SufficiencyVerdictOutput
    raw_keyframe_b64: Optional[str] = None
    raw_keyframe_uri: Optional[str] = None
    annotated_keyframe_uri: Optional[str] = None
    evidence_features: Optional[Dict[str, Any]] = None


class AdjudicatePassportRequest(BaseModel):
    officer_id: Optional[str] = Field(None, description="Derived automatically from JWT authentication")
    review_status: str # CONFIRMED, DISMISSED, INSPECTION_MANDATED
    officer_remarks: str

class AuditTrailResponse(BaseModel):
    audit_id: int
    passport_id: str
    step_sequence: int
    actor_id: str
    actor_role: str
    action_performed: str
    notes: Optional[str] = None
    client_ip_or_host: Optional[str] = None
    timestamp: datetime
    signed_hash: str

    class Config:
        from_attributes = True

class GovernanceActionRequest(BaseModel):
    reviewer: Optional[str] = Field(None, description="Derived automatically from JWT authentication")
    reviewer_username: Optional[str] = Field(None, description="Derived automatically from JWT authentication")
    action: str = Field(..., description="Must be CONFIRM, REJECT, or REQUEST INSPECTION")
    reason: str = Field(..., min_length=3, description="Justification for the governance action")

class DecisionHistoryItem(BaseModel):
    step: int
    reviewer: Optional[str] = None
    actor: str
    role: str
    action: str
    previous_decision: Optional[str] = None
    new_decision: str
    reason: str
    timestamp: str
    original_ai_verdict: Optional[str] = None
    evidence_score: Optional[float] = None

class ReviewQueueStats(BaseModel):
    total_in_queue: int
    pending_review_count: int
    pending_abstain_count: int
    adjudicated_count: int

class EvidencePassportResponse(BaseModel):
    passport_id: str
    event_id: str
    centre_id: str
    room_id: str
    camera_id: str
    timestamp: datetime
    event_type: str
    final_evidence_score: float
    verdict: str # Permanent original AI decision (NEVER OVERWRITTEN)
    compliance_finding: str
    reasons_for_decision: List[str]
    contributing_factors: Optional[Dict[str, Any]] = None
    camera_trust: Optional[Dict[str, Any]] = None
    observability: Optional[Dict[str, Any]] = None
    detection_quality: Optional[Dict[str, Any]] = None
    temporal_evidence: Optional[Dict[str, Any]] = None
    scene_stability: Optional[Dict[str, Any]] = None
    record_agreement: Optional[Dict[str, Any]] = None
    anti_spoof_signals: Optional[Dict[str, Any]] = None
    detection_summary: Optional[Dict[str, Any]] = None
    raw_keyframe_uri: str
    annotated_keyframe_uri: str
    review_status: str
    governance_decision: Optional[str] = None
    decision_history: List[Dict[str, Any]] = []
    assigned_officer_id: Optional[str] = None
    adjudicated_at: Optional[datetime] = None
    officer_remarks: Optional[str] = None
    image_sha256: str
    metadata_sha256: str
    evidence_combined_hash: str
    event_signature: str
    signing_key_id: str
    created_at: datetime
    audit_logs: List[AuditTrailResponse] = []

    class Config:
        from_attributes = True

class ReviewQueueResponse(BaseModel):
    stats: ReviewQueueStats
    items: List[EvidencePassportResponse]

