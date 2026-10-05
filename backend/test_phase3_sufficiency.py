import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.sufficiency_engine import EvidenceSufficiencyEngine

def run_sufficiency_tests():
    print("\n" + "="*70)
    print("PHASE 3: EVIDENCE SUFFICIENCY ENGINE TEST SUITE")
    print("Testing Epistemic Boundaries & Explainable Decision Routing")
    print("="*70 + "\n")

    engine = EvidenceSufficiencyEngine()

    # -----------------------------------------------------------------
    # TEST 1: Strong Evidence -> VERIFIED
    # -----------------------------------------------------------------
    print("[TEST 1] Strong Evidence (Pristine camera, persistent attendance, record agreement)...")
    res1 = engine.evaluate(
        camera_trust=0.94,
        observability=0.95,
        detection_quality=0.92,
        temporal_persistence=0.95,
        scene_stability=0.95,
        record_agreement=1.00,
        anti_spoof=1.00
    )
    print(f" -> Decision: {res1.decision} | Score: {res1.evidence_score} | Confidence: {res1.confidence}")
    assert res1.decision == "VERIFIED", f"Expected VERIFIED, got {res1.decision}"
    assert res1.evidence_score >= 0.75
    assert any("COMPLIANCE VERIFIED" in r for r in res1.reasons)
    print(" [PASS] Test 1: High trust and record agreement correctly yielded VERIFIED.\n")

    # -----------------------------------------------------------------
    # TEST 2: Ambiguous Evidence -> REVIEW
    # -----------------------------------------------------------------
    print("[TEST 2] Ambiguous Evidence (Borderline camera clarity & dwell)...")
    res2 = engine.evaluate(
        camera_trust=0.65,
        observability=0.60,
        detection_quality=0.55,
        temporal_persistence=0.52,
        scene_stability=0.70,
        record_agreement=0.75,
        anti_spoof=1.00
    )
    print(f" -> Decision: {res2.decision} | Score: {res2.evidence_score} | Confidence: {res2.confidence}")
    assert res2.decision == "REVIEW", f"Expected REVIEW, got {res2.decision}"
    assert 0.45 <= res2.evidence_score < 0.75
    assert any("AMBIGUOUS" in r for r in res2.reasons)
    print(" [PASS] Test 2: Borderline metrics correctly yielded REVIEW for officer triage.\n")

    # -----------------------------------------------------------------
    # TEST 3: Insufficient Evidence -> ABSTAIN
    # -----------------------------------------------------------------
    print("[TEST 3] Insufficient Evidence (Weak signals, high noise, low dwell)...")
    res3 = engine.evaluate(
        camera_trust=0.35,
        observability=0.35,
        detection_quality=0.30,
        temporal_persistence=0.25,
        scene_stability=0.40,
        record_agreement=0.50,
        anti_spoof=1.00
    )
    print(f" -> Decision: {res3.decision} | Score: {res3.evidence_score} | Confidence: {res3.confidence}")
    assert res3.decision == "ABSTAIN", f"Expected ABSTAIN, got {res3.decision}"
    assert res3.evidence_score < 0.45
    assert any("INSUFFICIENT EVIDENCE" in r for r in res3.reasons)
    print(" [PASS] Test 3: Weak evidence correctly yielded ABSTAIN instead of forcing a decision.\n")

    # -----------------------------------------------------------------
    # TEST 4: Camera Failure / Sensor Tamper -> ABSTAIN
    # -----------------------------------------------------------------
    print("[TEST 4A] Camera Failure: Severe Optical Blur (Laplacian var < 22, Trust < 0.20)...")
    res4a = engine.evaluate(
        camera_trust=0.12, # Hard fail (< 0.20)
        observability=0.90,
        detection_quality=0.85,
        temporal_persistence=0.90,
        scene_stability=0.85,
        record_agreement=0.20,
        anti_spoof=1.00
    )
    print(f" -> Decision: {res4a.decision} | Score: {res4a.evidence_score}")
    assert res4a.decision == "ABSTAIN", f"Expected ABSTAIN, got {res4a.decision}"
    assert any("CAMERA TRUST VETO" in r for r in res4a.reasons)
    print(" [PASS] Test 4A: Optical blur tripped Hard Veto Gate -> ABSTAIN.\n")

    print("[TEST 4B] Camera Failure: Stream Frozen / Replay Loop (Anti-spoof == 0.0)...")
    res4b = engine.evaluate(
        camera_trust=0.95,
        observability=0.95,
        detection_quality=0.95,
        temporal_persistence=0.95,
        scene_stability=0.95,
        record_agreement=1.00,
        anti_spoof=0.00 # Hard fail: Frozen video
    )
    print(f" -> Decision: {res4b.decision} | Score: {res4b.evidence_score}")
    assert res4b.decision == "ABSTAIN", f"Expected ABSTAIN, got {res4b.decision}"
    assert any("ANTI-SPOOF VETO" in r for r in res4b.reasons)
    print(" [PASS] Test 4B: Frozen feed tripped Anti-Spoof Veto Gate -> ABSTAIN.\n")

    print("[TEST 4C] Camera Failure: Lens Covered / Camera Blocked (Observability < 0.30)...")
    res4c = engine.evaluate(
        camera_trust=0.90,
        observability=0.15, # Hard fail: View obstructed
        detection_quality=0.80,
        temporal_persistence=0.80,
        scene_stability=0.80,
        record_agreement=0.20,
        anti_spoof=1.00
    )
    print(f" -> Decision: {res4c.decision} | Score: {res4c.evidence_score}")
    assert res4c.decision == "ABSTAIN", f"Expected ABSTAIN, got {res4c.decision}"
    assert any("OBSERVABILITY VETO" in r for r in res4c.reasons)
    print(" [PASS] Test 4C: Camera obstruction tripped Observability Veto Gate -> ABSTAIN.\n")

    # -----------------------------------------------------------------
    # TEST 4D: Camera Failure / Degradation -> Sensor Defect Protection
    # -----------------------------------------------------------------
    print("[TEST 4D] Camera Degradation: High AI detection confidence (0.95) with Degraded Camera (0.35)...")
    res4d = engine.evaluate(
        camera_trust=0.35, # Degraded optical clarity & stuttering FPS
        observability=0.60,
        detection_quality=0.95, # AI model is confident, but camera is shaky!
        temporal_persistence=0.70,
        scene_stability=0.60,
        record_agreement=0.90,
        anti_spoof=1.00
    )
    print(f" -> Decision: {res4d.decision} | Score: {res4d.evidence_score} | Confidence: {res4d.confidence}")
    # Must NOT verify blindly just because detection confidence is 0.95!
    assert res4d.decision in ("REVIEW", "ABSTAIN"), f"Expected REVIEW or ABSTAIN due to degraded camera, got {res4d.decision}"
    assert res4d.evidence_score < 0.75, "Degraded camera should have dragged evidence score below VERIFIED threshold"
    print(" [PASS] Test 4D: Sensor degradation prevented false verification ('Detection Confidence != Decision Confidence').\n")

    # -----------------------------------------------------------------
    # TEST 5: CCTV / Record Contradiction (Ghost Batch with Pristine Camera) -> REVIEW
    # -----------------------------------------------------------------
    print("[TEST 5] CCTV / Record Contradiction (Ghost Batch: 4 observed vs 25 registered, Pristine camera)...")
    res5 = engine.evaluate(
        camera_trust=0.95, # Pristine camera
        observability=0.95,
        detection_quality=0.92,
        temporal_persistence=0.95,
        scene_stability=0.95,
        record_agreement=0.12, # Severe contradiction (|4 - 25| = 21 deficit)
        anti_spoof=1.00
    )
    print(f" -> Decision: {res5.decision} | Score: {res5.evidence_score} | Confidence: {res5.confidence}")
    assert res5.decision == "REVIEW", f"Expected REVIEW, got {res5.decision}"
    assert res5.evidence_score >= 0.75
    assert any("HIGH-PRIORITY BREACH EVIDENCE" in r for r in res5.reasons)
    assert any("CRITICAL DISCREPANCY" in r for r in res5.reasons)
    print(" [PASS] Test 5: Conclusive breach evidence correctly compiled for Officer Confirmation (REVIEW).\n")

    # -----------------------------------------------------------------
    # TEST 6: Reason Storage & Audit Trail Integrity
    # -----------------------------------------------------------------
    print("[TEST 6] Permanent Accountability: Verifying that every decision stored its reasons...")
    history = engine.get_decision_history()
    print(f" -> Total recorded evaluations in engine history: {len(history)}")
    assert len(history) >= 7, f"Expected at least 7 history records, found {len(history)}"

    # Check that res1 and res5 stored their full details and reasons
    stored_res1 = engine.get_decision(res1.evaluation_id)
    assert stored_res1 is not None, "Evaluation record for Test 1 was not persisted!"
    assert stored_res1["decision"] == "VERIFIED"
    assert len(stored_res1["reasons"]) > 0
    assert "evaluation_id" in stored_res1
    assert "evaluated_at" in stored_res1

    stored_res5 = engine.get_decision(res5.evaluation_id)
    assert stored_res5 is not None, "Evaluation record for Test 5 was not persisted!"
    assert stored_res5["decision"] == "REVIEW"
    assert any("HIGH-PRIORITY BREACH EVIDENCE" in r for r in stored_res5["reasons"])
    print(" [PASS] Test 6: Every decision and its causal reasons are durably stored with evaluation IDs.\n")

    # -----------------------------------------------------------------
    # TEST 7: Perception Features Adapter
    # -----------------------------------------------------------------
    print("[TEST 7] Feature Adapter: Fusing Edge AI perceptions directly with roster...")
    res7 = engine.evaluate_from_features(
        composite_camera_trust=0.92,
        detection_quality_score=0.90,
        persistence_ratio=0.88,
        stability_score=0.90,
        observed_headcount=20,
        registered_headcount=20,
        freeze_detected=False,
        interframe_mad=3.5,
        observability_score=0.95
    )
    print(f" -> Decision: {res7.decision} | Score: {res7.evidence_score}")
    assert res7.decision == "VERIFIED"
    print(" [PASS] Test 7: Direct perception feature fusion successfully evaluated and verified.\n")

    print("="*70)
    print("SAMPLE VERDICT PAYLOAD (TEST 5 - GHOST BATCH AUDIT):")
    print("="*70)
    print(res5.model_dump_json(indent=2))
    print("="*70)
    print("\n>>> ALL 7 PHASE 3 EVIDENCE SUFFICIENCY ENGINE TESTS PASSED CLEANLY! <<<\n")

if __name__ == "__main__":
    run_sufficiency_tests()
