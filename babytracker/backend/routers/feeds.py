from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedEvent
from schemas import FeedEventCreate, FeedEventUpdate, FeedEventResponse, FeedEventCreateResponse
from timer_helpers import close_active_timers

router = APIRouter(tags=["feeds"])


@router.get("/babies/{baby_id}/feeds", response_model=list[FeedEventResponse])
async def list_feeds(
    baby_id: int,
    date_filter: date | None = Query(None, alias="date"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(FeedEvent)
        .where(FeedEvent.baby_id == baby_id)
        .order_by(FeedEvent.started_at.desc())
        .limit(limit)
    )
    if date_filter:
        day_start = datetime.combine(date_filter, time.min)
        day_end = datetime.combine(date_filter, time.max)
        query = query.where(
            FeedEvent.started_at >= day_start,
            FeedEvent.started_at <= day_end,
        )
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("/babies/{baby_id}/feeds", response_model=FeedEventCreateResponse, status_code=201)
async def create_feed(
    baby_id: int,
    feed_in: FeedEventCreate,
    db: AsyncSession = Depends(get_db),
):
    auto_closed = await close_active_timers(baby_id, db, exclude_model=FeedEvent)
    if feed_in.ended_at is None:
        active_query = select(FeedEvent).where(
            FeedEvent.baby_id == baby_id,
            FeedEvent.ended_at.is_(None),
        )
        active_row = await db.execute(active_query)
        active_feed = active_row.scalar_one_or_none()
        if active_feed:
            now = datetime.now(timezone.utc)
            active_feed.ended_at = now
            auto_closed.append(
                {
                    "type": "feed",
                    "id": active_feed.id,
                    "started_at": active_feed.started_at.isoformat(),
                }
            )
    feed = FeedEvent(baby_id=baby_id, **feed_in.model_dump())
    db.add(feed)
    await db.commit()
    await db.refresh(feed)
    feed_dict = FeedEventResponse.model_validate(feed).model_dump()
    feed_dict["auto_closed"] = auto_closed
    return feed_dict


@router.get("/babies/{baby_id}/feeds/active", response_model=FeedEventResponse | None)
async def get_active_feed(
    baby_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(FeedEvent).where(
        FeedEvent.baby_id == baby_id,
        FeedEvent.ended_at.is_(None),
    )
    row = await db.execute(query)
    return row.scalar_one_or_none()


@router.patch("/babies/{baby_id}/feeds/{feed_id}", response_model=FeedEventResponse)
async def update_feed(
    baby_id: int,
    feed_id: int,
    feed_in: FeedEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedEvent, feed_id)
    if not feed or feed.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Feed not found")
    for field, value in feed_in.model_dump(exclude_unset=True).items():
        setattr(feed, field, value)
    await db.commit()
    await db.refresh(feed)
    return feed


@router.delete("/babies/{baby_id}/feeds/{feed_id}", status_code=204)
async def delete_feed(
    baby_id: int,
    feed_id: int,
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedEvent, feed_id)
    if not feed or feed.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Feed not found")
    await db.delete(feed)
    await db.commit()


@router.post("/babies/{baby_id}/feeds/{feed_id}/pause", response_model=FeedEventResponse)
async def pause_feed(
    baby_id: int,
    feed_id: int,
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedEvent, feed_id)
    if not feed or feed.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Feed not found")
    if feed.ended_at is not None:
        raise HTTPException(status_code=409, detail="Feed is already ended")
    if feed.is_paused:
        raise HTTPException(status_code=409, detail="Feed is already paused")
    feed.is_paused = True
    feed.paused_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(feed)
    return feed


@router.post("/babies/{baby_id}/feeds/{feed_id}/resume", response_model=FeedEventResponse)
async def resume_feed(
    baby_id: int,
    feed_id: int,
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedEvent, feed_id)
    if not feed or feed.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Feed not found")
    if feed.ended_at is not None:
        raise HTTPException(status_code=409, detail="Feed is already ended")
    if not feed.is_paused:
        raise HTTPException(status_code=409, detail="Feed is not paused")
    now = datetime.now(timezone.utc)
    paused_at_aware = feed.paused_at.replace(tzinfo=timezone.utc)
    pause_duration = int((now - paused_at_aware).total_seconds())
    feed.paused_seconds = (feed.paused_seconds or 0) + pause_duration
    feed.is_paused = False
    feed.paused_at = None
    await db.commit()
    await db.refresh(feed)
    return feed
