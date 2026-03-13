"""Tests for Task 1.8 — Diaper Events router endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app


# --- Test DB setup ---

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


def _diaper_payload(user_id, **overrides):
    base = {
        "user_id": user_id,
        "logged_at": "2024-06-15T08:00:00",
        "type": "wet",
    }
    base.update(overrides)
    return base


# --- POST /api/v1/babies/{baby_id}/diapers ---


@pytest.mark.anyio
async def test_create_diaper_returns_201(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = _diaper_payload(user_id)
    resp = await client.post(f"/api/v1/babies/{baby_id}/diapers", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["baby_id"] == baby_id
    assert data["user_id"] == user_id
    assert data["type"] == "wet"
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_diaper_with_notes(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = _diaper_payload(user_id, notes="messy one")
    resp = await client.post(f"/api/v1/babies/{baby_id}/diapers", json=payload)
    assert resp.status_code == 201
    assert resp.json()["notes"] == "messy one"


@pytest.mark.anyio
async def test_create_diaper_missing_type_returns_422(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = {"user_id": user_id, "logged_at": "2024-06-15T08:00:00"}
    resp = await client.post(f"/api/v1/babies/{baby_id}/diapers", json=payload)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_diaper_missing_logged_at_returns_422(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = {"user_id": user_id, "type": "wet"}
    resp = await client.post(f"/api/v1/babies/{baby_id}/diapers", json=payload)
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/diapers ---


@pytest.mark.anyio
async def test_list_diapers_empty(client, seed_baby_and_user):
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/diapers")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_diapers_returns_created_events(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    await client.post(f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id, type="wet"))
    await client.post(f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id, type="dirty"))
    resp = await client.get(f"/api/v1/babies/{baby_id}/diapers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.anyio
async def test_list_diapers_date_filter(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, logged_at="2024-06-15T08:00:00"),
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, logged_at="2024-06-16T10:00:00"),
    )
    resp = await client.get(f"/api/v1/babies/{baby_id}/diapers", params={"date": "2024-06-15"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1


@pytest.mark.anyio
async def test_list_diapers_limit(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    for i in range(5):
        await client.post(f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id))
    resp = await client.get(f"/api/v1/babies/{baby_id}/diapers", params={"limit": 2})
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_diapers_ordered_desc(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, logged_at="2024-06-15T06:00:00"),
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, logged_at="2024-06-15T10:00:00"),
    )
    resp = await client.get(f"/api/v1/babies/{baby_id}/diapers")
    data = resp.json()
    assert data[0]["logged_at"] >= data[1]["logged_at"]


# --- PATCH /api/v1/babies/{baby_id}/diapers/{diaper_id} ---


@pytest.mark.anyio
async def test_update_diaper_returns_updated_fields(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id)
    )
    diaper_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/{diaper_id}",
        json={"type": "dirty", "notes": "updated"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "dirty"
    assert data["notes"] == "updated"


@pytest.mark.anyio
async def test_update_diaper_partial_update_preserves_other_fields(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers",
        json=_diaper_payload(user_id, notes="original"),
    )
    diaper_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/{diaper_id}",
        json={"type": "dirty"},
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "original"


@pytest.mark.anyio
async def test_update_diaper_nonexistent_returns_404(client, seed_baby_and_user):
    baby_id, _ = seed_baby_and_user
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/diapers/9999",
        json={"type": "dirty"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_diaper_wrong_baby_returns_404(client, seed_baby_and_user):
    """PATCH with a valid diaper_id but wrong baby_id should return 404."""
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id)
    )
    diaper_id = create_resp.json()["id"]
    # Create a second baby
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/babies/{baby2_id}/diapers/{diaper_id}",
        json={"type": "dirty"},
    )
    assert resp.status_code == 404


# --- DELETE /api/v1/babies/{baby_id}/diapers/{diaper_id} ---


@pytest.mark.anyio
async def test_delete_diaper_returns_204(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id)
    )
    diaper_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/babies/{baby_id}/diapers/{diaper_id}")
    assert resp.status_code == 204


@pytest.mark.anyio
async def test_delete_diaper_actually_removes_record(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id)
    )
    diaper_id = create_resp.json()["id"]
    await client.delete(f"/api/v1/babies/{baby_id}/diapers/{diaper_id}")
    list_resp = await client.get(f"/api/v1/babies/{baby_id}/diapers")
    assert len(list_resp.json()) == 0


@pytest.mark.anyio
async def test_delete_diaper_nonexistent_returns_404(client, seed_baby_and_user):
    baby_id, _ = seed_baby_and_user
    resp = await client.delete(f"/api/v1/babies/{baby_id}/diapers/9999")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_diaper_wrong_baby_returns_404(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/diapers", json=_diaper_payload(user_id)
    )
    diaper_id = create_resp.json()["id"]
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.delete(f"/api/v1/babies/{baby2_id}/diapers/{diaper_id}")
    assert resp.status_code == 404
