from typing import List, Tuple, Optional
import numpy as np
from ultralytics import YOLO
from backend.app.edge_ai.schemas import (
    DetectionItem, BoundingBox, DetectionQualityMetrics
)
from backend.app.logging_config import logger

# Target classes from standard COCO weights
TARGET_CLASSES = {
    0: "person",
    56: "chair",
    62: "tv", # desktop monitors
    63: "laptop"
}

class PerceptionEngine:
    """
    Lightweight YOLO Detection & ByteTrack Multi-Object Tracking Engine.
    Enforces Anonymous Presence Tracking (Zero facial recognition).
    """
    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        tracker_config: str = "bytetrack.yaml"
    ):
        self.model_name = model_name
        self.conf = confidence_threshold
        self.iou = iou_threshold
        self.tracker_config = tracker_config
        
        logger.info(f"Initializing PerceptionEngine with {model_name} and {tracker_config}...")
        self.model = YOLO(model_name)
        logger.info("PerceptionEngine initialized successfully.")

    def process_frame(
        self,
        frame: np.ndarray
    ) -> Tuple[List[DetectionItem], DetectionQualityMetrics]:
        """
        Runs YOLO + ByteTrack tracking on a single frame.
        Returns list of DetectionItems and DetectionQualityMetrics.
        """
        h, w = frame.shape[:2]
        frame_area = float(h * w)

        # Run model tracking with ByteTrack
        results = self.model.track(
            source=frame,
            persist=True,
            tracker=self.tracker_config,
            classes=list(TARGET_CLASSES.keys()),
            conf=self.conf,
            iou=self.iou,
            verbose=False
        )

        detections: List[DetectionItem] = []
        confidences: List[float] = []
        geometry_penalties: int = 0

        if results and len(results) > 0:
            boxes = results[0].boxes
            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = TARGET_CLASSES.get(cls_id, "unknown")
                    conf = float(box.conf[0].item())
                    
                    # Track ID assigned by ByteTrack (can be None for newly emerging or unconfirmed items)
                    track_id = int(box.id[0].item()) if box.id is not None else None

                    # Coordinates
                    xyxy = box.xyxy[0].tolist()
                    x1, y1, x2, y2 = xyxy[0], xyxy[1], xyxy[2], xyxy[3]

                    bbox = BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)
                    ground_pt = bbox.ground_point

                    # Sanity check geometry (penalize extreme anomalies)
                    box_area = bbox.width * bbox.height
                    if box_area > (0.85 * frame_area) or box_area < 80.0:
                        geometry_penalties += 1

                    det_item = DetectionItem(
                        track_id=track_id,
                        class_id=cls_id,
                        class_name=cls_name,
                        confidence=round(conf, 3),
                        bbox=bbox,
                        ground_point=(round(ground_pt[0], 1), round(ground_pt[1], 1))
                    )
                    detections.append(det_item)
                    confidences.append(conf)

        # Compute Quality Metrics
        det_count = len(detections)
        mean_conf = round(float(np.mean(confidences)), 3) if confidences else 0.0
        min_conf = round(float(np.min(confidences)), 3) if confidences else 0.0
        anomaly_ratio = round(geometry_penalties / max(1, det_count), 2) if det_count else 0.0

        # Base quality score
        quality_score = max(0.0, round(mean_conf - (0.2 * anomaly_ratio), 3)) if det_count else 1.0

        quality_metrics = DetectionQualityMetrics(
            mean_confidence=mean_conf,
            min_confidence=min_conf,
            detection_count=det_count,
            box_geometry_penalty=anomaly_ratio,
            quality_score=quality_score
        )

        return detections, quality_metrics
