"""Tests for Task 1.7 — Sleep Events router endpoints."""

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


# --- POST /api/v1/babies/{baby_id}/sleeps ---


@pytest.mark.anyio
async def test_create_sleep_returns_201(client, seed_baby_and_user):
    """POST /sleeps should create a sleep event and return 201."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "type": "nap",
        "started_at": "2024-06-15T13:00:00",
        "ended_at": "2024-06-15T14:30:00",
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["baby_id"] == baby_id
    assert data["user_id"] == user_id
    assert data["type"] == "nap"
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_sleep_night_type(client, seed_baby_and_user):
    """POST /sleeps with type='night' should succeed."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "type": "night",
        "started_at": "2024-06-15T20:00:00",
        "ended_at": "2024-06-16T06:00:00",
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload)
    assert resp.status_code == 201
    assert resp.json()["type"] == "night"


@pytest.mark.anyio
async def test_create_sleep_as_active_timer(client, seed_baby_and_user):
    """POST /sleeps with no ended_at should create an active timer."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "type": "nap",
        "started_at": "2024-06-15T13:00:00",
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_create_sleep_409_when_active_sleep_exists(client, seed_baby_and_user):
    """POST /sleeps with no ended_at should return 409 if an active sleep already exists."""
    baby_id, user_id = seed_baby_and_user
    # Start first active sleep
    payload = {"user_id": user_id, "type": "nap"}
    await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload)

    # Attempt second active sleep
    resp = await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload)
    assert resp.status_code == 409
    assert "already in progress" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_create_completed_sleep_allows_multiple(client, seed_baby_and_user):
    """POST /sleeps with both started_at and ended_at should allow multiple completed sleeps."""
    baby_id, user_id = seed_baby_and_user
    payload1 = {
        "user_id": user_id,
        "type": "nap",
        "started_at": "2024-06-15T09:00:00",
        "ended_at": "2024-06-15T10:00:00",
    }
    resp1 = await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload1)
    assert resp1.status_code == 201

    payload2 = {
        "user_id": user_id,
        "type": "nap",
        "started_at": "2024-06-15T13:00:00",
        "ended_at": "2024-06-15T14:30:00",
    }
    resp2 = await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload2)
    assert resp2.status_code == 201


@pytest.mark.anyio
async def test_create_completed_sleep_while_active_exists(client, seed_baby_and_user):
    """POST /sleeps with ended_at set should succeed even when an active sleep exists."""
    baby_id, user_id = seed_baby_and_user
    # Start active sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    # Create retroactive completed sleep
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "night",
            "started_at": "2024-06-14T20:00:00",
            "ended_at": "2024-06-15T06:00:00",
        },
    )
    assert resp.status_code == 201


@pytest.mark.anyio
async def test_create_sleep_missing_type_returns_422(client, seed_baby_and_user):
    """POST /sleeps without required 'type' field should return 422."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps", json={"user_id": user_id}
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_sleep_missing_user_id_returns_422(client, seed_baby_and_user):
    """POST /sleeps without required 'user_id' field should return 422."""
    baby_id, _ = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps", json={"type": "nap"}
    )
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/sleeps ---


@pytest.mark.anyio
async def test_list_sleeps_returns_empty_list(client, seed_baby_and_user):
    """GET /sleeps should return empty list when no sleeps exist."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_sleeps_returns_sleeps_ordered_by_started_at_desc(client, seed_baby_and_user):
    """GET /sleeps should return sleeps ordered by started_at descending."""
    baby_id, user_id = seed_baby_and_user
    for hour in [8, 14, 11]:
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={
                "user_id": user_id,
                "type": "nap",
                "started_at": f"2024-06-15T{hour:02d}:00:00",
                "ended_at": f"2024-06-15T{hour:02d}:45:00",
            },
        )

    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # Should be in descending order: 14, 11, 8
    assert data[0]["started_at"] > data[1]["started_at"] > data[2]["started_at"]


@pytest.mark.anyio
async def test_list_sleeps_date_filter(client, seed_baby_and_user):
    """GET /sleeps?date=YYYY-MM-DD should only return sleeps from that day."""
    baby_id, user_id = seed_baby_and_user
    # Create sleep on June 15
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:30:00",
        },
    )
    # Create sleep on June 16
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-16T09:00:00",
            "ended_at": "2024-06-16T10:00:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps?date=2024-06-15")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "2024-06-15" in data[0]["started_at"]


@pytest.mark.anyio
async def test_list_sleeps_limit_parameter(client, seed_baby_and_user):
    """GET /sleeps?limit=N should return at most N sleeps."""
    baby_id, user_id = seed_baby_and_user
    for i in range(5):
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={
                "user_id": user_id,
                "type": "nap",
                "started_at": f"2024-06-15T{8+i}:00:00",
                "ended_at": f"2024-06-15T{8+i}:30:00",
            },
        )

    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps?limit=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_sleeps_limit_max_200(client, seed_baby_and_user):
    """GET /sleeps?limit=300 should reject values above 200."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps?limit=300")
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_sleeps_limit_min_1(client, seed_baby_and_user):
    """GET /sleeps?limit=0 should reject values below 1."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps?limit=0")
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/sleeps/active ---


@pytest.mark.anyio
async def test_get_active_sleep_returns_null_when_none(client, seed_baby_and_user):
    """GET /sleeps/active should return null when no active sleep exists."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.anyio
