"""Tests for Task 1.2 — BurpEvent model and schemas."""

import pytest
from datetime import date, datetime
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from database import Base
from models import Baby, User, BurpEvent
from schemas import BurpEventCreate, BurpEventUpdate, BurpEventResponse

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
    """Engine with all tables created via create_all."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine


def _get_column_names_sync(conn, table_name):
    result = conn.execute(text(f"PRAGMA table_info({table_name})"))
    return [row[1] for row in result.fetchall()]


# --- BurpEvent table creation ---


async def test_burp_events_table_exists_after_create_all(engine_with_tables):
    """create_tables / create_all should create the burp_events table."""
    async with engine_with_tables.begin() as conn:
        tables = await conn.run_sync(
            lambda c: inspect(c).get_table_names()
        )
    assert "burp_events" in tables


async def test_burp_events_table_has_expected_columns(engine_with_tables):
    """burp_events table should have all columns defined in the model."""
    async with engine_with_tables.begin() as conn:
        cols = await conn.run_sync(lambda c: _get_column_names_sync(c, "burp_events"))
    expected = ["id", "baby_id", "user_id", "started_at", "ended_at", "notes", "created_at"]
    for col in expected:
        assert col in cols, f"Column '{col}' missing from burp_events"


# --- BurpEvent ORM operations ---


async def test_create_burp_event_via_orm(engine_with_tables):
    """Should be able to create a BurpEvent via SQLAlchemy ORM."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        burp = BurpEvent(
            baby_id=baby.id,
            user_id=user.id,
            started_at=datetime(2024, 6, 15, 10, 0, 0),
        )
        session.add(burp)
        await session.flush()

        assert burp.id is not None
        assert burp.baby_id == baby.id
        assert burp.user_id == user.id
        assert burp.started_at == datetime(2024, 6, 15, 10, 0, 0)
        assert burp.ended_at is None
        assert burp.notes is None


async def test_create_burp_event_with_all_fields(engine_with_tables):
    """Should be able to create a BurpEvent with all optional fields set."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        burp = BurpEvent(
            baby_id=baby.id,
            user_id=user.id,
            started_at=datetime(2024, 6, 15, 10, 0, 0),
            ended_at=datetime(2024, 6, 15, 10, 5, 0),
            notes="good burp",
        )
        session.add(burp)
        await session.flush()

        assert burp.ended_at == datetime(2024, 6, 15, 10, 5, 0)
        assert burp.notes == "good burp"


async def test_burp_event_user_id_is_nullable(engine_with_tables):
    """BurpEvent should allow user_id to be None."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        session.add(baby)
        await session.flush()

        burp = BurpEvent(
            baby_id=baby.id,
            user_id=None,
            started_at=datetime(2024, 6, 15, 10, 0, 0),
        )
        session.add(burp)
        await session.flush()

        assert burp.user_id is None


async def test_burp_event_ended_at_nullable_for_active_timer(engine_with_tables):
    """BurpEvent with ended_at=None represents an active timer."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        burp = BurpEvent(
            baby_id=baby.id,
            user_id=user.id,
            started_at=datetime(2024, 6, 15, 10, 0, 0),
            ended_at=None,
        )
        session.add(burp)
        await session.flush()

        assert burp.ended_at is None


async def test_multiple_burp_events_for_same_baby(engine_with_tables):
    """Should be able to create multiple BurpEvents for the same baby."""
    session_factory = async_sessionmaker(engine_with_tables, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 1))
        user = User(name="TestUser")
        session.add_all([baby, user])
        await session.flush()

        for hour in range(3):
            burp = BurpEvent(
                baby_id=baby.id,
                user_id=user.id,
                started_at=datetime(2024, 6, 15, 10 + hour, 0, 0),
                ended_at=datetime(2024, 6, 15, 10 + hour, 5, 0),
            )
            session.add(burp)

        await session.flush()

        result = await session.execute(
            text("SELECT COUNT(*) FROM burp_events WHERE baby_id = :baby_id"),
            {"baby_id": baby.id},
        )
        assert result.scalar() == 3


# --- BurpEvent schema validation ---


class TestBurpEventCreateSchema:
    """Tests for BurpEventCreate Pydantic schema."""

    def test_create_schema_with_minimal_fields(self):
        schema = BurpEventCreate()
        assert schema.user_id is None
        assert schema.started_at is not None  # default_factory
        assert schema.ended_at is None
        assert schema.notes is None

    def test_create_schema_with_all_fields(self):
        schema = BurpEventCreate(
            user_id=1,
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=datetime(2024, 6, 15, 10, 5),
            notes="burped well",
        )
        assert schema.user_id == 1
        assert schema.started_at == datetime(2024, 6, 15, 10, 0)
        assert schema.ended_at == datetime(2024, 6, 15, 10, 5)
        assert schema.notes == "burped well"

    def test_create_schema_user_id_optional(self):
        schema = BurpEventCreate(
            started_at=datetime(2024, 6, 15, 10, 0),
        )
        assert schema.user_id is None


class TestBurpEventUpdateSchema:
    """Tests for BurpEventUpdate Pydantic schema."""

    def test_update_schema_all_fields_default_to_none(self):
        schema = BurpEventUpdate()
        assert schema.started_at is None
        assert schema.ended_at is None
        assert schema.notes is None

    def test_update_schema_accepts_partial_fields(self):
        schema = BurpEventUpdate(ended_at=datetime(2024, 6, 15, 10, 5))
        assert schema.ended_at == datetime(2024, 6, 15, 10, 5)
        assert schema.started_at is None
        assert schema.notes is None

    def test_update_schema_accepts_all_fields(self):
        schema = BurpEventUpdate(
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=datetime(2024, 6, 15, 10, 5),
            notes="updated note",
        )
        assert schema.started_at == datetime(2024, 6, 15, 10, 0)
        assert schema.ended_at == datetime(2024, 6, 15, 10, 5)
        assert schema.notes == "updated note"


class TestBurpEventResponseSchema:
    """Tests for BurpEventResponse Pydantic schema."""

    def test_response_schema_with_all_fields(self):
        schema = BurpEventResponse(
            id=1, baby_id=1, user_id=1,
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=datetime(2024, 6, 15, 10, 5),
            notes="test", created_at=datetime(2024, 6, 15, 10, 0),
        )
        assert schema.id == 1
        assert schema.baby_id == 1
        assert schema.ended_at == datetime(2024, 6, 15, 10, 5)

    def test_response_schema_with_nullable_fields(self):
        schema = BurpEventResponse(
            id=1, baby_id=1, user_id=None,
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=None, notes=None, created_at=None,
        )
        assert schema.user_id is None
        assert schema.ended_at is None
        assert schema.notes is None
        assert schema.created_at is None

    def test_response_schema_has_from_attributes_config(self):
        assert BurpEventResponse.model_config.get("from_attributes") is True
