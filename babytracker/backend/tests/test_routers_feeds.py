"""Tests for Task 1.6 — Feed Events router endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app
from models import Baby, User


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


# --- POST /api/v1/babies/{baby_id}/feeds ---


@pytest.mark.anyio
async def test_create_feed_returns_201(client, seed_baby_and_user):
    """POST /feeds should create a feed and return 201."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "type": "bottle",
        "started_at": "2024-06-15T10:00:00",
        "ended_at": "2024-06-15T10:15:00",
        "amount_oz": 4.0,
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["baby_id"] == baby_id
    assert data["user_id"] == user_id
    assert data["type"] == "bottle"
    assert data["amount_oz"] == 4.0
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_feed_as_active_timer(client, seed_baby_and_user):
    """POST /feeds with no ended_at should create an active timer."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "type": "breast_left",
        "started_at": "2024-06-15T10:00:00",
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_create_feed_409_when_active_feed_exists(client, seed_baby_and_user):
    """POST /feeds with no ended_at should return 409 if an active feed already exists."""
    baby_id, user_id = seed_baby_and_user
    # Start first active feed
    payload = {"user_id": user_id, "type": "bottle"}
    await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload)

    # Attempt second active feed
    resp = await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload)
    assert resp.status_code == 409
    assert "already in progress" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_create_completed_feed_allows_multiple(client, seed_baby_and_user):
    """POST /feeds with both started_at and ended_at should allow multiple completed feeds."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "type": "bottle",
        "started_at": "2024-06-15T08:00:00",
        "ended_at": "2024-06-15T08:15:00",
    }
    resp1 = await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload)
    assert resp1.status_code == 201

    payload2 = {
        "user_id": user_id,
        "type": "bottle",
        "started_at": "2024-06-15T10:00:00",
        "ended_at": "2024-06-15T10:20:00",
    }
    resp2 = await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload2)
    assert resp2.status_code == 201


@pytest.mark.anyio
async def test_create_completed_feed_while_active_exists(client, seed_baby_and_user):
    """POST /feeds with ended_at set should succeed even when an active feed exists."""
    baby_id, user_id = seed_baby_and_user
    # Start active feed
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    # Create retroactive completed feed
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T06:00:00",
            "ended_at": "2024-06-15T06:20:00",
        },
    )
    assert resp.status_code == 201


@pytest.mark.anyio
async def test_create_feed_missing_type_returns_422(client, seed_baby_and_user):
    """POST /feeds without required 'type' field should return 422."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds", json={"user_id": user_id}
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_feed_missing_user_id_returns_422(client, seed_baby_and_user):
    """POST /feeds without required 'user_id' field should return 422."""
    baby_id, _ = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds", json={"type": "bottle"}
    )
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/feeds ---


@pytest.mark.anyio
async def test_list_feeds_returns_empty_list(client, seed_baby_and_user):
    """GET /feeds should return empty list when no feeds exist."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_feeds_returns_feeds_ordered_by_started_at_desc(client, seed_baby_and_user):
    """GET /feeds should return feeds ordered by started_at descending."""
    baby_id, user_id = seed_baby_and_user
    # Create feeds with different start times
    for hour in [8, 12, 10]:
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={
                "user_id": user_id,
                "type": "bottle",
                "started_at": f"2024-06-15T{hour:02d}:00:00",
                "ended_at": f"2024-06-15T{hour:02d}:15:00",
            },
        )

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # Should be in descending order: 12, 10, 8
    assert data[0]["started_at"] > data[1]["started_at"] > data[2]["started_at"]


@pytest.mark.anyio
async def test_list_feeds_date_filter(client, seed_baby_and_user):
    """GET /feeds?date=YYYY-MM-DD should only return feeds from that day."""
    baby_id, user_id = seed_baby_and_user
    # Create feed on June 15
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
        },
    )
    # Create feed on June 16
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-16T09:00:00",
            "ended_at": "2024-06-16T09:10:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds?date=2024-06-15")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "2024-06-15" in data[0]["started_at"]


@pytest.mark.anyio
async def test_list_feeds_limit_parameter(client, seed_baby_and_user):
    """GET /feeds?limit=N should return at most N feeds."""
    baby_id, user_id = seed_baby_and_user
    for i in range(5):
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={
                "user_id": user_id,
                "type": "bottle",
                "started_at": f"2024-06-15T{10+i}:00:00",
                "ended_at": f"2024-06-15T{10+i}:15:00",
            },
        )

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds?limit=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_feeds_limit_max_200(client, seed_baby_and_user):
    """GET /feeds?limit=300 should reject values above 200."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds?limit=300")
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_feeds_limit_min_1(client, seed_baby_and_user):
    """GET /feeds?limit=0 should reject values below 1."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds?limit=0")
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/feeds/active ---


