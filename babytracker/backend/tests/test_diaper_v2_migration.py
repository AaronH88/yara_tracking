"""Tests for Task 1.2 — DiaperEvent migration (migrate_diaper_event_v2)."""

import pytest
from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from database import Base
from models import Baby, User, DiaperEvent
from migrations import migrate_diaper_event_v2

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
async def engine_with_legacy_diaper_table(engine):
    """Engine with a diaper_events table that lacks the v2 columns (simulates pre-migration)."""
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
            CREATE TABLE diaper_events (
                id INTEGER PRIMARY KEY,
                baby_id INTEGER NOT NULL REFERENCES babies(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                logged_at DATETIME NOT NULL,
                type TEXT NOT NULL,
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


async def test_migration_on_table_with_existing_columns_is_noop(engine_with_tables):
    """Migration should succeed on a table that already has the v2 columns (idempotent)."""
    await migrate_diaper_event_v2(engine_with_tables)

    async with engine_with_tables.begin() as conn:
        cols = await conn.run_sync(lambda c: _get_column_names_sync(c, "diaper_events"))
    assert "wet_amount" in cols
    assert "dirty_colour" in cols


async def test_migration_is_idempotent_run_twice(engine_with_legacy_diaper_table):
    """Running the migration twice should not raise any errors."""
    await migrate_diaper_event_v2(engine_with_legacy_diaper_table)
    await migrate_diaper_event_v2(engine_with_legacy_diaper_table)

    async with engine_with_legacy_diaper_table.begin() as conn:
        cols = await conn.run_sync(lambda c: _get_column_names_sync(c, "diaper_events"))
    assert "wet_amount" in cols
    assert "dirty_colour" in cols


async def test_migration_is_idempotent_run_three_times(engine_with_legacy_diaper_table):
    """Running the migration three times should still not raise any errors."""
    for _ in range(3):
        await migrate_diaper_event_v2(engine_with_legacy_diaper_table)

    async with engine_with_legacy_diaper_table.begin() as conn:
        cols = await conn.run_sync(lambda c: _get_column_names_sync(c, "diaper_events"))
    assert "wet_amount" in cols
    assert "dirty_colour" in cols


# --- Migration adds columns to legacy table ---


async def test_migration_adds_both_columns_to_legacy_table(engine_with_legacy_diaper_table):
    """Migration should add wet_amount and dirty_colour to a legacy table."""
    async with engine_with_legacy_diaper_table.begin() as conn:
        cols_before = await conn.run_sync(lambda c: _get_column_names_sync(c, "diaper_events"))
    assert "wet_amount" not in cols_before
    assert "dirty_colour" not in cols_before

    await migrate_diaper_event_v2(engine_with_legacy_diaper_table)

    async with engine_with_legacy_diaper_table.begin() as conn:
        cols_after = await conn.run_sync(lambda c: _get_column_names_sync(c, "diaper_events"))
    assert "wet_amount" in cols_after
    assert "dirty_colour" in cols_after


# --- Existing data preserved after migration ---


async def test_existing_diaper_records_unaffected_by_migration(engine_with_legacy_diaper_table):
    """Pre-existing diaper records should keep their data; new columns should be NULL."""
    eng = engine_with_legacy_diaper_table

    async with eng.begin() as conn:
        await conn.execute(text(
            "INSERT INTO babies (id, name, birthdate) VALUES (1, 'Baby', '2024-01-01')"
        ))
        await conn.execute(text(
            "INSERT INTO users (id, name) VALUES (1, 'Parent')"
        ))
        await conn.execute(text(
            "INSERT INTO diaper_events (id, baby_id, user_id, logged_at, type, notes) "
            "VALUES (1, 1, 1, '2024-06-15T08:00:00', 'wet', 'normal')"
        ))

    await migrate_diaper_event_v2(eng)

    async with eng.begin() as conn:
        result = await conn.execute(text("SELECT * FROM diaper_events WHERE id = 1"))
        row = result.mappings().fetchone()

    assert row["type"] == "wet"
    assert row["notes"] == "normal"
    assert row["logged_at"] == "2024-06-15T08:00:00"
    assert row["wet_amount"] is None
    assert row["dirty_colour"] is None


async def test_multiple_existing_records_preserved_after_migration(engine_with_legacy_diaper_table):
    """Multiple pre-existing records should all be preserved after migration."""
    eng = engine_with_legacy_diaper_table

    async with eng.begin() as conn:
        await conn.execute(text(
            "INSERT INTO babies (id, name, birthdate) VALUES (1, 'Baby', '2024-01-01')"
        ))
        await conn.execute(text(
            "INSERT INTO users (id, name) VALUES (1, 'Parent')"
        ))
        for i in range(1, 4):
            await conn.execute(text(
                f"INSERT INTO diaper_events (id, baby_id, user_id, logged_at, type) "
                f"VALUES ({i}, 1, 1, '2024-06-15T0{i}:00:00', 'wet')"
            ))

    await migrate_diaper_event_v2(eng)

    async with eng.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM diaper_events"))
        count = result.scalar()
    assert count == 3


# --- Migration on empty database (no diaper_events table) ---


async def test_migration_does_not_error_when_table_missing(engine):
    """Migration should not raise when the diaper_events table doesn't exist yet."""
    await migrate_diaper_event_v2(engine)


# --- Column defaults verified via ORM after migration ---


async def test_new_columns_have_null_defaults_via_orm(engine_with_tables):
    """When creating a DiaperEvent via ORM without new fields, they should be None."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        diaper = DiaperEvent(
            baby_id=baby.id,
            user_id=user.id,
            logged_at=datetime(2024, 6, 15, 8, 0, 0),
            type="wet",
        )
        session.add(diaper)
        await session.flush()

        assert diaper.wet_amount is None
        assert diaper.dirty_colour is None


async def test_new_columns_store_values_via_orm(engine_with_tables):
    """When creating a DiaperEvent via ORM with new fields, values should persist."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        diaper = DiaperEvent(
            baby_id=baby.id,
            user_id=user.id,
            logged_at=datetime(2024, 6, 15, 8, 0, 0),
            type="dirty",
            wet_amount="heavy",
            dirty_colour="yellow",
        )
        session.add(diaper)
        await session.flush()

        assert diaper.wet_amount == "heavy"
        assert diaper.dirty_colour == "yellow"
