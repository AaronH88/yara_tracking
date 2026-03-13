from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Milestone
from schemas import MilestoneCreate, MilestoneUpdate, MilestoneResponse

router = APIRouter(tags=["milestones"])


@router.get("/babies/{baby_id}/milestones", response_model=list[MilestoneResponse])
async def list_milestones(
    baby_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Milestone)
        .where(Milestone.baby_id == baby_id)
        .order_by(Milestone.occurred_at.desc())
        .limit(limit)
    )
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("/babies/{baby_id}/milestones", response_model=MilestoneResponse, status_code=201)
async def create_milestone(
    baby_id: int,
    milestone_in: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
):
    milestone = Milestone(baby_id=baby_id, **milestone_in.model_dump())
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return milestone


@router.patch("/babies/{baby_id}/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    baby_id: int,
    milestone_id: int,
    milestone_in: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
):
    milestone = await db.get(Milestone, milestone_id)
    if not milestone or milestone.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for field, value in milestone_in.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)
    await db.commit()
    await db.refresh(milestone)
    return milestone


@router.delete("/babies/{baby_id}/milestones/{milestone_id}", status_code=204)
async def delete_milestone(
    baby_id: int,
    milestone_id: int,
    db: AsyncSession = Depends(get_db),
):
    milestone = await db.get(Milestone, milestone_id)
    if not milestone or milestone.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await db.delete(milestone)
    await db.commit()
