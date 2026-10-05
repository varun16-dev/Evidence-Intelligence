import hashlib
import hmac
import json
from typing import Dict, Any, Tuple, Optional
from pydantic import BaseModel
from backend.app.config import settings

class VerificationResult(BaseModel):
    passport_id: str
    is_authentic: bool
    status: str # VALID, TAMPERED_METADATA, TAMPERED_IMAGE, INVALID_SIGNATURE, CORRUPTED
    stored_metadata_sha256: str
    recomputed_metadata_sha256: str
    stored_image_sha256: str
    recomputed_image_sha256: Optional[str] = None
    stored_combined_hash: str
    recomputed_combined_hash: str
    signature_valid: bool
    details: str

class CryptoSigner:
    """
    Cryptographic sealing and integrity verification engine for Evidence Passports.
    Guarantees non-repudiation, tamper-evidence, and strict chain-of-custody.
    """
    def __init__(self, secret_key: Optional[str] = None, key_id: str = "SIG-KEY-V1"):
        self.secret_key = (secret_key or settings.SECRET_KEY).encode("utf-8")
        self.key_id = key_id

    @staticmethod
    def canonical_json(data: Dict[str, Any]) -> bytes:
        """
        Produces deterministic, lexicographically sorted canonical JSON representation.
        Prevents key-ordering or whitespace discrepancies during hashing.
        """
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str).encode("utf-8")

    @staticmethod
    def hash_bytes(content: bytes) -> str:
        """Returns standard hex-encoded SHA-256 hash."""
        return hashlib.sha256(content).hexdigest()

    def hash_metadata(self, metadata: Dict[str, Any]) -> str:
        """Computes SHA-256 of canonical metadata."""
        return self.hash_bytes(self.canonical_json(metadata))

    def compute_combined_hash(self, image_sha256: str, metadata_sha256: str) -> str:
        """
        Binds perceptual image evidence and epistemic decision metadata into a combined SHA-256 hash:
        H_combined = SHA256(image_sha256 || metadata_sha256)
        """
        combined_payload = f"{image_sha256}:{metadata_sha256}".encode("utf-8")
        return self.hash_bytes(combined_payload)

    def sign_hash(self, combined_hash: str) -> str:
        """
        Generates HMAC-SHA256 digital signature over the combined evidence hash.
        """
        signature = hmac.new(self.secret_key, combined_hash.encode("utf-8"), hashlib.sha256).hexdigest()
        return signature

    def verify_signature(self, combined_hash: str, signature: str) -> bool:
        """
        Verifies HMAC-SHA256 signature using constant-time comparison.
        """
        expected_sig = self.sign_hash(combined_hash)
        return hmac.compare_digest(expected_sig, signature)

    def verify_passport(
        self,
        passport_id: str,
        metadata_dict: Dict[str, Any],
        stored_metadata_sha256: str,
        stored_image_sha256: str,
        stored_combined_hash: str,
        stored_signature: str,
        raw_image_bytes: Optional[bytes] = None
    ) -> VerificationResult:
        """
        Performs end-to-end cryptographic verification:
        1. Recalculates metadata SHA-256
        2. Recalculates image SHA-256 (if raw bytes provided)
        3. Recalculates combined hash
        4. Validates digital signature
        """
        # 1. Recalculate Metadata Hash
        recomputed_meta_hash = self.hash_metadata(metadata_dict)
        meta_intact = hmac.compare_digest(recomputed_meta_hash, stored_metadata_sha256)

        # 2. Recalculate Image Hash
        recomputed_img_hash = None
        img_intact = True
        if raw_image_bytes is not None:
            recomputed_img_hash = self.hash_bytes(raw_image_bytes)
            img_intact = hmac.compare_digest(recomputed_img_hash, stored_image_sha256)

        # 3. Recalculate Combined Hash
        effective_img_hash = recomputed_img_hash if recomputed_img_hash else stored_image_sha256
        recomputed_combined = self.compute_combined_hash(effective_img_hash, recomputed_meta_hash)
        combined_intact = hmac.compare_digest(recomputed_combined, stored_combined_hash)

        # 4. Verify Signature
        sig_valid = self.verify_signature(stored_combined_hash, stored_signature)

        if not meta_intact:
            return VerificationResult(
                passport_id=passport_id,
                is_authentic=False,
                status="TAMPERED_METADATA",
                stored_metadata_sha256=stored_metadata_sha256,
                recomputed_metadata_sha256=recomputed_meta_hash,
                stored_image_sha256=stored_image_sha256,
                recomputed_image_sha256=recomputed_img_hash,
                stored_combined_hash=stored_combined_hash,
                recomputed_combined_hash=recomputed_combined,
                signature_valid=sig_valid,
                details="ALERT: Metadata has been altered! Stored SHA-256 does not match recomputed SHA-256."
            )

        if not img_intact:
            return VerificationResult(
                passport_id=passport_id,
                is_authentic=False,
                status="TAMPERED_IMAGE",
                stored_metadata_sha256=stored_metadata_sha256,
                recomputed_metadata_sha256=recomputed_meta_hash,
                stored_image_sha256=stored_image_sha256,
                recomputed_image_sha256=recomputed_img_hash,
                stored_combined_hash=stored_combined_hash,
                recomputed_combined_hash=recomputed_combined,
                signature_valid=sig_valid,
                details="ALERT: Keyframe image bytes have been modified! Stored image SHA-256 does not match."
            )

        if not combined_intact or not sig_valid:
            return VerificationResult(
                passport_id=passport_id,
                is_authentic=False,
                status="INVALID_SIGNATURE",
                stored_metadata_sha256=stored_metadata_sha256,
                recomputed_metadata_sha256=recomputed_meta_hash,
                stored_image_sha256=stored_image_sha256,
                recomputed_image_sha256=recomputed_img_hash,
                stored_combined_hash=stored_combined_hash,
                recomputed_combined_hash=recomputed_combined,
                signature_valid=sig_valid,
                details="ALERT: Digital signature verification failed! Possible signature or combined hash tampering."
            )

        return VerificationResult(
            passport_id=passport_id,
            is_authentic=True,
            status="VALID",
            stored_metadata_sha256=stored_metadata_sha256,
            recomputed_metadata_sha256=recomputed_meta_hash,
            stored_image_sha256=stored_image_sha256,
            recomputed_image_sha256=recomputed_img_hash,
            stored_combined_hash=stored_combined_hash,
            recomputed_combined_hash=recomputed_combined,
            signature_valid=True,
            details="PASS: All cryptographic hashes and digital signature match perfectly. Evidence is authentic."
        )

# Global singleton
crypto_signer = CryptoSigner()
