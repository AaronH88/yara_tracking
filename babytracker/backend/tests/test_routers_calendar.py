"""Tests for Task 1.9 — Calendar router endpoints."""

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
async def seed(client):
    """Create a baby and a user, return their IDs."""
    baby_resp = await client.post(
        "/api/v1/babies", json={"name": "CalBaby", "birthdate": "2024-01-01"}
    )
    user_resp = await client.post(
        "/api/v1/users", json={"name": "CalUser", "role": "parent"}
    )
    return baby_resp.json()["id"], user_resp.json()["id"]


# --- Helpers ---

async def _create_feed(client, baby_id, user_id, started_at, ended_at=None):
    payload = {"user_id": user_id, "type": "bottle", "started_at": started_at}
    if ended_at:
        payload["ended_at"] = ended_at
    return await client.post(f"/api/v1/babies/{baby_id}/feeds", json=payload)


async def _create_sleep(client, baby_id, user_id, started_at, ended_at=None):
    payload = {"user_id": user_id, "type": "nap", "started_at": started_at}
    if ended_at:
        payload["ended_at"] = ended_at
    return await client.post(f"/api/v1/babies/{baby_id}/sleeps", json=payload)


async def _create_diaper(client, baby_id, user_id, logged_at):
    payload = {"user_id": user_id, "type": "wet", "logged_at": logged_at}
    return await client.post(f"/api/v1/babies/{baby_id}/diapers", json=payload)


async def _create_milestone(client, baby_id, user_id, occurred_at, title="Smiled"):
    payload = {"user_id": user_id, "occurred_at": occurred_at, "title": title}
    return await client.post(f"/api/v1/babies/{baby_id}/milestones", json=payload)


# ==========================================================================
# GET /babies/{baby_id}/calendar/month
# ==========================================================================


@pytest.mark.anyio
async def test_month_returns_empty_dict_for_no_events(client, seed):
    """Month endpoint returns empty dict when there are no events."""
    baby_id, _ = seed
    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    assert resp.status_code == 200
    assert resp.json() == {}


@pytest.mark.anyio
async def test_month_counts_feeds(client, seed):
    """Month endpoint counts feed events correctly per day."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")
    await _create_feed(client, baby_id, user_id, "2024-06-15T12:00:00", "2024-06-15T12:20:00")
    await _create_feed(client, baby_id, user_id, "2024-06-16T09:00:00", "2024-06-16T09:10:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["2024-06-15"]["feed_count"] == 2
    assert data["2024-06-16"]["feed_count"] == 1


@pytest.mark.anyio
async def test_month_counts_sleeps(client, seed):
    """Month endpoint counts sleep events correctly."""
    baby_id, user_id = seed
    await _create_sleep(client, baby_id, user_id, "2024-06-10T13:00:00", "2024-06-10T14:30:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    assert data["2024-06-10"]["sleep_count"] == 1
    assert data["2024-06-10"]["feed_count"] == 0


@pytest.mark.anyio
async def test_month_counts_diapers(client, seed):
    """Month endpoint counts diaper events correctly."""
    baby_id, user_id = seed
    await _create_diaper(client, baby_id, user_id, "2024-06-20T07:00:00")
    await _create_diaper(client, baby_id, user_id, "2024-06-20T11:00:00")
    await _create_diaper(client, baby_id, user_id, "2024-06-20T15:00:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    assert data["2024-06-20"]["diaper_count"] == 3


@pytest.mark.anyio
async def test_month_detects_milestones(client, seed):
    """Month endpoint sets has_milestone=true for days with milestones."""
    baby_id, user_id = seed
    await _create_milestone(client, baby_id, user_id, "2024-06-05", "First smile")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    assert data["2024-06-05"]["has_milestone"] is True
    assert data["2024-06-05"]["feed_count"] == 0
    assert data["2024-06-05"]["sleep_count"] == 0
    assert data["2024-06-05"]["diaper_count"] == 0


@pytest.mark.anyio
async def test_month_combines_all_event_types(client, seed):
    """Month endpoint returns combined counts across all event types for a single day."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")
    await _create_sleep(client, baby_id, user_id, "2024-06-15T13:00:00", "2024-06-15T14:00:00")
    await _create_diaper(client, baby_id, user_id, "2024-06-15T07:00:00")
    await _create_milestone(client, baby_id, user_id, "2024-06-15", "Rolled over")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    day = data["2024-06-15"]
    assert day["feed_count"] == 1
    assert day["sleep_count"] == 1
    assert day["diaper_count"] == 1
    assert day["has_milestone"] is True


