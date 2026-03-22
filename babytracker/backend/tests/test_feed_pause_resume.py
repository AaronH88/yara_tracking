"""Tests for Task 2.1 — Feed Pause/Resume Endpoints."""

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


@pytest.fixture
async def active_feed(client, seed_baby_and_user):
    """Create an active (un-ended) feed, return (baby_id, user_id, feed_id)."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    assert resp.status_code == 201
    return baby_id, user_id, resp.json()["id"]


# =============================================================
# POST /api/v1/babies/{baby_id}/feeds/{feed_id}/pause
# =============================================================


@pytest.mark.anyio
async def test_pause_active_feed_sets_is_paused(client, active_feed):
    """Pausing an active feed should set is_paused=true and paused_at to a timestamp."""
    baby_id, _, feed_id = active_feed
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_paused"] is True
    assert data["paused_at"] is not None
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_pause_returns_404_for_nonexistent_feed(client, seed_baby_and_user):
    """Pause should return 404 when feed_id does not exist."""
    baby_id, _ = seed_baby_and_user
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/9999/pause")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_pause_returns_404_for_wrong_baby(client, active_feed):
    """Pause should return 404 when feed belongs to a different baby."""
    _, _, feed_id = active_feed
    # Create a second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.post(f"/api/v1/babies/{baby2_id}/feeds/{feed_id}/pause")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_pause_returns_409_when_already_paused(client, active_feed):
    """Pausing a feed that is already paused should return 409 with correct message."""
    baby_id, _, feed_id = active_feed
    # Pause once
    resp1 = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert resp1.status_code == 200

    # Pause again
    resp2 = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert resp2.status_code == 409
    assert resp2.json()["detail"] == "Feed is already paused"


@pytest.mark.anyio
async def test_pause_returns_409_when_feed_ended(client, active_feed):
    """Pausing a feed that has already ended should return 409 with correct message."""
    baby_id, _, feed_id = active_feed
    # End the feed
    await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"ended_at": "2024-06-15T11:00:00"},
    )
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Feed is already ended"


@pytest.mark.anyio
async def test_pause_does_not_reset_existing_paused_seconds(client, active_feed):
    """Pausing should not overwrite an existing paused_seconds value."""
    baby_id, _, feed_id = active_feed
    # Set paused_seconds via PATCH to simulate a previous pause/resume cycle
    await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"paused_seconds": 120},
    )
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert resp.status_code == 200
    # paused_seconds should still be 120 (pause only sets is_paused and paused_at)
    assert resp.json()["paused_seconds"] == 120


# =============================================================
# POST /api/v1/babies/{baby_id}/feeds/{feed_id}/resume
# =============================================================


@pytest.mark.anyio
async def test_resume_paused_feed_clears_pause_state(client, active_feed):
    """Resuming a paused feed should set is_paused=false and paused_at=null."""
    baby_id, _, feed_id = active_feed
    # Pause first
    await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    # Resume
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_paused"] is False
    assert data["paused_at"] is None
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_resume_accumulates_paused_seconds(client, active_feed):
    """Resuming should add the pause duration to paused_seconds."""
    baby_id, _, feed_id = active_feed
    # Pause
    await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    # Resume — duration will be very small but paused_seconds should be >= 0
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["paused_seconds"], int)
    assert data["paused_seconds"] >= 0


@pytest.mark.anyio
async def test_resume_returns_404_for_nonexistent_feed(client, seed_baby_and_user):
    """Resume should return 404 when feed_id does not exist."""
    baby_id, _ = seed_baby_and_user
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/9999/resume")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_resume_returns_404_for_wrong_baby(client, active_feed):
    """Resume should return 404 when feed belongs to a different baby."""
    _, _, feed_id = active_feed
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.post(f"/api/v1/babies/{baby2_id}/feeds/{feed_id}/resume")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_resume_returns_409_when_not_paused(client, active_feed):
    """Resuming a feed that is not paused should return 409 with correct message."""
    baby_id, _, feed_id = active_feed
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Feed is not paused"


@pytest.mark.anyio
async def test_resume_returns_409_when_feed_ended(client, active_feed):
    """Resuming a feed that has already ended should return 409 with correct message."""
    baby_id, _, feed_id = active_feed
    # End the feed
    await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"ended_at": "2024-06-15T11:00:00"},
    )
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Feed is already ended"


# =============================================================
# Workflow / integration tests
# =============================================================


@pytest.mark.anyio
async def test_full_pause_resume_workflow(client, active_feed):
    """Full lifecycle: start feed -> pause -> resume -> verify state."""
    baby_id, _, feed_id = active_feed

    # Pause
    pause_resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert pause_resp.status_code == 200
    assert pause_resp.json()["is_paused"] is True

    # Resume
    resume_resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    assert resume_resp.status_code == 200
    data = resume_resp.json()
    assert data["is_paused"] is False
    assert data["paused_at"] is None
    assert data["paused_seconds"] >= 0
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_multiple_pause_resume_cycles_accumulate(client, active_feed):
    """Multiple pause/resume cycles should accumulate paused_seconds."""
    baby_id, _, feed_id = active_feed

    # First pause/resume
    await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    resp1 = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    first_paused = resp1.json()["paused_seconds"]

    # Second pause/resume
    await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    resp2 = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    second_paused = resp2.json()["paused_seconds"]

    # Accumulated value should be >= first value
    assert second_paused >= first_paused


@pytest.mark.anyio
async def test_pause_then_end_feed_is_rejected(client, active_feed):
    """After pausing, attempting to end the feed should still work via PATCH
    (the pause/resume endpoints themselves don't block ending).
    But trying to pause an already-ended feed should be rejected."""
    baby_id, _, feed_id = active_feed

    # Pause
    await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")

    # End the feed via PATCH (this should work — PATCH doesn't check pause state)
    end_resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"ended_at": "2024-06-15T11:00:00"},
    )
    assert end_resp.status_code == 200

    # Now trying to pause again should fail with "already ended"
    pause_resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    assert pause_resp.status_code == 409
    assert pause_resp.json()["detail"] == "Feed is already ended"

    # And trying to resume should also fail with "already ended"
    resume_resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    assert resume_resp.status_code == 409
    assert resume_resp.json()["detail"] == "Feed is already ended"


@pytest.mark.anyio
async def test_pause_response_shape(client, active_feed):
    """Pause response should contain all expected FeedEventResponse fields."""
    baby_id, _, feed_id = active_feed
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    data = resp.json()
    expected_fields = {
        "id", "baby_id", "user_id", "type", "started_at",
        "ended_at", "amount_oz", "amount_ml",
        "paused_seconds", "is_paused", "paused_at", "quality",
        "notes", "created_at",
    }
    assert expected_fields == set(data.keys())


@pytest.mark.anyio
async def test_resume_response_shape(client, active_feed):
    """Resume response should contain all expected FeedEventResponse fields."""
    baby_id, _, feed_id = active_feed
    await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/pause")
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds/{feed_id}/resume")
    data = resp.json()
    expected_fields = {
        "id", "baby_id", "user_id", "type", "started_at",
        "ended_at", "amount_oz", "amount_ml",
        "paused_seconds", "is_paused", "paused_at", "quality",
        "notes", "created_at",
    }
    assert expected_fields == set(data.keys())
