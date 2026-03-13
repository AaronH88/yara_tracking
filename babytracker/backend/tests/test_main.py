"""Tests for Task 1.4 — FastAPI App Entry Point."""

import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport

from main import app, FRONTEND_DIST, lifespan


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def async_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# --- App configuration tests ---


def test_app_title():
    """App should be titled 'Baby Tracker'."""
    assert app.title == "Baby Tracker"


def test_app_has_lifespan():
    """App should have a lifespan context manager configured."""
    # FastAPI wraps the lifespan in a merged context; verify it's not None
    assert app.router.lifespan_context is not None


def test_cors_middleware_is_registered():
    """CORS middleware allowing all origins should be present."""
    middleware_classes = [m.cls.__name__ for m in app.user_middleware]
    assert "CORSMiddleware" in middleware_classes


def test_cors_allows_all_origins():
    """CORS should allow all origins since Tailscale network is trusted."""
    for m in app.user_middleware:
        if m.cls.__name__ == "CORSMiddleware":
            assert m.kwargs.get("allow_origins") == ["*"]
            assert m.kwargs.get("allow_methods") == ["*"]
            assert m.kwargs.get("allow_headers") == ["*"]
            break
    else:
        pytest.fail("CORSMiddleware not found")


# --- Router registration tests ---


def test_all_routers_registered_under_api_v1():
    """All 10 routers must be included via include_router with /api/v1 prefix.

    Routers are currently empty stubs so we verify by reading main.py source
    to confirm each include_router call with the correct prefix.
    """
    import inspect
    import main

    source = inspect.getsource(main)
    expected_modules = [
        "babies", "users", "feeds", "sleeps", "diapers",
        "pumps", "measurements", "milestones", "calendar", "settings",
    ]
    for module in expected_modules:
        assert f"{module}.router" in source, f"{module}.router not included in main.py"
        assert 'prefix="/api/v1"' in source, "Routers should use /api/v1 prefix"


# --- Lifespan tests ---


@pytest.mark.anyio
async def test_lifespan_calls_create_tables():
    """Lifespan startup should call create_tables()."""
    with patch("main.create_tables", new_callable=AsyncMock) as mock_create:
        async with lifespan(app):
            mock_create.assert_awaited_once()


# --- SPA catch-all route tests ---


@pytest.mark.anyio
async def test_spa_catch_all_returns_index_html_when_frontend_exists(
    async_client, tmp_path
):
    """Non-API GET requests should serve index.html when frontend is built."""
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>SPA</body></html>")

    with patch("main.FRONTEND_DIST", tmp_path):
        response = await async_client.get("/some/client/route")
        assert response.status_code == 200
        assert "SPA" in response.text


@pytest.mark.anyio
async def test_spa_catch_all_returns_404_when_frontend_not_built(async_client):
    """Non-API GET requests should return 404 when frontend dist doesn't exist."""
    with patch("main.FRONTEND_DIST", Path("/nonexistent/path")):
        response = await async_client.get("/some/client/route")
        assert response.status_code == 404
        assert "Frontend not built yet" in response.json()["detail"]


@pytest.mark.anyio
async def test_spa_catch_all_returns_404_for_api_paths(async_client):
    """The catch-all should return 404 for unmatched /api/ paths, not serve SPA."""
    response = await async_client.get("/api/v1/nonexistent")
    assert response.status_code == 404
    assert response.json()["detail"] == "Not Found"


@pytest.mark.anyio
async def test_spa_catch_all_serves_root_path(async_client, tmp_path):
    """Root path (/) should serve index.html when frontend is built."""
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>Root</body></html>")

    with patch("main.FRONTEND_DIST", tmp_path):
        response = await async_client.get("/")
        assert response.status_code == 200
        assert "Root" in response.text


@pytest.mark.anyio
async def test_spa_catch_all_serves_nested_paths(async_client, tmp_path):
    """Deeply nested paths should also serve index.html for client-side routing."""
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>Nested</body></html>")

    with patch("main.FRONTEND_DIST", tmp_path):
        response = await async_client.get("/babies/1/feeds/new")
        assert response.status_code == 200
        assert "Nested" in response.text


@pytest.mark.anyio
async def test_api_prefix_without_v1_goes_to_spa(async_client, tmp_path):
    """Paths starting with /api but not /api/ should be caught by SPA (edge case)."""
    # The catch-all checks for "api/" prefix, so /apiother should serve SPA
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>SPA</body></html>")

    with patch("main.FRONTEND_DIST", tmp_path):
        response = await async_client.get("/apiother")
        assert response.status_code == 200
        assert "SPA" in response.text


# --- Static files mount tests ---


def test_static_files_mount_only_when_dist_exists():
    """Static files should only mount when FRONTEND_DIST exists.
    This is a structural check — the mount is conditional."""
    # The mount path "/static" should be in routes only if dist exists
    mount_names = [
        r.name for r in app.routes if hasattr(r, "name") and r.name == "static"
    ]
    if FRONTEND_DIST.exists():
        assert len(mount_names) == 1, "Static files should be mounted when dist exists"
    else:
        # In test environment, dist probably doesn't exist — no mount expected
        assert len(mount_names) == 0, "Static files should not be mounted when dist is missing"


# --- CORS preflight test ---


@pytest.mark.anyio
async def test_cors_preflight_request(async_client):
    """CORS preflight (OPTIONS) should return appropriate headers."""
    response = await async_client.options(
        "/api/v1/babies",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    # With allow_origins=["*"] and credentials=True, CORS echoes the origin
    assert response.headers.get("access-control-allow-origin") in ("*", "http://example.com")
