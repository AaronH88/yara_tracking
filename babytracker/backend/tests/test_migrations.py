"""Tests for Task 1.1 — FeedEvent migration (migrate_feed_event_v2)."""

import pytest
from datetime import date, datetime
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from database import Base
from models import Baby, User, FeedEvent
from migrations import migrate_feed_event_v2

pytestmark = pytest.mark.anyio


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def engine():
    """Create a fresh in-memory async engine."""
    eng = create_async_engine(TEST_DB_URL, echo=False)
    yield eng
    await eng.dispose()


@pytest.fixture
async def engine_with_tables(engine):
    """Engine with all tables created via create_all (includes new columns)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine


@pytest.fixture
async def engine_with_legacy_table(engine):
    """Engine with a feed_events table that lacks the v2 columns (simulates pre-migration)."""
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: c.execute(text("""
            CREATE TABLE babies (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                birthdate DATE NOT NULL,
                gender TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)))
        await conn.run_sync(lambda c: c.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)))
        await conn.run_sync(lambda c: c.execute(text("""
            CREATE TABLE feed_events (
                id INTEGER PRIMARY KEY,
                baby_id INTEGER NOT NULL REFERENCES babies(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                type TEXT NOT NULL,
                started_at DATETIME NOT NULL,
                ended_at DATETIME,
                amount_oz REAL,
                amount_ml REAL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)))
    return engine


def _get_column_names_sync(conn, table_name):
    """Synchronous helper to get column names from a table."""
    result = conn.execute(text(f"PRAGMA table_info({table_name})"))
    return [row[1] for row in result.fetchall()]


# --- Migration idempotency ---


@pytest.mark.anyio
async def test_migration_runs_on_table_with_existing_columns(engine_with_tables):
    """Migration should succeed on a table that already has the v2 columns (idempotent)."""
    # The table already has v2 columns from create_all; running migration should not error
    await migrate_feed_event_v2(engine_with_tables)

    async with engine_with_tables.begin() as conn:
        cols = await conn.run_sync(lambda c: _get_column_names_sync(c, "feed_events"))
    assert "paused_seconds" in cols
    assert "is_paused" in cols
    assert "paused_at" in cols
    assert "quality" in cols


@pytest.mark.anyio
async def test_migration_is_idempotent_run_twice(engine_with_legacy_table):
    """Running the migration twice should not raise any errors."""
    await migrate_feed_event_v2(engine_with_legacy_table)
    # Second run — should be a no-op, not an error
    await migrate_feed_event_v2(engine_with_legacy_table)

    async with engine_with_legacy_table.begin() as conn:
        cols = await conn.run_sync(lambda c: _get_column_names_sync(c, "feed_events"))
    assert "paused_seconds" in cols
    assert "is_paused" in cols
    assert "paused_at" in cols
    assert "quality" in cols


# --- Migration adds columns to legacy table ---


@pytest.mark.anyio
async def test_migration_adds_all_four_columns_to_legacy_table(engine_with_legacy_table):
    """Migration should add paused_seconds, is_paused, paused_at, quality to a legacy table."""
    # Verify columns are absent before migration
    async with engine_with_legacy_table.begin() as conn:
        cols_before = await conn.run_sync(lambda c: _get_column_names_sync(c, "feed_events"))
    assert "paused_seconds" not in cols_before
    assert "is_paused" not in cols_before
    assert "paused_at" not in cols_before
    assert "quality" not in cols_before

    await migrate_feed_event_v2(engine_with_legacy_table)

    async with engine_with_legacy_table.begin() as conn:
        cols_after = await conn.run_sync(lambda c: _get_column_names_sync(c, "feed_events"))
    assert "paused_seconds" in cols_after
    assert "is_paused" in cols_after
    assert "paused_at" in cols_after
    assert "quality" in cols_after


# --- Existing data preserved after migration ---


@pytest.mark.anyio
async def test_existing_feed_records_unaffected_by_migration(engine_with_legacy_table):
    """Pre-existing feed records should keep their data; new columns should get defaults."""
    eng = engine_with_legacy_table

    # Insert a legacy record before migration
    async with eng.begin() as conn:
        await conn.execute(text(
            "INSERT INTO babies (id, name, birthdate) VALUES (1, 'Baby', '2024-01-01')"
        ))
        await conn.execute(text(
            "INSERT INTO users (id, name) VALUES (1, 'Parent')"
        ))
        await conn.execute(text(
            "INSERT INTO feed_events (id, baby_id, user_id, type, started_at, ended_at, amount_oz, notes) "
            "VALUES (1, 1, 1, 'bottle', '2024-06-15T10:00:00', '2024-06-15T10:15:00', 4.0, 'good feed')"
        ))

    # Run migration
    await migrate_feed_event_v2(eng)

    # Verify existing record is intact and new columns have defaults
    async with eng.begin() as conn:
        result = await conn.execute(text("SELECT * FROM feed_events WHERE id = 1"))
        row = result.mappings().fetchone()

    assert row["type"] == "bottle"
    assert row["amount_oz"] == 4.0
    assert row["notes"] == "good feed"
    assert row["started_at"] == "2024-06-15T10:00:00"
    assert row["ended_at"] == "2024-06-15T10:15:00"
    # New columns should have their defaults
    assert row["paused_seconds"] == 0
    assert row["is_paused"] in (False, 0, "false")  # SQLite stores booleans as int
    assert row["paused_at"] is None
    assert row["quality"] is None


# --- Migration on empty database (no feed_events table) ---


@pytest.mark.anyio
async def test_migration_does_not_error_when_table_missing(engine):
    """Migration should not raise when the feed_events table doesn't exist yet."""
    # The engine has no tables at all — migration should silently skip
    await migrate_feed_event_v2(engine)
    # No assertion needed beyond not raising


# --- Column defaults verified via ORM after migration ---


@pytest.mark.anyio
async def test_new_columns_have_correct_defaults_via_orm(engine_with_tables):
    """When creating a FeedEvent via ORM without new fields, defaults should apply."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        # Create prerequisite rows
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        feed = FeedEvent(
            baby_id=baby.id,
            user_id=user.id,
            type="bottle",
            started_at=datetime(2024, 6, 15, 10, 0, 0),
        )
        session.add(feed)
        await session.flush()

        assert feed.paused_seconds == 0
        assert feed.is_paused is False
        assert feed.paused_at is None
        assert feed.quality is None
