"""Tests for Task 1.8 — Pump Events router endpoints."""

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
async def seed_user(client):
    resp = await client.post("/api/v1/users", json={"name": "TestUser", "role": "parent"})
    return resp.json()["id"]


def _pump_payload(user_id, **overrides):
    base = {
        "user_id": user_id,
        "logged_at": "2024-06-15T09:00:00",
    }
    base.update(overrides)
    return base


# --- POST /api/v1/pumps ---


@pytest.mark.anyio
async def test_create_pump_returns_201(client, seed_user):
    payload = _pump_payload(seed_user, duration_minutes=15, left_oz=3.0, right_oz=2.5)
    resp = await client.post("/api/v1/pumps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == seed_user
    assert data["duration_minutes"] == 15
    assert data["left_oz"] == 3.0
    assert data["right_oz"] == 2.5
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_pump_minimal_payload(client, seed_user):
    """Pump with only required fields (user_id, logged_at)."""
    payload = _pump_payload(seed_user)
    resp = await client.post("/api/v1/pumps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["duration_minutes"] is None
    assert data["left_oz"] is None
    assert data["right_oz"] is None
    assert data["left_ml"] is None
    assert data["right_ml"] is None


@pytest.mark.anyio
async def test_create_pump_missing_user_id_returns_422(client):
    payload = {"logged_at": "2024-06-15T09:00:00"}
    resp = await client.post("/api/v1/pumps", json=payload)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_pump_missing_logged_at_returns_422(client, seed_user):
    payload = {"user_id": seed_user}
    resp = await client.post("/api/v1/pumps", json=payload)
    assert resp.status_code == 422


# --- GET /api/v1/pumps ---


@pytest.mark.anyio
async def test_list_pumps_empty(client):
    resp = await client.get("/api/v1/pumps")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_pumps_returns_created_events(client, seed_user):
    await client.post("/api/v1/pumps", json=_pump_payload(seed_user))
    await client.post("/api/v1/pumps", json=_pump_payload(seed_user))
    resp = await client.get("/api/v1/pumps")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_pumps_filter_by_user_id(client, seed_user):
    """Filtering by user_id only returns that user's pumps."""
    user2_resp = await client.post("/api/v1/users", json={"name": "User2", "role": "parent"})
    user2_id = user2_resp.json()["id"]
    await client.post("/api/v1/pumps", json=_pump_payload(seed_user))
    await client.post("/api/v1/pumps", json=_pump_payload(user2_id))
    resp = await client.get("/api/v1/pumps", params={"user_id": seed_user})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == seed_user


@pytest.mark.anyio
async def test_list_pumps_limit(client, seed_user):
    for _ in range(5):
        await client.post("/api/v1/pumps", json=_pump_payload(seed_user))
    resp = await client.get("/api/v1/pumps", params={"limit": 2})
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_pumps_ordered_desc(client, seed_user):
    await client.post("/api/v1/pumps", json=_pump_payload(seed_user, logged_at="2024-06-15T06:00:00"))
    await client.post("/api/v1/pumps", json=_pump_payload(seed_user, logged_at="2024-06-15T10:00:00"))
    resp = await client.get("/api/v1/pumps")
    data = resp.json()
    assert data[0]["logged_at"] >= data[1]["logged_at"]


# --- PATCH /api/v1/pumps/{pump_id} ---


@pytest.mark.anyio
async def test_update_pump_returns_updated_fields(client, seed_user):
    create_resp = await client.post("/api/v1/pumps", json=_pump_payload(seed_user, left_oz=2.0))
    pump_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/pumps/{pump_id}",
        json={"left_oz": 4.0, "notes": "updated"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["left_oz"] == 4.0
    assert data["notes"] == "updated"


@pytest.mark.anyio
async def test_update_pump_partial_preserves_other_fields(client, seed_user):
    create_resp = await client.post(
        "/api/v1/pumps", json=_pump_payload(seed_user, left_oz=2.0, notes="orig")
    )
    pump_id = create_resp.json()["id"]
    resp = await client.patch(f"/api/v1/pumps/{pump_id}", json={"left_oz": 5.0})
    assert resp.status_code == 200
    assert resp.json()["notes"] == "orig"


@pytest.mark.anyio
async def test_update_pump_nonexistent_returns_404(client):
    resp = await client.patch("/api/v1/pumps/9999", json={"notes": "nope"})
    assert resp.status_code == 404


# --- DELETE /api/v1/pumps/{pump_id} ---


@pytest.mark.anyio
async def test_delete_pump_returns_204(client, seed_user):
    create_resp = await client.post("/api/v1/pumps", json=_pump_payload(seed_user))
    pump_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/pumps/{pump_id}")
    assert resp.status_code == 204


@pytest.mark.anyio
async def test_delete_pump_actually_removes_record(client, seed_user):
    create_resp = await client.post("/api/v1/pumps", json=_pump_payload(seed_user))
    pump_id = create_resp.json()["id"]
    await client.delete(f"/api/v1/pumps/{pump_id}")
    list_resp = await client.get("/api/v1/pumps")
    assert len(list_resp.json()) == 0


@pytest.mark.anyio
async def test_delete_pump_nonexistent_returns_404(client):
    resp = await client.delete("/api/v1/pumps/9999")
    assert resp.status_code == 404


# --- Pump is NOT baby-scoped ---


@pytest.mark.anyio
async def test_pump_not_baby_scoped(client, seed_user):
    """Pumps belong to a user, not a baby — no baby_id in response."""
    payload = _pump_payload(seed_user)
    resp = await client.post("/api/v1/pumps", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "baby_id" not in data
