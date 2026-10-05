import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.db.session import get_db
from backend.app.db.models import EvidencePassport, User
from backend.app.auth.dependencies import get_current_user
from backend.app.logging_config import logger

router = APIRouter(prefix="/evidence-vault", tags=["Evidence Vault"])

# Controlled evidence directory
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
VAULT_DIR = (BACKEND_DIR / "evidence_vault").resolve()

# Regex pattern strictly enforcing application-generated passport IDs
PASSPORT_ID_PATTERN = re.compile(r"^PASS-[A-Za-z0-9_-]{4,32}$")

@router.get("/{passport_id}/{image_type}")
async def get_evidence_keyframe(
    passport_id: str,
    image_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure, authenticated endpoint for retrieving physical JPEG keyframes from the Evidence Vault.
    Strictly prevents path traversal and unrestricted filesystem access.
    """
    # 1. Regex validation of passport ID format (rejects ../, /, \, etc.)
    if not PASSPORT_ID_PATTERN.match(passport_id):
        logger.warning(f"Keyframe retrieval rejected: Invalid passport ID format '{passport_id}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid passport ID format"
        )

    # 2. Strict validation of image type
    clean_type = image_type.lower().strip()
    if clean_type in ["raw", "raw_keyframe.jpg", "raw.jpg"]:
        filename = f"{passport_id}_raw.jpg"
    elif clean_type in ["annotated", "annotated_keyframe.jpg", "annotated.jpg"]:
        filename = f"{passport_id}_annotated.jpg"
    else:
        logger.warning(f"Keyframe retrieval rejected: Invalid image type '{image_type}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid keyframe type. Allowed types: 'raw', 'annotated'"
        )

    # 3. Verify passport exists in database
    result = await db.execute(select(EvidencePassport).where(EvidencePassport.passport_id == passport_id))
    passport = result.scalars().first()
    if not passport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence Passport '{passport_id}' not found"
        )

    # 4. Resolve file path with boundary protection
    target_path = (VAULT_DIR / filename).resolve()
    if not str(target_path).startswith(str(VAULT_DIR)):
        logger.error(f"Path traversal blocked: target='{target_path}', vault='{VAULT_DIR}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Path traversal detected"
        )

    if not target_path.is_file():
        # Check subfolder fallback
        subfolder_file = (VAULT_DIR / passport_id / ("annotated_keyframe.jpg" if "annotated" in clean_type else "raw_keyframe.jpg")).resolve()
        if str(subfolder_file).startswith(str(VAULT_DIR)) and subfolder_file.is_file():
            target_path = subfolder_file
        else:
            logger.warning(f"Keyframe file not found on disk: {target_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Keyframe image for passport '{passport_id}' not found in vault"
            )

    return FileResponse(
        str(target_path),
        media_type="image/jpeg",
        filename=filename
    )