@pytest.mark.anyio
async def test_get_active_feed_returns_null_when_none(client, seed_baby_and_user):
    """GET /feeds/active should return null when no active feed exists."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.anyio
async def test_get_active_feed_returns_active_feed(client, seed_baby_and_user):
    """GET /feeds/active should return the feed with ended_at=null."""
    baby_id, user_id = seed_baby_and_user
    # Create active feed
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_right"},
    )
    feed_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == feed_id
    assert data["ended_at"] is None
    assert data["type"] == "breast_right"


@pytest.mark.anyio
async def test_get_active_feed_ignores_completed_feeds(client, seed_baby_and_user):
    """GET /feeds/active should not return completed feeds."""
    baby_id, user_id = seed_baby_and_user
    # Create completed feed
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert resp.status_code == 200
    assert resp.json() is None


# --- PATCH /api/v1/babies/{baby_id}/feeds/{feed_id} ---


@pytest.mark.anyio
async def test_update_feed_stop_active_timer(client, seed_baby_and_user):
    """PATCH /feeds/{id} with ended_at should stop an active timer."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    feed_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"ended_at": "2024-06-15T10:30:00"},
    )
    assert resp.status_code == 200
    assert resp.json()["ended_at"] is not None


@pytest.mark.anyio
async def test_update_feed_partial_update_preserves_fields(client, seed_baby_and_user):
    """PATCH /feeds/{id} should only update the fields provided."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
            "amount_oz": 3.0,
            "notes": "good feed",
        },
    )
    feed_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"amount_oz": 5.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount_oz"] == 5.0
    assert data["notes"] == "good feed"
    assert data["type"] == "bottle"


@pytest.mark.anyio
async def test_update_feed_returns_404_for_nonexistent(client, seed_baby_and_user):
    """PATCH /feeds/{id} should return 404 for unknown feed."""
    baby_id, _ = seed_baby_and_user
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/9999",
        json={"notes": "test"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_feed_returns_404_for_wrong_baby(client, seed_baby_and_user):
    """PATCH /feeds/{id} should return 404 if feed belongs to a different baby."""
    baby_id, user_id = seed_baby_and_user
    # Create a second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Create feed for baby 1
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

    # Try to update via baby 2's URL
    resp = await client.patch(
        f"/api/v1/babies/{baby2_id}/feeds/{feed_id}",
        json={"notes": "hacked"},
    )
    assert resp.status_code == 404


# --- DELETE /api/v1/babies/{baby_id}/feeds/{feed_id} ---


@pytest.mark.anyio
async def test_delete_feed_returns_204(client, seed_baby_and_user):
    """DELETE /feeds/{id} should remove the feed and return 204."""
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

    resp = await client.delete(f"/api/v1/babies/{baby_id}/feeds/{feed_id}")
    assert resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(f"/api/v1/babies/{baby_id}/feeds")
    assert len(list_resp.json()) == 0


@pytest.mark.anyio
async def test_delete_feed_returns_404_for_nonexistent(client, seed_baby_and_user):
    """DELETE /feeds/{id} should return 404 for unknown feed."""
    baby_id, _ = seed_baby_and_user
    resp = await client.delete(f"/api/v1/babies/{baby_id}/feeds/9999")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_feed_returns_404_for_wrong_baby(client, seed_baby_and_user):
    """DELETE /feeds/{id} should return 404 if feed belongs to a different baby."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

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

    resp = await client.delete(f"/api/v1/babies/{baby2_id}/feeds/{feed_id}")
    assert resp.status_code == 404


# --- Full workflow: start, check active, stop ---


@pytest.mark.anyio
async def test_full_feed_timer_workflow(client, seed_baby_and_user):
    """Start a feed timer, verify it's active, stop it, verify no active feed."""
    baby_id, user_id = seed_baby_and_user

    # Start active feed
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    assert create_resp.status_code == 201
    feed_id = create_resp.json()["id"]

    # Verify active
    active_resp = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == feed_id

    # Stop the feed
    stop_resp = await client.patch(
        f"/api/v1/babies/{baby_id}/feeds/{feed_id}",
        json={"ended_at": "2024-06-15T10:30:00"},
    )
    assert stop_resp.status_code == 200
    assert stop_resp.json()["ended_at"] is not None

    # Verify no active feed
    active_resp2 = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert active_resp2.status_code == 200
    assert active_resp2.json() is None


@pytest.mark.anyio
async def test_retroactive_feed_creation(client, seed_baby_and_user):
    """Creating a completed feed retroactively should work with both started_at and ended_at."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-14T20:00:00",
            "ended_at": "2024-06-14T20:25:00",
            "amount_ml": 120.0,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["started_at"] is not None
    assert data["ended_at"] is not None
    assert data["amount_ml"] == 120.0


@pytest.mark.anyio
async def test_update_feed_multiple_fields(client, seed_baby_and_user):
    """PATCH should allow updating multiple fields at once."""
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
        json={
            "amount_oz": 4.5,
            "amount_ml": 133.0,
            "notes": "updated notes",
            "type": "breast_right",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount_oz"] == 4.5
    assert data["amount_ml"] == 133.0
    assert data["notes"] == "updated notes"
    assert data["type"] == "breast_right"


@pytest.mark.anyio
async def test_response_shape_contains_all_fields(client, seed_baby_and_user):
    """Feed response should contain all expected fields."""
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
    data = resp.json()
    expected_fields = {"id", "baby_id", "user_id", "type", "started_at",
                       "ended_at", "amount_oz", "amount_ml", "notes", "created_at"}
    assert expected_fields == set(data.keys())
