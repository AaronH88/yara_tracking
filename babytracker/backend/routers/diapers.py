from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import DiaperEvent
from schemas import DiaperEventCreate, DiaperEventUpdate, DiaperEventResponse

router = APIRouter(tags=["diapers"])


@router.get("/babies/{baby_id}/diapers", response_model=list[DiaperEventResponse])
async def list_diapers(
    baby_id: int,
    date_filter: date | None = Query(None, alias="date"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(DiaperEvent)
        .where(DiaperEvent.baby_id == baby_id)
        .order_by(DiaperEvent.logged_at.desc())
        .limit(limit)
    )
    if date_filter:
        day_start = datetime.combine(date_filter, time.min)
        day_end = datetime.combine(date_filter, time.max)
        query = query.where(
            DiaperEvent.logged_at >= day_start,
            DiaperEvent.logged_at <= day_end,
        )
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("/babies/{baby_id}/diapers", response_model=DiaperEventResponse, status_code=201)
async def create_diaper(
    baby_id: int,
    diaper_in: DiaperEventCreate,
    db: AsyncSession = Depends(get_db),
):
    diaper = DiaperEvent(baby_id=baby_id, **diaper_in.model_dump())
    db.add(diaper)
    await db.commit()
    await db.refresh(diaper)
    return diaper


@router.patch("/babies/{baby_id}/diapers/{diaper_id}", response_model=DiaperEventResponse)
async def update_diaper(
    baby_id: int,
    diaper_id: int,
    diaper_in: DiaperEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    diaper = await db.get(DiaperEvent, diaper_id)
    if not diaper or diaper.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Diaper event not found")
    for field, value in diaper_in.model_dump(exclude_unset=True).items():
        setattr(diaper, field, value)
    await db.commit()
    await db.refresh(diaper)
    return diaper


@router.delete("/babies/{baby_id}/diapers/{diaper_id}", status_code=204)
async def delete_diaper(
    baby_id: int,
    diaper_id: int,
    db: AsyncSession = Depends(get_db),
):
    diaper = await db.get(DiaperEvent, diaper_id)
    if not diaper or diaper.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Diaper event not found")
    await db.delete(diaper)
    await db.commit()
