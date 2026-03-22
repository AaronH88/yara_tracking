"""Tests for Task 2.5 — Insights endpoint."""

from datetime import datetime, timedelta, timezone
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


# Fixed "now" for deterministic tests: 2024-06-15 at 17:00 UTC (after 4pm for alert checks)
FAKE_NOW = datetime(2024, 6, 15, 17, 0, 0, tzinfo=timezone.utc)


def _patch_now(fake_now=FAKE_NOW):
    """Patch datetime.now in the insights router to return a fixed time."""
    return patch("routers.insights.datetime", wraps=datetime, **{
        "now.return_value": fake_now,
    })


async def _seed_spread_data(client, baby_id, user_id):
    """Seed data spanning 10 days so has_enough_data=True for all event types.

    Assumes FAKE_NOW = 2024-06-15 17:00 UTC.
    Creates feeds, sleeps, and diapers from June 5 through June 15.
    """
    # Feeds: 8 per day for 7 days (June 5-11), plus 6 today
    for day_offset in range(4, 11):  # June 5 through June 11
        day = datetime(2024, 6, day_offset, 6, 0, 0, tzinfo=timezone.utc)
        for hour in range(8):
            await client.post(
                f"/api/v1/babies/{baby_id}/feeds",
                json={
                    "user_id": user_id,
                    "type": "breast_left",
                    "started_at": (day + timedelta(hours=hour * 2)).isoformat(),
                    "ended_at": (day + timedelta(hours=hour * 2, minutes=20)).isoformat(),
                },
            )
    # 6 feeds today (June 15)
    for hour in range(6):
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={
                "user_id": user_id,
                "type": "breast_left",
                "started_at": datetime(2024, 6, 15, hour * 2 + 1, 0, 0).isoformat(),
                "ended_at": datetime(2024, 6, 15, hour * 2 + 1, 20, 0).isoformat(),
            },
        )

    # Sleeps spanning 10 days
    for day_offset in range(4, 11):
        day = datetime(2024, 6, day_offset, tzinfo=timezone.utc)
        # Night sleep each day: 8pm to 6am next day
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={
                "user_id": user_id,
                "type": "night",
                "started_at": (day + timedelta(hours=20)).isoformat(),
                "ended_at": (day + timedelta(hours=30)).isoformat(),
            },
        )

    # One nap today
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={
            "user_id": user_id,
            "type": "nap",
            "started_at": "2024-06-15T12:00:00",
            "ended_at": "2024-06-15T13:30:00",
        },
    )

    # Diapers spanning 10 days
    for day_offset in range(4, 11):
        day = datetime(2024, 6, day_offset, tzinfo=timezone.utc)
        for i in range(6):
            dtype = "wet" if i < 4 else "dirty"
            await client.post(
                f"/api/v1/babies/{baby_id}/diapers",
                json={
                    "user_id": user_id,
                    "type": dtype,
                    "logged_at": (day + timedelta(hours=i * 3 + 6)).isoformat(),
                },
            )
    # 4 wet + 1 dirty today
    for i in range(4):
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={
                "user_id": user_id,
                "type": "wet",
                "logged_at": datetime(2024, 6, 15, i * 3 + 2, 0, 0).isoformat(),
            },
        )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={
            "user_id": user_id,
            "type": "dirty",
            "logged_at": "2024-06-15T10:00:00",
        },
    )


# ===== Response shape =====


@pytest.mark.anyio
async def test_insights_response_has_all_required_fields(client, seed_baby_and_user):
    """Response should contain all required top-level fields."""
    baby_id, _ = seed_baby_and_user
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) == {"has_enough_data", "feeds", "sleep", "nappies", "alerts"}
    assert set(data["feeds"].keys()) == {"count_since_midnight", "average_per_day_this_week"}
    assert set(data["sleep"].keys()) == {
        "total_last_24h_minutes", "average_per_day_7day_minutes",
        "nap_count_today", "longest_night_stretch_minutes",
    }
    assert set(data["nappies"].keys()) == {"wet_count_today", "average_wet_per_day_7day", "days_since_dirty"}


# ===== has_enough_data =====


@pytest.mark.anyio
async def test_has_enough_data_false_when_no_events(client, seed_baby_and_user):
    """has_enough_data should be false when there are no events at all."""
    baby_id, _ = seed_baby_and_user
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.status_code == 200
    assert resp.json()["has_enough_data"] is False


