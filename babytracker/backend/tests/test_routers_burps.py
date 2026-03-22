"""Tests for Task 2.3 — Burp Timer router endpoints."""

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


# --- POST /api/v1/babies/{baby_id}/burps ---


@pytest.mark.anyio
async def test_create_burp_returns_201(client, seed_baby_and_user):
    """POST /burps should create a burp event and return 201."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "started_at": "2024-06-15T13:00:00",
        "ended_at": "2024-06-15T13:05:00",
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/burps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["baby_id"] == baby_id
    assert data["user_id"] == user_id
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_burp_as_active_timer(client, seed_baby_and_user):
    """POST /burps with no ended_at should create an active timer."""
    baby_id, user_id = seed_baby_and_user
    payload = {
        "user_id": user_id,
        "started_at": "2024-06-15T13:00:00",
    }
    resp = await client.post(f"/api/v1/babies/{baby_id}/burps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_create_burp_auto_closes_active_burp(client, seed_baby_and_user):
    """POST /burps with no ended_at should auto-close any existing active burp."""
    baby_id, user_id = seed_baby_and_user
    # Start first active burp
    first_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    first_burp_id = first_resp.json()["id"]

    # Start second active burp — should auto-close the first
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert any(
        item["id"] == first_burp_id and item["type"] == "burp"
        for item in data["auto_closed"]
    )


@pytest.mark.anyio
async def test_create_completed_burp_allows_multiple(client, seed_baby_and_user):
    """POST /burps with both started_at and ended_at should allow multiple completed burps."""
    baby_id, user_id = seed_baby_and_user
    payload1 = {
        "user_id": user_id,
        "started_at": "2024-06-15T09:00:00",
        "ended_at": "2024-06-15T09:05:00",
    }
    resp1 = await client.post(f"/api/v1/babies/{baby_id}/burps", json=payload1)
    assert resp1.status_code == 201

    payload2 = {
        "user_id": user_id,
        "started_at": "2024-06-15T13:00:00",
        "ended_at": "2024-06-15T13:03:00",
    }
    resp2 = await client.post(f"/api/v1/babies/{baby_id}/burps", json=payload2)
    assert resp2.status_code == 201


@pytest.mark.anyio
async def test_create_completed_burp_while_active_exists(client, seed_baby_and_user):
    """POST /burps with ended_at set should succeed even when an active burp exists."""
    baby_id, user_id = seed_baby_and_user
    # Start active burp
    await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    # Create retroactive completed burp
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-14T20:00:00",
            "ended_at": "2024-06-14T20:05:00",
        },
    )
    assert resp.status_code == 201


@pytest.mark.anyio
async def test_create_burp_with_notes(client, seed_baby_and_user):
    """POST /burps should accept optional notes field."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
            "notes": "good burp after feeding",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["notes"] == "good burp after feeding"


@pytest.mark.anyio
async def test_create_burp_without_user_id_succeeds(client, seed_baby_and_user):
    """POST /burps without user_id should succeed (user_id is optional for burps)."""
    baby_id, _ = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"started_at": "2024-06-15T13:00:00", "ended_at": "2024-06-15T13:05:00"},
    )
    assert resp.status_code == 201
    assert resp.json()["user_id"] is None


@pytest.mark.anyio
async def test_create_burp_auto_closes_active_feed(client, seed_baby_and_user):
    """POST /burps should auto-close active timers from other types (feeds)."""
    baby_id, user_id = seed_baby_and_user
    # Start active feed
    feed_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast"},
    )
    feed_id = feed_resp.json()["id"]

    # Start burp — should auto-close the feed
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert any(
        item["id"] == feed_id and item["type"] == "feed"
        for item in data["auto_closed"]
    )


@pytest.mark.anyio
async def test_create_burp_auto_closes_active_sleep(client, seed_baby_and_user):
    """POST /burps should auto-close active timers from other types (sleeps)."""
    baby_id, user_id = seed_baby_and_user
    # Start active sleep
    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = sleep_resp.json()["id"]

    # Start burp — should auto-close the sleep
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert any(
        item["id"] == sleep_id and item["type"] == "sleep"
        for item in data["auto_closed"]
    )


# --- GET /api/v1/babies/{baby_id}/burps ---


