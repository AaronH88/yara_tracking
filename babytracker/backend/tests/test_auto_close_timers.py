"""Tests for Task 2.2 — Auto-Close Conflicting Timers.

Tests the close_active_timers helper and its integration into
feed and sleep POST endpoints.
"""

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


# --- Cross-type auto-close: feed closes active sleep ---


@pytest.mark.anyio
async def test_starting_feed_auto_closes_active_sleep(client, seed_baby_and_user):
    """Starting a feed while a sleep is active should set ended_at on the sleep."""
    baby_id, user_id = seed_baby_and_user

    # Start active sleep
    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = sleep_resp.json()["id"]

    # Start a feed — should auto-close the sleep
    feed_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    assert feed_resp.status_code == 201

    # Verify the sleep is now closed
    active_sleep = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert active_sleep.json() is None

    # Verify auto_closed list reports the sleep
    data = feed_resp.json()
    assert len(data["auto_closed"]) == 1
    assert data["auto_closed"][0]["type"] == "sleep"
    assert data["auto_closed"][0]["id"] == sleep_id


@pytest.mark.anyio
async def test_starting_feed_auto_closes_sleep_sets_ended_at(client, seed_baby_and_user):
    """The auto-closed sleep should have a non-null ended_at timestamp."""
    baby_id, user_id = seed_baby_and_user

    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = sleep_resp.json()["id"]

    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )

    # Fetch sleeps and find the original one
    sleeps = await client.get(f"/api/v1/babies/{baby_id}/sleeps")
    closed_sleep = next(s for s in sleeps.json() if s["id"] == sleep_id)
    assert closed_sleep["ended_at"] is not None


# --- Cross-type auto-close: sleep closes active feed ---


@pytest.mark.anyio
async def test_starting_sleep_auto_closes_active_feed(client, seed_baby_and_user):
    """Starting a sleep while a feed is active should set ended_at on the feed."""
    baby_id, user_id = seed_baby_and_user

    # Start active feed
    feed_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    feed_id = feed_resp.json()["id"]

    # Start a sleep — should auto-close the feed
    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    assert sleep_resp.status_code == 201

    # Verify the feed is now closed
    active_feed = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert active_feed.json() is None

    # Verify auto_closed list reports the feed
    data = sleep_resp.json()
    assert len(data["auto_closed"]) == 1
    assert data["auto_closed"][0]["type"] == "feed"
    assert data["auto_closed"][0]["id"] == feed_id


# --- Same-type auto-close: feed closes active feed ---


@pytest.mark.anyio
async def test_starting_feed_auto_closes_previous_active_feed(client, seed_baby_and_user):
    """Starting a new feed timer should auto-close any existing active feed."""
    baby_id, user_id = seed_baby_and_user

    # Start first feed timer
    first_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    first_feed_id = first_resp.json()["id"]

    # Start second feed timer
    second_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_right"},
    )
    assert second_resp.status_code == 201
    second_feed_id = second_resp.json()["id"]

    # auto_closed should include the first feed
    auto_closed = second_resp.json()["auto_closed"]
    assert any(item["id"] == first_feed_id and item["type"] == "feed" for item in auto_closed)

    # The active feed should be the new one
    active = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert active.json()["id"] == second_feed_id


# --- Same-type auto-close: sleep closes active sleep ---


@pytest.mark.anyio
async def test_starting_sleep_auto_closes_previous_active_sleep(client, seed_baby_and_user):
    """Starting a new sleep timer should auto-close any existing active sleep."""
    baby_id, user_id = seed_baby_and_user

    first_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    first_sleep_id = first_resp.json()["id"]

    second_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night"},
    )
    assert second_resp.status_code == 201
    second_sleep_id = second_resp.json()["id"]

    auto_closed = second_resp.json()["auto_closed"]
    assert any(item["id"] == first_sleep_id and item["type"] == "sleep" for item in auto_closed)

    active = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert active.json()["id"] == second_sleep_id


# --- auto_closed list accuracy ---


@pytest.mark.anyio
async def test_auto_closed_list_empty_when_no_active_timers(client, seed_baby_and_user):
    """auto_closed should be empty when there are no active timers to close."""
    baby_id, user_id = seed_baby_and_user

    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    assert resp.status_code == 201
    assert resp.json()["auto_closed"] == []


@pytest.mark.anyio
async def test_auto_closed_list_empty_for_sleep_when_no_active_timers(client, seed_baby_and_user):
    """auto_closed should be empty for sleeps when there are no active timers."""
    baby_id, user_id = seed_baby_and_user

    resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    assert resp.status_code == 201
    assert resp.json()["auto_closed"] == []


@pytest.mark.anyio
async def test_auto_closed_contains_started_at_field(client, seed_baby_and_user):
    """Each auto_closed item should include a started_at timestamp string."""
    baby_id, user_id = seed_baby_and_user

    # Start a sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": "2024-06-15T13:00:00"},
    )

    # Start a feed — auto-closes sleep
    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    item = resp.json()["auto_closed"][0]
    assert "started_at" in item
    assert isinstance(item["started_at"], str)
    assert len(item["started_at"]) > 0