@pytest.mark.anyio
async def test_has_enough_data_false_with_only_one_day_of_events(client, seed_baby_and_user):
    """has_enough_data should be false when events span less than 2 days."""
    baby_id, user_id = seed_baby_and_user
    # All events on the same day
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle", "started_at": "2024-06-15T10:00:00",
              "ended_at": "2024-06-15T10:20:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": "2024-06-15T12:00:00",
              "ended_at": "2024-06-15T13:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T11:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["has_enough_data"] is False


@pytest.mark.anyio
async def test_has_enough_data_false_when_only_feeds_span_2_days(client, seed_baby_and_user):
    """has_enough_data requires ALL event types to span 2+ days, not just one."""
    baby_id, user_id = seed_baby_and_user
    # Feeds span 3 days but sleeps and diapers are single-day
    for d in range(3):
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": f"2024-06-{13+d}T10:00:00",
                  "ended_at": f"2024-06-{13+d}T10:20:00"},
        )
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap", "started_at": "2024-06-15T12:00:00",
              "ended_at": "2024-06-15T13:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T11:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["has_enough_data"] is False


@pytest.mark.anyio
async def test_has_enough_data_true_when_all_types_span_2_days(client, seed_baby_and_user):
    """has_enough_data should be true when all event types span 2+ days."""
    baby_id, user_id = seed_baby_and_user
    await _seed_spread_data(client, baby_id, user_id)
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["has_enough_data"] is True


# ===== Feed insights =====


@pytest.mark.anyio
async def test_feed_count_since_midnight_counts_only_today(client, seed_baby_and_user):
    """count_since_midnight should only count feeds started today."""
    baby_id, user_id = seed_baby_and_user
    # Feed yesterday
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle", "started_at": "2024-06-14T22:00:00",
              "ended_at": "2024-06-14T22:20:00"},
    )
    # 3 feeds today
    for h in [1, 8, 14]:
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": f"2024-06-15T{h:02d}:00:00",
                  "ended_at": f"2024-06-15T{h:02d}:20:00"},
        )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["feeds"]["count_since_midnight"] == 3


@pytest.mark.anyio
async def test_feed_average_per_day_this_week_calculation(client, seed_baby_and_user):
    """average_per_day_this_week should be total feeds over 7 days / 7."""
    baby_id, user_id = seed_baby_and_user
    # 14 feeds spread across 7 days before today (2 per day)
    for day_offset in range(1, 8):
        day = datetime(2024, 6, 15, tzinfo=timezone.utc) - timedelta(days=day_offset)
        for h in [9, 15]:
            await client.post(
                f"/api/v1/babies/{baby_id}/feeds",
                json={
                    "user_id": user_id, "type": "bottle",
                    "started_at": (day + timedelta(hours=h)).isoformat(),
                    "ended_at": (day + timedelta(hours=h, minutes=20)).isoformat(),
                },
            )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["feeds"]["average_per_day_this_week"] == 2.0


@pytest.mark.anyio
async def test_feed_count_zero_when_no_feeds_today(client, seed_baby_and_user):
    """count_since_midnight should be 0 when there are no feeds today."""
    baby_id, _ = seed_baby_and_user
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["feeds"]["count_since_midnight"] == 0
    assert resp.json()["feeds"]["average_per_day_this_week"] == 0.0


# ===== Sleep insights =====


@pytest.mark.anyio
async def test_sleep_total_last_24h_minutes_calculated_correctly(client, seed_baby_and_user):
    """total_last_24h_minutes should sum sleep durations in the last 24h window."""
    baby_id, user_id = seed_baby_and_user
    # Sleep from 2024-06-14 20:00 to 2024-06-15 06:00 (10h=600min within 24h window)
    # 24h window: June 14 17:00 to June 15 17:00
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T20:00:00",
              "ended_at": "2024-06-15T06:00:00"},
    )
    # Nap today 12:00-13:30 (90min)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap",
              "started_at": "2024-06-15T12:00:00",
              "ended_at": "2024-06-15T13:30:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    data = resp.json()["sleep"]
    # Night: 10h = 600min, Nap: 90min => total 690min
    assert data["total_last_24h_minutes"] == 690


