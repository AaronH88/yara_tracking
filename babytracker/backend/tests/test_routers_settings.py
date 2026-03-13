"""Tests for Task 1.10 — Settings router endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app
from models import Setting
from routers.settings import seed_settings


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
async def seeded_client(db_session, client):
    """Client with default settings already seeded."""
    await seed_settings(db_session)
    return client


# --- GET /settings ---


@pytest.mark.anyio
async def test_get_settings_returns_empty_when_no_settings(client):
    """GET /settings returns empty object when no settings exist."""
    resp = await client.get("/api/v1/settings")
    assert resp.status_code == 200
    assert resp.json() == {}


@pytest.mark.anyio
async def test_get_settings_returns_seeded_defaults(seeded_client):
    """GET /settings returns default values after seeding."""
    resp = await seeded_client.get("/api/v1/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["units"] == "imperial"
    assert data["time_format"] == "24h"


@pytest.mark.anyio
async def test_get_settings_returns_flat_json_object(seeded_client):
    """GET /settings returns a flat key-value JSON object, not a list."""
    resp = await seeded_client.get("/api/v1/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    # Should have exactly the two default keys
    assert set(data.keys()) == {"units", "time_format"}


# --- seed_settings ---


@pytest.mark.anyio
async def test_seed_settings_creates_defaults(db_session):
    """seed_settings inserts default settings when none exist."""
    await seed_settings(db_session)
    units = await db_session.get(Setting, "units")
    time_format = await db_session.get(Setting, "time_format")
    assert units is not None
    assert units.value == "imperial"
    assert time_format is not None
    assert time_format.value == "24h"


@pytest.mark.anyio
async def test_seed_settings_does_not_overwrite_existing(db_session):
    """seed_settings does not overwrite values that already exist."""
    # Pre-set a custom value
    db_session.add(Setting(key="units", value="metric"))
    await db_session.commit()

    await seed_settings(db_session)

    units = await db_session.get(Setting, "units")
    assert units.value == "metric"  # should NOT be overwritten to "imperial"


@pytest.mark.anyio
async def test_seed_settings_is_idempotent(db_session):
    """Calling seed_settings twice does not create duplicate rows."""
    await seed_settings(db_session)
    await seed_settings(db_session)

    from sqlalchemy import select
    result = await db_session.execute(select(Setting))
    all_settings = result.scalars().all()
    keys = [s.key for s in all_settings]
    assert keys.count("units") == 1
    assert keys.count("time_format") == 1


# --- PATCH /settings ---


@pytest.mark.anyio
async def test_patch_settings_updates_existing_key(seeded_client):
    """PATCH /settings updates an existing setting value."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"units": "metric"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["units"] == "metric"
    # time_format should remain unchanged
    assert data["time_format"] == "24h"


@pytest.mark.anyio
async def test_patch_settings_updates_multiple_keys(seeded_client):
    """PATCH /settings can update multiple settings at once."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"units": "metric", "time_format": "12h"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["units"] == "metric"
    assert data["time_format"] == "12h"


@pytest.mark.anyio
async def test_patch_settings_creates_new_key(seeded_client):
    """PATCH /settings creates a new setting if key doesn't exist."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"theme": "dark"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "dark"
    # Original defaults still present
    assert data["units"] == "imperial"
    assert data["time_format"] == "24h"


@pytest.mark.anyio
async def test_patch_settings_returns_all_settings(seeded_client):
    """PATCH /settings returns the full settings dict, not just updated keys."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"units": "metric"}
    )
    assert resp.status_code == 200
    data = resp.json()
    # Must return ALL settings, not just the one we changed
    assert "time_format" in data
    assert "units" in data


@pytest.mark.anyio
async def test_patch_settings_persists_changes(seeded_client):
    """Changes from PATCH /settings persist and are returned by subsequent GET."""
    await seeded_client.patch(
        "/api/v1/settings", json={"units": "metric"}
    )
    resp = await seeded_client.get("/api/v1/settings")
    assert resp.status_code == 200
    assert resp.json()["units"] == "metric"


@pytest.mark.anyio
async def test_patch_settings_with_empty_body(seeded_client):
    """PATCH /settings with empty object makes no changes."""
    resp = await seeded_client.patch("/api/v1/settings", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["units"] == "imperial"
    assert data["time_format"] == "24h"


@pytest.mark.anyio
async def test_patch_settings_rejects_non_json_body(seeded_client):
    """PATCH /settings with non-JSON body returns 422."""
    resp = await seeded_client.patch(
        "/api/v1/settings",
        content=b"not json",
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_patch_settings_overwrites_same_key_twice(seeded_client):
    """Setting the same key twice via sequential PATCHes keeps the latest value."""
    await seeded_client.patch(
        "/api/v1/settings", json={"units": "metric"}
    )
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"units": "imperial"}
    )
    assert resp.status_code == 200
    assert resp.json()["units"] == "imperial"


@pytest.mark.anyio
async def test_patch_settings_rejects_non_dict_body(seeded_client):
    """PATCH /settings with a JSON array instead of object returns 422."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json=["units", "metric"]
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_get_settings_method_not_allowed_for_post(client):
    """POST /settings is not a valid method and should return 405."""
    resp = await client.post("/api/v1/settings", json={"units": "metric"})
    assert resp.status_code == 405


@pytest.mark.anyio
async def test_get_settings_method_not_allowed_for_delete(client):
    """DELETE /settings is not a valid method and should return 405."""
    resp = await client.delete("/api/v1/settings")
    assert resp.status_code == 405


@pytest.mark.anyio
async def test_patch_settings_empty_string_value(seeded_client):
    """PATCH /settings allows setting a value to an empty string."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"units": ""}
    )
    assert resp.status_code == 200
    assert resp.json()["units"] == ""


@pytest.mark.anyio
async def test_seed_settings_fills_missing_key_only(db_session):
    """seed_settings adds only missing defaults, preserving existing ones."""
    # Only add one of the two defaults
    db_session.add(Setting(key="units", value="metric"))
    await db_session.commit()

    await seed_settings(db_session)

    units = await db_session.get(Setting, "units")
    time_format = await db_session.get(Setting, "time_format")
    assert units.value == "metric"  # preserved
    assert time_format is not None
    assert time_format.value == "24h"  # filled in


@pytest.mark.anyio
async def test_patch_settings_does_not_remove_unmentioned_keys(seeded_client):
    """PATCH only updates provided keys; unmentioned keys remain intact."""
    resp = await seeded_client.patch(
        "/api/v1/settings", json={"units": "metric"}
    )
    data = resp.json()
    assert "time_format" in data
    assert data["time_format"] == "24h"
