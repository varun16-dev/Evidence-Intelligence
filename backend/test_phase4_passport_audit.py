import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import EvidencePassport
from sqlalchemy import select, update

async def run_phase4_tests():
    print("\n" + "="*70)
    print("PHASE 4: EVIDENCE PASSPORT & CRYPTOGRAPHIC AUDIT TEST SUITE")
    print("Testing Evidence Sealing, Digital Signatures, and Tamper Detection")
    print("="*70 + "\n")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # -------------------------------------------------------------
        # STEP 1: Generate Decision via Sufficiency Engine
        # -------------------------------------------------------------
        print("[STEP 1] Generating Sufficiency Decision for Ghost Batch Audit...")
        payload_eval = {
            "camera_trust": 0.95,
            "observability": 0.95,
            "detection_quality": 0.92,
            "temporal_persistence": 0.95,
            "scene_stability": 0.95,
            "record_agreement": 0.12, # Ghost batch discrepancy
            "anti_spoof": 1.00
        }
        eval_res = await client.post("/api/v1/evaluate/sufficiency", json=payload_eval)
        assert eval_res.status_code == 200
        verdict_data = eval_res.json()
        print(f" -> Sufficiency Verdict: {verdict_data['decision']} (Score: {verdict_data['evidence_score']})")

        # -------------------------------------------------------------
        # STEP 2: Create Sealed Evidence Passport
        # -------------------------------------------------------------
        print("\n[STEP 2] Creating and Sealing Evidence Passport...")
        passport_req = {
            "centre_id": "TC-DL-OKHLA-04",
            "room_id": "ROOM-101",
            "camera_id": "CAM-OKHLA-01",
            "event_type": "CLASSROOM_SESSION_ATTENDANCE",
            "compliance_finding": "High-priority Ghost Batch discrepancy detected",
            "verdict": verdict_data,
            "raw_keyframe_b64": "U0lIMjYyNDVfRVZJREVOQ0VfVEVTVF9GUkFNRQ==", # base64 mock image
            "evidence_features": {
                "detection_summary": {
                    "observed_headcount": 4,
                    "registered_headcount": 25,
                    "deficit": 21
                }
            }
        }
        pass_res = await client.post("/api/v1/passports/generate", json=passport_req)
        assert pass_res.status_code == 201, f"Failed to generate passport: {pass_res.text}"
        passport = pass_res.json()
        passport_id = passport["passport_id"]

        print(f" -> Passport ID: {passport_id}")
        print(f" -> Verdict: {passport['verdict']} | Score: {passport['final_evidence_score']}")
        print(f" -> Image SHA-256: {passport['image_sha256']}")
        print(f" -> Metadata SHA-256: {passport['metadata_sha256']}")
        print(f" -> Combined Evidence Hash: {passport['evidence_combined_hash']}")
        print(f" -> Digital Signature: {passport['event_signature'][:32]}... (HMAC-SHA256)")
        print(f" -> Genesis Audit Records: {len(passport['audit_logs'])}")

        assert passport["verdict"] == "REVIEW"
        assert len(passport["reasons_for_decision"]) > 0
        assert len(passport["audit_logs"]) == 1
        assert passport["audit_logs"][0]["action_performed"] == "PASSPORT_GENERATED_AND_SEALED"
        print(" [PASS] Step 2: Evidence Passport created, hashed, digitally signed, and genesis audit logged.")

        # -------------------------------------------------------------
        # STEP 3: Cryptographic Integrity Verification (Authentic Case)
        # -------------------------------------------------------------
        print("\n[STEP 3] Verifying Cryptographic Integrity on Authentic Evidence...")
        verify_res = await client.post(f"/api/v1/passports/{passport_id}/verify")
        assert verify_res.status_code == 200, f"Verify failed: {verify_res.text}"
        v_data = verify_res.json()

        print(f" -> Verification Status: {v_data['status']}")
        print(f" -> Is Authentic: {v_data['is_authentic']}")
        print(f" -> Stored Metadata Hash:     {v_data['stored_metadata_sha256']}")
        print(f" -> Recomputed Metadata Hash: {v_data['recomputed_metadata_sha256']}")
        print(f" -> Stored Combined Hash:     {v_data['stored_combined_hash']}")
        print(f" -> Recomputed Combined Hash: {v_data['recomputed_combined_hash']}")
        print(f" -> Signature Valid: {v_data['signature_valid']}")
        print(f" -> Details: {v_data['details']}")

        assert v_data["is_authentic"] is True
        assert v_data["status"] == "VALID"
        assert v_data["signature_valid"] is True
        print(" [PASS] Step 3: Original Evidence -> Hash -> Stored Hash -> Verified Authentic!")

        # -------------------------------------------------------------
        # STEP 4: Tamper Detection Demonstration (Modify Metadata)
        # -------------------------------------------------------------
        print("\n[STEP 4] Simulating Database Tampering (Adversary modifies evidence score)...")
        # Direct DB update simulating malicious insider or attacker changing the evidence score
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(EvidencePassport)
                .where(EvidencePassport.passport_id == passport_id)
                .values(final_evidence_score=0.999) # Malicious tampering!
            )
            await db.commit()
        print(" -> DB Altered: final_evidence_score modified from 0.87 to 0.999")

        # Run verification check again on tampered record
        tamper_res = await client.post(f"/api/v1/passports/{passport_id}/verify")
        assert tamper_res.status_code == 200
        t_data = tamper_res.json()

        print(f" -> Verification Status: {t_data['status']}")
        print(f" -> Is Authentic: {t_data['is_authentic']}")
        print(f" -> Stored Metadata Hash:     {t_data['stored_metadata_sha256']}")
        print(f" -> Recomputed Metadata Hash: {t_data['recomputed_metadata_sha256']}")
        print(f" -> Details: {t_data['details']}")

        assert t_data["is_authentic"] is False
        assert t_data["status"] == "TAMPERED_METADATA"
        print(" [PASS] Step 4: System successfully detected metadata tampering! Integrity violation caught.")

        # Revert tampering so passport is valid again
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(EvidencePassport)
                .where(EvidencePassport.passport_id == passport_id)
                .values(final_evidence_score=0.87)
            )
            await db.commit()
        print(" -> DB Restored to authentic state.")

        # -------------------------------------------------------------
        # STEP 5: Tamper Detection Demonstration (Modify Signature)
        # -------------------------------------------------------------
        print("\n[STEP 5] Simulating Signature Tampering (Adversary forges event signature)...")
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(EvidencePassport)
                .where(EvidencePassport.passport_id == passport_id)
                .values(event_signature="FORGED_SIGNATURE_000000000000000000000000000000000000000000000000")
            )
            await db.commit()

        sig_tamper_res = await client.post(f"/api/v1/passports/{passport_id}/verify")
        assert sig_tamper_res.status_code == 200
        sig_data = sig_tamper_res.json()
        print(f" -> Verification Status: {sig_data['status']}")
        print(f" -> Is Authentic: {sig_data['is_authentic']}")
        print(f" -> Details: {sig_data['details']}")
        assert sig_data["is_authentic"] is False
        assert sig_data["status"] == "INVALID_SIGNATURE"
        print(" [PASS] Step 5: System successfully rejected forged digital signature!")

        # Revert signature back to valid
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(EvidencePassport)
                .where(EvidencePassport.passport_id == passport_id)
                .values(event_signature=passport["event_signature"])
            )
            await db.commit()

        # -------------------------------------------------------------
        # STEP 6: Officer Adjudication & Audit Trail Chaining
        # -------------------------------------------------------------
        print("\n[STEP 6] Testing Human Officer Adjudication & Audit Chaining...")
        adjudicate_req = {
            "officer_id": "OFFICER-RAJESH-92",
            "review_status": "INSPECTION_MANDATED",
            "officer_remarks": "Conclusive Ghost Batch evidence verified. Physical vigilance inspection ordered under NSDC Section 14."
        }
        adj_res = await client.post(f"/api/v1/passports/{passport_id}/adjudicate", json=adjudicate_req)
        assert adj_res.status_code == 200, f"Adjudication failed: {adj_res.text}"
        adj_passport = adj_res.json()

        print(f" -> Updated Review Status: {adj_passport['review_status']}")
        print(f" -> Assigned Officer: {adj_passport['assigned_officer_id']}")
        print(f" -> Officer Remarks: {adj_passport['officer_remarks']}")
        print(f" -> Total Audit Chain Records: {len(adj_passport['audit_logs'])}")

        assert adj_passport["review_status"] == "INSPECTION_MANDATED"
        assert adj_passport["assigned_officer_id"] == "OFFICER-RAJESH-92"
        assert len(adj_passport["audit_logs"]) >= 3 # 1 (genesis) + 2 (integrity check logs) + 1 (adjudication)

        latest_audit = adj_passport["audit_logs"][-1]
        print(f" -> Latest Audit Step: #{latest_audit['step_sequence']} - {latest_audit['action_performed']} by {latest_audit['actor_id']}")
        assert latest_audit["action_performed"] == "ADJUDICATION_INSPECTION_MANDATED"
        assert latest_audit["actor_role"] == "OFFICER"
        print(" [PASS] Step 6: Human Officer review recorded with chained audit log.")

        # -------------------------------------------------------------
        # STEP 7: Listing Passports with Filtering
        # -------------------------------------------------------------
        print("\n[STEP 7] Listing Passports via API (Filtering by verdict=REVIEW)...")
        list_res = await client.get("/api/v1/passports?verdict=REVIEW")
        assert list_res.status_code == 200
        passports_list = list_res.json()
        print(f" -> Found {len(passports_list)} passport(s) with verdict REVIEW")
        assert len(passports_list) >= 1
        print(" [PASS] Step 7: Passports listing and filtering verified.\n")

    print("="*70)
    print(">>> ALL 7 PHASE 4 EVIDENCE PASSPORT & AUDIT TESTS PASSED CLEANLY! <<<")
    print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(run_phase4_tests())
