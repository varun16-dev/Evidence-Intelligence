from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from backend.app.db.session import get_db
from backend.app.db.models import TrainingCentre, User
from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.schemas.centre_schemas import (
    TrainingCentreCreate, TrainingCentreResponse
)

router = APIRouter(prefix="/centres", tags=["Training Centres"])

@router.get("", response_model=List[TrainingCentreResponse])
async def list_training_centres(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(TrainingCentre).options(selectinload(TrainingCentre.rooms))
    if state:
        query = query.where(TrainingCentre.state == state)
    if district:
        query = query.where(TrainingCentre.district == district)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    centres = result.scalars().all()
    return centres

@router.get("/{centre_id}", response_model=TrainingCentreResponse)
async def get_training_centre(
    centre_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(TrainingCentre).options(selectinload(TrainingCentre.rooms)).where(TrainingCentre.centre_id == centre_id)
    result = await db.execute(query)
    centre = result.scalars().first()
    if not centre:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training centre with ID '{centre_id}' not found"
        )
    return centre

@router.post("", response_model=TrainingCentreResponse, status_code=status.HTTP_201_CREATED)
async def create_training_centre(
    centre_in: TrainingCentreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    result = await db.execute(select(TrainingCentre).where(TrainingCentre.centre_id == centre_in.centre_id))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Centre with ID '{centre_in.centre_id}' already exists"
        )
    
    new_centre = TrainingCentre(
        centre_id=centre_in.centre_id,
        centre_name=centre_in.centre_name,
        state=centre_in.state,
        district=centre_in.district,
        accredited_trades=centre_in.accredited_trades
    )
    db.add(new_centre)
    await db.commit()
    
    # Reload with relationships
    query = select(TrainingCentre).options(selectinload(TrainingCentre.rooms)).where(TrainingCentre.centre_id == new_centre.centre_id)
    result = await db.execute(query)
    return result.scalars().first()
