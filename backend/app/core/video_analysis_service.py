import os
import re
import uuid
import base64
import time
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

import cv2
import numpy as np
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.db.models import Room, AuthoritativeSchedule, User, EvidencePassport
from backend.app.edge_ai.video_input import VideoInputSampler
from backend.app.edge_ai.pipeline import EdgeAIPipeline
from backend.app.edge_ai.schemas import StructuredEvidenceFeatures
from backend.app.core.sufficiency_engine import EvidenceSufficiencyEngine, SufficiencyVerdictOutput
from backend.app.core.passport_service import PassportService
from backend.app.core.crypto_signer import crypto_signer
from backend.app.schemas.passport_schemas import GeneratePassportRequest
from backend.app.logging_config import logger

# Controlled allowlist of verifiable test clips (prevents arbitrary filesystem traversal)
ALLOWLISTED_CLIPS: Dict[str, Dict[str, Any]] = {
    "scenario_classroom_class.mp4": {
        "title": "Classroom Session (Standard Trainees & Equipment)",
        "description": "Standard classroom scenario with seated trainee and equipment in student zone",
        "event_type": "CLASSROOM_SESSION_ATTENDANCE",
        "default_expected_headcount": 1
    },
    "scenario_persistent.mp4": {
        "title": "Persistent Trainee Session",
        "description": "Continuous seated trainee accumulating sustained dwell time inside the training zone",
        "event_type": "PERSISTENT_TRAINEE_MONITORING",
        "default_expected_headcount": 1
    },
    "scenario_transient.mp4": {
        "title": "Transient Passerby",
        "description": "Transient pedestrian walking through without sustained dwell time",
        "event_type": "TRANSIENT_ACTIVITY_MONITORING",
        "default_expected_headcount": 1
    },
    "scenario_freeze.mp4": {
        "title": "Stagnant / Frozen CCTV Feed",
        "description": "Static duplicate frames triggering Anti-Spoof hard veto",
        "event_type": "FEED_AUTHENTICITY_VERIFICATION",
        "default_expected_headcount": 1
    }
}

