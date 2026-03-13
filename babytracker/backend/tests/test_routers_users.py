"""Tests for Task 1.5 — Users router endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app
from models import User, Baby, FeedEvent

from datetime import datetime


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


# --- GET /api/v1/users ---


@pytest.mark.anyio
async def test_list_users_returns_empty_list(client):
    """GET /users should return an empty list when no users exist."""
    response = await client.get("/api/v1/users")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_users_returns_all_users(client):
    """GET /users should return all created users."""
    await client.post("/api/v1/users", json={"name": "Mom"})
    await client.post("/api/v1/users", json={"name": "Dad"})

    response = await client.get("/api/v1/users")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = {u["name"] for u in data}
    assert names == {"Mom", "Dad"}


# --- POST /api/v1/users ---


@pytest.mark.anyio
async def test_create_user_returns_201(client):
    """POST /users should return 201 and the created user."""
    response = await client.post("/api/v1/users", json={"name": "Grandma"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Grandma"
    assert "id" in data
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_user_missing_name_returns_422(client):
    """POST /users without name should return 422."""
    response = await client.post("/api/v1/users", json={})
    assert response.status_code == 422


@pytest.mark.anyio
async def test_create_user_duplicate_name_returns_409(client):
    """POST /users with duplicate name should return 409."""
    await client.post("/api/v1/users", json={"name": "Mom"})
    response = await client.post("/api/v1/users", json={"name": "Mom"})
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_create_user_duplicate_name_case_sensitive(client):
    """Duplicate name check should be case-sensitive (Mom != mom)."""
    await client.post("/api/v1/users", json={"name": "Mom"})
    response = await client.post("/api/v1/users", json={"name": "mom"})
    # Different case should succeed (SQLite default is case-sensitive for =)
    assert response.status_code == 201


# --- PATCH /api/v1/users/{id} ---


@pytest.mark.anyio
async def test_update_user_changes_name(client):
    """PATCH /users/{id} should update the user's name."""
    create_resp = await client.post("/api/v1/users", json={"name": "Dad"})
    user_id = create_resp.json()["id"]

    response = await client.patch(f"/api/v1/users/{user_id}", json={"name": "Papa"})
    assert response.status_code == 200
    assert response.json()["name"] == "Papa"


@pytest.mark.anyio
async def test_update_user_returns_404_for_nonexistent_id(client):
    """PATCH /users/{id} should return 404 when user doesn't exist."""
    response = await client.patch("/api/v1/users/9999", json={"name": "Nobody"})
    assert response.status_code == 404


@pytest.mark.anyio
async def test_update_user_with_empty_body_returns_unchanged(client):
    """PATCH /users/{id} with empty body should return user unchanged."""
    create_resp = await client.post("/api/v1/users", json={"name": "Nanny"})
    user_id = create_resp.json()["id"]

    response = await client.patch(f"/api/v1/users/{user_id}", json={})
    assert response.status_code == 200
    assert response.json()["name"] == "Nanny"


# --- DELETE /api/v1/users/{id} ---


@pytest.mark.anyio
async def test_delete_user_returns_204(client):
    """DELETE /users/{id} should return 204 when user has no events."""
    create_resp = await client.post("/api/v1/users", json={"name": "Temp"})
    user_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/users/{user_id}")
    assert response.status_code == 204

    # Verify user is gone
    get_resp = await client.get("/api/v1/users")
    assert all(u["id"] != user_id for u in get_resp.json())


@pytest.mark.anyio
async def test_delete_user_returns_404_for_nonexistent_id(client):
    """DELETE /users/{id} should return 404 when user doesn't exist."""
    response = await client.delete("/api/v1/users/9999")
    assert response.status_code == 404


@pytest.mark.anyio
async def test_delete_user_with_events_returns_409(client, db_session):
    """DELETE /users/{id} should return 409 when user has logged events."""
    # Create user and baby via API
    user_resp = await client.post("/api/v1/users", json={"name": "Caregiver"})
    user_id = user_resp.json()["id"]

    baby_resp = await client.post(
        "/api/v1/babies", json={"name": "Baby", "birthdate": "2024-01-01"}
    )
    baby_id = baby_resp.json()["id"]

    # Insert a feed event directly in the DB to link the user
    event = FeedEvent(
        baby_id=baby_id,
        user_id=user_id,
        type="bottle",
        started_at=datetime(2024, 6, 1, 12, 0, 0),
    )
    db_session.add(event)
    await db_session.commit()

    response = await client.delete(f"/api/v1/users/{user_id}")
    assert response.status_code == 409
    assert "cannot be deleted" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_delete_user_with_events_preserves_user(client, db_session):
    """DELETE /users/{id} returning 409 should NOT delete the user."""
    user_resp = await client.post("/api/v1/users", json={"name": "Keeper"})
    user_id = user_resp.json()["id"]

    baby_resp = await client.post(
        "/api/v1/babies", json={"name": "Kiddo", "birthdate": "2024-01-01"}
    )
    baby_id = baby_resp.json()["id"]

    event = FeedEvent(
        baby_id=baby_id,
        user_id=user_id,
        type="breast",
        started_at=datetime(2024, 6, 1, 12, 0, 0),
    )
    db_session.add(event)
    await db_session.commit()

    await client.delete(f"/api/v1/users/{user_id}")

    # User should still exist
    users_resp = await client.get("/api/v1/users")
    user_ids = [u["id"] for u in users_resp.json()]
    assert user_id in user_ids


# --- Response shape ---


@pytest.mark.anyio
async def test_user_response_contains_created_at(client):
    """User response should include a created_at timestamp."""
    create_resp = await client.post("/api/v1/users", json={"name": "Auntie"})
    data = create_resp.json()
    assert "created_at" in data