@pytest.mark.anyio
async def test_sleep_clamps_to_24h_window(client, seed_baby_and_user):
    """Sleep that started before the 24h window should be clamped."""
    baby_id, user_id = seed_baby_and_user
    # Sleep from June 14 10:00 to June 14 20:00 (10h total, but only 3h in 24h window)
    # 24h window starts at June 14 17:00
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T10:00:00",
              "ended_at": "2024-06-14T20:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    # Only 3h (17:00-20:00) = 180 min should count
    assert resp.json()["sleep"]["total_last_24h_minutes"] == 180


@pytest.mark.anyio
async def test_sleep_nap_count_today(client, seed_baby_and_user):
    """nap_count_today should count sleeps that started after midnight today."""
    baby_id, user_id = seed_baby_and_user
    # Nap yesterday (should not count)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap",
              "started_at": "2024-06-14T13:00:00",
              "ended_at": "2024-06-14T14:00:00"},
    )
    # Two naps today
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap",
              "started_at": "2024-06-15T10:00:00",
              "ended_at": "2024-06-15T11:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "nap",
              "started_at": "2024-06-15T14:00:00",
              "ended_at": "2024-06-15T15:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["sleep"]["nap_count_today"] == 2


@pytest.mark.anyio
async def test_sleep_longest_night_stretch_picks_longest(client, seed_baby_and_user):
    """longest_night_stretch_minutes should pick the longest sleep in the night window."""
    baby_id, user_id = seed_baby_and_user
    # Night window: 8pm June 14 to 8am June 15
    # Short stretch: 8pm-11pm (180 min)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T20:00:00",
              "ended_at": "2024-06-14T23:00:00"},
    )
    # Long stretch: 11:30pm-6am (390 min)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T23:30:00",
              "ended_at": "2024-06-15T06:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["sleep"]["longest_night_stretch_minutes"] == 390


@pytest.mark.anyio
async def test_sleep_night_stretch_clamped_to_night_window(client, seed_baby_and_user):
    """Night stretch should be clamped to the 8pm-8am window."""
    baby_id, user_id = seed_baby_and_user
    # Sleep from 6pm to 10am — should be clamped to 8pm-8am = 720 min
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T18:00:00",
              "ended_at": "2024-06-15T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["sleep"]["longest_night_stretch_minutes"] == 720


@pytest.mark.anyio
async def test_sleep_zero_when_no_sleep_events(client, seed_baby_and_user):
    """All sleep insights should be zero when there are no sleep events."""
    baby_id, _ = seed_baby_and_user
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    sleep = resp.json()["sleep"]
    assert sleep["total_last_24h_minutes"] == 0
    assert sleep["average_per_day_7day_minutes"] == 0
    assert sleep["nap_count_today"] == 0
    assert sleep["longest_night_stretch_minutes"] == 0


# ===== Nappy insights =====


@pytest.mark.anyio
async def test_nappy_wet_count_today_includes_wet_and_both(client, seed_baby_and_user):
    """wet_count_today should count 'wet' and 'both' type diapers today."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T08:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "both", "logged_at": "2024-06-15T12:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-15T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["nappies"]["wet_count_today"] == 2


@pytest.mark.anyio
async def test_nappy_wet_count_excludes_yesterday(client, seed_baby_and_user):
    """wet_count_today should not include diapers from yesterday."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-14T23:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["nappies"]["wet_count_today"] == 0


