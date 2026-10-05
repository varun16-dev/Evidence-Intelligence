"""
PHASE 4 OFFICER EVIDENCE REVIEW & GOVERNANCE WORKFLOW TEST SUITE
Tests the end-to-end Officer & Admin flows against the running server.
"""
import urllib.request
import urllib.parse
import json

BASE = "http://127.0.0.1:8000/api/v1"

def post_json(url, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get_json(url, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def run_tests():
    print("=" * 65)
    print("PHASE 4 OFFICER EVIDENCE REVIEW & GOVERNANCE VERIFICATION")
    print("=" * 65)

    # TEST A: Officer Login
    code, off_login = post_json(f"{BASE}/auth/login", {"username": "officer_rajesh", "password": "officer123"})
    assert code == 200, f"Officer login failed: {off_login}"
    off_token = off_login["access_token"]
    print(f"[TEST A PASS] Officer Login: {off_login['username']} | Role: {off_login['role']}")

    # TEST B: Fetch Passports and verify REVIEW Case structure
    code, passports = get_json(f"{BASE}/passports", off_token)
    assert code == 200, f"Failed to fetch passports: {passports}"
    review_cases = [p for p in passports if p["verdict"] == "REVIEW"]
    assert len(review_cases) > 0, "No REVIEW cases found!"
    rev_case = review_cases[0]
    assert "reasons_for_decision" in rev_case
    assert "final_evidence_score" in rev_case
    print(f"[TEST B PASS] REVIEW Case Verified: ID={rev_case['passport_id']} | Score={rev_case['final_evidence_score']} | Reasons={len(rev_case['reasons_for_decision'])}")

    # TEST C: Fetch Passports and verify ABSTAIN Case (Insufficient Evidence - not a violation)
    abstain_cases = [p for p in passports if p["verdict"] == "ABSTAIN"]
    assert len(abstain_cases) > 0, "No ABSTAIN cases found!"
    abs_case = abstain_cases[0]
    assert abs_case["verdict"] == "ABSTAIN"
    print(f"[TEST C PASS] ABSTAIN Case Verified: ID={abs_case['passport_id']} | Score={abs_case['final_evidence_score']} | Epistemic Status=INSUFFICIENT EVIDENCE (Not a violation)")

    # TEST D: Officer Governance Action (CONFIRM)
    target_pid = rev_case["passport_id"]
    code, gov_res = post_json(
        f"{BASE}/governance/passports/{target_pid}/action",
        {
            "action": "CONFIRM",
            "reason": "Evidence reviewed by officer and verified against attendance logs."
        },
        off_token
    )
    assert code == 200, f"Governance action failed: {gov_res}"
    assert gov_res["verdict"] == "REVIEW", "Original AI verdict was overwritten!"
    assert gov_res["governance_decision"] == "CONFIRMED", "Governance decision missing!"
    assert gov_res["assigned_officer_id"] == "officer_rajesh", "Reviewer identity was not derived from JWT!"
    print(f"[TEST D PASS] Governance Action Recorded: Reviewer={gov_res['assigned_officer_id']} | AI Verdict={gov_res['verdict']} (Immutable) | Human Decision={gov_res['governance_decision']}")

    # TEST E: Admin Audit View
    code, admin_login = post_json(f"{BASE}/auth/login", {"username": "admin", "password": "admin123"})
    assert code == 200
    admin_token = admin_login["access_token"]
    code, admin_queue = get_json(f"{BASE}/governance/review-queue", admin_token)
    assert code == 200
    code, admin_passport = get_json(f"{BASE}/passports/{target_pid}", admin_token)
    assert code == 200
    print(f"[TEST E PASS] Admin Read-Only Audit View: Review queue & Passport details accessible for oversight.")

    # TEST F: Security Regressions
    code, admin_act = post_json(
        f"{BASE}/governance/passports/{target_pid}/action",
        {"action": "CONFIRM", "reason": "Admin trying to adjudicate"},
        admin_token
    )
    assert code == 403, f"Admin must receive 403 on governance action, got {code}"
    code, off_create = post_json(
        f"{BASE}/centres",
        {"centre_id": "TC-ILLEGAL-99", "centre_name": "Bad Centre", "state": "Delhi", "district": "South", "accredited_trades": ["IT"]},
        off_token
    )
    assert code == 403, f"Officer must receive 403 on centre creation, got {code}"
    print("[TEST F PASS] Security Regressions: Admin governance -> 403 Forbidden; Officer centre creation -> 403 Forbidden.")
    print("=" * 65)
    print("ALL PHASE 4 WORKFLOW VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