@pytest.mark.anyio
async def test_list_burps_returns_empty_list(client, seed_baby_and_user):
    """GET /burps should return empty list when no burps exist."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/burps")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_burps_returns_burps_ordered_by_started_at_desc(client, seed_baby_and_user):
    """GET /burps should return burps ordered by started_at descending."""
    baby_id, user_id = seed_baby_and_user
    for hour in [8, 14, 11]:
        await client.post(
            f"/api/v1/babies/{baby_id}/burps",
            json={
                "user_id": user_id,
                "started_at": f"2024-06-15T{hour:02d}:00:00",
                "ended_at": f"2024-06-15T{hour:02d}:05:00",
            },
        )

    resp = await client.get(f"/api/v1/babies/{baby_id}/burps")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # Should be in descending order: 14, 11, 8
    assert data[0]["started_at"] > data[1]["started_at"] > data[2]["started_at"]


@pytest.mark.anyio
async def test_list_burps_date_filter(client, seed_baby_and_user):
    """GET /burps?date=YYYY-MM-DD should only return burps from that day."""
    baby_id, user_id = seed_baby_and_user
    # Create burp on June 15
    await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )
    # Create burp on June 16
    await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-16T09:00:00",
            "ended_at": "2024-06-16T09:03:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/burps?date=2024-06-15")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "2024-06-15" in data[0]["started_at"]


@pytest.mark.anyio
async def test_list_burps_limit_parameter(client, seed_baby_and_user):
    """GET /burps?limit=N should return at most N burps."""
    baby_id, user_id = seed_baby_and_user
    for i in range(5):
        await client.post(
            f"/api/v1/babies/{baby_id}/burps",
            json={
                "user_id": user_id,
                "started_at": f"2024-06-15T{8+i}:00:00",
                "ended_at": f"2024-06-15T{8+i}:05:00",
            },
        )

    resp = await client.get(f"/api/v1/babies/{baby_id}/burps?limit=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_burps_limit_max_200(client, seed_baby_and_user):
    """GET /burps?limit=300 should reject values above 200."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/burps?limit=300")
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_burps_limit_min_1(client, seed_baby_and_user):
    """GET /burps?limit=0 should reject values below 1."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/burps?limit=0")
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/burps/active ---


@pytest.mark.anyio
async def test_get_active_burp_returns_null_when_none(client, seed_baby_and_user):
    """GET /burps/active should return null when no active burp exists."""
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.anyio
async def test_get_active_burp_returns_active_burp(client, seed_baby_and_user):
    """GET /burps/active should return the burp with ended_at=null."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    burp_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == burp_id
    assert data["ended_at"] is None


@pytest.mark.anyio
async def test_get_active_burp_ignores_completed_burps(client, seed_baby_and_user):
    """GET /burps/active should not return completed burps."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )

    resp = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    assert resp.status_code == 200
    assert resp.json() is None


# --- PATCH /api/v1/babies/{baby_id}/burps/{burp_id} ---


@pytest.mark.anyio
async def test_update_burp_stop_active_timer(client, seed_baby_and_user):
    """PATCH /burps/{id} with ended_at should stop an active timer."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    burp_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/burps/{burp_id}",
        json={"ended_at": "2024-06-15T13:05:00"},
    )
    assert resp.status_code == 200
    assert resp.json()["ended_at"] is not None


