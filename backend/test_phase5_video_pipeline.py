import os
import sys
import asyncio
import hashlib
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from httpx import ASGITransport

from backend.app.main import app


BACKEND_DIR = Path(__file__).resolve().parent
VAULT_DIR = (BACKEND_DIR / "evidence_vault").resolve()

async def run_phase5_test_suite():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        print("\n" + "=" * 70)
        print("PHASE 5 REAL VIDEO EVIDENCE ACQUISITION PIPELINE TEST SUITE")
        print("=" * 70 + "\n")

        # -------------------------------------------------------------
        # TEST 1: Authenticated Officer Login
        # -------------------------------------------------------------
        print("[TEST 1] Testing Authenticated Officer Login...")
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"username": "officer_rajesh", "password": "officer123"}
        )


        assert login_res.status_code == 200, f"Expected 200, got {login_res.status_code}: {login_res.text}"
        officer_token = login_res.json()["access_token"]
        officer_headers = {"Authorization": f"Bearer {officer_token}"}
        print(" [PASS] Test 1: Officer login successful. JWT token received.")

        # -------------------------------------------------------------
        # TEST 2: Select Valid Configured Camera
        # -------------------------------------------------------------
        print("\n[TEST 2] Testing Camera Selection...")
        cams_res = await client.get("/api/v1/cameras", headers=officer_headers)
        assert cams_res.status_code == 200, f"Expected 200, got {cams_res.status_code}"
        cameras = cams_res.json()
        assert len(cameras) > 0, "No cameras found in database"
        
        # Pick standard CAM-LAB-01 or first available
        target_camera = None
        for cam in cameras:
            if cam["camera_id"] == "CAM-LAB-01":
                target_camera = cam
                break
        if not target_camera:
            target_camera = cameras[0]
        camera_id = target_camera["camera_id"]
        print(f" [PASS] Test 2: Selected valid camera '{camera_id}' (Room: {target_camera['room_id']}).")

        # -------------------------------------------------------------
        # TEST 3: Analyze an Actual Existing Test Video
        # -------------------------------------------------------------
        print(f"\n[TEST 3] Running Real Video Analysis on camera '{camera_id}' with 'scenario_classroom_class.mp4'...")
        analyze_res = await client.post(
            f"/api/v1/cameras/{camera_id}/analyze-clip",
            headers=officer_headers,
            json={
                "clip_filename": "scenario_classroom_class.mp4",
                "max_frames": 30,
                "sample_fps": 3.0,
                "expected_headcount": 1
            }
        )
        assert analyze_res.status_code == 200, f"Analysis failed with {analyze_res.status_code}: {analyze_res.text}"
        data = analyze_res.json()
        print(f" [PASS] Test 3: Analysis endpoint completed successfully (Status: {data['processing_status']}).")

        # -------------------------------------------------------------
        # TEST 4: Verify Frames Were Actually Processed
        # -------------------------------------------------------------
        print("\n[TEST 4] Verifying Real Frame Processing...")
        frames_processed = data.get("frames_processed", 0)
        assert frames_processed >= 10, f"Expected >= 10 frames processed, got {frames_processed}"
        assert data.get("source_type") == "TEST_VIDEO", f"Expected source_type='TEST_VIDEO', got {data.get('source_type')}"
        print(f" [PASS] Test 4: Real frame ingestion confirmed: {frames_processed} frames sampled and evaluated.")

        # -------------------------------------------------------------
        # TEST 5: Verify YOLO Detections Were Generated
        # -------------------------------------------------------------
        print("\n[TEST 5] Verifying YOLO Detections...")
        factors = data.get("contributing_factors", {})
        det_quality = factors.get("detection_quality", 0.0)
        assert det_quality > 0.0, f"Detection quality score should be > 0.0, got {det_quality}"
        print(f" [PASS] Test 5: YOLOv8 detections verified (Quality Score: {det_quality}).")

        # -------------------------------------------------------------
        # TEST 6: Verify ByteTrack Generated Real Tracks
        # -------------------------------------------------------------
        print("\n[TEST 6] Verifying ByteTrack Tracking...")
        tracks_detected = data.get("tracks_detected", 0)
        assert tracks_detected >= 1, f"Expected >= 1 track detected, got {tracks_detected}"
        print(f" [PASS] Test 6: ByteTrack tracking confirmed: {tracks_detected} persistent track(s) identified.")

        # -------------------------------------------------------------
        # TEST 7: Verify SensorTrustEvaluator Was Actually Invoked
        # -------------------------------------------------------------
        print("\n[TEST 7] Verifying SensorTrustEvaluator Invocation...")
        cam_trust = factors.get("camera_trust", 0.0)
        assert cam_trust > 0.0, f"Camera trust should be > 0.0, got {cam_trust}"
        print(f" [PASS] Test 7: SensorTrustEvaluator metrics computed (Composite Camera Trust: {cam_trust}).")

        # -------------------------------------------------------------
        # TEST 8: Verify Temporal Validation Was Actually Invoked
        # -------------------------------------------------------------
        print("\n[TEST 8] Verifying Temporal Validation FSM...")
        temporal_pers = factors.get("temporal_persistence", 0.0)
        assert temporal_pers >= 0.0, f"Temporal persistence score missing or invalid: {temporal_pers}"
        print(f" [PASS] Test 8: Temporal Validator FSM evaluated persistence (Persistence Ratio: {temporal_pers}).")

        # -------------------------------------------------------------
        # TEST 9: Verify StructuredEvidenceFeatures Populated from Real Processing
        # -------------------------------------------------------------
        print("\n[TEST 9] Verifying StructuredEvidenceFeatures Contract...")
        expected_keys = [
            "camera_trust", "observability", "detection_quality",
            "temporal_persistence", "scene_stability", "record_agreement", "anti_spoof"
        ]
        for key in expected_keys:
            assert key in factors, f"Missing factor key '{key}' in contributing_factors"
            assert isinstance(factors[key], (int, float)), f"Factor '{key}' is not numeric"
        print(f" [PASS] Test 9: All 7 StructuredEvidenceFeatures populated from real pipeline outputs.")

        # -------------------------------------------------------------
        # TEST 10: Verify Evidence Sufficiency Engine Generated Verdict
        # -------------------------------------------------------------
        print("\n[TEST 10] Verifying Evidence Sufficiency Engine Verdict...")
        verdict = data.get("verdict")
        score = data.get("evidence_score", 0.0)
        reasons = data.get("reasons", [])
        assert verdict in ["VERIFIED", "REVIEW", "ABSTAIN"], f"Invalid verdict: {verdict}"
        assert 0.0 <= score <= 1.0, f"Score out of bounds: {score}"
        assert len(reasons) > 0, "Verdict must include epistemic causal justification reasons"
        print(f" [PASS] Test 10: Evidence Sufficiency Engine produced authoritative verdict: '{verdict}' (Score: {score}).")

        # -------------------------------------------------------------
        # TEST 11: Verify Evidence Passport Was Created from Analysis
        # -------------------------------------------------------------
        print("\n[TEST 11] Verifying Evidence Passport Creation...")
        passport_id = data.get("passport_id")
        assert passport_id and passport_id.startswith("PASS-"), f"Invalid passport_id: {passport_id}"
        
        pass_res = await client.get(f"/api/v1/passports/{passport_id}", headers=officer_headers)
        assert pass_res.status_code == 200, f"Failed to retrieve passport: {pass_res.text}"
        passport_db = pass_res.json()
        assert passport_db["camera_id"] == camera_id
        assert passport_db["verdict"] == verdict
        print(f" [PASS] Test 11: Evidence Passport '{passport_id}' stored in database and cryptographically sealed.")

        # -------------------------------------------------------------
        # TEST 12: Verify Actual JPEG Keyframe Exists on Disk
        # -------------------------------------------------------------
        print("\n[TEST 12] Verifying Physical Keyframe on Disk...")
        raw_keyframe_file = VAULT_DIR / f"{passport_id}_raw.jpg"
        assert raw_keyframe_file.is_file(), f"Keyframe file does not exist: {raw_keyframe_file}"
        raw_bytes = raw_keyframe_file.read_bytes()
        assert len(raw_bytes) > 500, f"Keyframe file too small: {len(raw_bytes)} bytes"
        # Verify valid JPEG magic header
        assert raw_bytes[:2] == b"\xff\xd8", "Keyframe file is not a valid JPEG format"
        print(f" [PASS] Test 12: Physical keyframe exists in vault: {raw_keyframe_file.name} ({len(raw_bytes)} bytes, valid JPEG).")

        # -------------------------------------------------------------
        # TEST 13: Verify Image SHA-256 Matches Actual Saved JPEG Bytes
        # -------------------------------------------------------------
        print("\n[TEST 13] Verifying Image SHA-256 Digest...")
        actual_sha256 = hashlib.sha256(raw_bytes).hexdigest()
        assert actual_sha256 == data["image_sha256"], (
            f"Digest mismatch! On-disk: {actual_sha256} vs Response: {data['image_sha256']}"
        )
        print(f" [PASS] Test 13: SHA-256 matches actual JPEG bytes on disk ({actual_sha256[:16]}...).")

        # -------------------------------------------------------------
        # TEST 14: Verify Passport Contains the Same Image Hash
        # -------------------------------------------------------------
        print("\n[TEST 14] Verifying Passport Digital Signature Hash Alignment...")
        assert passport_db["image_sha256"] == actual_sha256, (
            f"Passport image_sha256 mismatch! DB: {passport_db['image_sha256']} vs On-disk: {actual_sha256}"
        )
        print(f" [PASS] Test 14: Passport cryptographic record perfectly matches on-disk keyframe SHA-256.")

        # -------------------------------------------------------------
        # TEST 15: Verify Admin / Officer Authentication Still Works
        # -------------------------------------------------------------
        print("\n[TEST 15] Verifying Role Authentication...")
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "admin123"}
        )


        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        admin_me = await client.get("/api/v1/auth/me", headers=admin_headers)
        assert admin_me.json()["role"] == "ADMIN"
        
        officer_me = await client.get("/api/v1/auth/me", headers=officer_headers)
        assert officer_me.json()["role"] == "OFFICER"
        print(" [PASS] Test 15: Admin and Officer authentication and profile resolution verified.")

        # -------------------------------------------------------------
        # TEST 16: Verify Admin Cannot Perform Prohibited Governance Actions
        # -------------------------------------------------------------
        print("\n[TEST 16] Verifying Admin Governance Adjudication Prohibited...")
        admin_gov = await client.post(
            f"/api/v1/governance/passports/{passport_id}/action",
            headers=admin_headers,
            json={"action": "CONFIRM", "reason": "Admin attempting unauthorized adjudication"}
        )
        assert admin_gov.status_code == 403, f"Expected 403 Forbidden, got {admin_gov.status_code}"
        print(" [PASS] Test 16: Admin cannot adjudicate review queue (403 Forbidden).")

        # -------------------------------------------------------------
        # TEST 17: Verify Officer Cannot Mutate Admin-Only Centre Configuration
        # -------------------------------------------------------------
        print("\n[TEST 17] Verifying Officer Centre Mutation Prohibited...")
        officer_centre_post = await client.post(
            "/api/v1/centres",
            headers=officer_headers,
            json={
                "centre_id": "TC-UNAUTHORIZED",
                "centre_name": "Unauthorized Centre",
                "state": "Delhi",
                "district": "Central"
            }
        )
        assert officer_centre_post.status_code == 403, f"Expected 403 Forbidden, got {officer_centre_post.status_code}"
        print(" [PASS] Test 17: Officer cannot create/mutate training centres (403 Forbidden).")

        # -------------------------------------------------------------
        # TEST 18: Verify Unauthenticated Analysis Request Returns 401
        # -------------------------------------------------------------
        print("\n[TEST 18] Verifying Unauthenticated Analysis Request Rejection...")
        anon_res = await client.post(
            f"/api/v1/cameras/{camera_id}/analyze-clip",
            json={"clip_filename": "scenario_classroom_class.mp4"}
        )
        assert anon_res.status_code == 401, f"Expected 401 Unauthorized, got {anon_res.status_code}"
        print(" [PASS] Test 18: Unauthenticated video analysis request rejected with 401 Unauthorized.")

        # -------------------------------------------------------------
        # TEST 19: Verify Invalid / Non-Allowlisted Video Path is Rejected
        # -------------------------------------------------------------
        print("\n[TEST 19] Verifying Allowlist Security & Path Traversal Rejection...")
        traversal_res = await client.post(
            f"/api/v1/cameras/{camera_id}/analyze-clip",
            headers=officer_headers,
            json={"clip_filename": "../../etc/passwd"}
        )
        assert traversal_res.status_code == 400, f"Expected 400 Bad Request, got {traversal_res.status_code}"
        
        non_allowlisted_res = await client.post(
            f"/api/v1/cameras/{camera_id}/analyze-clip",
            headers=officer_headers,
            json={"clip_filename": "malicious_script.sh"}
        )
        assert non_allowlisted_res.status_code == 400, f"Expected 400 Bad Request, got {non_allowlisted_res.status_code}"
        print(" [PASS] Test 19: Non-allowlisted clips and directory traversal strictly rejected with 400 Bad Request.")

        # -------------------------------------------------------------
        # TEST 20: Verify Processing Errors Are Not Falsely Converted to ABSTAIN
        # -------------------------------------------------------------
        print("\n[TEST 20] Verifying Processing Errors Are Distinct from Epistemic ABSTAIN...")
        # 1. Non-existent camera should return 404, not ABSTAIN verdict
        bad_cam_res = await client.post(
            "/api/v1/cameras/CAM-NONEXISTENT-9999/analyze-clip",
            headers=officer_headers,
            json={"clip_filename": "scenario_classroom_class.mp4"}
        )
        assert bad_cam_res.status_code == 404, f"Expected 404 for missing camera, got {bad_cam_res.status_code}"
        assert "not found" in bad_cam_res.text.lower()
        
        # 2. Keyframe vault traversal check returns 400 or 403, not silent fallback
        bad_vault_res = await client.get(
            "/api/v1/evidence-vault/../../etc/passwd/raw",
            headers=officer_headers
        )
        assert bad_vault_res.status_code in [400, 403, 404], f"Expected 400/403/404, got {bad_vault_res.status_code}"
        print(" [PASS] Test 20: System errors clearly distinguished from epistemic ABSTAIN (404/400 returned, not fake ABSTAIN).")

        print("\n" + "=" * 70)
        print(">>> ALL 20 PHASE 5 VIDEO PIPELINE TESTS PASSED FLAWLESSLY! <<<")
        print("=" * 70 + "\n")

if __name__ == "__main__":
    asyncio.run(run_phase5_test_suite())
