from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Baby, SleepEvent
from schemas import WakeWindowResponse

router = APIRouter(tags=["wake-window"])


@router.get("/babies/{baby_id}/wake-window", response_model=WakeWindowResponse)
async def get_wake_window(
    baby_id: int,
    db: AsyncSession = Depends(get_db),
):
    active_sleep_query = select(SleepEvent).where(
        SleepEvent.baby_id == baby_id,
        SleepEvent.ended_at.is_(None),
    )
    active_sleep_row = await db.execute(active_sleep_query)
    active_sleep = active_sleep_row.scalar_one_or_none()

    if active_sleep:
        return WakeWindowResponse(
            is_sleeping=True,
            awake_since=None,
            awake_minutes=0,
            sleep_started_at=active_sleep.started_at,
        )

    last_sleep_query = (
        select(SleepEvent)
        .where(
            SleepEvent.baby_id == baby_id,
            SleepEvent.ended_at.is_not(None),
        )
        .order_by(SleepEvent.ended_at.desc())
        .limit(1)
    )
    last_sleep_row = await db.execute(last_sleep_query)
    last_sleep = last_sleep_row.scalar_one_or_none()

    if last_sleep:
        awake_since = last_sleep.ended_at
    else:
        baby = await db.get(Baby, baby_id)
        awake_since = datetime.combine(
            baby.created_at.date() if baby.created_at else baby.birthdate,
            datetime.min.time(),
            tzinfo=timezone.utc,
        )

    now = datetime.now(timezone.utc)
    awake_since_utc = awake_since.replace(tzinfo=timezone.utc) if awake_since.tzinfo is None else awake_since
    awake_minutes = int((now - awake_since_utc).total_seconds() / 60)

    return WakeWindowResponse(
        is_sleeping=False,
        awake_since=awake_since,
        awake_minutes=awake_minutes,
        sleep_started_at=None,
    )
