from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import SleepEvent
from schemas import SleepEventCreate, SleepEventUpdate, SleepEventResponse

router = APIRouter(tags=["sleeps"])


@router.get("/babies/{baby_id}/sleeps", response_model=list[SleepEventResponse])
async def list_sleeps(
    baby_id: int,
    date_filter: date | None = Query(None, alias="date"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(SleepEvent)
        .where(SleepEvent.baby_id == baby_id)
        .order_by(SleepEvent.started_at.desc())
        .limit(limit)
    )
    if date_filter:
        day_start = datetime.combine(date_filter, time.min)
        day_end = datetime.combine(date_filter, time.max)
        query = query.where(
            SleepEvent.started_at >= day_start,
            SleepEvent.started_at <= day_end,
        )
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("/babies/{baby_id}/sleeps", response_model=SleepEventResponse, status_code=201)
async def create_sleep(
    baby_id: int,
    sleep_in: SleepEventCreate,
    db: AsyncSession = Depends(get_db),
):
    if sleep_in.ended_at is None:
        active_query = select(SleepEvent).where(
            SleepEvent.baby_id == baby_id,
            SleepEvent.ended_at.is_(None),
        )
        active_row = await db.execute(active_query)
        if active_row.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="A sleep is already in progress for this baby.",
            )
    sleep = SleepEvent(baby_id=baby_id, **sleep_in.model_dump())
    db.add(sleep)
    await db.commit()
    await db.refresh(sleep)
    return sleep


@router.get("/babies/{baby_id}/sleeps/active", response_model=SleepEventResponse | None)
async def get_active_sleep(
    baby_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(SleepEvent).where(
        SleepEvent.baby_id == baby_id,
        SleepEvent.ended_at.is_(None),
    )
    row = await db.execute(query)
    return row.scalar_one_or_none()


@router.patch("/babies/{baby_id}/sleeps/{sleep_id}", response_model=SleepEventResponse)
async def update_sleep(
    baby_id: int,
    sleep_id: int,
    sleep_in: SleepEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    sleep = await db.get(SleepEvent, sleep_id)
    if not sleep or sleep.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Sleep not found")
    for field, value in sleep_in.model_dump(exclude_unset=True).items():
        setattr(sleep, field, value)
    await db.commit()
    await db.refresh(sleep)
    return sleep


@router.delete("/babies/{baby_id}/sleeps/{sleep_id}", status_code=204)
async def delete_sleep(
    baby_id: int,
    sleep_id: int,
    db: AsyncSession = Depends(get_db),
):
    sleep = await db.get(SleepEvent, sleep_id)
    if not sleep or sleep.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Sleep not found")
    await db.delete(sleep)
    await db.commit()
