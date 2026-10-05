from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="OFFICER") # ADMIN, OFFICER, AUDITOR, EDGE
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

class TrainingCentre(Base):
    __tablename__ = "training_centres"

    centre_id = Column(String(64), primary_key=True)
    centre_name = Column(String(255), nullable=False)
    state = Column(String(64), nullable=False)
    district = Column(String(64), nullable=False)
    accredited_trades = Column(JSON, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    rooms = relationship("Room", back_populates="centre", cascade="all, delete-orphan")

class Room(Base):
    __tablename__ = "rooms"

    room_id = Column(String(64), primary_key=True)
    centre_id = Column(String(64), ForeignKey("training_centres.centre_id", ondelete="CASCADE"), nullable=False)
    room_name = Column(String(128), nullable=False)
    room_type = Column(String(64), nullable=False) # CLASSROOM, IT_LAB, VOCATIONAL_WORKSHOP
    seating_capacity = Column(Integer, nullable=False, default=25)
    camera_id = Column(String(64), unique=True, nullable=False)
    rtsp_stream_uri = Column(String(512), nullable=False)
    zones_geojson = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    centre = relationship("TrainingCentre", back_populates="rooms")
    schedules = relationship("AuthoritativeSchedule", back_populates="room", cascade="all, delete-orphan")

class AuthoritativeSchedule(Base):
    __tablename__ = "authoritative_schedules"

    schedule_id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String(64), ForeignKey("rooms.room_id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(String(64), nullable=False)
    trade_name = Column(String(128), nullable=False)
    session_start = Column(DateTime(timezone=True), nullable=False)
    session_end = Column(DateTime(timezone=True), nullable=False)
    expected_students = Column(Integer, nullable=False, default=20)
    required_equipment = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    room = relationship("Room", back_populates="schedules")

class EvidencePassport(Base):
    __tablename__ = "evidence_passports"

    passport_id = Column(String(64), primary_key=True)
    event_id = Column(String(64), default=lambda: str(uuid.uuid4()), nullable=False)
    centre_id = Column(String(64), ForeignKey("training_centres.centre_id"), nullable=False)
    room_id = Column(String(64), ForeignKey("rooms.room_id"), nullable=False)
    camera_id = Column(String(64), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    event_type = Column(String(64), nullable=False)
    
    final_evidence_score = Column(Float, nullable=False)
    verdict = Column(String(32), nullable=False) # VERIFIED, REVIEW, ABSTAIN
    compliance_finding = Column(String(128), nullable=False)
    reasons_for_decision = Column(JSON, default=list, nullable=False)
    
    detection_summary = Column(JSON, default=dict, nullable=False)
    temporal_evidence = Column(JSON, default=dict, nullable=False)
    camera_trust = Column(JSON, default=dict, nullable=False)
    observability = Column(JSON, default=dict, nullable=False)
    detection_quality = Column(JSON, default=dict, nullable=False)
    scene_stability = Column(JSON, default=dict, nullable=False)
    anti_spoof_signals = Column(JSON, default=dict, nullable=False)
    record_agreement = Column(JSON, default=dict, nullable=False)
    
    raw_keyframe_uri = Column(String(512), nullable=False)
    annotated_keyframe_uri = Column(String(512), nullable=False)
    crop_thumbnails_uris = Column(JSON, default=list, nullable=False)
    
    review_status = Column(String(32), default="PENDING", nullable=False) # PENDING, CONFIRMED, REJECTED, INSPECTION_REQUESTED
    governance_decision = Column(String(64), nullable=True) # CONFIRM, REJECT, REQUEST INSPECTION
    decision_history = Column(JSON, default=list, nullable=False)
    assigned_officer_id = Column(String(128), nullable=True)
    adjudicated_at = Column(DateTime(timezone=True), nullable=True)
    officer_remarks = Column(Text, nullable=True)
    
    image_sha256 = Column(String(64), nullable=False)
    metadata_sha256 = Column(String(64), nullable=False)
    evidence_combined_hash = Column(String(64), nullable=False)
    event_signature = Column(Text, nullable=False)
    signing_key_id = Column(String(64), nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    audit_logs = relationship("AuditTrail", back_populates="passport", cascade="all, delete-orphan", order_by="AuditTrail.step_sequence.asc()")

class AuditTrail(Base):
    __tablename__ = "audit_trail"

    audit_id = Column(Integer, primary_key=True, autoincrement=True)
    passport_id = Column(String(64), ForeignKey("evidence_passports.passport_id", ondelete="RESTRICT"), nullable=False)
    step_sequence = Column(Integer, nullable=False, default=1)
    actor_id = Column(String(128), nullable=False)
    actor_role = Column(String(64), nullable=False)
    action_performed = Column(String(64), nullable=False)
    notes = Column(Text, nullable=True)
    client_ip_or_host = Column(String(64), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    signed_hash = Column(String(64), nullable=False)

    passport = relationship("EvidencePassport", back_populates="audit_logs")
