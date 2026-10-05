import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from backend.app.main import app

async def run_tests():
    print("\n" + "="*65)
    print("PHASE 1 BACKEND API & RBAC SECURITY VERIFICATION SUITE")
    print("="*65 + "\n")
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Test Root
        res = await client.get("/")
        assert res.status_code == 200, f"Root failed: {res.text}"
        print(" [PASS] 1. Root landing endpoint (GET /) -> 200 OK")
        
        # 2. Test Health
        res = await client.get("/api/v1/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        data = res.json()
        assert data["database"] == "HEALTHY", f"DB not healthy: {data}"
        print(" [PASS] 2. Health check endpoint (GET /api/v1/health) -> 200 OK, DB: HEALTHY")
        
        # 3. Test Unauthenticated Access to Protected Endpoints (Must be rejected)
        res = await client.get("/api/v1/centres")
        assert res.status_code == 401, f"Unauthenticated centres check failed: {res.status_code}"
        print(" [PASS] 3. Unauthenticated access rejection (GET /api/v1/centres) -> 401 Unauthorized")

        res = await client.get("/api/v1/cameras")
        assert res.status_code == 401, f"Unauthenticated cameras check failed: {res.status_code}"
        print(" [PASS] 4. Unauthenticated access rejection (GET /api/v1/cameras) -> 401 Unauthorized")

        # 4. Test Login (admin)
        res = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        admin_data = res.json()
        admin_token = admin_data["access_token"]
        assert admin_data["role"] == "ADMIN"
        print(f" [PASS] 5. Admin Auth login -> 200 OK, Role: {admin_data['role']}")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 5. Test Login (officer)
        res = await client.post("/api/v1/auth/login", json={"username": "officer_rajesh", "password": "officer123"})
        assert res.status_code == 200, f"Officer login failed: {res.text}"
        officer_data = res.json()
        officer_token = officer_data["access_token"]
        assert officer_data["role"] == "OFFICER"
        print(f" [PASS] 6. Officer Auth login -> 200 OK, Role: {officer_data['role']}")
        officer_headers = {"Authorization": f"Bearer {officer_token}"}
        
        # 6. Test Admin Profile
        res = await client.get("/api/v1/auth/me", headers=admin_headers)
        assert res.status_code == 200, f"Auth me failed: {res.text}"
        assert res.json()["username"] == "admin"
        print(" [PASS] 7. Admin profile verification (GET /api/v1/auth/me) -> 200 OK")
        
        # 7. Test Officer Profile
        res = await client.get("/api/v1/auth/me", headers=officer_headers)
        assert res.status_code == 200, f"Officer profile failed: {res.text}"
        assert res.json()["username"] == "officer_rajesh"
        print(" [PASS] 8. Officer profile verification (GET /api/v1/auth/me) -> 200 OK")
        
        # 8. Test Authenticated List Centres (Both Admin and Officer can list)
        res = await client.get("/api/v1/centres", headers=admin_headers)
        assert res.status_code == 200, f"Admin list centres failed: {res.text}"
        print(f" [PASS] 9. Admin List centres -> 200 OK, Found: {len(res.json())} centres")

        res = await client.get("/api/v1/centres", headers=officer_headers)
        assert res.status_code == 200, f"Officer list centres failed: {res.text}"
        print(f" [PASS] 10. Officer List centres -> 200 OK, Found: {len(res.json())} centres")

        # 9. Test Create Centre with Admin (Allowed -> 201)
        new_centre_id = f"TC-TEST-{os.getpid()}"
        centre_payload = {
            "centre_id": new_centre_id,
            "centre_name": "Bengaluru Skill Development Complex",
            "state": "Karnataka",
            "district": "Bengaluru Urban",
            "accredited_trades": ["CLOUD-PRACTITIONER-L5", "AUTOMATION-L4"]
        }
        res = await client.post("/api/v1/centres", json=centre_payload, headers=admin_headers)
        assert res.status_code == 201, f"Admin create centre failed: {res.text}"
        print(f" [PASS] 11. Admin Create centre -> 201 Created ({new_centre_id})")
        
        # 10. Test Officer Attempting to Create Centre (MUST BE FORBIDDEN -> 403)
        illegal_centre_payload = {
            "centre_id": f"TC-ILLEGAL-{os.getpid()}",
            "centre_name": "Unauthorized Centre Attempt",
            "state": "Delhi",
            "district": "Central Delhi",
            "accredited_trades": ["IT-L1"]
        }
        res = await client.post("/api/v1/centres", json=illegal_centre_payload, headers=officer_headers)
        assert res.status_code == 403, f"Officer create centre was not forbidden: {res.status_code}, {res.text}"
        print(f" [PASS] 12. Officer Create Centre RBAC Rejection -> 403 Forbidden (Strictly Prohibited)")

        # 11. Test Admin Register Camera in New Centre (Allowed -> 201)
        cam_id = f"CAM-BLR-{os.getpid()}"
        room_payload = {
            "room_id": f"ROOM-BLR-{os.getpid()}",
            "room_name": "Cloud Computing Bay 1",
            "room_type": "IT_LAB",
            "seating_capacity": 30,
            "camera_id": cam_id,
            "rtsp_stream_uri": "rtsp://192.168.1.50:554/ch1",
            "zones_geojson": {"student_zone": [[0, 0], [100, 100]]}
        }
        res = await client.post(f"/api/v1/centres/{new_centre_id}/cameras", json=room_payload, headers=admin_headers)
        assert res.status_code == 201, f"Admin register camera failed: {res.text}"
        print(f" [PASS] 13. Admin Register camera -> 201 Created ({cam_id})")

        # 12. Test Officer Attempting to Register Camera (MUST BE FORBIDDEN -> 403)
        illegal_cam_payload = {
            "room_id": f"ROOM-ILLEGAL-{os.getpid()}",
            "room_name": "Illegal Room",
            "room_type": "IT_LAB",
            "seating_capacity": 20,
            "camera_id": f"CAM-ILLEGAL-{os.getpid()}",
            "rtsp_stream_uri": "rtsp://192.168.1.99:554/ch1",
            "zones_geojson": {}
        }
        res = await client.post(f"/api/v1/centres/{new_centre_id}/cameras", json=illegal_cam_payload, headers=officer_headers)
        assert res.status_code == 403, f"Officer register camera was not forbidden: {res.status_code}"
        print(f" [PASS] 14. Officer Register Camera RBAC Rejection -> 403 Forbidden (Strictly Prohibited)")

        # 13. Test Admin Update Camera Zone (Allowed -> 200)
        zone_payload = {
            "zones_geojson": {
                "student_zone": [[10, 10], [90, 10], [90, 90], [10, 90]],
                "instructor_zone": [[10, 0], [90, 0], [90, 10], [10, 10]]
            }
        }
        res = await client.put(f"/api/v1/cameras/{cam_id}/zones", json=zone_payload, headers=admin_headers)
        assert res.status_code == 200, f"Admin update zone failed: {res.text}"
        print(f" [PASS] 15. Admin Update camera zones -> 200 OK")

        # 14. Test Officer Attempting to Update Camera Zone (MUST BE FORBIDDEN -> 403)
        res = await client.put(f"/api/v1/cameras/{cam_id}/zones", json=zone_payload, headers=officer_headers)
        assert res.status_code == 403, f"Officer update zone was not forbidden: {res.status_code}"
        print(f" [PASS] 16. Officer Update Camera Zone RBAC Rejection -> 403 Forbidden (Strictly Prohibited)")

        # 15. Test Admin Attempting Officer Adjudication (MUST BE FORBIDDEN -> 403)
        adjudicate_payload = {
            "reviewer": "admin",
            "action": "CONFIRM",
            "reason": "Admin trying to adjudicate directly"
        }
        res = await client.post("/api/v1/governance/passports/PASS-FAKE-01/action", json=adjudicate_payload, headers=admin_headers)
        assert res.status_code == 403, f"Admin adjudication was not forbidden: {res.status_code}"
        print(f" [PASS] 17. Admin Adjudication Restriction -> 403 Forbidden (Only Officers can adjudicate)")

    print("\n" + "="*65)
    print("ALL 17 PHASE 1 SECURITY & RBAC CHECKS PASSED FLAWLESSLY!")
    print("="*65 + "\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
