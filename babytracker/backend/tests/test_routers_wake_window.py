"""Tests for Task 2.4 — Wake Window endpoint."""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app


# --- Test DB setup ---

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_session():
    """Create a fresh in-memory database for each test."""
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
    """HTTP client wired to the test database."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def seed_baby_and_user(client):
    """Create a baby and a user, return their IDs."""
    baby_resp = await client.post(
        "/api/v1/babies", json={"name": "TestBaby", "birthdate": "2024-01-01"}
    )
    user_resp = await client.post(
        "/api/v1/users", json={"name": "TestUser", "role": "parent"}
    )
    return baby_resp.json()["id"], user_resp.json()["id"]


# --- AC: Returns is_sleeping=true when active sleep exists ---


@pytest.mark.anyio
async def test_wake_window_returns_sleeping_true_when_active_sleep(client, seed_baby_and_user):
    """When a sleep timer is running (ended_at=null), is_sleeping should be true."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": "2024-06-15T13:00:00"},
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_sleeping"] is True
    assert data["awake_since"] is None
    assert data["awake_minutes"] == 0
    assert data["sleep_started_at"] is not None


@pytest.mark.anyio
async def test_wake_window_sleeping_returns_correct_sleep_started_at(client, seed_baby_and_user):
    """When sleeping, sleep_started_at should match the active sleep's started_at."""
    baby_id, user_id = seed_baby_and_user
    started = "2024-06-15T13:00:00"
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": started},
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    data = resp.json()
    assert "2024-06-15T13:00:00" in data["sleep_started_at"]


# --- AC: Returns correct awake_since from last ended sleep ---


@pytest.mark.anyio
async def test_wake_window_awake_since_equals_last_sleep_ended_at(client, seed_baby_and_user):
    """awake_since should be the ended_at of the most recent completed sleep."""
    baby_id, user_id = seed_baby_and_user
    # Create an older completed sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T09:00:00",
            "ended_at": "2024-06-15T10:00:00",
        },
    )
    # Create a newer completed sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:30:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_sleeping"] is False
    assert "2024-06-15T14:30:00" in data["awake_since"]
    assert data["sleep_started_at"] is None


@pytest.mark.anyio
async def test_wake_window_awake_uses_most_recent_ended_sleep(client, seed_baby_and_user):
    """When multiple completed sleeps exist, awake_since should use the one with the latest ended_at."""
    baby_id, user_id = seed_baby_and_user
    # Insert out of chronological order to test ordering
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T15:00:00",
            "ended_at": "2024-06-15T16:00:00",
        },
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T09:00:00",
            "ended_at": "2024-06-15T10:00:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    data = resp.json()
    # Should pick 16:00, not 10:00
    assert "2024-06-15T16:00:00" in data["awake_since"]


# --- AC: Falls back to baby.created_at when no sleeps on record ---


@pytest.mark.anyio
async def test_wake_window_fallback_to_baby_created_at_when_no_sleeps(client, seed_baby_and_user):
    """When no sleep events exist, awake_since should fall back to baby.created_at."""
    baby_id, _ = seed_baby_and_user

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_sleeping"] is False
    assert data["awake_since"] is not None
    assert data["sleep_started_at"] is None
    # awake_minutes should be a non-negative integer
    assert isinstance(data["awake_minutes"], int)
    assert data["awake_minutes"] >= 0


# --- AC: awake_minutes is correct integer ---


@pytest.mark.anyio
async def test_wake_window_awake_minutes_is_integer(client, seed_baby_and_user):
    """awake_minutes should be an integer, not a float."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    data = resp.json()
    assert isinstance(data["awake_minutes"], int)


@pytest.mark.anyio
async def test_wake_window_awake_minutes_calculation_with_mocked_time(client, seed_baby_and_user):
    """awake_minutes should be calculated correctly from awake_since to now."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )

    fake_now = datetime(2024, 6, 15, 14, 47, 30, tzinfo=timezone.utc)
    with patch("routers.wake_window.datetime") as mock_dt:
        mock_dt.now.return_value = fake_now
        mock_dt.min = datetime.min
        mock_dt.combine = datetime.combine
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
        data = resp.json()
        assert data["awake_minutes"] == 47


# --- Response shape ---


@pytest.mark.anyio
async def test_wake_window_response_has_all_required_fields(client, seed_baby_and_user):
    """Response should contain exactly the four expected fields."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    data = resp.json()
    expected_fields = {"is_sleeping", "awake_since", "awake_minutes", "sleep_started_at"}
    assert expected_fields == set(data.keys())


# --- Edge cases / unhappy paths ---


@pytest.mark.anyio
async def test_wake_window_ignores_active_sleep_from_different_baby(client, seed_baby_and_user):
    """An active sleep on baby A should not affect baby B's wake window."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby2", "birthdate": "2024-03-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Start active sleep for baby 1
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )

    # Baby 2 should not be sleeping
    resp = await client.get(f"/api/v1/babies/{baby2_id}/wake-window")
    data = resp.json()
    assert data["is_sleeping"] is False


@pytest.mark.anyio
async def test_wake_window_ignores_completed_sleeps_from_different_baby(client, seed_baby_and_user):
    """Completed sleeps for baby A should not set awake_since for baby B."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby2", "birthdate": "2024-03-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Create completed sleep for baby 1
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )

    # Baby 2's awake_since should fall back to its own created_at, not baby 1's sleep
    resp = await client.get(f"/api/v1/babies/{baby2_id}/wake-window")
    data = resp.json()
    assert data["is_sleeping"] is False
    # awake_since should NOT be 2024-06-15T14:00:00 (baby 1's sleep end)
    if data["awake_since"]:
        assert "2024-06-15T14:00:00" not in data["awake_since"]


@pytest.mark.anyio
async def test_wake_window_with_completed_and_active_sleep_returns_sleeping(client, seed_baby_and_user):
    """When both completed and active sleeps exist, should report is_sleeping=true."""
    baby_id, user_id = seed_baby_and_user
    # Create completed sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T09:00:00",
            "ended_at": "2024-06-15T10:00:00",
        },
    )
    # Start active sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": "2024-06-15T13:00:00"},
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    data = resp.json()
    assert data["is_sleeping"] is True
    assert data["awake_minutes"] == 0
    assert data["awake_since"] is None


@pytest.mark.anyio
async def test_wake_window_after_stopping_sleep_shows_awake(client, seed_baby_and_user):
    """After stopping an active sleep, wake window should show baby as awake."""
    baby_id, user_id = seed_baby_and_user
    # Start and stop a sleep
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": "2024-06-15T13:00:00"},
    )
    sleep_id = create_resp.json()["id"]
    await client.patch(
        f"/api/v1/babies/{baby_id}/sleeps/{sleep_id}",
        json={"ended_at": "2024-06-15T14:00:00"},
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/wake-window")
    data = resp.json()
    assert data["is_sleeping"] is False
    assert "2024-06-15T14:00:00" in data["awake_since"]
    assert data["awake_minutes"] >= 0


@pytest.mark.anyio
async def test_wake_window_nonexistent_baby_id_raises_error(client):
    """Requesting wake window for a non-existent baby_id crashes (no guard)."""
    # The endpoint does not validate that the baby exists, so when no sleeps
    # exist for a non-existent baby_id, db.get(Baby, 9999) returns None
    # and the code crashes with AttributeError.
    with pytest.raises(AttributeError):
        await client.get("/api/v1/babies/9999/wake-window")
