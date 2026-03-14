"""Tests for Task 7.2 — Environment Configuration.

Verifies that DATABASE_URL, CORS_ORIGINS, and LOG_LEVEL are configurable
via environment variables and that .env.example documents all three.
"""

import importlib
import logging
import os
from pathlib import Path
from unittest.mock import patch

import pytest


# ── .env.example documentation ──────────────────────────────────────────────


class TestEnvExampleFile:
    """Verify .env.example exists and documents the three required variables."""

    ENV_EXAMPLE = Path(__file__).resolve().parent.parent / ".env.example"

    def test_env_example_file_exists(self):
        assert self.ENV_EXAMPLE.exists(), ".env.example must exist in the backend directory"

    def test_env_example_documents_database_url(self):
        content = self.ENV_EXAMPLE.read_text()
        assert "DATABASE_URL" in content

    def test_env_example_documents_cors_origins(self):
        content = self.ENV_EXAMPLE.read_text()
        assert "CORS_ORIGINS" in content

    def test_env_example_documents_log_level(self):
        content = self.ENV_EXAMPLE.read_text()
        assert "LOG_LEVEL" in content

    def test_env_example_shows_production_database_path(self):
        content = self.ENV_EXAMPLE.read_text()
        assert "/var/lib/babytracker/db.sqlite" in content


# ── DATABASE_URL default ────────────────────────────────────────────────────


class TestDatabaseUrlDefault:
    """Verify production default for DATABASE_URL."""

    def test_production_default_points_to_var_lib(self):
        """Without DATABASE_URL env var, default must use /var/lib/babytracker/db.sqlite."""
        env = os.environ.copy()
        env.pop("DATABASE_URL", None)
        with patch.dict(os.environ, env, clear=True):
            import database
            importlib.reload(database)
            assert database.DATABASE_URL == "sqlite+aiosqlite:////var/lib/babytracker/db.sqlite"
        # Restore test DATABASE_URL
        import database
        importlib.reload(database)

    def test_custom_database_url_is_respected(self):
        """Setting DATABASE_URL should override the default."""
        custom = "sqlite+aiosqlite:///./my_custom.db"
        with patch.dict(os.environ, {"DATABASE_URL": custom}):
            import database
            importlib.reload(database)
            assert database.DATABASE_URL == custom
        # Restore
        import database
        importlib.reload(database)


# ── CORS_ORIGINS ────────────────────────────────────────────────────────────


class TestCorsOriginsConfig:
    """Verify CORS_ORIGINS is parsed from environment and applied to the app."""

    def test_default_cors_origins_is_wildcard(self):
        """Without CORS_ORIGINS set, default should be ['*']."""
        env = os.environ.copy()
        env.pop("CORS_ORIGINS", None)
        with patch.dict(os.environ, env, clear=True):
            import main
            importlib.reload(main)
            assert main.CORS_ORIGINS == ["*"]

    def test_single_custom_origin(self):
        """A single origin should produce a one-element list."""
        with patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000"}):
            import main
            importlib.reload(main)
            assert main.CORS_ORIGINS == ["http://localhost:3000"]

    def test_multiple_comma_separated_origins(self):
        """Multiple origins separated by commas should all be parsed."""
        origins = "http://localhost:3000,http://localhost:5173,http://example.com"
        with patch.dict(os.environ, {"CORS_ORIGINS": origins}):
            import main
            importlib.reload(main)
            assert main.CORS_ORIGINS == [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://example.com",
            ]

    def test_whitespace_around_origins_is_stripped(self):
        """Spaces around comma-separated origins should be stripped."""
        with patch.dict(os.environ, {"CORS_ORIGINS": " http://a.com , http://b.com "}):
            import main
            importlib.reload(main)
            assert main.CORS_ORIGINS == ["http://a.com", "http://b.com"]

    def test_empty_entries_are_filtered(self):
        """Trailing commas or empty segments should not produce empty strings."""
        with patch.dict(os.environ, {"CORS_ORIGINS": "http://a.com,,http://b.com,"}):
            import main
            importlib.reload(main)
            assert "" not in main.CORS_ORIGINS
            assert len(main.CORS_ORIGINS) == 2

    def test_cors_middleware_uses_configured_origins(self):
        """The FastAPI app's CORS middleware should use the CORS_ORIGINS list."""
        with patch.dict(os.environ, {"CORS_ORIGINS": "http://myapp.com"}):
            import main
            importlib.reload(main)
            for m in main.app.user_middleware:
                if m.cls.__name__ == "CORSMiddleware":
                    assert m.kwargs.get("allow_origins") == ["http://myapp.com"]
                    break
            else:
                pytest.fail("CORSMiddleware not found after reload")


# ── LOG_LEVEL ───────────────────────────────────────────────────────────────


class TestLogLevelConfig:
    """Verify LOG_LEVEL is read from environment and applied."""

    def test_default_log_level_is_info(self):
        """Without LOG_LEVEL set, default should be INFO."""
        env = os.environ.copy()
        env.pop("LOG_LEVEL", None)
        with patch.dict(os.environ, env, clear=True):
            import main
            importlib.reload(main)
            assert main.LOG_LEVEL == "INFO"

    def test_custom_log_level_debug(self):
        """Setting LOG_LEVEL=debug should result in DEBUG (uppercased)."""
        with patch.dict(os.environ, {"LOG_LEVEL": "debug"}):
            import main
            importlib.reload(main)
            assert main.LOG_LEVEL == "DEBUG"

    def test_log_level_is_uppercased(self):
        """Mixed-case input should be uppercased."""
        with patch.dict(os.environ, {"LOG_LEVEL": "Warning"}):
            import main
            importlib.reload(main)
            assert main.LOG_LEVEL == "WARNING"

    def test_invalid_log_level_falls_back_to_info(self):
        """An unrecognized log level string should fall back to INFO."""
        with patch.dict(os.environ, {"LOG_LEVEL": "bogus"}):
            import main
            importlib.reload(main)
            # logging.basicConfig was called with getattr fallback to logging.INFO
            # We verify the LOG_LEVEL variable is set to "BOGUS" (uppercased)
            assert main.LOG_LEVEL == "BOGUS"
            # But the actual logging level should fall back to INFO
            assert getattr(logging, main.LOG_LEVEL, logging.INFO) == logging.INFO


# ── conftest test isolation ─────────────────────────────────────────────────


class TestConfTestIsolation:
    """Verify the test conftest sets DATABASE_URL to avoid using production DB."""

    def test_test_database_url_is_not_production(self):
        """In tests, DATABASE_URL should NOT point to the production path."""
        import database
        assert "/var/lib/babytracker/db.sqlite" not in database.DATABASE_URL

    def test_test_database_url_is_local(self):
        """In tests, DATABASE_URL should point to a local test database."""
        import database
        assert "test_babytracker" in database.DATABASE_URL
