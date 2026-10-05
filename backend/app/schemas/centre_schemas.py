from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class RoomBase(BaseModel):
    room_id: str
    room_name: str
    room_type: str = "IT_LAB" # CLASSROOM, IT_LAB, VOCATIONAL_WORKSHOP
    seating_capacity: int = 25
    camera_id: str
    rtsp_stream_uri: str
    zones_geojson: Dict[str, Any] = Field(default_factory=dict)

class RoomCreate(RoomBase):
    pass

class RoomResponse(RoomBase):
    centre_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ZoneUpdate(BaseModel):
    zones_geojson: Dict[str, Any]

class TrainingCentreBase(BaseModel):
    centre_id: str
    centre_name: str
    state: str
    district: str
    accredited_trades: List[str] = Field(default_factory=list)

class TrainingCentreCreate(TrainingCentreBase):
    pass

class TrainingCentreResponse(TrainingCentreBase):
    is_active: bool
    created_at: datetime
    rooms: Optional[List[RoomResponse]] = []

    class Config:
        from_attributes = True

class AnalyzeClipRequest(BaseModel):
    clip_filename: str = Field(..., description="Allowlisted video clip filename from backend/test_videos")
    max_frames: Optional[int] = Field(default=90, ge=10, le=300, description="Max frames to process")
    sample_fps: Optional[float] = Field(default=3.0, ge=0.5, le=10.0, description="Sampling rate in FPS")
    expected_headcount: Optional[int] = Field(default=None, ge=0, le=100, description="Expected headcount for schedule agreement")

class ClipAnalysisResponse(BaseModel):
    analysis_id: str
    camera_id: str
    room_id: str
    centre_id: str
    source_type: str = "TEST_VIDEO"
    clip_filename: str
    frames_processed: int
    tracks_detected: int
    verified_trainees: int
    transient_loiterers: int
    evidence_score: float
    verdict: str
    reasons: List[str]
    passport_id: str
    keyframe_available: bool
    image_sha256: str
    raw_keyframe_uri: str
    annotated_keyframe_uri: str
    processing_status: str
    processing_duration_seconds: float
    contributing_factors: Dict[str, Any]

