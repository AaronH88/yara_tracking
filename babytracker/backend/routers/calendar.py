import calendar as cal
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import DiaperEvent, FeedEvent, Milestone, SleepEvent

router = APIRouter(tags=["calendar"])


class DaySummary(BaseModel):
    date: str
    feed_count: int
    sleep_count: int
    diaper_count: int
    has_milestone: bool


class DayEvent(BaseModel):
    event_type: str
    timestamp: datetime | date
    id: int
    detail: dict

    model_config = {"from_attributes": True}


@router.get(
    "/babies/{baby_id}/calendar/month",
    response_model=dict[str, DaySummary],
)
async def get_month_summary(
    baby_id: int,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    _, last_day = cal.monthrange(year, month)
    month_start = datetime.combine(date(year, month, 1), time.min)
    month_end = datetime.combine(date(year, month, last_day), time.max)
    month_start_date = date(year, month, 1)
    month_end_date = date(year, month, last_day)

    feed_counts = await _count_by_date(
        db, FeedEvent, FeedEvent.baby_id == baby_id,
        cast(FeedEvent.started_at, Date),
        FeedEvent.started_at >= month_start,
        FeedEvent.started_at <= month_end,
    )

    sleep_counts = await _count_by_date(
        db, SleepEvent, SleepEvent.baby_id == baby_id,
        cast(SleepEvent.started_at, Date),
        SleepEvent.started_at >= month_start,
        SleepEvent.started_at <= month_end,
    )

    diaper_counts = await _count_by_date(
        db, DiaperEvent, DiaperEvent.baby_id == baby_id,
        cast(DiaperEvent.logged_at, Date),
        DiaperEvent.logged_at >= month_start,
        DiaperEvent.logged_at <= month_end,
    )

    milestone_query = (
        select(Milestone.occurred_at)
        .where(
            Milestone.baby_id == baby_id,
            Milestone.occurred_at >= month_start_date,
            Milestone.occurred_at <= month_end_date,
        )
    )
    milestone_rows = await db.execute(milestone_query)
    milestone_dates = {row[0] for row in milestone_rows.all()}

    all_dates = set(feed_counts) | set(sleep_counts) | set(diaper_counts) | milestone_dates

    summaries: dict[str, DaySummary] = {}
    for day_date in sorted(all_dates):
        date_str = day_date.isoformat()
        summaries[date_str] = DaySummary(
            date=date_str,
            feed_count=feed_counts.get(day_date, 0),
            sleep_count=sleep_counts.get(day_date, 0),
            diaper_count=diaper_counts.get(day_date, 0),
            has_milestone=day_date in milestone_dates,
        )

    return summaries


@router.get(
    "/babies/{baby_id}/calendar/day",
    response_model=list[DayEvent],
)
async def get_day_events(
    baby_id: int,
    date_param: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    day_start = datetime.combine(date_param, time.min)
    day_end = datetime.combine(date_param, time.max)

    feeds = await db.execute(
        select(FeedEvent).where(
            FeedEvent.baby_id == baby_id,
            FeedEvent.started_at >= day_start,
            FeedEvent.started_at <= day_end,
        )
    )
    sleeps = await db.execute(
        select(SleepEvent).where(
            SleepEvent.baby_id == baby_id,
            SleepEvent.started_at >= day_start,
            SleepEvent.started_at <= day_end,
        )
    )
    diapers = await db.execute(
        select(DiaperEvent).where(
            DiaperEvent.baby_id == baby_id,
            DiaperEvent.logged_at >= day_start,
            DiaperEvent.logged_at <= day_end,
        )
    )
    milestones = await db.execute(
        select(Milestone).where(
            Milestone.baby_id == baby_id,
            Milestone.occurred_at == date_param,
        )
    )

    events: list[DayEvent] = []

    for feed in feeds.scalars().all():
        events.append(DayEvent(
            event_type="feed",
            timestamp=feed.started_at,
            id=feed.id,
            detail={"type": feed.type, "amount_oz": feed.amount_oz, "notes": feed.notes},
        ))

    for sleep in sleeps.scalars().all():
        events.append(DayEvent(
            event_type="sleep",
            timestamp=sleep.started_at,
            id=sleep.id,
            detail={"type": sleep.type, "ended_at": str(sleep.ended_at) if sleep.ended_at else None, "notes": sleep.notes},
        ))

    for diaper in diapers.scalars().all():
        events.append(DayEvent(
            event_type="diaper",
            timestamp=diaper.logged_at,
            id=diaper.id,
            detail={"type": diaper.type, "notes": diaper.notes},
        ))

    for milestone in milestones.scalars().all():
        events.append(DayEvent(
            event_type="milestone",
            timestamp=datetime.combine(milestone.occurred_at, time.min),
            id=milestone.id,
            detail={"title": milestone.title, "notes": milestone.notes},
        ))

    events.sort(key=lambda e: e.timestamp)
    return events


async def _count_by_date(db: AsyncSession, model, owner_filter, date_expr, *range_filters):
    query = (
        select(date_expr, func.count())
        .where(owner_filter, *range_filters)
        .group_by(date_expr)
    )
    rows = await db.execute(query)
    return {row[0]: row[1] for row in rows.all()}
