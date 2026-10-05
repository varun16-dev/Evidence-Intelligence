from pydantic import BaseModel, Field
from typing import List, Dict, Tuple, Optional
from datetime import datetime

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def ground_point(self) -> Tuple[float, float]:
        """Calculates bottom-center contact point of the bounding box"""
        return ((self.x1 + self.x2) / 2.0, self.y2)

class DetectionItem(BaseModel):
    track_id: Optional[int] = None
    class_id: int
    class_name: str
    confidence: float
    bbox: BoundingBox
    ground_point: Tuple[float, float]
    assigned_zone: Optional[str] = None

class TrackletRecord(BaseModel):
    track_id: int
    class_name: str
    status: str # UNCONFIRMED, OBSERVED, PERSISTING, SUFFICIENT, LOST_OCCLUDED, TRANSIENT
    first_seen_timestamp: float
    last_seen_timestamp: float
    dwell_seconds: float
    total_frames_seen: int
    lost_frames_count: int
    is_persistent_trainee: bool
    current_zone: Optional[str] = None
    last_ground_point: Tuple[float, float]

class FrameMetadata(BaseModel):
    frame_index: int
    timestamp: float
    iso_timestamp: str
    resolution: Tuple[int, int]
    cadence_fps: float

class DetectionQualityMetrics(BaseModel):
    mean_confidence: float
    min_confidence: float
    detection_count: int
    box_geometry_penalty: float
    quality_score: float # 0.0 to 1.0

class TemporalPersistenceMetrics(BaseModel):
    window_duration_seconds: float
    active_tracklets_total: int
    verified_trainee_headcount: int # Count of tracklets >= dwell_threshold in student zone
    transient_loiterer_count: int # Count of tracklets < dwell_threshold
    mean_trainee_dwell_seconds: float
    dwell_threshold_seconds: float
    persistence_ratio: float # (verified / total_active)
    stability_score: float # 0.0 to 1.0

class EquipmentAuditItem(BaseModel):
    class_name: str # e.g. "tv" (monitors), "chair", "laptop"
    count: int
    zone: str

from backend.app.core.sensor_trust import CameraTrustMetrics

class StructuredEvidenceFeatures(BaseModel):
    """
    Standardized evidentiary contract produced by the Edge AI Perception Pipeline.
    Directly feeds into the Evidence Sufficiency Engine in Phase 3.
    """
    frame_meta: FrameMetadata
    active_detections: List[DetectionItem]
    active_tracklets: List[TrackletRecord]
    observed_equipment: List[EquipmentAuditItem]
    detection_quality: DetectionQualityMetrics
    temporal_persistence: TemporalPersistenceMetrics
    zone_occupancy: Dict[str, int]
    is_scene_stable: bool
    camera_trust: Optional[CameraTrustMetrics] = None

