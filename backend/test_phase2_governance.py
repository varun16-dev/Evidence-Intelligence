import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from backend.app.main import app

async def run_tests():
    print("\n" + "="*70)
    print("PHASE 2 GOVERNANCE SECURITY & IMMUTABILITY VERIFICATION SUITE")
    print("="*70 + "\n")
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Authenticate users
        admin_res = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
        assert admin_res.status_code == 200
        admin_token = admin_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        officer_res = await client.post("/api/v1/auth/login", json={"username": "officer_rajesh", "password": "officer123"})
        assert officer_res.status_code == 200
        officer_token = officer_res.json()["access_token"]
        officer_headers = {"Authorization": f"Bearer {officer_token}"}

        # -------------------------------------------------------------
        # 1. Anonymous Access Restrictions (Must all be 401)
        # -------------------------------------------------------------
        res = await client.post("/api/v1/governance/passports/PASS-TEST-99/action", json={"action": "CONFIRM", "reason": "Test"})
        assert res.status_code == 401, f"Anonymous governance action not 401: {res.status_code}"
        print(" [PASS] 1. Anonymous governance request -> 401 Unauthorized")

        res = await client.get("/api/v1/passports")
        assert res.status_code == 401, f"Anonymous passport list not 401: {res.status_code}"
        print(" [PASS] 2. Anonymous passport request (GET /passports) -> 401 Unauthorized")

        res = await client.get("/api/v1/governance/review-queue")
        assert res.status_code == 401, f"Anonymous review queue not 401: {res.status_code}"
        print(" [PASS] 3. Anonymous review queue request (GET /governance/review-queue) -> 401 Unauthorized")

        res = await client.post("/api/v1/passports/generate", json={})
        assert res.status_code == 401, f"Anonymous passport generate not 401: {res.status_code}"
        print(" [PASS] 4. Anonymous passport generation -> 401 Unauthorized")

        # -------------------------------------------------------------
        # Generate a test passport using Officer token
        # -------------------------------------------------------------
        passport_payload = {
            "centre_id": "TC-DL-OKHLA-04",
            "room_id": "ROOM-101",
            "camera_id": "CAM-LAB-01",
            "event_type": "ATTENDANCE_EVALUATION",
            "compliance_finding": "High Discrepancy Contradiction Test",
            "verdict": {
                "decision": "REVIEW",
                "evidence_score": 0.82,
                "confidence": 0.82,
                "reasons": ["CRITICAL DISCREPANCY: CCTV observed 4 students vs 25 expected"],
                "contributing_factors": {
                    "camera_trust": 0.95,
                    "observability": 0.92,
                    "detection_quality": 0.90,
                    "temporal_persistence": 0.95,
                    "scene_stability": 0.90,
                    "record_agreement": 0.16,
                    "anti_spoof": 1.00
                }
            }
        }
        gen_res = await client.post("/api/v1/passports/generate", json=passport_payload, headers=officer_headers)
        assert gen_res.status_code == 201, f"Failed to generate passport: {gen_res.text}"
        created_passport = gen_res.json()
        passport_id = created_passport["passport_id"]
        original_ai_verdict = created_passport["verdict"]
        assert original_ai_verdict == "REVIEW"
        print(f" [PASS] 5. Created initial test passport ({passport_id}) with AI verdict: {original_ai_verdict}")

        # -------------------------------------------------------------
        # 2. Role Enforcement on Governance Adjudication
        # -------------------------------------------------------------
        # Admin attempting governance action -> MUST BE FORBIDDEN (403)
        admin_action_payload = {
            "action": "CONFIRM",
            "reason": "Admin attempting unauthorized adjudication"
        }
        res = await client.post(f"/api/v1/governance/passports/{passport_id}/action", json=admin_action_payload, headers=admin_headers)
        assert res.status_code == 403, f"Admin governance action not 403: {res.status_code}"
        print(" [PASS] 6. ADMIN governance action rejection -> 403 Forbidden (Only Officers can adjudicate)")

        # -------------------------------------------------------------
        # 3. Reviewer Impersonation Defense & Identity from JWT
        # -------------------------------------------------------------
        # Officer submits action with spoofed reviewer names in body
        spoofed_payload = {
            "action": "CONFIRM",
            "reason": "Verified on-site biometric logs confirm ghost batch discrepancy",
            "reviewer": "fake_admin_super_user",
            "reviewer_username": "fake_inspector_general"
        }
        res = await client.post(f"/api/v1/governance/passports/{passport_id}/action", json=spoofed_payload, headers=officer_headers)
        assert res.status_code == 200, f"Officer governance action failed: {res.text}"
        adjudicated = res.json()
        print(" [PASS] 7. OFFICER governance action execution -> 200 OK")

        # Verify reviewer identity: MUST BE 'officer_rajesh' (authenticated user), NOT 'fake_admin_super_user'
        assert adjudicated["assigned_officer_id"] == "officer_rajesh", \
            f"Expected officer_rajesh, but got spoofed id: {adjudicated['assigned_officer_id']}"
        print(f" [PASS] 8. Officer identity strictly derived from JWT sub ('{adjudicated['assigned_officer_id']}'); spoofed name ignored!")

        # -------------------------------------------------------------
        # 4. Immutability of Original AI Verdict
        # -------------------------------------------------------------
        # Original verdict must REMAIN "REVIEW"
        assert adjudicated["verdict"] == "REVIEW", f"AI verdict was overwritten: {adjudicated['verdict']}"
        print(f" [PASS] 9. Original AI verdict is IMMUTABLE: remains '{adjudicated['verdict']}' (not overwritten)")

        # -------------------------------------------------------------
        # 5. Governance Decision Recorded Separately
        # -------------------------------------------------------------
        assert adjudicated["governance_decision"] == "CONFIRMED"
        assert adjudicated["review_status"] == "CONFIRMED"
        print(f" [PASS] 10. Governance decision recorded separately: governance_decision='{adjudicated['governance_decision']}'")

        # -------------------------------------------------------------
        # 6. Decision History Audit Ledger Verification
        # -------------------------------------------------------------
        history = adjudicated["decision_history"]
        assert len(history) >= 1
        latest_entry = history[-1]
        assert latest_entry["actor"] == "officer_rajesh"
        assert latest_entry["reviewer"] == "officer_rajesh"
        assert latest_entry["action"] == "CONFIRM"
        assert latest_entry["original_ai_verdict"] == "REVIEW"
        assert "Verified on-site biometric logs" in latest_entry["reason"]
        print(f" [PASS] 11. Decision history records authenticated officer ('{latest_entry['actor']}') and original AI verdict")

        # -------------------------------------------------------------
        # 7. Permitted Admin Read / Audit Operations
        # -------------------------------------------------------------
        # Admin CAN read review queue for oversight
        res = await client.get("/api/v1/governance/review-queue", headers=admin_headers)
        assert res.status_code == 200, f"Admin read review queue failed: {res.status_code}"
        print(" [PASS] 12. Admin read review queue oversight -> 200 OK")

        # Admin CAN view passport details
        res = await client.get(f"/api/v1/passports/{passport_id}", headers=admin_headers)
        assert res.status_code == 200, f"Admin read passport failed: {res.status_code}"
        print(f" [PASS] 13. Admin view passport details -> 200 OK")

        # -------------------------------------------------------------
        # 8. Officer Cannot Perform Admin-Only Mutations
        # -------------------------------------------------------------
        res = await client.post("/api/v1/centres", json={"centre_id": "TC-HACK", "centre_name": "Hack", "state": "DL", "district": "ND", "accredited_trades": []}, headers=officer_headers)
        assert res.status_code == 403, f"Officer centre creation was not forbidden: {res.status_code}"
        print(" [PASS] 14. Officer cannot create training centres -> 403 Forbidden")

    print("\n" + "="*70)
    print("ALL 14 PHASE 2 GOVERNANCE SECURITY & IMMUTABILITY CHECKS PASSED!")
    print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
