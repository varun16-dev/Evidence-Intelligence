from typing import Dict, List, Tuple, Optional
from collections import deque
import numpy as np
from backend.app.edge_ai.schemas import (
    DetectionItem, TrackletRecord, TemporalPersistenceMetrics
)
from backend.app.logging_config import logger

class TrackletInternalState:
    def __init__(self, track_id: int, class_name: str, first_timestamp: float, ground_point: Tuple[float, float], zone: Optional[str]):
        self.track_id = track_id
        self.class_name = class_name
        self.first_timestamp = first_timestamp
        self.last_timestamp = first_timestamp
        self.ground_point = ground_point
        self.zone = zone
        self.dwell_seconds = 0.0
        self.total_frames_seen = 1
        self.lost_frames_count = 0
        self.status = "UNCONFIRMED" # UNCONFIRMED, OBSERVED, PERSISTING, SUFFICIENT, LOST_OCCLUDED, TRANSIENT
        self.is_persistent_trainee = False

class TemporalValidator:
    """
    Temporal Persistence & State Transition Engine.
    Filters out transient passersby, tracks dwell durations,
    and manages Kalman occlusion grace buffers.
    """
    def __init__(
        self,
        target_zone: str = "student_zone",
        dwell_threshold_seconds: float = 15.0,
        max_occlusion_seconds: float = 5.0,
        sliding_window_seconds: float = 30.0
    ):
        self.target_zone = target_zone
        self.dwell_threshold = dwell_threshold_seconds
        self.max_occlusion_seconds = max_occlusion_seconds
        self.sliding_window_seconds = sliding_window_seconds

        self.active_tracks: Dict[int, TrackletInternalState] = {}
        self.recent_headcounts: deque = deque(maxlen=90) # ~30s at 3 FPS
        self.last_process_time: Optional[float] = None

    def update(
        self,
        current_timestamp: float,
        current_detections: List[DetectionItem]
    ) -> Tuple[List[TrackletRecord], TemporalPersistenceMetrics]:
        """
        Updates tracking history and transitions states for the current frame.
        """
        dt = 0.0
        if self.last_process_time is not None:
            dt = max(0.0, current_timestamp - self.last_process_time)
        self.last_process_time = current_timestamp

        # Collect incoming track IDs
        detected_track_ids = set()
        person_detections_by_id: Dict[int, DetectionItem] = {}

        for det in current_detections:
            if det.class_name == "person" and det.track_id is not None:
                detected_track_ids.add(det.track_id)
                person_detections_by_id[det.track_id] = det

        # 1. Update existing tracks and instantiate new ones
        for track_id, det in person_detections_by_id.items():
            if track_id in self.active_tracks:
                # Existing tracklet updated
                t = self.active_tracks[track_id]
                t.last_timestamp = current_timestamp
                t.ground_point = det.ground_point
                t.zone = det.assigned_zone
                t.total_frames_seen += 1
                t.lost_frames_count = 0
                if t.status == "LOST_OCCLUDED":
                    t.status = "RECOVERED"

                # Accumulate dwell only if inside the target compliance zone
                if t.zone == self.target_zone:
                    t.dwell_seconds += dt
            else:
                # New tracklet
                self.active_tracks[track_id] = TrackletInternalState(
                    track_id=track_id,
                    class_name=det.class_name,
                    first_timestamp=current_timestamp,
                    ground_point=det.ground_point,
                    zone=det.assigned_zone
                )

        # 2. Check for missing / occluded tracks
        for track_id, t in list(self.active_tracks.items()):
            if track_id not in detected_track_ids:
                t.lost_frames_count += 1
                lost_duration = current_timestamp - t.last_timestamp

                if lost_duration <= self.max_occlusion_seconds:
                    # In occlusion grace period: preserve track, freeze dwell timer
                    t.status = "LOST_OCCLUDED"
                else:
                    # Expired beyond occlusion buffer
                    if t.dwell_seconds < self.dwell_threshold:
                        t.status = "TRANSIENT"
                    del self.active_tracks[track_id]
                    continue

            # 3. State Machine Transitions for active tracks
            if t.status != "LOST_OCCLUDED":
                if t.total_frames_seen < 3:
                    t.status = "UNCONFIRMED"
                elif t.dwell_seconds < 5.0:
                    t.status = "OBSERVED"
                elif t.dwell_seconds < self.dwell_threshold:
                    t.status = "PERSISTING"
                else:
                    t.status = "SUFFICIENT"
                    t.is_persistent_trainee = True

        # 4. Compute Metrics
        verified_count = 0
        transient_count = 0
        trainee_dwells: List[float] = []

        tracklet_records: List[TrackletRecord] = []
        for t in self.active_tracks.values():
            if t.is_persistent_trainee and t.zone == self.target_zone:
                verified_count += 1
                trainee_dwells.append(t.dwell_seconds)
            else:
                transient_count += 1

            record = TrackletRecord(
                track_id=t.track_id,
                class_name=t.class_name,
                status=t.status,
                first_seen_timestamp=round(t.first_timestamp, 2),
                last_seen_timestamp=round(t.last_timestamp, 2),
                dwell_seconds=round(t.dwell_seconds, 1),
                total_frames_seen=t.total_frames_seen,
                lost_frames_count=t.lost_frames_count,
                is_persistent_trainee=t.is_persistent_trainee,
                current_zone=t.zone,
                last_ground_point=(round(t.ground_point[0], 1), round(t.ground_point[1], 1))
            )
            tracklet_records.append(record)

        # Update sliding window headcount stability
        self.recent_headcounts.append(verified_count)
        stability_score = 1.0
        if len(self.recent_headcounts) >= 10:
            std = float(np.std(self.recent_headcounts))
            stability_score = max(0.0, round(1.0 - min(1.0, std / 2.0), 3))

        mean_dwell = round(float(np.mean(trainee_dwells)), 1) if trainee_dwells else 0.0
        total_active = len(self.active_tracks)
        persistence_ratio = round(verified_count / max(1, total_active), 3)

        persistence_metrics = TemporalPersistenceMetrics(
            window_duration_seconds=self.sliding_window_seconds,
            active_tracklets_total=total_active,
            verified_trainee_headcount=verified_count,
            transient_loiterer_count=transient_count,
            mean_trainee_dwell_seconds=mean_dwell,
            dwell_threshold_seconds=self.dwell_threshold,
            persistence_ratio=persistence_ratio,
            stability_score=stability_score
        )

        return tracklet_records, persistence_metrics
