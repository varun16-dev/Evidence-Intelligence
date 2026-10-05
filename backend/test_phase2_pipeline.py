import sys
import os
import time
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.edge_ai.schemas import (
    DetectionItem, BoundingBox, FrameMetadata, StructuredEvidenceFeatures
)
from backend.app.edge_ai.zone_engine import ZoneEngine
from backend.app.edge_ai.temporal_validator import TemporalValidator
from backend.app.edge_ai.perception import PerceptionEngine
from backend.app.edge_ai.video_input import VideoInputSampler
from backend.app.edge_ai.pipeline import EdgeAIPipeline

def test_zone_engine():
    print("\n[TEST 1] Testing ZoneEngine (Point-in-Polygon Ray Casting)...")
    zones = {
        "student_zone": [[50, 100], [550, 100], [550, 450], [50, 450]],
        "doorway_zone": [[550, 20], [640, 20], [640, 200], [550, 200]]
    }
    ze = ZoneEngine(zones, frame_resolution=(640, 480))

    # Point inside student zone (x=200, y=300)
    assert ze.is_point_in_zone((200, 300), "student_zone") is True
    assert ze.is_point_in_zone((200, 300), "doorway_zone") is False

    # Point in doorway
    assert ze.is_point_in_zone((600, 50), "doorway_zone") is True
    assert ze.is_point_in_zone((600, 50), "student_zone") is False

    print(" [PASS] ZoneEngine: Ground point containment accurately mapped to polygon zones.")

def test_temporal_validator_states_and_occlusion():
    print("\n[TEST 2] Testing TemporalValidator State Machine & Occlusion Grace...")
    tv = TemporalValidator(
        target_zone="student_zone",
        dwell_threshold_seconds=15.0,
        max_occlusion_seconds=5.0
    )

    t0 = 1000.0

    # 1. First observation (t=0s) -> UNCONFIRMED
    det1 = DetectionItem(
        track_id=1,
        class_id=0,
        class_name="person",
        confidence=0.92,
        bbox=BoundingBox(x1=100, y1=200, x2=150, y2=350),
        ground_point=(125.0, 350.0),
        assigned_zone="student_zone"
    )
    records, metrics = tv.update(t0, [det1])
    assert records[0].status == "UNCONFIRMED"
    assert metrics.verified_trainee_headcount == 0

    # 2. Subsequent observations up to t=6s -> OBSERVED / PERSISTING
    tv.update(t0 + 1.0, [det1])
    tv.update(t0 + 2.0, [det1])
    records, metrics = tv.update(t0 + 6.0, [det1])
    assert records[0].status in ["OBSERVED", "PERSISTING"]
    assert records[0].dwell_seconds >= 5.0
    assert metrics.verified_trainee_headcount == 0

    # 3. Sustained observations reaching t=16s -> SUFFICIENT (Verified Trainee)
    records, metrics = tv.update(t0 + 16.0, [det1])
    assert records[0].status == "SUFFICIENT"
    assert records[0].is_persistent_trainee is True
    assert metrics.verified_trainee_headcount == 1
    assert records[0].dwell_seconds >= 15.0
    print(" [PASS] TemporalValidator: Reached SUFFICIENT state after 15s dwell.")

    # 4. Occlusion Test: Missing for 3 seconds -> LOST_OCCLUDED (Dwell frozen, NOT terminated)
    records, metrics = tv.update(t0 + 19.0, []) # Empty detections (occluded)
    assert len(records) == 1
    assert records[0].status == "LOST_OCCLUDED"
    dwell_before = records[0].dwell_seconds

    # 5. Recovery Test: Re-appears at t=21s -> Resumes SUFFICIENT status
    records, metrics = tv.update(t0 + 21.0, [det1])
    assert records[0].status == "SUFFICIENT"
    assert records[0].dwell_seconds >= dwell_before
    assert metrics.verified_trainee_headcount == 1
    print(" [PASS] TemporalValidator: Occlusion grace buffer preserved tracklet & resumed dwell.")

def test_pipeline_on_video():
    print("\n[TEST 3] Testing EdgeAIPipeline on Scenario Video...")
    zones = {
        "student_zone": [[50, 100], [550, 100], [550, 450], [50, 450]]
    }
    pipeline = EdgeAIPipeline(zones_geojson=zones, model_name="yolov8n.pt")

    video_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_videos", "scenario_classroom_class.mp4")
    sampler = VideoInputSampler(source=video_path, target_fps=3.0, target_resolution=(640, 480))

    frames_processed = 0
    sample_features = None

    for frame, meta in sampler.read_frames(simulate_realtime=False):
        features = pipeline.process_frame(frame, meta)
        frames_processed += 1
        sample_features = features
        if frames_processed >= 15:
            # Annotated frame test
            annotated = pipeline.annotate_frame(frame, features)
            assert annotated.shape == (480, 640, 3)
            break

    assert frames_processed >= 15
    assert sample_features is not None
    assert isinstance(sample_features, StructuredEvidenceFeatures)
    assert sample_features.frame_meta.frame_index == 15
    print(f" [PASS] EdgeAIPipeline: Processed {frames_processed} frames and verified StructuredEvidenceFeatures schema.")

    print("\n" + "="*60)
    print("SAMPLE STRUCTURED EVIDENCE FEATURES OUTPUT (JSON):")
    print("="*60)
    print(sample_features.model_dump_json(indent=2))
    print("="*60)

if __name__ == "__main__":
    test_zone_engine()
    test_temporal_validator_states_and_occlusion()
    test_pipeline_on_video()
    print("\n>>> ALL PHASE 2 EDGE AI PIPELINE TESTS PASSED CLEANLY! <<<\n")
