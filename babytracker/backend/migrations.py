from sqlalchemy import text
from sqlalchemy.exc import OperationalError


def _migrate_feed_event_v2_sync(conn):
    alter_statements = [
        "ALTER TABLE feed_events ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE feed_events ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE feed_events ADD COLUMN paused_at DATETIME",
        "ALTER TABLE feed_events ADD COLUMN quality TEXT",
    ]
    for statement in alter_statements:
        try:
            conn.execute(text(statement))
        except OperationalError as e:
            if "duplicate column name" not in str(e).lower() and "no such table" not in str(e).lower():
                raise


async def migrate_feed_event_v2(engine):
    async with engine.begin() as conn:
        await conn.run_sync(_migrate_feed_event_v2_sync)
