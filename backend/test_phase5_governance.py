import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from backend.app.main import app

async def run_phase5_governance_tests():
    print("\n" + "="*75)
    print("PHASE 5: HUMAN GOVERNANCE & ADJUDICATION TEST SUITE")
    print("SIH26245: Human-in-the-Loop Oversight for REVIEW & ABSTAIN Compliance Cases")
    print("="*75 + "\n")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # -----------------------------------------------------------------
        # STEP 1: Set Up Compliance Passports for Testing
        # - Case A: Ambiguous attendance (Verdict: REVIEW)
        # - Case B: Severely degraded camera (Verdict: ABSTAIN)
        # - Case C: Perfect high confidence (Verdict: VERIFIED - Auto-cleared)
        # -----------------------------------------------------------------
        print("[TEST 1] Generating Test Compliance Decisions across all verdicts...")

        # Case A: REVIEW (Ghost Batch Discrepancy)
        eval_review = await client.post("/api/v1/evaluate/sufficiency", json={
            "camera_trust": 0.92,
            "observability": 0.90,
            "detection_quality": 0.88,
            "temporal_persistence": 0.95,
            "scene_stability": 0.90,
            "record_agreement": 0.15,  # Contradiction
            "anti_spoof": 1.00
        })
        assert eval_review.status_code == 200
        v_review = eval_review.json()
        assert v_review["decision"] == "REVIEW"

        pass_review_res = await client.post("/api/v1/passports/generate", json={
            "centre_id": "TC-DL-SOUTH-01",
            "room_id": "ROOM-LAB-A",
            "camera_id": "CAM-LAB-01",
            "event_type": "SESSION_ATTENDANCE_AUDIT",
            "compliance_finding": "Suspected Ghost Batch: Roster indicates 28 candidates, CCTV indicates 5",
            "verdict": v_review,
            "evidence_features": {
                "detection_summary": {"observed": 5, "registered": 28, "deficit": 23}
            }
        })
        assert pass_review_res.status_code == 201
        passport_review = pass_review_res.json()
        p_review_id = passport_review["passport_id"]
        print(f" -> Generated REVIEW Passport: {p_review_id} (Status: {passport_review['review_status']})")
        assert passport_review["review_status"] == "PENDING"

        # Case B: ABSTAIN (Camera Occluded / Glare / Failure)
        eval_abstain = await client.post("/api/v1/evaluate/sufficiency", json={
            "camera_trust": 0.20,
            "observability": 0.25,
            "detection_quality": 0.20,
            "temporal_persistence": 0.30,
            "scene_stability": 0.35,
            "record_agreement": 0.50,
            "anti_spoof": 0.40
        })
        assert eval_abstain.status_code == 200
        v_abstain = eval_abstain.json()
        assert v_abstain["decision"] == "ABSTAIN"

        pass_abstain_res = await client.post("/api/v1/passports/generate", json={
            "centre_id": "TC-MH-PUNE-03",
            "room_id": "ROOM-IT-102",
            "camera_id": "CAM-PUNE-09",
            "event_type": "INFRASTRUCTURE_AVAILABILITY",
            "compliance_finding": "Camera lens obstructed; insufficient optical evidence to assess compliance",
            "verdict": v_abstain,
            "evidence_features": {
                "detection_summary": {"lens_obstruction": True, "confidence": 0.15}
            }
        })
        assert pass_abstain_res.status_code == 201
        passport_abstain = pass_abstain_res.json()
        p_abstain_id = passport_abstain["passport_id"]
        print(f" -> Generated ABSTAIN Passport: {p_abstain_id} (Status: {passport_abstain['review_status']})")
        assert passport_abstain["review_status"] == "PENDING"

        # Case C: VERIFIED (Clear Pass)
        eval_verified = await client.post("/api/v1/evaluate/sufficiency", json={
            "camera_trust": 0.98,
            "observability": 0.96,
            "detection_quality": 0.95,
            "temporal_persistence": 0.98,
            "scene_stability": 0.94,
            "record_agreement": 0.97,
            "anti_spoof": 1.00
        })
        assert eval_verified.status_code == 200
        v_verified = eval_verified.json()
        assert v_verified["decision"] == "VERIFIED"

        pass_verif_res = await client.post("/api/v1/passports/generate", json={
            "centre_id": "TC-KA-BLR-01",
            "room_id": "ROOM-CAD-01",
            "camera_id": "CAM-BLR-02",
            "event_type": "SESSION_ATTENDANCE_AUDIT",
            "compliance_finding": "Verified attendance matches authoritative registration within 97% confidence",
            "verdict": v_verified
        })
        assert pass_verif_res.status_code == 201
        passport_verif = pass_verif_res.json()
        print(f" -> Generated VERIFIED Passport: {passport_verif['passport_id']} (Status: {passport_verif['review_status']})")
        assert passport_verif["review_status"] == "AUTO_CLEARED"

        # -----------------------------------------------------------------
        # STEP 2: Verify Review Queue Filtering and Stats
        # -----------------------------------------------------------------
        print("\n[TEST 2] Verifying Review Queue Triage and Metrics...")
        q_res = await client.get("/api/v1/governance/review-queue")
        assert q_res.status_code == 200
        q_data = q_res.json()

        stats = q_data["stats"]
        items = q_data["items"]
        print(f" -> Total Pending In Queue: {stats['total_in_queue']}")
        print(f" -> Pending REVIEW Cases: {stats['pending_review_count']}")
        print(f" -> Pending ABSTAIN Cases: {stats['pending_abstain_count']}")
        print(f" -> Adjudicated Cases: {stats['adjudicated_count']}")

        assert stats["total_in_queue"] >= 2
        assert stats["pending_review_count"] >= 1
        assert stats["pending_abstain_count"] >= 1

        # Confirm queue only returns REVIEW and ABSTAIN pending items
        item_ids = [it["passport_id"] for it in items]
        assert p_review_id in item_ids
        assert p_abstain_id in item_ids
        assert passport_verif["passport_id"] not in item_ids, "AUTO_CLEARED cases must not be in pending queue!"

        for it in items:
            assert it["verdict"] in ("REVIEW", "ABSTAIN")
            assert it["review_status"] == "PENDING"
        print(" -> Queue successfully enforces triage boundaries!")

        # -----------------------------------------------------------------
        # STEP 3: Reviewer Inspects Evidence Passport Before Decision
        # -----------------------------------------------------------------
        print(f"\n[TEST 3] Reviewer Inspects Full Evidence Passport {p_review_id}...")
        inspect_res = await client.get(f"/api/v1/governance/passports/{p_review_id}")
        assert inspect_res.status_code == 200
        p_detail = inspect_res.json()

        # Check all required inspectable evidence dimensions
        assert p_detail["passport_id"] == p_review_id
        assert p_detail["verdict"] == "REVIEW"
        assert p_detail["final_evidence_score"] > 0
        assert "camera_trust" in p_detail and p_detail["camera_trust"] is not None
        assert "observability" in p_detail and p_detail["observability"] is not None
        assert "temporal_evidence" in p_detail and p_detail["temporal_evidence"] is not None
        assert "record_agreement" in p_detail and p_detail["record_agreement"] is not None
        assert len(p_detail["reasons_for_decision"]) > 0
        assert len(p_detail["decision_history"]) == 1  # Genesis automated step
        assert p_detail["decision_history"][0]["action"] == "AUTOMATED_EVALUATION"
        assert len(p_detail["audit_logs"]) >= 1
        print(" -> Evidence Passport inspection verified: Full multi-factor data present!")

        # -----------------------------------------------------------------
        # STEP 4: Reviewer Action: CONFIRM
        # -----------------------------------------------------------------
        print(f"\n[TEST 4] Reviewer Executes Action: CONFIRM on {p_review_id}...")
        confirm_payload = {
            "reviewer": "OFFICER-RAJESH-SHARMA-042",
            "action": "CONFIRM",
            "reason": "Independent verification confirms that only 5 students were seated during the 2-hour window. Confirmed Ghost Batch violation."
        }
        confirm_res = await client.post(f"/api/v1/governance/passports/{p_review_id}/action", json=confirm_payload)
        assert confirm_res.status_code == 200
        p_confirmed = confirm_res.json()

        # Invariant 1: System MUST NOT silently overwrite original AI decision
        assert p_confirmed["verdict"] == "REVIEW", "CRITICAL FAILURE: Original AI decision was overwritten!"
        print(f" -> INVARIANT PRESERVED: Original AI verdict remains '{p_confirmed['verdict']}'")

        # Invariant 2: Governance decision and status updated
        assert p_confirmed["governance_decision"] == "CONFIRMED"
        assert p_confirmed["review_status"] == "CONFIRMED"
        assert p_confirmed["assigned_officer_id"] == "OFFICER-RAJESH-SHARMA-042"

        # Invariant 3: Decision history preserved
        history = p_confirmed["decision_history"]
        assert len(history) == 2
        step1 = history[0]
        step2 = history[1]
        assert step1["step"] == 1
        assert step1["action"] == "AUTOMATED_EVALUATION"
        assert step1["new_decision"] == "REVIEW"

        assert step2["step"] == 2
        assert step2["reviewer"] == "OFFICER-RAJESH-SHARMA-042"
        assert step2["action"] == "CONFIRM"
        assert step2["previous_decision"] == "REVIEW"
        assert step2["new_decision"] == "CONFIRMED"
        assert "Ghost Batch violation" in step2["reason"]
        assert step2["original_ai_verdict"] == "REVIEW"
        assert "timestamp" in step2
        print(" -> Decision history updated with complete transition metadata!")

        # Invariant 4: Chained audit event recorded
        audit_logs = p_confirmed["audit_logs"]
        assert len(audit_logs) >= 2
        latest_audit = audit_logs[-1]
        assert latest_audit["actor_id"] == "OFFICER-RAJESH-SHARMA-042"
        assert latest_audit["action_performed"] == "GOVERNANCE_CONFIRM"
        assert "OFFICER-RAJESH-SHARMA-042" in latest_audit["notes"]
        print(f" -> Chained audit event logged: seq #{latest_audit['step_sequence']} with hash {latest_audit['signed_hash'][:16]}...")

        # -----------------------------------------------------------------
        # STEP 5: Reviewer Action: REJECT
        # -----------------------------------------------------------------
        print(f"\n[TEST 5] Reviewer Executes Action: REJECT on {p_abstain_id}...")
        reject_payload = {
            "reviewer": "OFFICER-PRIYA-MENON-015",
            "action": "REJECT",
            "reason": "Temporary scaffolding for authorized ceiling fan maintenance caused obstruction. Dismiss breach."
        }
        reject_res = await client.post(f"/api/v1/governance/passports/{p_abstain_id}/action", json=reject_payload)
        assert reject_res.status_code == 200
        p_rejected = reject_res.json()

        assert p_rejected["verdict"] == "ABSTAIN", "Original AI verdict must remain ABSTAIN!"
        assert p_rejected["governance_decision"] == "REJECTED"
        assert p_rejected["review_status"] == "REJECTED"
        assert len(p_rejected["decision_history"]) == 2
        assert p_rejected["decision_history"][1]["action"] == "REJECT"
        assert p_rejected["decision_history"][1]["previous_decision"] == "ABSTAIN"
        assert p_rejected["decision_history"][1]["new_decision"] == "REJECTED"
        print(" -> REJECT action successfully recorded without altering original AI verdict!")

        # -----------------------------------------------------------------
        # STEP 6: Multi-Stage Escalation: REQUEST INSPECTION -> CONFIRM
        # -----------------------------------------------------------------
        print("\n[TEST 6] Testing Multi-Stage Escalation: REQUEST INSPECTION -> CONFIRM...")

        # Create a new ambiguous passport
        pass_esc_res = await client.post("/api/v1/passports/generate", json={
            "centre_id": "TC-UP-NOIDA-02",
            "room_id": "ROOM-WELDING-04",
            "camera_id": "CAM-NOIDA-08",
            "event_type": "EQUIPMENT_PRESENCE_AUDIT",
            "compliance_finding": "Hydraulic training rig visually occluded by partition",
            "verdict": v_review
        })
        assert pass_esc_res.status_code == 201
        p_esc_id = pass_esc_res.json()["passport_id"]

        # Stage 6A: Officer requests physical inspection
        print(f" -> Stage 6A: Officer requests physical vigilance inspection on {p_esc_id}...")
        req_insp_payload = {
            "reviewer": "OFFICER-KUMAR-088",
            "action": "REQUEST INSPECTION",
            "reason": "Partition wall obstructs camera angle. Mandate State Flying Squad on-site visit."
        }
        insp_res = await client.post(f"/api/v1/governance/passports/{p_esc_id}/action", json=req_insp_payload)
        assert insp_res.status_code == 200
        p_insp = insp_res.json()

        assert p_insp["verdict"] == "REVIEW"
        assert p_insp["governance_decision"] == "INSPECTION_REQUESTED"
        assert p_insp["review_status"] == "INSPECTION_REQUESTED"
        assert len(p_insp["decision_history"]) == 2
        assert p_insp["decision_history"][1]["new_decision"] == "INSPECTION_REQUESTED"

        # Stage 6B: State Flying Squad returns with inspection report -> Final confirmation
        print(f" -> Stage 6B: Flying squad submits on-site findings -> Director confirms breach on {p_esc_id}...")
        final_confirm_payload = {
            "reviewer": "DIRECTOR-VIGILANCE-HQ-001",
            "action": "CONFIRM",
            "reason": "Flying Squad report #SFS-UP-2026-088 confirms hydraulic training rig was removed from premises."
        }
        final_res = await client.post(f"/api/v1/governance/passports/{p_esc_id}/action", json=final_confirm_payload)
        assert final_res.status_code == 200
        p_final = final_res.json()

        # Check complete 3-step decision history
        assert p_final["verdict"] == "REVIEW", "Original AI verdict must remain REVIEW across entire lifecycle!"
        assert p_final["governance_decision"] == "CONFIRMED"
        assert len(p_final["decision_history"]) == 3

        h1 = p_final["decision_history"][0]
        h2 = p_final["decision_history"][1]
        h3 = p_final["decision_history"][2]

        print(f"    Step 1: {h1['action']} -> Result: {h1['new_decision']}")
        print(f"    Step 2: {h2['action']} by {h2['reviewer']} -> Prev: {h2['previous_decision']}, New: {h2['new_decision']}")
        print(f"    Step 3: {h3['action']} by {h3['reviewer']} -> Prev: {h3['previous_decision']}, New: {h3['new_decision']}")

        assert h2["previous_decision"] == "REVIEW"
        assert h2["new_decision"] == "INSPECTION_REQUESTED"
        assert h3["previous_decision"] == "INSPECTION_REQUESTED"
        assert h3["new_decision"] == "CONFIRMED"
        assert h3["reviewer"] == "DIRECTOR-VIGILANCE-HQ-001"

        # Check that audit log has 3 chained records
        assert len(p_final["audit_logs"]) == 3
        assert p_final["audit_logs"][0]["action_performed"] == "PASSPORT_GENERATED_AND_SEALED"
        assert p_final["audit_logs"][1]["action_performed"] == "GOVERNANCE_REQUEST_INSPECTION"
        assert p_final["audit_logs"][2]["action_performed"] == "GOVERNANCE_CONFIRM"
        print(" -> Multi-stage escalation lifecycle validated with unbroken audit chain!")

        # -----------------------------------------------------------------
        # STEP 7: Validation and Error Handling
        # -----------------------------------------------------------------
        print("\n[TEST 7] Testing Input Validation & Error Enforcements...")
        bad_action_res = await client.post(f"/api/v1/governance/passports/{p_review_id}/action", json={
            "reviewer": "OFFICER-TEST",
            "action": "INVALID_RANDOM_ACTION",
            "reason": "Testing invalid action rejection"
        })
        assert bad_action_res.status_code == 400
        print(f" -> Correctly rejected invalid action: {bad_action_res.json()['detail']}")

        not_found_res = await client.post("/api/v1/governance/passports/PASS-DOESNOTEXIST/action", json={
            "reviewer": "OFFICER-TEST",
            "action": "CONFIRM",
            "reason": "Testing not found"
        })
        assert not_found_res.status_code == 404
        print(f" -> Correctly returned 404 for non-existent passport")

    print("\n" + "="*75)
    print("ALL 7 PHASE 5 HUMAN GOVERNANCE TESTS PASSED SUCCESSFULLY!")
    print("="*75 + "\n")

if __name__ == "__main__":
    asyncio.run(run_phase5_governance_tests())
