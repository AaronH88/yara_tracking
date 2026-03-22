from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import BurpEvent, FeedEvent, SleepEvent


async def close_active_timers(
    baby_id: int, db: AsyncSession, exclude_model=None
) -> list[dict]:
    closed_timers = []
    model_configs = [
        (FeedEvent, "feed"),
        (SleepEvent, "sleep"),
        (BurpEvent, "burp"),
    ]

    now = datetime.now(timezone.utc)

    for model_class, type_label in model_configs:
        if model_class is exclude_model:
            continue

        active_query = select(model_class).where(
            model_class.baby_id == baby_id,
            model_class.ended_at.is_(None),
        )
        active_rows = await db.execute(active_query)
        active_events = active_rows.scalars().all()

        for active_event in active_events:
            active_event.ended_at = now
            closed_timers.append(
                {
                    "type": type_label,
                    "id": active_event.id,
                    "started_at": active_event.started_at.isoformat(),
                }
            )

    return closed_timers
