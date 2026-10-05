import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from backend.app.main import app

async def run_api_tests():
    print("\n" + "="*70)
    print("PHASE 3 FASTAPI EVALUATION SUITE: ENDPOINTS & AUDIT LEDGER")
    print("="*70 + "\n")
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Strong Evidence Endpoint Test -> VERIFIED
        payload_strong = {
            "camera_trust": 0.94,
            "observability": 0.95,
            "detection_quality": 0.92,
            "temporal_persistence": 0.95,
            "scene_stability": 0.95,
            "record_agreement": 1.00,
            "anti_spoof": 1.00
        }
        res1 = await client.post("/api/v1/evaluate/sufficiency", json=payload_strong)
        assert res1.status_code == 200, f"Strong test failed: {res1.text}"
        data1 = res1.json()
        assert data1["decision"] == "VERIFIED"
        assert data1["evidence_score"] >= 0.75
        assert len(data1["reasons"]) > 0
        eval_id1 = data1["evaluation_id"]
        print(f" [PASS] 1. POST /api/v1/evaluate/sufficiency (Strong) -> VERIFIED (Eval ID: {eval_id1})")

        # 2. Ambiguous Evidence Endpoint Test -> REVIEW
        payload_ambiguous = {
            "camera_trust": 0.65,
            "observability": 0.60,
            "detection_quality": 0.55,
            "temporal_persistence": 0.52,
            "scene_stability": 0.70,
            "record_agreement": 0.75,
            "anti_spoof": 1.00
        }
        res2 = await client.post("/api/v1/evaluate/sufficiency", json=payload_ambiguous)
        assert res2.status_code == 200, f"Ambiguous test failed: {res2.text}"
        data2 = res2.json()
        assert data2["decision"] == "REVIEW"
        print(f" [PASS] 2. POST /api/v1/evaluate/sufficiency (Ambiguous) -> REVIEW (Score: {data2['evidence_score']})")

        # 3. Insufficient Evidence Endpoint Test -> ABSTAIN
        payload_insufficient = {
            "camera_trust": 0.35,
            "observability": 0.35,
            "detection_quality": 0.30,
            "temporal_persistence": 0.25,
            "scene_stability": 0.40,
            "record_agreement": 0.50,
            "anti_spoof": 1.00
        }
        res3 = await client.post("/api/v1/evaluate/sufficiency", json=payload_insufficient)
        assert res3.status_code == 200, f"Insufficient test failed: {res3.text}"
        data3 = res3.json()
        assert data3["decision"] == "ABSTAIN"
        print(f" [PASS] 3. POST /api/v1/evaluate/sufficiency (Insufficient) -> ABSTAIN (Score: {data3['evidence_score']})")

        # 4. Camera Failure (Optical Blur Veto) -> ABSTAIN
        payload_blur = {
            "camera_trust": 0.12,
            "observability": 0.90,
            "detection_quality": 0.85,
            "temporal_persistence": 0.90,
            "scene_stability": 0.85,
            "record_agreement": 0.20,
            "anti_spoof": 1.00
        }
        res4 = await client.post("/api/v1/evaluate/sufficiency", json=payload_blur)
        assert res4.status_code == 200, f"Blur veto failed: {res4.text}"
        data4 = res4.json()
        assert data4["decision"] == "ABSTAIN"
        assert any("CAMERA TRUST VETO" in r for r in data4["reasons"])
        print(f" [PASS] 4. POST /api/v1/evaluate/sufficiency (Camera Blur) -> ABSTAIN (Veto Tripped)")

        # 5. Ghost Batch Contradiction -> REVIEW
        payload_contradiction = {
            "camera_trust": 0.95,
            "observability": 0.95,
            "detection_quality": 0.92,
            "temporal_persistence": 0.95,
            "scene_stability": 0.95,
            "record_agreement": 0.12, # Severe contradiction
            "anti_spoof": 1.00
        }
        res5 = await client.post("/api/v1/evaluate/sufficiency", json=payload_contradiction)
        assert res5.status_code == 200, f"Contradiction test failed: {res5.text}"
        data5 = res5.json()
        assert data5["decision"] == "REVIEW"
        assert any("HIGH-PRIORITY BREACH EVIDENCE" in r for r in data5["reasons"])
        eval_id5 = data5["evaluation_id"]
        print(f" [PASS] 5. POST /api/v1/evaluate/sufficiency (CCTV/Record Contradiction) -> REVIEW (Breach flagged)")

        # 6. Audit Ledger Verification: GET /api/v1/evaluate/history
        res_hist = await client.get("/api/v1/evaluate/history")
        assert res_hist.status_code == 200
        history = res_hist.json()
        assert len(history) >= 5
        print(f" [PASS] 6. GET /api/v1/evaluate/history -> 200 OK (Retrieved {len(history)} persistent records with reasons)")

        # 7. Audit Detail by Evaluation ID: GET /api/v1/evaluate/history/{evaluation_id}
        res_detail = await client.get(f"/api/v1/evaluate/history/{eval_id5}")
        assert res_detail.status_code == 200
        detail_data = res_detail.json()
        assert detail_data["evaluation_id"] == eval_id5
        assert detail_data["decision"] == "REVIEW"
        assert any("CRITICAL DISCREPANCY" in r for r in detail_data["reasons"])
        print(f" [PASS] 7. GET /api/v1/evaluate/history/{eval_id5} -> 200 OK (Verified full causal reasons retrieved)")

    print("\n" + "="*70)
    print(">>> ALL 7 PHASE 3 FASTAPI EVALUATION API TESTS PASSED CLEANLY! <<<")
    print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(run_api_tests())
