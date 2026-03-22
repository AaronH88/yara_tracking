"""Tests for Task 1.1 — FeedEvent v2 fields via API (paused_seconds, is_paused, paused_at, quality)."""

import pytest
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app
from schemas import FeedEventCreate, FeedEventUpdate, FeedEventResponse


# --- Test DB setup (same pattern as test_routers_feeds.py) ---

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


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


# --- POST: new fields are accepted and stored ---


@pytest.mark.anyio
async def test_create_feed_with_paused_seconds(client, seed_baby_and_user):
    """POST /feeds should accept paused_seconds and return it in the response."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
            "paused_seconds": 120,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["paused_seconds"] == 120


@pytest.mark.anyio
async def test_create_feed_with_quality(client, seed_baby_and_user):
    """POST /feeds should accept quality and return it in the response."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "breast_left",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:20:00",
            "quality": "good",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["quality"] == "good"


@pytest.mark.anyio
async def test_create_feed_with_is_paused_and_paused_at(client, seed_baby_and_user):
    """POST /feeds should accept is_paused and paused_at."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "is_paused": True,
            "paused_at": "2024-06-15T10:05:00",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_paused"] is True
    assert "2024-06-15" in data["paused_at"]


@pytest.mark.anyio
async def test_create_feed_with_all_v2_fields(client, seed_baby_and_user):
    """POST /feeds should accept all four v2 fields simultaneously."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:20:00",
            "paused_seconds": 60,
            "is_paused": False,
            "paused_at": "2024-06-15T10:05:00",
            "quality": "excellent",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["paused_seconds"] == 60
    assert data["is_paused"] is False
    assert data["quality"] == "excellent"
    assert data["paused_at"] is not None


# --- POST: new fields default correctly when omitted ---


@pytest.mark.anyio
async def test_create_feed_without_v2_fields_defaults(client, seed_baby_and_user):
    """POST /feeds without v2 fields should default them to null/0/false in response."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    # paused_seconds should default to 0 (server_default), is_paused to False
    assert data["paused_seconds"] in (0, None)
    assert data["is_paused"] in (False, None)
    assert data["paused_at"] is None
    assert data["quality"] is None


# --- PATCH: new fields can be updated ---


@pytest.mark.anyio
async def test_update_feed_paused_seconds(client, seed_baby_and_user):
    """PATCH /feeds/{id} should allow updating paused_seconds."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
        },
    )
    feed_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"paused_seconds": 300},
    )
    assert resp.status_code == 200
    assert resp.json()["paused_seconds"] == 300


@pytest.mark.anyio
async def test_update_feed_quality(client, seed_baby_and_user):
    """PATCH /feeds/{id} should allow updating quality."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "breast_left",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:20:00",
        },
    )
    feed_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"quality": "poor"},
    )
    assert resp.status_code == 200
    assert resp.json()["quality"] == "poor"


@pytest.mark.anyio
async def test_update_feed_is_paused_and_paused_at(client, seed_baby_and_user):
    """PATCH /feeds/{id} should allow updating is_paused and paused_at together."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    feed_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"is_paused": True, "paused_at": "2024-06-15T10:05:00"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_paused"] is True
    assert "2024-06-15" in data["paused_at"]


@pytest.mark.anyio
async def test_update_v2_fields_does_not_clobber_existing_fields(client, seed_baby_and_user):
    """PATCH with v2 fields should not affect pre-existing fields like amount_oz."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
            "amount_oz": 4.0,
            "notes": "test note",
        },
    )
    feed_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"quality": "good", "paused_seconds": 30},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["quality"] == "good"
    assert data["paused_seconds"] == 30
    # Original fields should be preserved
    assert data["amount_oz"] == 4.0
    assert data["notes"] == "test note"
    assert data["type"] == "bottle"


# --- GET: v2 fields are returned in list and detail ---


@pytest.mark.anyio
async def test_list_feeds_includes_v2_fields(client, seed_baby_and_user):
    """GET /feeds should include v2 fields in the list response."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
            "quality": "great",
            "paused_seconds": 45,
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["quality"] == "great"
    assert data[0]["paused_seconds"] == 45
    assert "is_paused" in data[0]
    assert "paused_at" in data[0]


