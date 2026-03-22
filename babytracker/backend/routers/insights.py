from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedEvent, SleepEvent, DiaperEvent
from schemas import (
    InsightsResponse,
    FeedInsights,
    SleepInsights,
    NappyInsights,
    InsightAlert,
)

router = APIRouter(tags=["insights"])


def _midnight_utc_today(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _sleep_duration_minutes(sleep: SleepEvent, clamp_start: datetime, clamp_end: datetime) -> int:
    started = max(sleep.started_at.replace(tzinfo=timezone.utc)
                  if sleep.started_at.tzinfo is None else sleep.started_at, clamp_start)
    if sleep.ended_at is None:
        ended = clamp_end
    else:
        ended = min(sleep.ended_at.replace(tzinfo=timezone.utc)
                    if sleep.ended_at.tzinfo is None else sleep.ended_at, clamp_end)
    minutes = int((ended - started).total_seconds() / 60)
    return max(minutes, 0)


async def _has_enough_data(baby_id: int, db: AsyncSession) -> bool:
    for model, date_col in [
        (FeedEvent, FeedEvent.started_at),
        (SleepEvent, SleepEvent.started_at),
        (DiaperEvent, DiaperEvent.logged_at),
    ]:
        query = select(
            func.julianday(func.max(date_col)) - func.julianday(func.min(date_col))
        ).where(model.baby_id == baby_id)
        row = await db.execute(query)
        day_span = row.scalar_one_or_none()
        if day_span is None or day_span < 2:
            return False
    return True


async def _feed_insights(baby_id: int, db: AsyncSession, now: datetime) -> FeedInsights:
    midnight_today = _midnight_utc_today(now)
    seven_days_ago = midnight_today - timedelta(days=7)

    today_count_query = select(func.count()).where(
        FeedEvent.baby_id == baby_id,
        FeedEvent.started_at >= midnight_today,
        FeedEvent.started_at <= now,
    )
    today_count_row = await db.execute(today_count_query)
    count_since_midnight = today_count_row.scalar_one()

    week_count_query = select(func.count()).where(
        FeedEvent.baby_id == baby_id,
        FeedEvent.started_at >= seven_days_ago,
        FeedEvent.started_at < midnight_today,
    )
    week_count_row = await db.execute(week_count_query)
    week_count = week_count_row.scalar_one()
    average_per_day = round(week_count / 7, 1)

    return FeedInsights(
        count_since_midnight=count_since_midnight,
        average_per_day_this_week=average_per_day,
    )


async def _sleep_insights(baby_id: int, db: AsyncSession, now: datetime) -> SleepInsights:
    twenty_four_hours_ago = now - timedelta(hours=24)
    midnight_today = _midnight_utc_today(now)
    seven_days_ago = midnight_today - timedelta(days=7)
    last_night_start = midnight_today - timedelta(hours=4)  # 8pm yesterday
    last_night_end = midnight_today + timedelta(hours=8)     # 8am today

    # Total sleep in last 24h
    sleep_24h_query = select(SleepEvent).where(
        SleepEvent.baby_id == baby_id,
        SleepEvent.started_at <= now,
        (SleepEvent.ended_at >= twenty_four_hours_ago) | SleepEvent.ended_at.is_(None),
    )
    sleep_24h_rows = await db.execute(sleep_24h_query)
    sleep_24h_events = sleep_24h_rows.scalars().all()
    total_last_24h_minutes = sum(
        _sleep_duration_minutes(s, twenty_four_hours_ago, now) for s in sleep_24h_events
    )

    # 7-day average sleep per day
    sleep_7d_query = select(SleepEvent).where(
        SleepEvent.baby_id == baby_id,
        SleepEvent.started_at < midnight_today,
        (SleepEvent.ended_at >= seven_days_ago) | SleepEvent.ended_at.is_(None),
    )
    sleep_7d_rows = await db.execute(sleep_7d_query)
    sleep_7d_events = sleep_7d_rows.scalars().all()
    total_7d_minutes = sum(
        _sleep_duration_minutes(s, seven_days_ago, midnight_today) for s in sleep_7d_events
    )
    average_per_day_7day_minutes = round(total_7d_minutes / 7)

    # Nap count today (sleeps started after midnight today)
    nap_count_query = select(func.count()).where(
        SleepEvent.baby_id == baby_id,
        SleepEvent.started_at >= midnight_today,
        SleepEvent.started_at <= now,
    )
    nap_count_row = await db.execute(nap_count_query)
    nap_count_today = nap_count_row.scalar_one()

    # Longest night stretch (8pm yesterday to 8am today)
    night_sleep_query = select(SleepEvent).where(
        SleepEvent.baby_id == baby_id,
        SleepEvent.started_at <= last_night_end,
        (SleepEvent.ended_at >= last_night_start) | SleepEvent.ended_at.is_(None),
    )
    night_sleep_rows = await db.execute(night_sleep_query)
    night_sleep_events = night_sleep_rows.scalars().all()
    longest_night_stretch = 0
    for sleep_event in night_sleep_events:
        stretch = _sleep_duration_minutes(sleep_event, last_night_start, last_night_end)
        if stretch > longest_night_stretch:
            longest_night_stretch = stretch

    return SleepInsights(
        total_last_24h_minutes=total_last_24h_minutes,
        average_per_day_7day_minutes=average_per_day_7day_minutes,
        nap_count_today=nap_count_today,
        longest_night_stretch_minutes=longest_night_stretch,
    )


async def _nappy_insights(baby_id: int, db: AsyncSession, now: datetime) -> NappyInsights:
    midnight_today = _midnight_utc_today(now)
    seven_days_ago = midnight_today - timedelta(days=7)

    # Wet count today
    wet_today_query = select(func.count()).where(
        DiaperEvent.baby_id == baby_id,
        DiaperEvent.logged_at >= midnight_today,
        DiaperEvent.logged_at <= now,
        DiaperEvent.type.in_(["wet", "both"]),
    )
    wet_today_row = await db.execute(wet_today_query)
    wet_count_today = wet_today_row.scalar_one()

    # Average wet per day over 7 days
    wet_week_query = select(func.count()).where(
        DiaperEvent.baby_id == baby_id,
        DiaperEvent.logged_at >= seven_days_ago,
        DiaperEvent.logged_at < midnight_today,
        DiaperEvent.type.in_(["wet", "both"]),
    )
    wet_week_row = await db.execute(wet_week_query)
    wet_week_count = wet_week_row.scalar_one()
    average_wet_per_day_7day = round(wet_week_count / 7, 1)

    # Days since last dirty nappy
    last_dirty_query = (
        select(DiaperEvent.logged_at)
        .where(
            DiaperEvent.baby_id == baby_id,
            DiaperEvent.type.in_(["dirty", "both"]),
        )
        .order_by(DiaperEvent.logged_at.desc())
        .limit(1)
    )
    last_dirty_row = await db.execute(last_dirty_query)
    last_dirty_at = last_dirty_row.scalar_one_or_none()
    if last_dirty_at is None:
        days_since_dirty = 999
    else:
        last_dirty_utc = last_dirty_at.replace(tzinfo=timezone.utc) if last_dirty_at.tzinfo is None else last_dirty_at
        days_since_dirty = (now - last_dirty_utc).days

    return NappyInsights(
        wet_count_today=wet_count_today,
        average_wet_per_day_7day=average_wet_per_day_7day,
        days_since_dirty=days_since_dirty,
    )


def _build_alerts(
    feed_insights: FeedInsights,
    sleep_insights: SleepInsights,
    nappy_insights: NappyInsights,
    now: datetime,
) -> list[InsightAlert]:
    alerts: list[InsightAlert] = []

    # Fewer wet nappies than usual
    if (
        now.hour >= 16
        and feed_insights.average_per_day_this_week > 0
        and nappy_insights.average_wet_per_day_7day > 0
        and nappy_insights.wet_count_today < 0.7 * nappy_insights.average_wet_per_day_7day
    ):
        alerts.append(InsightAlert(
            type="warning",
            message="Fewer wet nappies than usual today",
        ))

    # More frequent feeds
    if (
        now.hour >= 12
        and feed_insights.average_per_day_this_week > 0
        and feed_insights.count_since_midnight > 1.3 * feed_insights.average_per_day_this_week
    ):
        alerts.append(InsightAlert(
            type="warning",
            message="More frequent feeds than usual today",
        ))

    # No dirty nappy in 2+ days
    if nappy_insights.days_since_dirty >= 2:
        alerts.append(InsightAlert(
            type="warning",
            message="No dirty nappy in 2+ days",
        ))

    # Great sleep stretch
    if sleep_insights.longest_night_stretch_minutes >= 240:
        alerts.append(InsightAlert(
            type="info",
            message="Great sleep stretch last night! 🎉",
        ))

    return alerts[:3]


@router.get("/babies/{baby_id}/insights", response_model=InsightsResponse)
async def get_insights(
    baby_id: int,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    has_enough_data = await _has_enough_data(baby_id, db)

    feed_insights = await _feed_insights(baby_id, db, now)
    sleep_insights = await _sleep_insights(baby_id, db, now)
    nappy_insights = await _nappy_insights(baby_id, db, now)

    alerts = _build_alerts(feed_insights, sleep_insights, nappy_insights, now) if has_enough_data else []

    return InsightsResponse(
        has_enough_data=has_enough_data,
        feeds=feed_insights,
        sleep=sleep_insights,
        nappies=nappy_insights,
        alerts=alerts,
    )
