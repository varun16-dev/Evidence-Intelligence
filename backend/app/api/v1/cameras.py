from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.db.session import get_db
from backend.app.db.models import Room, TrainingCentre, User
from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.schemas.centre_schemas import (
    RoomCreate, RoomResponse, ZoneUpdate,
    AnalyzeClipRequest, ClipAnalysisResponse
)
from backend.app.core.video_analysis_service import VideoAnalysisService

router = APIRouter(tags=["Cameras & Rooms"])

@router.get("/cameras/test-clips", response_model=List[Dict[str, Any]])
async def list_available_test_clips(
    current_user: User = Depends(get_current_user)
):
    """
    Lists allowlisted test video clips available for offline CV pipeline evaluation.
    Requires authentication.
    """
    return VideoAnalysisService.get_allowlisted_clips()

@router.get("/cameras", response_model=List[RoomResponse])
async def list_all_cameras(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Room))
    rooms = result.scalars().all()
    return rooms

@router.get("/centres/{centre_id}/cameras", response_model=List[RoomResponse])
async def list_cameras_by_centre(
    centre_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Room).where(Room.centre_id == centre_id))
    rooms = result.scalars().all()
    return rooms

@router.post("/centres/{centre_id}/cameras", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def register_camera(
    centre_id: str,
    room_in: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    # Verify centre exists
    centre_res = await db.execute(select(TrainingCentre).where(TrainingCentre.centre_id == centre_id))
    if not centre_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Centre '{centre_id}' does not exist"
        )
    
    # Check if room_id or camera_id already exists
    existing_room = await db.execute(select(Room).where(Room.room_id == room_in.room_id))
    if existing_room.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Room ID '{room_in.room_id}' already registered"
        )
    
    existing_cam = await db.execute(select(Room).where(Room.camera_id == room_in.camera_id))
    if existing_cam.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera ID '{room_in.camera_id}' already registered"
        )
    
    new_room = Room(
        room_id=room_in.room_id,
        centre_id=centre_id,
        room_name=room_in.room_name,
        room_type=room_in.room_type,
        seating_capacity=room_in.seating_capacity,
        camera_id=room_in.camera_id,
        rtsp_stream_uri=room_in.rtsp_stream_uri,
        zones_geojson=room_in.zones_geojson
    )
    db.add(new_room)
    await db.commit()
    await db.refresh(new_room)
    return new_room

@router.put("/cameras/{camera_id}/zones", response_model=RoomResponse)
async def update_camera_zones(
    camera_id: str,
    zone_in: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    result = await db.execute(select(Room).where(Room.camera_id == camera_id))
    room = result.scalars().first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera ID '{camera_id}' not found"
        )
    
    room.zones_geojson = zone_in.zones_geojson
    await db.commit()
    await db.refresh(room)
    return room

@router.post("/cameras/{camera_id}/analyze-clip", response_model=ClipAnalysisResponse)
async def analyze_camera_clip(
    camera_id: str,
    req: AnalyzeClipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OFFICER"]))
):
    """
    Executes real Computer Vision analysis on an allowlisted test clip for a configured camera.
    Authenticated officers and admins only.
    """
    return await VideoAnalysisService.analyze_camera_clip(
        db=db,
        camera_id=camera_id,
        clip_filename=req.clip_filename,
        max_frames=req.max_frames or 90,
        sample_fps=req.sample_fps or 3.0,
        expected_headcount=req.expected_headcount,
        current_user=current_user
    )