@pytest.mark.anyio
async def test_active_feed_includes_v2_fields(client, seed_baby_and_user):
    """GET /feeds/active should include v2 fields."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "breast_right",
            "is_paused": True,
            "paused_at": "2024-06-15T10:05:00",
            "paused_seconds": 0,
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert resp.status_code == 200
    data = resp.json()
    assert data is not None
    assert data["is_paused"] is True
    assert "paused_at" in data
    assert "quality" in data
    assert "paused_seconds" in data


# --- Schema validation tests ---


class TestFeedEventCreateSchema:
    """Tests for FeedEventCreate Pydantic schema with v2 fields."""

    def test_create_schema_accepts_v2_fields(self):
        schema = FeedEventCreate(
            user_id=1,
            type="bottle",
            started_at=datetime(2024, 6, 15, 10, 0),
            paused_seconds=120,
            is_paused=True,
            paused_at=datetime(2024, 6, 15, 10, 5),
            quality="good",
        )
        assert schema.paused_seconds == 120
        assert schema.is_paused is True
        assert schema.paused_at == datetime(2024, 6, 15, 10, 5)
        assert schema.quality == "good"

    def test_create_schema_v2_fields_default_to_none(self):
        schema = FeedEventCreate(user_id=1, type="bottle")
        assert schema.paused_seconds is None
        assert schema.is_paused is None
        assert schema.paused_at is None
        assert schema.quality is None

    def test_create_schema_paused_seconds_accepts_zero(self):
        schema = FeedEventCreate(user_id=1, type="bottle", paused_seconds=0)
        assert schema.paused_seconds == 0


class TestFeedEventUpdateSchema:
    """Tests for FeedEventUpdate Pydantic schema with v2 fields."""

    def test_update_schema_accepts_v2_fields(self):
        schema = FeedEventUpdate(
            paused_seconds=60,
            is_paused=False,
            paused_at=datetime(2024, 6, 15, 10, 5),
            quality="poor",
        )
        assert schema.paused_seconds == 60
        assert schema.is_paused is False
        assert schema.quality == "poor"

    def test_update_schema_v2_fields_default_to_none(self):
        schema = FeedEventUpdate()
        assert schema.paused_seconds is None
        assert schema.is_paused is None
        assert schema.paused_at is None
        assert schema.quality is None


class TestFeedEventResponseSchema:
    """Tests for FeedEventResponse Pydantic schema with v2 fields."""

    def test_response_schema_includes_v2_fields(self):
        schema = FeedEventResponse(
            id=1, baby_id=1, user_id=1, type="bottle",
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=None, amount_oz=None, amount_ml=None,
            paused_seconds=0, is_paused=False, paused_at=None, quality=None,
            notes=None, created_at=None,
        )
        assert schema.paused_seconds == 0
        assert schema.is_paused is False
        assert schema.paused_at is None
        assert schema.quality is None

    def test_response_schema_with_populated_v2_fields(self):
        schema = FeedEventResponse(
            id=1, baby_id=1, user_id=1, type="breast_left",
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=datetime(2024, 6, 15, 10, 20),
            amount_oz=None, amount_ml=None,
            paused_seconds=180, is_paused=False,
            paused_at=datetime(2024, 6, 15, 10, 10),
            quality="excellent",
            notes=None, created_at=None,
        )
        assert schema.paused_seconds == 180
        assert schema.is_paused is False
        assert schema.paused_at == datetime(2024, 6, 15, 10, 10)
        assert schema.quality == "excellent"

    def test_response_schema_v2_fields_are_nullable(self):
        """All v2 fields should accept None."""
        schema = FeedEventResponse(
            id=1, baby_id=1, user_id=1, type="bottle",
            started_at=datetime(2024, 6, 15, 10, 0),
            ended_at=None, amount_oz=None, amount_ml=None,
            paused_seconds=None, is_paused=None, paused_at=None, quality=None,
            notes=None, created_at=None,
        )
        assert schema.paused_seconds is None
        assert schema.is_paused is None
        assert schema.paused_at is None
        assert schema.quality is None
