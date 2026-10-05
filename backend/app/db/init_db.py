import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from backend.app.db.session import engine, AsyncSessionLocal
from backend.app.db.models import Base, User, TrainingCentre, Room, AuthoritativeSchedule
from backend.app.auth.security import get_password_hash
from backend.app.logging_config import logger

async def init_db():
    logger.info("Initializing database schema...")
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Safe migration for new governance columns on existing SQLite/Postgres tables
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE evidence_passports ADD COLUMN governance_decision VARCHAR(64)"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE evidence_passports ADD COLUMN decision_history JSON DEFAULT '[]'"))
        except Exception:
            pass
    logger.info("Database tables verified.")

    async with AsyncSessionLocal() as session:
        # 1. Seed Default Admin User
        user_res = await session.execute(select(User).where(User.username == "admin"))
        if not user_res.scalars().first():
            admin_user = User(
                username="admin",
                email="admin@evidenceintel.gov.in",
                hashed_password=get_password_hash("admin123"),
                role="ADMIN",
                is_active=True
            )
            session.add(admin_user)
            logger.info("Created default administrator: admin / admin123")

        # Seed Default Compliance Officer
        officer_res = await session.execute(select(User).where(User.username == "officer_rajesh"))
        if not officer_res.scalars().first():
            officer_user = User(
                username="officer_rajesh",
                email="rajesh.sharma@skillmission.gov.in",
                hashed_password=get_password_hash("officer123"),
                role="OFFICER",
                is_active=True
            )
            session.add(officer_user)
            logger.info("Created default compliance officer: officer_rajesh / officer123")

        # 2. Seed Default Training Centre
        centre_id = "TC-DL-OKHLA-04"
        centre_res = await session.execute(select(TrainingCentre).where(TrainingCentre.centre_id == centre_id))
        if not centre_res.scalars().first():
            default_centre = TrainingCentre(
                centre_id=centre_id,
                centre_name="Delhi Skill Development Hub - Okhla",
                state="Delhi",
                district="South East Delhi",
                accredited_trades=["IT-ITES-L4", "SEWING-MACHINE-OP-L2", "DATA-ENTRY-L3"],
                is_active=True
            )
            session.add(default_centre)
            logger.info(f"Created default training centre: {centre_id}")

        # 3. Seed Default Rooms & Cameras
        room_id_1 = "ROOM-101"
        room_res_1 = await session.execute(select(Room).where(Room.room_id == room_id_1))
        if not room_res_1.scalars().first():
            room_1 = Room(
                room_id=room_id_1,
                centre_id=centre_id,
                room_name="Computer Lab A (IT-ITES)",
                room_type="IT_LAB",
                seating_capacity=25,
                camera_id="CAM-LAB-01",
                rtsp_stream_uri="rtsp://localhost:8554/live/lab1",
                zones_geojson={
                    "student_zone": [
                        [50, 100], [590, 100], [590, 450], [50, 450]
                    ],
                    "instructor_zone": [
                        [50, 20], [590, 20], [590, 80], [50, 80]
                    ],
                    "doorway_zone": [
                        [500, 20], [630, 20], [630, 180], [500, 180]
                    ]
                }
            )
            session.add(room_1)
            logger.info(f"Created default room: {room_id_1} (CAM-LAB-01)")

        room_id_2 = "ROOM-102"
        room_res_2 = await session.execute(select(Room).where(Room.room_id == room_id_2))
        if not room_res_2.scalars().first():
            room_2 = Room(
                room_id=room_id_2,
                centre_id=centre_id,
                room_name="Vocational Workshop B (Apparel)",
                room_type="VOCATIONAL_WORKSHOP",
                seating_capacity=20,
                camera_id="CAM-WRK-02",
                rtsp_stream_uri="rtsp://localhost:8554/live/workshop2",
                zones_geojson={
                    "student_zone": [
                        [60, 120], [580, 120], [580, 440], [60, 440]
                    ]
                }
            )
            session.add(room_2)
            logger.info(f"Created default room: {room_id_2} (CAM-WRK-02)")

        # 4. Seed Active Schedule for ROOM-101
        now = datetime.now(timezone.utc)
        sched_res = await session.execute(select(AuthoritativeSchedule).where(AuthoritativeSchedule.room_id == room_id_1))
        if not sched_res.scalars().first():
            schedule_1 = AuthoritativeSchedule(
                room_id=room_id_1,
                batch_id="BATCH-2026-IT-01",
                trade_name="IT-ITES-L4",
                session_start=now - timedelta(hours=1),
                session_end=now + timedelta(hours=3),
                expected_students=25,
                required_equipment={
                    "monitors": 20,
                    "chairs": 25,
                    "projector": 1
                }
            )
            session.add(schedule_1)
            logger.info(f"Created active authoritative schedule for {room_id_1}")

        await session.commit()
    logger.info("Database initialization and seed complete.")

if __name__ == "__main__":
    asyncio.run(init_db())