class VideoAnalysisService:
    """
    Orchestration service for the Real Video Evidence Acquisition Pipeline.
    
    Transforms:
    Allowlisted Test Video (MP4)
        ↓
    Frame Sampling (VideoInputSampler)
        ↓
    YOLOv8 Detection
        ↓
    ByteTrack Multi-Object Tracking
        ↓
    Zone Analysis (PIP Ray-Casting)
        ↓
    Sensor Trust Evaluation (Laplacian blur, luminance, freeze, obstruction, cadence)
        ↓
    Temporal Validation FSM (Dwell tracking, state transitions, occlusion grace)
        ↓
    Structured Evidence Features Contract
        ↓
    Evidence Sufficiency Engine (Epistemic decision, 7 dimensions, hard vetoes)
        ↓
    VERIFIED / REVIEW / ABSTAIN Verdict
        ↓
    Evidence Passport Generation & Cryptographic Sealing
        ↓
    Physical JPEG Keyframe Storage & SHA-256 Digest Verification
    """

    @staticmethod
    def get_allowlisted_clips() -> List[Dict[str, Any]]:
        """Returns metadata for all allowlisted video test clips."""
        return [
            {
                "filename": filename,
                "title": data["title"],
                "description": data["description"],
                "event_type": data["event_type"],
                "default_expected_headcount": data["default_expected_headcount"]
            }
            for filename, data in ALLOWLISTED_CLIPS.items()
        ]

    @staticmethod
    async def analyze_camera_clip(
        db: AsyncSession,
        camera_id: str,
        clip_filename: str,
        max_frames: int = 90,
        sample_fps: float = 3.0,
        expected_headcount: Optional[int] = None,
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end computer vision analysis on a controlled allowlisted test clip for a camera.
        """
        # 1. Verify Camera exists in DB
        result = await db.execute(select(Room).where(Room.camera_id == camera_id))
        room = result.scalars().first()
        if not room:
            logger.warning(f"Camera analysis rejected: Camera ID '{camera_id}' not found.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera ID '{camera_id}' not found"
            )
        target_room_id = room.room_id
        target_centre_id = room.centre_id
        target_zones_geojson = room.zones_geojson


        # 2. Security: Strictly enforce allowlist and prevent directory traversal
        if not clip_filename or clip_filename not in ALLOWLISTED_CLIPS:
            logger.warning(f"Rejected non-allowlisted video clip: '{clip_filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or non-allowlisted video clip: '{clip_filename}'. Allowed clips: {list(ALLOWLISTED_CLIPS.keys())}"
            )

        if ".." in clip_filename or "/" in clip_filename or "\\" in clip_filename:
            logger.warning(f"Directory traversal attempt detected in clip filename: '{clip_filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Directory traversal prohibited in video clip selection"
            )

        # Resolve video path safely
        backend_dir = Path(__file__).resolve().parent.parent.parent
        test_videos_dir = (backend_dir / "test_videos").resolve()
        video_path = (test_videos_dir / clip_filename).resolve()

        if not str(video_path).startswith(str(test_videos_dir)) or not video_path.is_file():
            logger.error(f"Allowlisted video file missing on disk: {video_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Allowlisted video clip '{clip_filename}' is not present on disk"
            )

        clip_meta = ALLOWLISTED_CLIPS[clip_filename]
        logger.info(
            f"Starting video analysis on camera '{camera_id}' using clip '{clip_filename}' "
            f"(Max frames: {max_frames}, Target FPS: {sample_fps}, Actor: {current_user.username if current_user else 'SYSTEM'})"
        )

        # 3. Initialize VideoInputSampler & EdgeAIPipeline
        sampler = VideoInputSampler(source=str(video_path), target_fps=sample_fps)
        if not sampler.open():
            logger.error(f"Failed to open video source: {video_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"PROCESSING_ERROR: Failed to open video source '{clip_filename}'"
            )

        pipeline = EdgeAIPipeline(
            zones_geojson=target_zones_geojson,
            target_zone="student_zone",
            dwell_threshold_seconds=5.0
        )


        start_time = time.time()
        frames_processed = 0
        all_features: List[StructuredEvidenceFeatures] = []
        best_frame: Optional[np.ndarray] = None
        best_features: Optional[StructuredEvidenceFeatures] = None
        max_detections = -1
        all_track_ids = set()

        # 4. Execute frame-by-frame pipeline
        try:
            for frame, meta in sampler.read_frames(simulate_realtime=False):
                features = pipeline.process_frame(frame, meta)
                frames_processed += 1
                all_features.append(features)

                for det in features.active_detections:
                    if det.track_id is not None:
                        all_track_ids.add(det.track_id)

                num_det = len(features.active_detections)
                if num_det > max_detections or best_frame is None:
                    max_detections = num_det
                    best_frame = frame.copy()
                    best_features = features

                if frames_processed >= max_frames:
                    break
        except Exception as e:
            logger.error(f"CV Pipeline runtime exception on camera '{camera_id}': {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"PROCESSING_ERROR: Vision pipeline failure: {str(e)}"
            )
        finally:
            sampler.close()

        if frames_processed == 0 or best_frame is None or best_features is None:
            logger.error(f"Zero frames processed from '{clip_filename}'")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PROCESSING_ERROR: Video source yielded 0 readable frames"
            )

        # 5. Render HUD Annotated Keyframe
        annotated_bgr = pipeline.annotate_frame(best_frame, best_features)

        # 6. Encode Raw and Annotated JPEG bytes
        success_raw, raw_jpeg_bytes = cv2.imencode('.jpg', best_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        success_ann, ann_jpeg_bytes = cv2.imencode('.jpg', annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if not success_raw or not success_ann:
            logger.error("Failed to encode keyframe JPEG images")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PROCESSING_ERROR: Keyframe JPEG encoding failed"
            )
        raw_bytes = raw_jpeg_bytes.tobytes()
        ann_bytes = ann_jpeg_bytes.tobytes()

        # 7. Aggregate Real Evidence Dimensions from actual processing
        final_feat = all_features[-1]
        mean_cam_trust = sum(f.camera_trust.composite_camera_trust for f in all_features if f.camera_trust) / float(frames_processed)
        mean_det_qual = sum(f.detection_quality.quality_score for f in all_features) / float(frames_processed)
        pers_ratio = final_feat.temporal_persistence.persistence_ratio
        stab_score = final_feat.temporal_persistence.stability_score
        observed_headcount = final_feat.temporal_persistence.verified_trainee_headcount
        transient_count = final_feat.temporal_persistence.transient_loiterer_count
        freeze_detected = any(f.camera_trust.freeze_detected for f in all_features if f.camera_trust)
        mean_mad = sum(f.camera_trust.interframe_pixel_mad for f in all_features if f.camera_trust) / float(frames_processed)

        veto_reason: Optional[str] = None
        for f in all_features:
            if f.camera_trust and f.camera_trust.hard_veto_triggered:
                veto_reason = f.camera_trust.veto_reason
                break

        observability_score = 0.95
        for f in all_features:
            if f.camera_trust and f.camera_trust.obstruction_detected:
                observability_score = 0.20
                break

        # Authoritative schedule comparison
        registered_count = expected_headcount
        if registered_count is None:
            sched_res = await db.execute(select(AuthoritativeSchedule).where(AuthoritativeSchedule.room_id == target_room_id))
            sched = sched_res.scalars().first()
            if sched and sched.expected_students:
                registered_count = sched.expected_students
            else:
                registered_count = clip_meta["default_expected_headcount"]

        # 8. Evaluate Evidence Sufficiency via Deterministic Mathematics
        sufficiency_engine = EvidenceSufficiencyEngine()
        verdict: SufficiencyVerdictOutput = sufficiency_engine.evaluate_from_features(
            composite_camera_trust=round(mean_cam_trust, 3),
            detection_quality_score=round(mean_det_qual, 3),
            persistence_ratio=round(pers_ratio, 3),
            stability_score=round(stab_score, 3),
            observed_headcount=observed_headcount,
            registered_headcount=registered_count,
            freeze_detected=freeze_detected,
            interframe_mad=round(mean_mad, 3),
            observability_score=observability_score,
            veto_reason=veto_reason
        )

        # 9. Cryptographically Seal and Store Evidence Passport
        passport_service = PassportService()
        raw_b64 = base64.b64encode(raw_bytes).decode("ascii")

        actor_username = current_user.username if current_user else "SYSTEM_VIDEO_PIPELINE"
        actor_role = current_user.role if current_user else "OFFICER"

        # Generate temporary passport placeholder to establish URIs
        temp_passport_id = f"PASS-{uuid.uuid4().hex[:12].upper()}"

        passport_req = GeneratePassportRequest(
            centre_id=target_centre_id,
            room_id=target_room_id,
            camera_id=camera_id,
            event_type=clip_meta["event_type"],
            compliance_finding=f"Real Video CV Analysis ({clip_filename}): {verdict.decision}",
            verdict=verdict,
            raw_keyframe_b64=raw_b64,
            raw_keyframe_uri=f"/api/v1/evidence-vault/{temp_passport_id}/raw",
            annotated_keyframe_uri=f"/api/v1/evidence-vault/{temp_passport_id}/annotated",
            evidence_features={
                "source_type": "TEST_VIDEO",
                "clip_filename": clip_filename,
                "frames_processed": frames_processed,
                "tracks_detected": len(all_track_ids),
                "verified_trainees": observed_headcount,
                "transients": transient_count,
                "camera_trust": round(mean_cam_trust, 3),
                "detection_quality": round(mean_det_qual, 3),
                "temporal_persistence": round(pers_ratio, 3),
                "scene_stability": round(stab_score, 3)
            }
        )

        passport: EvidencePassport = await passport_service.create_passport(
            db=db,
            req=passport_req,
            actor_id=actor_username,
            actor_role=actor_role
        )

        # 10. Store Physical Keyframe Files in Controlled Evidence Vault
        vault_dir = (backend_dir / "evidence_vault").resolve()
        vault_dir.mkdir(parents=True, exist_ok=True)

        # Save both flat filenames and subfolder paths for complete compatibility
        flat_raw_path = vault_dir / f"{passport.passport_id}_raw.jpg"
        flat_ann_path = vault_dir / f"{passport.passport_id}_annotated.jpg"
        flat_raw_path.write_bytes(raw_bytes)
        flat_ann_path.write_bytes(ann_bytes)

        sub_vault_dir = vault_dir / passport.passport_id
        sub_vault_dir.mkdir(parents=True, exist_ok=True)
        (sub_vault_dir / "raw_keyframe.jpg").write_bytes(raw_bytes)
        (sub_vault_dir / "annotated_keyframe.jpg").write_bytes(ann_bytes)

        # Re-verify image SHA-256 matches actual saved bytes on disk
        disk_image_sha256 = crypto_signer.hash_bytes(flat_raw_path.read_bytes())
        if disk_image_sha256 != passport.image_sha256:
            logger.error(
                f"CRITICAL: Keyframe SHA-256 mismatch! On-disk: {disk_image_sha256} vs Passport: {passport.image_sha256}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PROCESSING_ERROR: Keyframe cryptographic digest mismatch"
            )

        duration = round(time.time() - start_time, 2)
        logger.info(
            f"Video analysis completed for camera '{camera_id}': "
            f"Verdict={verdict.decision}, Score={verdict.evidence_score}, Passport={passport.passport_id}, Duration={duration}s"
        )

        return {
            "analysis_id": f"ANL-{uuid.uuid4().hex[:12].upper()}",
            "camera_id": camera_id,
            "room_id": target_room_id,
            "centre_id": target_centre_id,
            "source_type": "TEST_VIDEO",
            "clip_filename": clip_filename,
            "frames_processed": frames_processed,
            "tracks_detected": len(all_track_ids),

            "verified_trainees": observed_headcount,
            "transient_loiterers": transient_count,
            "evidence_score": verdict.evidence_score,
            "verdict": verdict.decision,
            "reasons": verdict.reasons,
            "passport_id": passport.passport_id,
            "keyframe_available": True,
            "image_sha256": passport.image_sha256,
            "raw_keyframe_uri": f"/api/v1/evidence-vault/{passport.passport_id}/raw",
            "annotated_keyframe_uri": f"/api/v1/evidence-vault/{passport.passport_id}/annotated",
            "processing_status": "COMPLETED",
            "processing_duration_seconds": duration,
            "contributing_factors": verdict.contributing_factors.model_dump()
        }