@pytest.mark.anyio
async def test_nappy_days_since_dirty_zero_when_dirty_today(client, seed_baby_and_user):
    """days_since_dirty should be 0 when there's a dirty diaper today."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-15T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["nappies"]["days_since_dirty"] == 0


@pytest.mark.anyio
async def test_nappy_days_since_dirty_counts_correctly(client, seed_baby_and_user):
    """days_since_dirty should count days since last dirty/both diaper."""
    baby_id, user_id = seed_baby_and_user
    # Last dirty was 3 days ago
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-12T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["nappies"]["days_since_dirty"] == 3


@pytest.mark.anyio
async def test_nappy_days_since_dirty_counts_both_type(client, seed_baby_and_user):
    """days_since_dirty should also consider 'both' type diapers."""
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "both", "logged_at": "2024-06-14T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["nappies"]["days_since_dirty"] == 1


@pytest.mark.anyio
async def test_nappy_days_since_dirty_large_when_no_dirty_ever(client, seed_baby_and_user):
    """days_since_dirty should be a large value when no dirty diapers exist."""
    baby_id, user_id = seed_baby_and_user
    # Only wet diapers
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["nappies"]["days_since_dirty"] >= 2  # Should trigger the alert


# ===== Alerts =====


@pytest.mark.anyio
async def test_alerts_empty_when_no_warning_conditions_met(client, seed_baby_and_user):
    """No warning alerts should fire when conditions are normal."""
    baby_id, user_id = seed_baby_and_user
    # Create spread data for has_enough_data, with balanced counts
    for d in range(10):
        day = datetime(2024, 6, 5 + d, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": (day + timedelta(hours=8)).isoformat(),
                  "ended_at": (day + timedelta(hours=8, minutes=20)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": (day + timedelta(hours=20)).isoformat(),
                  "ended_at": (day + timedelta(hours=22)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "wet",
                  "logged_at": (day + timedelta(hours=10)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "dirty",
                  "logged_at": (day + timedelta(hours=12)).isoformat()},
        )
    # 1 feed today (average ~1/day, so not > 130%), 1 wet today (average ~1/day, not < 70%)
    # dirty today => days_since_dirty=0, short night stretch => no sleep alert
    await client.post(
        f"/api/v1/babies/{baby_id}/feeds",
        json={"user_id": user_id, "type": "bottle",
              "started_at": "2024-06-15T08:00:00",
              "ended_at": "2024-06-15T08:20:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T09:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-15T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    assert len(alerts) == 0


@pytest.mark.anyio
async def test_alerts_empty_when_has_enough_data_false(client, seed_baby_and_user):
    """Alerts should not be generated when has_enough_data is false."""
    baby_id, user_id = seed_baby_and_user
    # Create conditions that would normally trigger alerts, but only 1 day of data
    # No dirty diapers (would trigger "no dirty nappy in 2+ days" if data was enough)
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    data = resp.json()
    assert data["has_enough_data"] is False
    assert data["alerts"] == []


@pytest.mark.anyio
async def test_alert_fewer_wet_nappies_fires_when_below_70_pct(client, seed_baby_and_user):
    """Fewer wet nappies alert fires when today's wet < 70% of average and hour >= 16."""
    baby_id, user_id = seed_baby_and_user
    # Need has_enough_data=True, so create spread data for all types
    # Feeds: spread across 10 days
    for d in range(10):
        day = datetime(2024, 6, 5 + d, 8, 0, 0, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": day.isoformat(),
                  "ended_at": (day + timedelta(minutes=20)).isoformat()},
        )
    # Sleeps: spread across 10 days
    for d in range(10):
        day = datetime(2024, 6, 5 + d, 20, 0, 0, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": day.isoformat(),
                  "ended_at": (day + timedelta(hours=2)).isoformat()},
        )
    # Diapers: 7 wet per day for past 7 days, but only 1 wet today
    for d in range(1, 8):
        day = datetime(2024, 6, 15, tzinfo=timezone.utc) - timedelta(days=d)
        for i in range(7):
            await client.post(
                f"/api/v1/babies/{baby_id}/diapers",
                json={"user_id": user_id, "type": "wet",
                      "logged_at": (day + timedelta(hours=i * 2 + 6)).isoformat()},
            )
    # Also need dirty diapers spanning days for has_enough_data
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-05T10:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-15T10:00:00"},
    )
    # Only 1 wet today (average is 7, 70% = 4.9, so 1 < 4.9 triggers)
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "wet", "logged_at": "2024-06-15T08:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    wet_alert = [a for a in alerts if "wet nappies" in a["message"]]
    assert len(wet_alert) == 1
    assert wet_alert[0]["type"] == "warning"


@pytest.mark.anyio
async def test_alert_fewer_wet_nappies_does_not_fire_before_4pm(client, seed_baby_and_user):
    """Fewer wet nappies alert should NOT fire before 4pm (hour < 16)."""
    baby_id, user_id = seed_baby_and_user
    await _seed_spread_data(client, baby_id, user_id)
    # Use 10am — before the 4pm threshold
    early_now = datetime(2024, 6, 15, 10, 0, 0, tzinfo=timezone.utc)
    with _patch_now(early_now):
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    wet_alert = [a for a in alerts if "wet nappies" in a["message"]]
    assert len(wet_alert) == 0


