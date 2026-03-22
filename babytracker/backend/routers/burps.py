from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import BurpEvent
from schemas import BurpEventCreate, BurpEventUpdate, BurpEventResponse, BurpEventCreateResponse
from timer_helpers import close_active_timers

router = APIRouter(tags=["burps"])


@router.get("/babies/{baby_id}/burps", response_model=list[BurpEventResponse])
async def list_burps(
    baby_id: int,
    date_filter: date | None = Query(None, alias="date"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(BurpEvent)
        .where(BurpEvent.baby_id == baby_id)
        .order_by(BurpEvent.started_at.desc())
        .limit(limit)
    )
    if date_filter:
        day_start = datetime.combine(date_filter, time.min)
        day_end = datetime.combine(date_filter, time.max)
        query = query.where(
            BurpEvent.started_at >= day_start,
            BurpEvent.started_at <= day_end,
        )
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("/babies/{baby_id}/burps", response_model=BurpEventCreateResponse, status_code=201)
async def create_burp(
    baby_id: int,
    burp_in: BurpEventCreate,
    db: AsyncSession = Depends(get_db),
):
    auto_closed = await close_active_timers(baby_id, db, exclude_model=BurpEvent)
    if burp_in.ended_at is None:
        active_query = select(BurpEvent).where(
            BurpEvent.baby_id == baby_id,
            BurpEvent.ended_at.is_(None),
        )
        active_row = await db.execute(active_query)
        active_burp = active_row.scalar_one_or_none()
        if active_burp:
            now = datetime.now(timezone.utc)
            active_burp.ended_at = now
            auto_closed.append(
                {
                    "type": "burp",
                    "id": active_burp.id,
                    "started_at": active_burp.started_at.isoformat(),
                }
            )
    burp = BurpEvent(baby_id=baby_id, **burp_in.model_dump())
    db.add(burp)
    await db.commit()
    await db.refresh(burp)
    burp_dict = BurpEventResponse.model_validate(burp).model_dump()
    burp_dict["auto_closed"] = auto_closed
    return burp_dict


@router.get("/babies/{baby_id}/burps/active", response_model=BurpEventResponse | None)
async def get_active_burp(
    baby_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(BurpEvent).where(
        BurpEvent.baby_id == baby_id,
        BurpEvent.ended_at.is_(None),
    )
    row = await db.execute(query)
    return row.scalar_one_or_none()


@router.patch("/babies/{baby_id}/burps/{burp_id}", response_model=BurpEventResponse)
async def update_burp(
    baby_id: int,
    burp_id: int,
    burp_in: BurpEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    burp = await db.get(BurpEvent, burp_id)
    if not burp or burp.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Burp not found")
    for field, value in burp_in.model_dump(exclude_unset=True).items():
        setattr(burp, field, value)
    await db.commit()
    await db.refresh(burp)
    return burp


@router.delete("/babies/{baby_id}/burps/{burp_id}", status_code=204)
async def delete_burp(
    baby_id: int,
    burp_id: int,
    db: AsyncSession = Depends(get_db),
):
    burp = await db.get(BurpEvent, burp_id)
    if not burp or burp.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Burp not found")
    await db.delete(burp)
    await db.commit()
