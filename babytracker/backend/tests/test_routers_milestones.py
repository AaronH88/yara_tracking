"""Tests for Task 1.8 — Milestones router endpoints."""

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


def _milestone_payload(user_id, **overrides):
    base = {
        "user_id": user_id,
        "occurred_at": "2024-06-15",
        "title": "First smile",
    }
    base.update(overrides)
    return base


# --- POST /api/v1/babies/{baby_id}/milestones ---


@pytest.mark.anyio
async def test_create_milestone_returns_201(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = _milestone_payload(user_id)
    resp = await client.post(f"/api/v1/babies/{baby_id}/milestones", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["baby_id"] == baby_id
    assert data["user_id"] == user_id
    assert data["title"] == "First smile"
    assert data["occurred_at"] == "2024-06-15"
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_milestone_with_notes(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = _milestone_payload(user_id, notes="so sweet!")
    resp = await client.post(f"/api/v1/babies/{baby_id}/milestones", json=payload)
    assert resp.status_code == 201
    assert resp.json()["notes"] == "so sweet!"


@pytest.mark.anyio
async def test_create_milestone_missing_title_returns_422(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = {"user_id": user_id, "occurred_at": "2024-06-15"}
    resp = await client.post(f"/api/v1/babies/{baby_id}/milestones", json=payload)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_milestone_missing_occurred_at_returns_422(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    payload = {"user_id": user_id, "title": "First word"}
    resp = await client.post(f"/api/v1/babies/{baby_id}/milestones", json=payload)
    assert resp.status_code == 422


# --- GET /api/v1/babies/{baby_id}/milestones ---


@pytest.mark.anyio
async def test_list_milestones_empty(client, seed_baby_and_user):
    baby_id, _ = seed_baby_and_user
    resp = await client.get(f"/api/v1/babies/{baby_id}/milestones")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_list_milestones_returns_created(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    await client.post(f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id))
    await client.post(
        f"/api/v1/babies/{baby_id}/milestones",
        json=_milestone_payload(user_id, title="First laugh"),
    )
    resp = await client.get(f"/api/v1/babies/{baby_id}/milestones")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_list_milestones_limit(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    for i in range(5):
        await client.post(
            f"/api/v1/babies/{baby_id}/milestones",
            json=_milestone_payload(user_id, title=f"Milestone {i}"),
        )
    resp = await client.get(f"/api/v1/babies/{baby_id}/milestones", params={"limit": 3})
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.anyio
async def test_list_milestones_ordered_desc(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    await client.post(
        f"/api/v1/babies/{baby_id}/milestones",
        json=_milestone_payload(user_id, occurred_at="2024-03-01"),
    )
    await client.post(
        f"/api/v1/babies/{baby_id}/milestones",
        json=_milestone_payload(user_id, occurred_at="2024-09-01"),
    )
    resp = await client.get(f"/api/v1/babies/{baby_id}/milestones")
    data = resp.json()
    assert data[0]["occurred_at"] >= data[1]["occurred_at"]


@pytest.mark.anyio
async def test_list_milestones_scoped_to_baby(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    await client.post(f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id))
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.get(f"/api/v1/babies/{baby2_id}/milestones")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


# --- PATCH /api/v1/babies/{baby_id}/milestones/{milestone_id} ---


@pytest.mark.anyio
async def test_update_milestone_returns_updated_fields(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id)
    )
    m_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/milestones/{m_id}",
        json={"title": "First word", "notes": "said mama"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "First word"
    assert data["notes"] == "said mama"


@pytest.mark.anyio
async def test_update_milestone_partial_preserves_other_fields(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/milestones",
        json=_milestone_payload(user_id, notes="initial"),
    )
    m_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/milestones/{m_id}",
        json={"title": "Updated title"},
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "initial"


@pytest.mark.anyio
async def test_update_milestone_nonexistent_returns_404(client, seed_baby_and_user):
    baby_id, _ = seed_baby_and_user
    resp = await client.patch(
        f"/api/v1/babies/{baby_id}/milestones/9999",
        json={"title": "nope"},
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_milestone_wrong_baby_returns_404(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id)
    )
    m_id = create_resp.json()["id"]
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/babies/{baby2_id}/milestones/{m_id}",
        json={"title": "nope"},
    )
    assert resp.status_code == 404


# --- DELETE /api/v1/babies/{baby_id}/milestones/{milestone_id} ---


@pytest.mark.anyio
async def test_delete_milestone_returns_204(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id)
    )
    m_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/babies/{baby_id}/milestones/{m_id}")
    assert resp.status_code == 204


@pytest.mark.anyio
async def test_delete_milestone_actually_removes_record(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id)
    )
    m_id = create_resp.json()["id"]
    await client.delete(f"/api/v1/babies/{baby_id}/milestones/{m_id}")
    list_resp = await client.get(f"/api/v1/babies/{baby_id}/milestones")
    assert len(list_resp.json()) == 0


@pytest.mark.anyio
async def test_delete_milestone_nonexistent_returns_404(client, seed_baby_and_user):
    baby_id, _ = seed_baby_and_user
    resp = await client.delete(f"/api/v1/babies/{baby_id}/milestones/9999")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_milestone_wrong_baby_returns_404(client, seed_baby_and_user):
    baby_id, user_id = seed_baby_and_user
    create_resp = await client.post(
        f"/api/v1/babies/{baby_id}/milestones", json=_milestone_payload(user_id)
    )
    m_id = create_resp.json()["id"]
    baby2_resp = await client.post(
        "/api/v1/babies", json={"name": "OtherBaby", "birthdate": "2024-02-01"}
    )
    baby2_id = baby2_resp.json()["id"]
    resp = await client.delete(f"/api/v1/babies/{baby2_id}/milestones/{m_id}")
    assert resp.status_code == 404