@pytest.mark.anyio
async def test_alert_more_frequent_feeds_fires_above_130_pct(client, seed_baby_and_user):
    """More frequent feeds alert fires when today's count > 130% of average after noon."""
    baby_id, user_id = seed_baby_and_user
    # Create spread data for all types (has_enough_data=True)
    for d in range(10):
        day = datetime(2024, 6, 5 + d, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": (day + timedelta(hours=20)).isoformat(),
                  "ended_at": (day + timedelta(hours=22)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "wet",
                  "logged_at": (day + timedelta(hours=10)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "dirty",
                  "logged_at": (day + timedelta(hours=12)).isoformat()},
        )
    # 3 feeds per day for past 7 days => average 3.0
    for d in range(1, 8):
        day = datetime(2024, 6, 15, tzinfo=timezone.utc) - timedelta(days=d)
        for h in [8, 12, 18]:
            await client.post(
                f"/api/v1/babies/{baby_id}/feeds",
                json={"user_id": user_id, "type": "bottle",
                      "started_at": (day + timedelta(hours=h)).isoformat(),
                      "ended_at": (day + timedelta(hours=h, minutes=20)).isoformat()},
            )
    # 5 feeds today (5 > 3 * 1.3 = 3.9)
    for h in [1, 5, 9, 12, 15]:
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": f"2024-06-15T{h:02d}:00:00",
                  "ended_at": f"2024-06-15T{h:02d}:20:00"},
        )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    feed_alert = [a for a in alerts if "frequent feeds" in a["message"]]
    assert len(feed_alert) == 1
    assert feed_alert[0]["type"] == "warning"


@pytest.mark.anyio
async def test_alert_more_frequent_feeds_does_not_fire_before_noon(client, seed_baby_and_user):
    """More frequent feeds alert should NOT fire before noon (hour < 12)."""
    baby_id, user_id = seed_baby_and_user
    await _seed_spread_data(client, baby_id, user_id)
    # Extra feeds today to exceed 130%
    for h in range(6, 11):
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": f"2024-06-15T{h:02d}:00:00",
                  "ended_at": f"2024-06-15T{h:02d}:20:00"},
        )
    morning_now = datetime(2024, 6, 15, 11, 0, 0, tzinfo=timezone.utc)
    with _patch_now(morning_now):
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    feed_alert = [a for a in alerts if "frequent feeds" in a["message"]]
    assert len(feed_alert) == 0


