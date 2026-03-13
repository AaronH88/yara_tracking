"""Tests for Task 1.5 — Babies router endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from database import Base, get_db
from main import app
from models import Baby


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


# --- GET /api/v1/babies ---


@pytest.mark.anyio
async def test_list_babies_returns_empty_list(client):
    """GET /babies should return an empty list when no babies exist."""
    response = await client.get("/api/v1/babies")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_list_babies_returns_all_babies(client):
    """GET /babies should return all babies that have been created."""
    await client.post("/api/v1/babies", json={"name": "Alice", "birthdate": "2024-01-15"})
    await client.post("/api/v1/babies", json={"name": "Bob", "birthdate": "2024-06-20"})

    response = await client.get("/api/v1/babies")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = {b["name"] for b in data}
    assert names == {"Alice", "Bob"}


# --- POST /api/v1/babies ---


@pytest.mark.anyio
async def test_create_baby_returns_201_with_all_fields(client):
    """POST /babies with all fields should return 201 and the created baby."""
    payload = {"name": "Charlie", "birthdate": "2024-03-10", "gender": "male"}
    response = await client.post("/api/v1/babies", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Charlie"
    assert data["birthdate"] == "2024-03-10"
    assert data["gender"] == "male"
    assert "id" in data
    assert data["id"] is not None


@pytest.mark.anyio
async def test_create_baby_without_gender_defaults_to_null(client):
    """POST /babies without gender should create baby with gender=null."""
    payload = {"name": "Dana", "birthdate": "2024-05-01"}
    response = await client.post("/api/v1/babies", json=payload)
    assert response.status_code == 201
    assert response.json()["gender"] is None


@pytest.mark.anyio
async def test_create_baby_missing_name_returns_422(client):
    """POST /babies without name should return 422 validation error."""
    response = await client.post("/api/v1/babies", json={"birthdate": "2024-01-01"})
    assert response.status_code == 422


@pytest.mark.anyio
async def test_create_baby_missing_birthdate_returns_422(client):
    """POST /babies without birthdate should return 422 validation error."""
    response = await client.post("/api/v1/babies", json={"name": "Eve"})
    assert response.status_code == 422


@pytest.mark.anyio
async def test_create_baby_empty_body_returns_422(client):
    """POST /babies with empty body should return 422."""
    response = await client.post("/api/v1/babies", json={})
    assert response.status_code == 422


# --- GET /api/v1/babies/{id} ---


@pytest.mark.anyio
async def test_get_baby_returns_correct_baby(client):
    """GET /babies/{id} should return the baby with that id."""
    create_resp = await client.post(
        "/api/v1/babies", json={"name": "Finn", "birthdate": "2024-02-14"}
    )
    baby_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/babies/{baby_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Finn"
    assert response.json()["id"] == baby_id


@pytest.mark.anyio
async def test_get_baby_returns_404_for_nonexistent_id(client):
    """GET /babies/{id} should return 404 when baby doesn't exist."""
    response = await client.get("/api/v1/babies/9999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# --- PATCH /api/v1/babies/{id} ---


@pytest.mark.anyio
async def test_update_baby_changes_name(client):
    """PATCH /babies/{id} should update the specified fields."""
    create_resp = await client.post(
        "/api/v1/babies", json={"name": "Grace", "birthdate": "2024-04-01"}
    )
    baby_id = create_resp.json()["id"]

    response = await client.patch(f"/api/v1/babies/{baby_id}", json={"name": "Gracie"})
    assert response.status_code == 200
    assert response.json()["name"] == "Gracie"
    # birthdate should remain unchanged
    assert response.json()["birthdate"] == "2024-04-01"


@pytest.mark.anyio
async def test_update_baby_partial_update_preserves_other_fields(client):
    """PATCH /babies/{id} with only gender should not change name or birthdate."""
    create_resp = await client.post(
        "/api/v1/babies",
        json={"name": "Hank", "birthdate": "2024-07-15", "gender": "male"},
    )
    baby_id = create_resp.json()["id"]

    response = await client.patch(f"/api/v1/babies/{baby_id}", json={"gender": "other"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Hank"
    assert data["birthdate"] == "2024-07-15"
    assert data["gender"] == "other"


@pytest.mark.anyio
async def test_update_baby_returns_404_for_nonexistent_id(client):
    """PATCH /babies/{id} should return 404 when baby doesn't exist."""
    response = await client.patch("/api/v1/babies/9999", json={"name": "Nobody"})
    assert response.status_code == 404


@pytest.mark.anyio
async def test_update_baby_with_empty_body_returns_baby_unchanged(client):
    """PATCH /babies/{id} with empty body should return baby without changes."""
    create_resp = await client.post(
        "/api/v1/babies", json={"name": "Ivy", "birthdate": "2024-08-01"}
    )
    baby_id = create_resp.json()["id"]

    response = await client.patch(f"/api/v1/babies/{baby_id}", json={})
    assert response.status_code == 200
    assert response.json()["name"] == "Ivy"


# --- Response shape ---


@pytest.mark.anyio
async def test_baby_response_contains_created_at(client):
    """Baby response should include a created_at timestamp."""
    create_resp = await client.post(
        "/api/v1/babies", json={"name": "Jack", "birthdate": "2024-09-01"}
    )
    data = create_resp.json()
    assert "created_at" in data