async def test_get_active_sleep_returns_active_sleep(client, seed_baby_and_user):
    """GET /sleeps/active should return the sleep with ended_at=null."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night"},
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sleep_id
    assert data["ended_at"] is None
    assert data["type"] == "night"


@pytest.mark.anyio
async def test_get_active_sleep_ignores_completed_sleeps(client, seed_baby_and_user):
    """GET /sleeps/active should not return completed sleeps."""
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

    resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert resp.status_code == 200
    assert resp.json() is None


# --- PATCH /api/v1/babies/{baby_id}/sleeps/{sleep_id} ---


@pytest.mark.anyio
async def test_update_sleep_stop_active_timer(client, seed_baby_and_user):
    """PATCH /sleeps/{id} with ended_at should stop an active timer."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/sleeps/{sleep_id}",
        json={"ended_at": "2024-06-15T14:30:00"},
    )
    assert resp.status_code == 200
    assert resp.json()["ended_at"] is not None


@pytest.mark.anyio
async def test_update_sleep_partial_update_preserves_fields(client, seed_baby_and_user):
    """PATCH /sleeps/{id} should only update the fields provided."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:30:00",
            "notes": "good nap",
        },
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/sleeps/{sleep_id}",
        json={"type": "night"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "night"
    assert data["notes"] == "good nap"


@pytest.mark.anyio
async def test_update_sleep_returns_404_for_nonexistent(client, seed_baby_and_user):
    """PATCH /sleeps/{id} should return 404 for unknown sleep."""
    baby_id, _ = seed_baby_and_user
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/sleeps/9999",
        json={"notes": "test"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_sleep_returns_404_for_wrong_baby(client, seed_baby_and_user):
    """PATCH /sleeps/{id} should return 404 if sleep belongs to a different baby."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby2_id}/sleeps/{sleep_id}",
        json={"notes": "hacked"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_sleep_multiple_fields(client, seed_baby_and_user):
    """PATCH should allow updating multiple fields at once."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/sleeps/{sleep_id}",
        json={
            "type": "night",
            "notes": "updated notes",
            "started_at": "2024-06-15T20:00:00",
            "ended_at": "2024-06-16T06:00:00",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "night"
    assert data["notes"] == "updated notes"
    assert "2024-06-15T20:00:00" in data["started_at"]
    assert "2024-06-16T06:00:00" in data["ended_at"]


# --- DELETE /api/v1/babies/{baby_id}/sleeps/{sleep_id} ---


@pytest.mark.anyio
async def test_delete_sleep_returns_204(client, seed_baby_and_user):
    """DELETE /sleeps/{id} should remove the sleep and return 204."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/babies/{baby_id}/sleeps/{sleep_id}")
    assert resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps")
    assert len(list_resp.json()) == 0


@pytest.mark.anyio
async def test_delete_sleep_returns_404_for_nonexistent(client, seed_baby_and_user):
    """DELETE /sleeps/{id} should return 404 for unknown sleep."""
    baby_id, _ = seed_baby_and_user
    resp = await client.delete(f"/api/v1/babies/{baby_id}/sleeps/9999")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_sleep_returns_404_for_wrong_baby(client, seed_baby_and_user):
    """DELETE /sleeps/{id} should return 404 if sleep belongs to a different baby."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )
    sleep_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/babies/{baby2_id}/sleeps/{sleep_id}")
    assert resp.status_code == 404


# --- Full workflow: start, check active, stop ---


@pytest.mark.anyio
async def test_full_sleep_timer_workflow(client, seed_baby_and_user):
    """Start a sleep timer, verify it's active, stop it, verify no active sleep."""
    baby_id, user_id = seed_baby_and_user

    # Start active sleep
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night"},
    )
    assert create_resp.status_code == 201
    sleep_id = create_resp.json()["id"]

    # Verify active
    active_resp = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == sleep_id

    # Stop the sleep
    stop_resp = await client.patch(
        f"/api/v1/babies/{baby_id}/sleeps/{sleep_id}",
        json={"ended_at": "2024-06-16T06:00:00"},
    )
    assert stop_resp.status_code == 200
    assert stop_resp.json()["ended_at"] is not None

    # Verify no active sleep
    active_resp2 = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert active_resp2.status_code == 200
    assert active_resp2.json() is None


@pytest.mark.anyio
async def test_retroactive_sleep_creation(client, seed_baby_and_user):
    """Creating a completed sleep retroactively should work with both started_at and ended_at."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "night",
            "started_at": "2024-06-14T20:00:00",
            "ended_at": "2024-06-15T06:00:00",
            "notes": "slept through the night",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["started_at"] is not None
    assert data["ended_at"] is not None
    assert data["notes"] == "slept through the night"


@pytest.mark.anyio
async def test_response_shape_contains_all_fields(client, seed_baby_and_user):
    """Sleep response should contain all expected fields."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T14:00:00",
        },
    )
    data = resp.json()
    expected_fields = {"id", "baby_id", "user_id", "type", "started_at",
                       "ended_at", "notes", "created_at"}
    assert expected_fields == set(data.keys())


@pytest.mark.anyio
async def test_active_sleep_isolated_per_baby(client, seed_baby_and_user):
    """Active sleep constraint should be per-baby, not global."""
    baby_id, user_id = seed_baby_and_user
    # Create second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby2", "birthdate": "2024-03-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Start active sleep for baby 1
    resp1 = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    assert resp1.status_code == 201

    # Start active sleep for baby 2 — should succeed
    resp2 = await client.post(
        f"/api/v1/babies/{baby2_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    assert resp2.status_code == 201
