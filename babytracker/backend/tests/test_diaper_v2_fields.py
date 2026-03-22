"""Tests for Task 1.2 — DiaperEvent v2 fields via API (wet_amount, dirty_colour)."""

import pytest
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app
from schemas import DiaperEventCreate, DiaperEventUpdate, DiaperEventResponse

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

pytestmark = pytest.mark.anyio


@pytest.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def seed_baby_and_user(client):
    baby_resp = await client.post(
        "/api/v1/babies", json={"name": "TestBaby", "birthdate": "2024-01-01"}
    )
    user_resp = await client.post(
        "/api/v1/users", json={"name": "TestUser", "role": "parent"}
    )
    return baby_resp.json()["id"], user_resp.json()["id"]


def _diaper_payload(user_id, **overrides):
    base = {
        "user_id": user_id,
        "logged_at": "2024-06-15T08:00:00",
        "type": "wet",
    }
    base.update(overrides)
    return base


# --- POST: new fields are accepted and stored ---


async def test_create_diaper_with_wet_amount(client, seed_baby_and_user):
    """POST /diapers should accept wet_amount and return it."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, wet_amount="heavy"),
    )
    assert resp.status_code == 201
    assert resp.json()["wet_amount"] == "heavy"


async def test_create_diaper_with_dirty_colour(client, seed_baby_and_user):
    """POST /diapers should accept dirty_colour and return it."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, type="dirty", dirty_colour="yellow"),
    )
    assert resp.status_code == 201
    assert resp.json()["dirty_colour"] == "yellow"


async def test_create_diaper_with_both_v2_fields(client, seed_baby_and_user):
    """POST /diapers should accept both wet_amount and dirty_colour simultaneously."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, type="both", wet_amount="light", dirty_colour="green"),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["wet_amount"] == "light"
    assert data["dirty_colour"] == "green"


# --- POST: new fields default correctly when omitted ---


async def test_create_diaper_without_v2_fields_defaults_to_null(client, seed_baby_and_user):
    """POST /diapers without v2 fields should default them to null."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["wet_amount"] is None
    assert data["dirty_colour"] is None


# --- PATCH: new fields can be updated ---


async def test_update_diaper_wet_amount(client, seed_baby_and_user):
    """PATCH /diapers/{id} should allow updating wet_amount."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id),
    )
    diaper_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/{diaper_id}",
        json={"wet_amount": "medium"},
    )
    assert resp.status_code == 200
    assert resp.json()["wet_amount"] == "medium"


async def test_update_diaper_dirty_colour(client, seed_baby_and_user):
    """PATCH /diapers/{id} should allow updating dirty_colour."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id),
    )
    diaper_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/{diaper_id}",
        json={"dirty_colour": "brown"},
    )
    assert resp.status_code == 200
    assert resp.json()["dirty_colour"] == "brown"


async def test_update_v2_fields_does_not_clobber_existing_fields(client, seed_baby_and_user):
    """PATCH with v2 fields should not affect pre-existing fields like type or notes."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, type="dirty", notes="original note"),
    )
    diaper_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/{diaper_id}",
        json={"wet_amount": "heavy", "dirty_colour": "green"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["wet_amount"] == "heavy"
    assert data["dirty_colour"] == "green"
    assert data["type"] == "dirty"
    assert data["notes"] == "original note"


async def test_update_v2_fields_can_be_cleared_to_null(client, seed_baby_and_user):
    """PATCH should allow clearing v2 fields back to null."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, wet_amount="heavy", dirty_colour="yellow"),
    )
    diaper_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/{diaper_id}",
        json={"wet_amount": None, "dirty_colour": None},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["wet_amount"] is None
    assert data["dirty_colour"] is None


# --- GET: v2 fields are returned in list ---


async def test_list_diapers_includes_v2_fields(client, seed_baby_and_user):
    """GET /diapers should include wet_amount and dirty_colour in list response."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, wet_amount="light", dirty_colour="brown"),
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/diapers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["wet_amount"] == "light"
    assert data[0]["dirty_colour"] == "brown"


# --- Schema validation tests ---


class TestDiaperEventCreateSchema:
    """Tests for DiaperEventCreate Pydantic schema with v2 fields."""

    def test_create_schema_accepts_v2_fields(self):
        schema = DiaperEventCreate(
            user_id=1,
            logged_at=datetime(2024, 6, 15, 8, 0),
            type="wet",
            wet_amount="heavy",
            dirty_colour="yellow",
        )
        assert schema.wet_amount == "heavy"
        assert schema.dirty_colour == "yellow"

    def test_create_schema_v2_fields_default_to_none(self):
        schema = DiaperEventCreate(
            user_id=1,
            logged_at=datetime(2024, 6, 15, 8, 0),
            type="wet",
        )
        assert schema.wet_amount is None
        assert schema.dirty_colour is None


class TestDiaperEventUpdateSchema:
    """Tests for DiaperEventUpdate Pydantic schema with v2 fields."""

    def test_update_schema_accepts_v2_fields(self):
        schema = DiaperEventUpdate(
            wet_amount="medium",
            dirty_colour="green",
        )
        assert schema.wet_amount == "medium"
        assert schema.dirty_colour == "green"

    def test_update_schema_v2_fields_default_to_none(self):
        schema = DiaperEventUpdate()
        assert schema.wet_amount is None
        assert schema.dirty_colour is None

    def test_update_schema_allows_partial_v2_update(self):
        schema = DiaperEventUpdate(wet_amount="light")
        assert schema.wet_amount == "light"
        assert schema.dirty_colour is None


class TestDiaperEventResponseSchema:
    """Tests for DiaperEventResponse Pydantic schema with v2 fields."""

    def test_response_schema_includes_v2_fields(self):
        schema = DiaperEventResponse(
            id=1, baby_id=1, user_id=1,
            logged_at=datetime(2024, 6, 15, 8, 0),
            type="wet",
            wet_amount=None, dirty_colour=None,
            notes=None, created_at=None,
        )
        assert schema.wet_amount is None
        assert schema.dirty_colour is None

    def test_response_schema_with_populated_v2_fields(self):
        schema = DiaperEventResponse(
            id=1, baby_id=1, user_id=1,
            logged_at=datetime(2024, 6, 15, 8, 0),
            type="both",
            wet_amount="heavy", dirty_colour="yellow",
            notes="test", created_at=datetime(2024, 6, 15, 8, 0),
        )
        assert schema.wet_amount == "heavy"
        assert schema.dirty_colour == "yellow"