@pytest.mark.anyio
async def test_month_excludes_events_from_other_months(client, seed):
    """Month endpoint does not include events outside the requested month."""
    baby_id, user_id = seed
    # Event in May
    await _create_feed(client, baby_id, user_id, "2024-05-31T23:00:00", "2024-05-31T23:15:00")
    # Event in June
    await _create_feed(client, baby_id, user_id, "2024-06-01T00:30:00", "2024-06-01T00:45:00")
    # Event in July
    await _create_feed(client, baby_id, user_id, "2024-07-01T08:00:00", "2024-07-01T08:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    assert "2024-05-31" not in data
    assert "2024-07-01" not in data
    assert "2024-06-01" in data


@pytest.mark.anyio
async def test_month_excludes_events_from_other_babies(client, seed):
    """Month endpoint only includes events for the specified baby."""
    baby_id, user_id = seed
    # Create second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Event for baby 2
    await _create_feed(client, baby2_id, user_id, "2024-06-15T10:00:00", "2024-06-15T10:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    assert resp.json() == {}


@pytest.mark.anyio
async def test_month_only_includes_dates_with_events(client, seed):
    """Month endpoint only returns dates that have at least one event (sparse dict)."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-10T08:00:00", "2024-06-10T08:15:00")
    await _create_feed(client, baby_id, user_id, "2024-06-20T08:00:00", "2024-06-20T08:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    assert len(data) == 2
    assert "2024-06-10" in data
    assert "2024-06-20" in data
    # Days with no events should not appear
    assert "2024-06-11" not in data


@pytest.mark.anyio
async def test_month_invalid_month_returns_422(client, seed):
    """Month endpoint rejects month values outside 1-12."""
    baby_id, _ = seed
    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=13"
    )
    assert resp.status_code == 422

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=0"
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_month_missing_params_returns_422(client, seed):
    """Month endpoint requires both year and month query params."""
    baby_id, _ = seed
    resp = await client.get(f"/api/v1/babies/{baby_id}/calendar/month?year=2024")
    assert resp.status_code == 422

    resp = await client.get(f"/api/v1/babies/{baby_id}/calendar/month?month=6")
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_month_response_shape(client, seed):
    """Month endpoint returns correct DaySummary shape for each date."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/month?year=2024&month=6"
    )
    data = resp.json()
    day = data["2024-06-15"]
    assert set(day.keys()) == {"date", "feed_count", "sleep_count", "diaper_count", "has_milestone"}
    assert day["date"] == "2024-06-15"


# ==========================================================================
# GET /babies/{baby_id}/calendar/day
# ==========================================================================


@pytest.mark.anyio
async def test_day_returns_empty_list_for_no_events(client, seed):
    """Day endpoint returns empty list when no events exist for the date."""
    baby_id, _ = seed
    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_day_returns_all_event_types(client, seed):
    """Day endpoint returns feeds, sleeps, diapers, and milestones."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")
    await _create_sleep(client, baby_id, user_id, "2024-06-15T13:00:00", "2024-06-15T14:00:00")
    await _create_diaper(client, baby_id, user_id, "2024-06-15T07:00:00")
    await _create_milestone(client, baby_id, user_id, "2024-06-15", "Rolled over")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    assert resp.status_code == 200
    data = resp.json()
    event_types = {e["event_type"] for e in data}
    assert event_types == {"feed", "sleep", "diaper", "milestone"}


@pytest.mark.anyio
async def test_day_events_sorted_by_timestamp(client, seed):
    """Day endpoint returns events sorted by their timestamp ascending."""
    baby_id, user_id = seed
    # Create events in non-chronological order
    await _create_feed(client, baby_id, user_id, "2024-06-15T14:00:00", "2024-06-15T14:20:00")
    await _create_diaper(client, baby_id, user_id, "2024-06-15T07:00:00")
    await _create_sleep(client, baby_id, user_id, "2024-06-15T10:00:00", "2024-06-15T11:00:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    data = resp.json()
    assert len(data) == 3
    timestamps = [e["timestamp"] for e in data]
    assert timestamps == sorted(timestamps)
    # Verify actual order: diaper(07:00) < sleep(10:00) < feed(14:00)
    assert data[0]["event_type"] == "diaper"
    assert data[1]["event_type"] == "sleep"
    assert data[2]["event_type"] == "feed"


@pytest.mark.anyio
async def test_day_excludes_events_from_other_days(client, seed):
    """Day endpoint only returns events from the requested date."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-14T23:00:00", "2024-06-14T23:15:00")
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")
    await _create_feed(client, baby_id, user_id, "2024-06-16T08:00:00", "2024-06-16T08:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    data = resp.json()
    assert len(data) == 1
    assert data[0]["event_type"] == "feed"


@pytest.mark.anyio
async def test_day_excludes_events_from_other_babies(client, seed):
    """Day endpoint only returns events for the specified baby."""
    baby_id, user_id = seed
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    await _create_feed(client, baby2_id, user_id, "2024-06-15T10:00:00", "2024-06-15T10:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    assert resp.json() == []


@pytest.mark.anyio
async def test_day_event_has_correct_shape(client, seed):
    """Day endpoint events have event_type, timestamp, id, and detail fields."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    data = resp.json()
    assert len(data) == 1
    event = data[0]
    assert set(event.keys()) == {"event_type", "timestamp", "id", "detail"}
    assert event["event_type"] == "feed"
    assert event["id"] is not None
    assert isinstance(event["detail"], dict)


@pytest.mark.anyio
async def test_day_feed_detail_fields(client, seed):
    """Feed events in day view include type, amount_oz, and notes in detail."""
    baby_id, user_id = seed
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={
            "user_id": user_id,
            "type": "bottle",
            "started_at": "2024-06-15T08:00:00",
            "ended_at": "2024-06-15T08:15:00",
            "amount_oz": 4.0,
            "notes": "good feed",
        },
    )

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    detail = resp.json()[0]["detail"]
    assert detail["type"] == "bottle"
    assert detail["amount_oz"] == 4.0
    assert detail["notes"] == "good feed"


@pytest.mark.anyio
async def test_day_sleep_detail_fields(client, seed):
    """Sleep events in day view include type, ended_at, and notes in detail."""
    baby_id, user_id = seed
    await _create_sleep(client, baby_id, user_id, "2024-06-15T13:00:00", "2024-06-15T14:00:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    event = resp.json()[0]
    assert event["event_type"] == "sleep"
    assert "type" in event["detail"]
    assert "ended_at" in event["detail"]
    assert "notes" in event["detail"]


@pytest.mark.anyio
async def test_day_diaper_detail_fields(client, seed):
    """Diaper events in day view include type and notes in detail."""
    baby_id, user_id = seed
    await _create_diaper(client, baby_id, user_id, "2024-06-15T07:00:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    event = resp.json()[0]
    assert event["event_type"] == "diaper"
    assert "type" in event["detail"]
    assert "notes" in event["detail"]


@pytest.mark.anyio
async def test_day_milestone_detail_fields(client, seed):
    """Milestone events in day view include title and notes in detail."""
    baby_id, user_id = seed
    await _create_milestone(client, baby_id, user_id, "2024-06-15", "First smile")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    event = resp.json()[0]
    assert event["event_type"] == "milestone"
    assert event["detail"]["title"] == "First smile"
    assert "notes" in event["detail"]


@pytest.mark.anyio
async def test_day_missing_date_returns_422(client, seed):
    """Day endpoint requires date query param."""
    baby_id, _ = seed
    resp = await client.get(f"/api/v1/babies/{baby_id}/calendar/day")
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_day_invalid_date_returns_422(client, seed):
    """Day endpoint rejects invalid date strings."""
    baby_id, _ = seed
    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=not-a-date"
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_day_multiple_events_same_type(client, seed):
    """Day endpoint returns multiple events of the same type."""
    baby_id, user_id = seed
    await _create_feed(client, baby_id, user_id, "2024-06-15T08:00:00", "2024-06-15T08:15:00")
    await _create_feed(client, baby_id, user_id, "2024-06-15T12:00:00", "2024-06-15T12:20:00")
    await _create_feed(client, baby_id, user_id, "2024-06-15T18:00:00", "2024-06-15T18:15:00")

    resp = await client.get(
        f"/api/v1/babies/{baby_id}/calendar/day?date=2024-06-15"
    )
    data = resp.json()
    assert len(data) == 3
    assert all(e["event_type"] == "feed" for e in data)
    # Verify sorted order
    assert data[0]["timestamp"] < data[1]["timestamp"] < data[2]["timestamp"]
