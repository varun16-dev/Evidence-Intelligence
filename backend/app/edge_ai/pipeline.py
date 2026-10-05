from typing import Dict, Any, Optional, Tuple
import cv2
import numpy as np
from backend.app.edge_ai.schemas import (
    StructuredEvidenceFeatures, FrameMetadata
)
from backend.app.edge_ai.perception import PerceptionEngine
from backend.app.edge_ai.zone_engine import ZoneEngine
from backend.app.edge_ai.temporal_validator import TemporalValidator
from backend.app.core.sensor_trust import SensorTrustEvaluator
from backend.app.logging_config import logger

class EdgeAIPipeline:
    """
    End-to-End Edge AI Perception & Temporal Validation Pipeline.
    
    Transforms:
    Raw Frame -> YOLO + ByteTrack -> Zone PIP -> Temporal Accumulator -> StructuredEvidenceFeatures
    """
    def __init__(
        self,
        zones_geojson: Dict[str, Any],
        model_name: str = "yolov8n.pt",
        target_zone: str = "student_zone",
        dwell_threshold_seconds: float = 15.0,
        max_occlusion_seconds: float = 5.0,
        resolution: Tuple[int, int] = (640, 480)
    ):
        self.resolution = resolution
        self.sensor_trust = SensorTrustEvaluator()
        self.perception = PerceptionEngine(model_name=model_name)
        self.zone_engine = ZoneEngine(zones_geojson=zones_geojson, frame_resolution=resolution)
        self.temporal_validator = TemporalValidator(
            target_zone=target_zone,
            dwell_threshold_seconds=dwell_threshold_seconds,
            max_occlusion_seconds=max_occlusion_seconds
        )
        self.prev_frame_gray: Optional[np.ndarray] = None
        logger.info("EdgeAIPipeline assembled and ready.")


    def update_zones(self, zones_geojson: Dict[str, Any]):
        self.zone_engine.update_resolution_and_zones(zones_geojson, self.resolution)

    def process_frame(
        self,
        frame: np.ndarray,
        meta: FrameMetadata
    ) -> StructuredEvidenceFeatures:
        """
        Executes perception, tracking, zone analysis, and temporal validation on a single frame.
        """
        # 1. Optical Integrity & Sensor Trust Evaluation
        camera_trust_metrics = self.sensor_trust.evaluate_frame(
            frame=frame,
            timestamp=meta.timestamp,
            target_fps=meta.cadence_fps
        )

        # 2. AI Perception (YOLO + ByteTrack)
        raw_detections, quality_metrics = self.perception.process_frame(frame)

        # 3. Zone Analysis (Point-in-Polygon on ground-contact points)
        zoned_detections, zone_occupancy, equipment_list = self.zone_engine.assign_zones(raw_detections)

        # 4. Temporal Validation (Dwell tracking, states, occlusion)
        tracklet_records, persistence_metrics = self.temporal_validator.update(
            current_timestamp=meta.timestamp,
            current_detections=zoned_detections
        )

        # 5. Scene Stability (Inter-frame difference)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        is_scene_stable = True
        if self.prev_frame_gray is not None:
            # Check frame difference
            diff = cv2.absdiff(gray, self.prev_frame_gray)
            mean_diff = float(np.mean(diff))
            if mean_diff > 45.0: # Violent camera shake
                is_scene_stable = False
        self.prev_frame_gray = gray

        # Assemble standardized Structured Evidence Features
        return StructuredEvidenceFeatures(
            frame_meta=meta,
            active_detections=zoned_detections,
            active_tracklets=tracklet_records,
            observed_equipment=equipment_list,
            detection_quality=quality_metrics,
            temporal_persistence=persistence_metrics,
            zone_occupancy=zone_occupancy,
            is_scene_stable=is_scene_stable,
            camera_trust=camera_trust_metrics
        )


    def annotate_frame(
        self,
        frame: np.ndarray,
        features: StructuredEvidenceFeatures
    ) -> np.ndarray:
        """
        Renders HUD overlays: zone polygons, color-coded bounding boxes,
        dwell timers, and real-time compliance telemetry.
        """
        annotated = frame.copy()

        # 1. Draw Zone Polygons
        for zone_name, poly in self.zone_engine.parsed_polygons.items():
            color = (168, 85, 247) if "student" in zone_name else (0, 229, 255) # Purple or Cyan
            cv2.polylines(annotated, [poly], isClosed=True, color=color, thickness=2)
            # Label
            first_pt = poly[0][0]
            cv2.putText(
                annotated,
                f"[{zone_name.upper()}]",
                (int(first_pt[0]), int(first_pt[1]) - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                color,
                1,
                cv2.LINE_AA
            )

        # Map tracklet status for fast lookup
        track_status_map = {t.track_id: t for t in features.active_tracklets}

        # 2. Draw Detections
        for det in features.active_detections:
            x1, y1 = int(det.bbox.x1), int(det.bbox.y1)
            x2, y2 = int(det.bbox.x2), int(det.bbox.y2)

            if det.class_name == "person":
                t_record = track_status_map.get(det.track_id)
                is_persistent = t_record.is_persistent_trainee if t_record else False

                if is_persistent:
                    color = (0, 240, 168) # Neon Emerald for verified trainee
                    status_lbl = f"ID:{det.track_id} | TRAINEE ({t_record.dwell_seconds}s)"
                else:
                    color = (148, 163, 184) # Muted Slate for transient
                    dwell = f"{t_record.dwell_seconds}s" if t_record else "0s"
                    status_lbl = f"ID:{det.track_id} | TRANSIENT ({dwell})"

                # Ground contact marker
                gx, gy = int(det.ground_point[0]), int(det.ground_point[1])
                cv2.circle(annotated, (gx, gy), 4, color, -1)
            else:
                # Equipment (monitors, chairs)
                color = (255, 200, 0) # Cyan/Yellow
                status_lbl = f"{det.class_name.upper()} ({int(det.confidence * 100)}%)"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                annotated,
                status_lbl,
                (x1, max(15, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                color,
                1,
                cv2.LINE_AA
            )

        # 3. Draw Telemetry HUD Header
        p_metrics = features.temporal_persistence
        hud_text = (
            f"FRAME #{features.frame_meta.frame_index} | "
            f"FPS: {features.frame_meta.cadence_fps} | "
            f"VERIFIED TRAINEES: {p_metrics.verified_trainee_headcount} | "
            f"TRANSIENTS: {p_metrics.transient_loiterer_count}"
        )
        cv2.rectangle(annotated, (0, 0), (annotated.shape[1], 30), (10, 15, 25), -1)
        cv2.putText(annotated, hud_text, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 240, 168), 1, cv2.LINE_AA)

        return annotated
