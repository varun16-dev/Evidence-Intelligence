import uuid
import base64
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from backend.app.db.models import EvidencePassport, AuditTrail
from backend.app.core.crypto_signer import crypto_signer, VerificationResult
from backend.app.core.sufficiency_engine import SufficiencyVerdictOutput
from backend.app.schemas.passport_schemas import GeneratePassportRequest

def normalize_iso_timestamp(dt) -> str:
    """Ensures consistent UTC ISO-8601 formatting across SQLite, PostgreSQL, and Python."""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return dt
    if hasattr(dt, "tzinfo") and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

class PassportService:
    """
    Orchestration service for Evidence Passport generation, cryptographic sealing,
    audit ledger logging, and integrity verification.
    """

    @staticmethod
    def extract_metadata_dict(passport: EvidencePassport) -> Dict[str, Any]:
        """
        Extracts the canonical metadata dictionary from an EvidencePassport instance.
        Used for computing and re-verifying metadata_sha256.
        """
        return {
            "passport_id": passport.passport_id,
            "event_id": passport.event_id,
            "centre_id": passport.centre_id,
            "room_id": passport.room_id,
            "camera_id": passport.camera_id,
            "timestamp": normalize_iso_timestamp(passport.timestamp),
            "event_type": passport.event_type,
            "final_evidence_score": round(float(passport.final_evidence_score), 3),
            "verdict": passport.verdict,
            "compliance_finding": passport.compliance_finding,
            "reasons_for_decision": passport.reasons_for_decision,
            "camera_trust": passport.camera_trust,
            "observability": passport.observability,
            "detection_quality": passport.detection_quality,
            "temporal_evidence": passport.temporal_evidence,
            "scene_stability": passport.scene_stability,
            "record_agreement": passport.record_agreement,
            "anti_spoof_signals": passport.anti_spoof_signals,
            "detection_summary": passport.detection_summary,
        }

    async def create_passport(
        self,
        db: AsyncSession,
        req: GeneratePassportRequest,
        actor_id: str = "SYSTEM_SUFFICIENCY_ENGINE",
        actor_role: str = "SYSTEM"
    ) -> EvidencePassport:
        """
        Generates and seals a new Evidence Passport based on Sufficiency Engine verdict.
        Saves the record and creates the genesis AuditTrail event.
        """
        passport_id = f"PASS-{uuid.uuid4().hex[:12].upper()}"
        event_id = f"EVT-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.now(timezone.utc)

        # 1. Handle Keyframe Image Hashing
        raw_image_bytes = b""
        raw_keyframe_uri = req.raw_keyframe_uri or f"/evidence_vault/{passport_id}/raw_keyframe.jpg"
        annotated_keyframe_uri = req.annotated_keyframe_uri or f"/evidence_vault/{passport_id}/annotated_keyframe.jpg"


        if req.raw_keyframe_b64:
            try:
                raw_image_bytes = base64.b64decode(req.raw_keyframe_b64)
            except Exception:
                raw_image_bytes = f"RAW_FRAME_MOCK_{passport_id}".encode("utf-8")
        else:
            raw_image_bytes = f"RAW_FRAME_MOCK_{passport_id}".encode("utf-8")

        image_sha256 = crypto_signer.hash_bytes(raw_image_bytes)

        # 2. Extract Contributing Factors
        factors = req.verdict.contributing_factors
        cam_trust_dict = {"score": factors.camera_trust}
        obs_dict = {"score": factors.observability}
        det_qual_dict = {"score": factors.detection_quality}
        temp_ev_dict = {"score": factors.temporal_persistence, "dwell_threshold_seconds": 15.0}
        scene_stab_dict = {"score": factors.scene_stability}
        rec_agr_dict = {"score": factors.record_agreement}
        anti_spoof_dict = {"score": factors.anti_spoof}

        features = req.evidence_features or {}
        det_summary = features.get("detection_summary", {"status": "aggregated", "verdict": req.verdict.decision})

        # 3. Assemble Canonical Metadata Dictionary
        meta_dict = {
            "passport_id": passport_id,
            "event_id": event_id,
            "centre_id": req.centre_id,
            "room_id": req.room_id,
            "camera_id": req.camera_id,
            "timestamp": normalize_iso_timestamp(now),
            "event_type": req.event_type,
            "final_evidence_score": round(float(req.verdict.evidence_score), 3),
            "verdict": req.verdict.decision,
            "compliance_finding": req.compliance_finding,
            "reasons_for_decision": req.verdict.reasons,
            "camera_trust": cam_trust_dict,
            "observability": obs_dict,
            "detection_quality": det_qual_dict,
            "temporal_evidence": temp_ev_dict,
            "scene_stability": scene_stab_dict,
            "record_agreement": rec_agr_dict,
            "anti_spoof_signals": anti_spoof_dict,
            "detection_summary": det_summary,
        }

        metadata_sha256 = crypto_signer.hash_metadata(meta_dict)
        evidence_combined_hash = crypto_signer.compute_combined_hash(image_sha256, metadata_sha256)
        event_signature = crypto_signer.sign_hash(evidence_combined_hash)

        # 4. Construct EvidencePassport Model
        passport = EvidencePassport(
            passport_id=passport_id,
            event_id=event_id,
            centre_id=req.centre_id,
            room_id=req.room_id,
            camera_id=req.camera_id,
            timestamp=now,
            event_type=req.event_type,
            final_evidence_score=req.verdict.evidence_score,
            verdict=req.verdict.decision,
            compliance_finding=req.compliance_finding,
            reasons_for_decision=req.verdict.reasons,
            detection_summary=det_summary,
            temporal_evidence=temp_ev_dict,
            camera_trust=cam_trust_dict,
            observability=obs_dict,
            detection_quality=det_qual_dict,
            scene_stability=scene_stab_dict,
            anti_spoof_signals=anti_spoof_dict,
            record_agreement=rec_agr_dict,
            raw_keyframe_uri=raw_keyframe_uri,
            annotated_keyframe_uri=annotated_keyframe_uri,
            crop_thumbnails_uris=[],
            review_status="PENDING" if req.verdict.decision in ("REVIEW", "ABSTAIN") else "AUTO_CLEARED",
            governance_decision=None,
            decision_history=[{
                "step": 1,
                "reviewer": None,
                "actor": actor_id,
                "role": actor_role,
                "action": "AUTOMATED_EVALUATION",
                "previous_decision": None,
                "new_decision": req.verdict.decision,
                "reason": req.verdict.reasons[0] if req.verdict.reasons else req.compliance_finding,
                "timestamp": normalize_iso_timestamp(now),
                "original_ai_verdict": req.verdict.decision,
                "evidence_score": round(float(req.verdict.evidence_score), 3)
            }],
            image_sha256=image_sha256,
            metadata_sha256=metadata_sha256,
            evidence_combined_hash=evidence_combined_hash,
            event_signature=event_signature,
            signing_key_id=crypto_signer.key_id,
            created_at=now
        )

        db.add(passport)

        # 5. Genesis Audit Trail Record
        first_audit = AuditTrail(
            passport_id=passport_id,
            step_sequence=1,
            actor_id=actor_id,
            actor_role=actor_role,
            action_performed="PASSPORT_GENERATED_AND_SEALED",
            notes=f"Automated evaluation completed with decision {req.verdict.decision} (Evidence Score: {round(req.verdict.evidence_score, 3)}). Primary Reason: {req.verdict.reasons[0] if req.verdict.reasons else 'N/A'}",
            client_ip_or_host="127.0.0.1",
            timestamp=now,
            signed_hash=evidence_combined_hash
        )
        db.add(first_audit)

        await db.commit()
        db.expire_all()
        return await self.get_passport(db, passport_id)

    async def get_passport(self, db: AsyncSession, passport_id: str) -> Optional[EvidencePassport]:
        """Loads passport with all associated audit logs."""
        stmt = (
            select(EvidencePassport)
            .options(selectinload(EvidencePassport.audit_logs))
            .where(EvidencePassport.passport_id == passport_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_passports(
        self,
        db: AsyncSession,
        centre_id: Optional[str] = None,
        verdict: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[EvidencePassport]:
        """Lists passports with optional centre or verdict filtering."""
        stmt = select(EvidencePassport).options(selectinload(EvidencePassport.audit_logs))
        if centre_id:
            stmt = stmt.where(EvidencePassport.centre_id == centre_id)
        if verdict:
            stmt = stmt.where(EvidencePassport.verdict == verdict)
        stmt = stmt.order_by(EvidencePassport.created_at.desc()).offset(offset).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def verify_passport_integrity(
        self,
        db: AsyncSession,
        passport_id: str,
        raw_image_bytes: Optional[bytes] = None
    ) -> VerificationResult:
        """
        Demonstrates: Original Evidence -> Hash -> Stored Hash -> Verification & Detects Modification.
        """
        passport = await self.get_passport(db, passport_id)
        if not passport:
            raise ValueError(f"Passport {passport_id} not found")

        meta_dict = self.extract_metadata_dict(passport)

        res = crypto_signer.verify_passport(
            passport_id=passport.passport_id,
            metadata_dict=meta_dict,
            stored_metadata_sha256=passport.metadata_sha256,
            stored_image_sha256=passport.image_sha256,
            stored_combined_hash=passport.evidence_combined_hash,
            stored_signature=passport.event_signature,
            raw_image_bytes=raw_image_bytes
        )

        # Log audit check event
        now = datetime.now(timezone.utc)
        next_seq = (len(passport.audit_logs) + 1) if passport.audit_logs else 2
        audit_check = AuditTrail(
            passport_id=passport.passport_id,
            step_sequence=next_seq,
            actor_id="INTEGRITY_VERIFIER_API",
            actor_role="SYSTEM",
            action_performed="INTEGRITY_CHECK_PERFORMED",
            notes=f"Cryptographic check result: {res.status} (Authentic: {res.is_authentic}). {res.details}",
            client_ip_or_host="127.0.0.1",
            timestamp=now,
            signed_hash=res.recomputed_combined_hash
        )
        db.add(audit_check)
        await db.commit()

        return res

    async def get_review_queue(
        self,
        db: AsyncSession,
        verdict: Optional[str] = None,
        status: Optional[str] = "PENDING",
        centre_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[Dict[str, int], List[EvidencePassport]]:
        """
        Retrieves human governance review queue containing REVIEW and ABSTAIN cases,
        plus aggregate queue statistics.
        """
        base_filter = EvidencePassport.verdict.in_(["REVIEW", "ABSTAIN"])

        # Aggregate Statistics
        s_total = select(func.count(EvidencePassport.passport_id)).where(
            base_filter,
            EvidencePassport.review_status == "PENDING"
        )
        s_pending_review = select(func.count(EvidencePassport.passport_id)).where(
            EvidencePassport.verdict == "REVIEW",
            EvidencePassport.review_status == "PENDING"
        )
        s_pending_abstain = select(func.count(EvidencePassport.passport_id)).where(
            EvidencePassport.verdict == "ABSTAIN",
            EvidencePassport.review_status == "PENDING"
        )
        s_adjudicated = select(func.count(EvidencePassport.passport_id)).where(
            base_filter,
            EvidencePassport.governance_decision.is_not(None)
        )

        total_in_queue = (await db.execute(s_total)).scalar() or 0
        pending_review = (await db.execute(s_pending_review)).scalar() or 0
        pending_abstain = (await db.execute(s_pending_abstain)).scalar() or 0
        adjudicated = (await db.execute(s_adjudicated)).scalar() or 0

        stats = {
            "total_in_queue": total_in_queue,
            "pending_review_count": pending_review,
            "pending_abstain_count": pending_abstain,
            "adjudicated_count": adjudicated
        }

        # Item Query
        query = (
            select(EvidencePassport)
            .options(selectinload(EvidencePassport.audit_logs))
            .where(base_filter)
        )

        if status and status.upper() != "ALL":
            if status.upper() == "PENDING":
                query = query.where(EvidencePassport.review_status == "PENDING")
            elif status.upper() == "ADJUDICATED":
                query = query.where(EvidencePassport.governance_decision.is_not(None))
            else:
                query = query.where(EvidencePassport.review_status == status)

        if verdict and verdict.upper() != "ALL":
            query = query.where(EvidencePassport.verdict == verdict.upper())

        if centre_id:
            query = query.where(EvidencePassport.centre_id == centre_id)

        query = query.order_by(EvidencePassport.created_at.desc()).offset(offset).limit(limit)
        res = await db.execute(query)
        items = list(res.scalars().all())

        return stats, items

    async def execute_governance_action(
        self,
        db: AsyncSession,
        passport_id: str,
        reviewer: str,
        action: str,
        reason: str,
        client_ip: str = "127.0.0.1",
        action_prefix: str = "GOVERNANCE"
    ) -> EvidencePassport:
        """
        Executes a human governance review action (CONFIRM, REJECT, REQUEST INSPECTION).
        CRITICAL GOVERNANCE INVARIANTS:
        1. Never silently overwrite original AI decision (`passport.verdict` is immutable).
        2. Preserves complete decision history chronologically.
        3. Appends cryptographically chained audit log.
        4. Updates governance_decision and review_status.
        """
        passport = await self.get_passport(db, passport_id)
        if not passport:
            raise ValueError(f"Passport {passport_id} not found")

        # Normalize action
        clean_act = action.strip().upper().replace("_", " ")
        if clean_act in ("CONFIRM", "CONFIRMED"):
            norm_action = "CONFIRM"
            new_decision = "CONFIRMED"
        elif clean_act in ("REJECT", "REJECTED", "DISMISSED", "DISMISS"):
            norm_action = "REJECT"
            new_decision = "REJECTED"
        elif clean_act in ("REQUEST INSPECTION", "INSPECTION REQUESTED", "INSPECTION MANDATED", "INSPECTION"):
            norm_action = "REQUEST INSPECTION"
            if "MANDATED" in action.upper():
                new_decision = "INSPECTION_MANDATED"
            else:
                new_decision = "INSPECTION_REQUESTED"
        else:
            raise ValueError(f"Invalid governance action: '{action}'. Must be CONFIRM, REJECT, or REQUEST INSPECTION.")

        now = datetime.now(timezone.utc)
        previous_decision = passport.governance_decision or passport.verdict

        # 1. Update governance tracking fields (WITHOUT touching passport.verdict)
        passport.governance_decision = new_decision
        passport.review_status = new_decision
        passport.assigned_officer_id = reviewer
        passport.adjudicated_at = now
        passport.officer_remarks = reason

        # 2. Append to decision history (Immutable ledger)
        history = list(passport.decision_history or [])
        step_number = len(history) + 1
        history_entry = {
            "step": step_number,
            "reviewer": reviewer,
            "actor": reviewer,
            "role": "GOVERNANCE_REVIEWER",
            "action": norm_action,
            "previous_decision": previous_decision,
            "new_decision": new_decision,
            "reason": reason,
            "timestamp": normalize_iso_timestamp(now),
            "original_ai_verdict": passport.verdict,  # Strictly preserved
            "evidence_score": round(float(passport.final_evidence_score), 3)
        }
        history.append(history_entry)
        passport.decision_history = history
        flag_modified(passport, "decision_history")

        # 3. Create chained audit event
        prev_signed_hash = passport.audit_logs[-1].signed_hash if passport.audit_logs else passport.evidence_combined_hash
        chain_payload = f"{prev_signed_hash}:{reviewer}:{norm_action}:{new_decision}:{normalize_iso_timestamp(now)}"
        action_hash = crypto_signer.hash_bytes(chain_payload.encode("utf-8"))

        next_seq = (len(passport.audit_logs) + 1) if passport.audit_logs else 2
        audit_action = f"{action_prefix}_{action}" if action_prefix == "ADJUDICATION" else f"GOVERNANCE_{norm_action.replace(' ', '_')}"
        audit_entry = AuditTrail(
            passport_id=passport.passport_id,
            step_sequence=next_seq,
            actor_id=reviewer,
            actor_role="GOVERNANCE_REVIEWER" if action_prefix != "ADJUDICATION" else "OFFICER",
            action_performed=audit_action,
            notes=f"Reviewer: {reviewer} | Previous: {previous_decision} | New: {new_decision} | Reason: {reason}",
            client_ip_or_host=client_ip,
            timestamp=now,
            signed_hash=action_hash
        )
        db.add(audit_entry)

        await db.commit()
        db.expire_all()
        return await self.get_passport(db, passport_id)

    async def adjudicate_passport(
        self,
        db: AsyncSession,
        passport_id: str,
        officer_id: str,
        review_status: str,
        officer_remarks: str,
        client_ip: str = "127.0.0.1"
    ) -> EvidencePassport:
        """
        Legacy/convenience wrapper delegating to execute_governance_action.
        """
        return await self.execute_governance_action(
            db=db,
            passport_id=passport_id,
            reviewer=officer_id,
            action=review_status,
            reason=officer_remarks,
            client_ip=client_ip,
            action_prefix="ADJUDICATION"
        )

passport_service = PassportService()