@pytest.mark.anyio
async def test_update_burp_partial_update_preserves_fields(client, seed_baby_and_user):
    """PATCH /burps/{id} should only update the fields provided."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
            "notes": "good burp",
        },
    )
    burp_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/burps/{burp_id}",
        json={"notes": "great burp"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["notes"] == "great burp"
    assert "2024-06-15T13:00:00" in data["started_at"]
    assert "2024-06-15T13:05:00" in data["ended_at"]


@pytest.mark.anyio
async def test_update_burp_returns_404_for_nonexistent(client, seed_baby_and_user):
    """PATCH /burps/{id} should return 404 for unknown burp."""
    baby_id, _ = seed_baby_and_user
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/burps/9999",
        json={"notes": "test"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_burp_returns_404_for_wrong_baby(client, seed_baby_and_user):
    """PATCH /burps/{id} should return 404 if burp belongs to a different baby."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )
    burp_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby2_id}/burps/{burp_id}",
        json={"notes": "hacked"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_burp_multiple_fields(client, seed_baby_and_user):
    """PATCH should allow updating multiple fields at once."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )
    burp_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/burps/{burp_id}",
        json={
            "notes": "updated notes",
            "started_at": "2024-06-15T14:00:00",
            "ended_at": "2024-06-15T14:03:00",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["notes"] == "updated notes"
    assert "2024-06-15T14:00:00" in data["started_at"]
    assert "2024-06-15T14:03:00" in data["ended_at"]


# --- DELETE /api/v1/babies/{baby_id}/burps/{burp_id} ---


@pytest.mark.anyio
async def test_delete_burp_returns_204(client, seed_baby_and_user):
    """DELETE /burps/{id} should remove the burp and return 204."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )
    burp_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/babies/{baby_id}/burps/{burp_id}")
    assert resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(f"/api/v1/babies/{baby_id}/burps")
    assert len(list_resp.json()) == 0


@pytest.mark.anyio
async def test_delete_burp_returns_404_for_nonexistent(client, seed_baby_and_user):
    """DELETE /burps/{id} should return 404 for unknown burp."""
    baby_id, _ = seed_baby_and_user
    resp = await client.delete(f"/api/v1/babies/{baby_id}/burps/9999")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_burp_returns_404_for_wrong_baby(client, seed_baby_and_user):
    """DELETE /burps/{id} should return 404 if burp belongs to a different baby."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )
    burp_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/babies/{baby2_id}/burps/{burp_id}")
    assert resp.status_code == 404


# --- Full workflow: start, check active, stop ---


@pytest.mark.anyio
async def test_full_burp_timer_workflow(client, seed_baby_and_user):
    """Start a burp timer, verify it's active, stop it, verify no active burp."""
    baby_id, user_id = seed_baby_and_user

    # Start active burp
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    assert create_resp.status_code == 201
    burp_id = create_resp.json()["id"]

    # Verify active
    active_resp = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == burp_id

    # Stop the burp
    stop_resp = await client.patch(
        f"/api/v1/babies/{baby_id}/burps/{burp_id}",
        json={"ended_at": "2024-06-15T13:05:00"},
    )
    assert stop_resp.status_code == 200
    assert stop_resp.json()["ended_at"] is not None

    # Verify no active burp
    active_resp2 = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    assert active_resp2.status_code == 200
    assert active_resp2.json() is None


@pytest.mark.anyio
async def test_retroactive_burp_creation(client, seed_baby_and_user):
    """Creating a completed burp retroactively should work with both started_at and ended_at."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-14T20:00:00",
            "ended_at": "2024-06-14T20:03:00",
            "notes": "after evening feed",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["started_at"] is not None
    assert data["ended_at"] is not None
    assert data["notes"] == "after evening feed"


@pytest.mark.anyio
async def test_response_shape_contains_all_fields(client, seed_baby_and_user):
    """Burp create response should contain all expected fields."""
    baby_id, user_id = seed_baby_and_user
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={
            "user_id": user_id,
            "started_at": "2024-06-15T13:00:00",
            "ended_at": "2024-06-15T13:05:00",
        },
    )
    data = resp.json()
    expected_fields = {"id", "baby_id", "user_id", "started_at",
                       "ended_at", "notes", "created_at", "auto_closed"}
    assert expected_fields == set(data.keys())


@pytest.mark.anyio
async def test_active_burp_isolated_per_baby(client, seed_baby_and_user):
    """Active burp constraint should be per-baby, not global."""
    baby_id, user_id = seed_baby_and_user
    # Create second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby2", "birthdate": "2024-03-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Start active burp for baby 1
    resp1 = await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    assert resp1.status_code == 201

    # Start active burp for baby 2 — should succeed without auto-closing baby 1's burp
    resp2 = await client.post(
        f"/api/v1/babies/{baby2_id}/burps",
        json={"user_id": user_id},
    )
    assert resp2.status_code == 201
    # Baby 1's burp should still be active
    active_resp = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    assert active_resp.json() is not None


@pytest.mark.anyio
async def test_get_response_shape_for_non_create(client, seed_baby_and_user):
    """GET /burps/active response should not include auto_closed field."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/burps",
        json={"user_id": user_id},
    )
    resp = await client.get(f"/api/v1/babies/{baby_id}/burps/active")
    data = resp.json()
    expected_fields = {"id", "baby_id", "user_id", "started_at",
                       "ended_at", "notes", "created_at"}
    assert expected_fields == set(data.keys())