@pytest.mark.anyio
async def test_alert_no_dirty_nappy_fires_after_2_days(client, seed_baby_and_user):
    """No dirty nappy alert fires when days_since_dirty >= 2."""
    baby_id, user_id = seed_baby_and_user
    # Create spread data but last dirty was 3 days ago
    for d in range(10):
        day = datetime(2024, 6, 5 + d, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": (day + timedelta(hours=8)).isoformat(),
                  "ended_at": (day + timedelta(hours=8, minutes=20)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": (day + timedelta(hours=20)).isoformat(),
                  "ended_at": (day + timedelta(hours=22)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "wet",
                  "logged_at": (day + timedelta(hours=10)).isoformat()},
        )
    # Last dirty was 3 days ago
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-05T10:00:00"},
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json={"user_id": user_id, "type": "dirty", "logged_at": "2024-06-12T10:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    dirty_alert = [a for a in alerts if "dirty nappy" in a["message"]]
    assert len(dirty_alert) == 1
    assert dirty_alert[0]["type"] == "warning"


@pytest.mark.anyio
async def test_alert_great_sleep_stretch_fires_at_240_min(client, seed_baby_and_user):
    """Great sleep stretch alert fires when longest_night_stretch_minutes >= 240."""
    baby_id, user_id = seed_baby_and_user
    # Create spread data for has_enough_data
    for d in range(10):
        day = datetime(2024, 6, 5 + d, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": (day + timedelta(hours=8)).isoformat(),
                  "ended_at": (day + timedelta(hours=8, minutes=20)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": (day + timedelta(hours=20)).isoformat(),
                  "ended_at": (day + timedelta(hours=22)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "wet",
                  "logged_at": (day + timedelta(hours=10)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "dirty",
                  "logged_at": (day + timedelta(hours=12)).isoformat()},
        )
    # 5-hour night stretch (300 min >= 240 threshold)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T21:00:00",
              "ended_at": "2024-06-15T02:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    sleep_alert = [a for a in alerts if "sleep stretch" in a["message"]]
    assert len(sleep_alert) == 1
    assert sleep_alert[0]["type"] == "info"


@pytest.mark.anyio
async def test_alert_great_sleep_stretch_does_not_fire_under_240(client, seed_baby_and_user):
    """Great sleep stretch alert should NOT fire when stretch < 240 minutes."""
    baby_id, user_id = seed_baby_and_user
    for d in range(10):
        day = datetime(2024, 6, 5 + d, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": (day + timedelta(hours=8)).isoformat(),
                  "ended_at": (day + timedelta(hours=8, minutes=20)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": (day + timedelta(hours=20)).isoformat(),
                  "ended_at": (day + timedelta(hours=22)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "wet",
                  "logged_at": (day + timedelta(hours=10)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "dirty",
                  "logged_at": (day + timedelta(hours=12)).isoformat()},
        )
    # 3-hour night stretch (180 min < 240 threshold)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T22:00:00",
              "ended_at": "2024-06-15T01:00:00"},
    )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    sleep_alert = [a for a in alerts if "sleep stretch" in a["message"]]
    assert len(sleep_alert) == 0


@pytest.mark.anyio
async def test_alerts_max_three(client, seed_baby_and_user):
    """At most 3 alerts should be returned, even if 4 conditions are met."""
    baby_id, user_id = seed_baby_and_user
    # Create minimal spread data for has_enough_data
    for d in range(10):
        day = datetime(2024, 6, 5 + d, tzinfo=timezone.utc)
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": (day + timedelta(hours=8)).isoformat(),
                  "ended_at": (day + timedelta(hours=8, minutes=20)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "night",
                  "started_at": (day + timedelta(hours=20)).isoformat(),
                  "ended_at": (day + timedelta(hours=22)).isoformat()},
        )
        await client.post(
            f"/api/v1/babies/{baby_id}/diapers",
            json={"user_id": user_id, "type": "wet",
                  "logged_at": (day + timedelta(hours=10)).isoformat()},
        )

    # Trigger 1: Fewer wet nappies (0 today vs average ~1.4, hour >= 16)
    # Already 0 wet today, average > 0 from seed data

    # Trigger 2: More frequent feeds (many feeds today vs average ~1)
    for h in range(0, 16, 2):
        await client.post(
            f"/api/v1/babies/{baby_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": f"2024-06-15T{h:02d}:00:00",
                  "ended_at": f"2024-06-15T{h:02d}:20:00"},
        )

    # Trigger 3: No dirty nappy in 2+ days (never had any dirty)
    # (no dirty diapers seeded)

    # Trigger 4: Great sleep stretch (5h night stretch)
    await client.post(
        f"/api/v1/babies/{baby_id}/sleeps",
        json={"user_id": user_id, "type": "night",
              "started_at": "2024-06-14T21:00:00",
              "ended_at": "2024-06-15T02:00:00"},
    )

    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    alerts = resp.json()["alerts"]
    assert len(alerts) <= 3


# ===== Cross-baby isolation =====


@pytest.mark.anyio
async def test_insights_scoped_to_specific_baby(client, seed_baby_and_user):
    """Insights for baby A should not include events from baby B."""
    baby_id, user_id = seed_baby_and_user
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby2", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]

    # Create feeds only for baby 2
    for h in range(5):
        await client.post(
            f"/api/v1/babies/{baby2_id}/feeds",
            json={"user_id": user_id, "type": "bottle",
                  "started_at": f"2024-06-15T{h+1:02d}:00:00",
                  "ended_at": f"2024-06-15T{h+1:02d}:20:00"},
        )

    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    # Baby 1 should have 0 feeds
    assert resp.json()["feeds"]["count_since_midnight"] == 0


# ===== 7-day average sleep =====


@pytest.mark.anyio
async def test_sleep_7day_average_calculation(client, seed_baby_and_user):
    """average_per_day_7day_minutes = total 7-day sleep / 7, rounded."""
    baby_id, user_id = seed_baby_and_user
    # 2 hours of sleep per day for 7 days = 14h total = 840 min / 7 = 120 min/day
    for d in range(1, 8):
        day = datetime(2024, 6, 15, tzinfo=timezone.utc) - timedelta(days=d)
        await client.post(
            f"/api/v1/babies/{baby_id}/sleeps",
            json={"user_id": user_id, "type": "nap",
                  "started_at": (day + timedelta(hours=13)).isoformat(),
                  "ended_at": (day + timedelta(hours=15)).isoformat()},
        )
    with _patch_now():
        resp = await client.get(f"/api/v1/babies/{baby_id}/insights")
    assert resp.json()["sleep"]["average_per_day_7day_minutes"] == 120