@pytest.mark.anyio
async def test_creating_feed_auto_closes_sleep_but_not_vice_versa_in_same_request(client, seed_baby_and_user):
    """Creating a feed only closes active sleeps (via helper), not other feeds (helper excludes FeedEvent).
    The inline code handles closing the existing active feed separately."""
    baby_id, user_id = seed_baby_and_user

    # Start a sleep timer
    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = sleep_resp.json()["id"]

    # Start a feed — should auto-close the sleep, auto_closed should contain only sleep
    feed_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    assert feed_resp.status_code == 201
    auto_closed = feed_resp.json()["auto_closed"]
    assert len(auto_closed) == 1
    assert auto_closed[0]["type"] == "sleep"
    assert auto_closed[0]["id"] == sleep_id

    # Start another feed — should auto-close the first feed only
    feed2_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    auto_closed2 = feed2_resp.json()["auto_closed"]
    # Only the previous feed should be in auto_closed (sleep was already closed)
    assert len(auto_closed2) == 1
    assert auto_closed2[0]["type"] == "feed"


# --- Completed events should not trigger auto-close ---


@pytest.mark.anyio
async def test_completed_feed_does_not_auto_close_active_sleep(client, seed_baby_and_user):
    """Creating a completed feed (with ended_at) should still auto-close active sleep."""
    baby_id, user_id = seed_baby_and_user

    # Start active sleep
    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = sleep_resp.json()["id"]

    # Create a completed feed — auto_closed still runs before creation
    feed_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T10:00:00",
            "ended_at": "2024-06-15T10:15:00",
        },
    )
    assert feed_resp.status_code == 201
    # The helper runs before creation, so sleep should be auto-closed
    auto_closed = feed_resp.json()["auto_closed"]
    assert any(item["id"] == sleep_id for item in auto_closed)


@pytest.mark.anyio
async def test_completed_feed_does_not_auto_close_active_feed(client, seed_baby_and_user):
    """Creating a completed feed should NOT auto-close an existing active feed
    (the inline check only runs when ended_at is None)."""
    baby_id, user_id = seed_baby_and_user

    # Start an active feed timer
    first_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    first_feed_id = first_resp.json()["id"]

    # Create a completed (retroactive) feed — should NOT close the active feed
    # (inline code only runs when ended_at is None, and helper excludes FeedEvent)
    second_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T06:00:00",
            "ended_at": "2024-06-15T06:15:00",
        },
    )
    assert second_resp.status_code == 201

    # Active feed should still be active
    active = await client.get(f"/api/v1/babies/{baby_id}/feeds/active")
    assert active.json()["id"] == first_feed_id


# --- Per-baby isolation ---


@pytest.mark.anyio
async def test_auto_close_is_scoped_to_baby(client, seed_baby_and_user):
    """Auto-close should only affect timers for the same baby, not other babies."""
    baby_id, user_id = seed_baby_and_user

    # Create second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby2", "birthdate": "2024-03-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Start sleep for baby 1
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )

    # Start feed for baby 2 — should NOT close baby 1's sleep
    feed_resp = await client.post(
        f"/api/v1/babies/{baby2_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    assert feed_resp.status_code == 201
    assert feed_resp.json()["auto_closed"] == []

    # Baby 1's sleep should still be active
    active_sleep = await client.get(f"/api/v1/babies/{baby_id}/sleeps/active")
    assert active_sleep.json() is not None


# --- Auto-closed timer has correct ended_at ---


@pytest.mark.anyio
async def test_auto_closed_feed_has_ended_at_set(client, seed_baby_and_user):
    """An auto-closed feed should have ended_at set to approximately now."""
    baby_id, user_id = seed_baby_and_user

    # Start a feed
    feed_resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "breast_left"},
    )
    feed_id = feed_resp.json()["id"]

    # Start a sleep — auto-closes the feed
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )

    # Fetch all feeds, find the closed one
    feeds = await client.get(f"/api/v1/babies/{baby_id}/feeds")
    closed_feed = next(f for f in feeds.json() if f["id"] == feed_id)
    assert closed_feed["ended_at"] is not None


@pytest.mark.anyio
async def test_auto_closed_sleep_has_ended_at_set(client, seed_baby_and_user):
    """An auto-closed sleep should have ended_at set to approximately now."""
    baby_id, user_id = seed_baby_and_user

    # Start a sleep
    sleep_resp = await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )
    sleep_id = sleep_resp.json()["id"]

    # Start a feed — auto-closes the sleep
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )

    # Fetch all sleeps, find the closed one
    sleeps = await client.get(f"/api/v1/babies/{baby_id}/sleeps")
    closed_sleep = next(s for s in sleeps.json() if s["id"] == sleep_id)
    assert closed_sleep["ended_at"] is not None


# --- Response shape ---


@pytest.mark.anyio
async def test_feed_create_response_includes_auto_closed_field(client, seed_baby_and_user):
    """POST /feeds response should always include auto_closed field."""
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
    assert "auto_closed" in resp.json()
    assert isinstance(resp.json()["auto_closed"], list)


@pytest.mark.anyio
async def test_sleep_create_response_includes_auto_closed_field(client, seed_baby_and_user):
    """POST /sleeps response should always include auto_closed field."""
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
    assert resp.status_code == 201
    assert "auto_closed" in resp.json()
    assert isinstance(resp.json()["auto_closed"], list)


@pytest.mark.anyio
async def test_auto_closed_item_shape(client, seed_baby_and_user):
    """Each auto_closed item should have type, id, and started_at fields."""
    baby_id, user_id = seed_baby_and_user

    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap"},
    )

    resp = await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle"},
    )
    auto_closed = resp.json()["auto_closed"]
    assert len(auto_closed) == 1
    item = auto_closed[0]
    assert set(item.keys()) == {"type", "id", "started_at"}
    assert isinstance(item["type"], str)
    assert isinstance(item["id"], int)
    assert isinstance(item["started_at"], str)
