"""Tests for Task 1.1 — Database Setup.

Verifies that database.py exposes the correct engine, session factory,
Base declarative base, and get_db dependency — and that they behave
correctly under various conditions.
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)


# ── Module-level exports ─────────────────────────────────────────────────────

class TestDatabaseModuleExports:
    """Verify database.py exports the required objects."""

    def test_exports_engine(self):
        import database
        assert hasattr(database, "engine")

    def test_exports_async_session(self):
        import database
        assert hasattr(database, "async_session")

    def test_exports_base(self):
        import database
        assert hasattr(database, "Base")

    def test_exports_get_db(self):
        import database
        assert callable(database.get_db)

    def test_exports_database_url(self):
        import database
        assert hasattr(database, "DATABASE_URL")


# ── Engine configuration ─────────────────────────────────────────────────────

class TestEngineConfiguration:
    """Verify the engine is an async engine with correct defaults."""

    def test_engine_is_async_engine(self):
        import database
        assert isinstance(database.engine, AsyncEngine)

    def test_default_database_url_uses_sqlite(self):
        import database
        assert "sqlite" in database.DATABASE_URL

    def test_default_database_url_uses_aiosqlite(self):
        import database
        assert "aiosqlite" in database.DATABASE_URL

    def test_default_database_url_targets_babytracker_db(self):
        import database
        assert "babytracker.db" in database.DATABASE_URL


class TestDatabaseUrlFromEnvVar:
    """Verify DATABASE_URL env var is respected."""

    def test_env_var_overrides_default(self):
        """When DATABASE_URL is set, the module should use that value."""
        custom_url = "sqlite+aiosqlite:///./custom_test.db"
        with patch.dict(os.environ, {"DATABASE_URL": custom_url}):
            # Re-import the module to pick up the env var change
            import importlib
            import database
            importlib.reload(database)
            assert database.DATABASE_URL == custom_url
            # Restore the module to its original state
            del os.environ["DATABASE_URL"]
            importlib.reload(database)

    def test_missing_env_var_uses_default(self):
        """Without DATABASE_URL set, the default should be used."""
        env = os.environ.copy()
        env.pop("DATABASE_URL", None)
        with patch.dict(os.environ, env, clear=True):
            import importlib
            import database
            importlib.reload(database)
            assert database.DATABASE_URL == "sqlite+aiosqlite:///./babytracker.db"


# ── Session factory ──────────────────────────────────────────────────────────

class TestSessionFactory:
    """Verify async_session factory produces correct sessions."""

    def test_async_session_is_sessionmaker(self):
        import database
        assert isinstance(database.async_session, async_sessionmaker)

    @pytest.mark.asyncio
    async def test_session_factory_produces_async_session(self):
        import database
        async with database.async_session() as session:
            assert isinstance(session, AsyncSession)

    @pytest.mark.asyncio
    async def test_session_expire_on_commit_is_false(self):
        """Sessions should have expire_on_commit=False per the implementation."""
        import database
        async with database.async_session() as session:
            # expire_on_commit lives on the underlying sync session
            assert session.sync_session.expire_on_commit is False


# ── Base declarative base ────────────────────────────────────────────────────

class TestBase:
    """Verify Base is a proper declarative base for defining models."""

    def test_base_has_metadata(self):
        import database
        assert hasattr(database.Base, "metadata")

    def test_base_has_registry(self):
        import database
        assert hasattr(database.Base, "registry")

    def test_base_can_be_subclassed(self):
        """Models should be able to subclass Base without errors."""
        from sqlalchemy import Column, Integer, String
        import database

        # This should not raise
        class _TestModel(database.Base):
            __tablename__ = "_test_model_task_1_1"
            id = Column(Integer, primary_key=True)
            name = Column(String)


# ── get_db dependency ────────────────────────────────────────────────────────

class TestGetDb:
    """Verify get_db yields a usable session and cleans up."""

    @pytest.mark.asyncio
    async def test_get_db_yields_async_session(self):
        import database
        gen = database.get_db()
        session = await gen.__anext__()
        assert isinstance(session, AsyncSession)
        # Clean up the generator
        try:
            await gen.__anext__()
        except StopAsyncIteration:
            pass

    @pytest.mark.asyncio
    async def test_get_db_session_is_closed_after_iteration(self):
        """After the generator is exhausted, the session should be closed."""
        import database
        gen = database.get_db()
        session = await gen.__anext__()
        # Exhaust the generator (triggers cleanup)
        try:
            await gen.__anext__()
        except StopAsyncIteration:
            pass
        # After cleanup, the session should be closed
        assert session.is_active is False or not session.in_transaction()

    @pytest.mark.asyncio
    async def test_get_db_is_async_generator(self):
        """get_db must be an async generator (yields, not returns)."""
        import database
        import inspect
        assert inspect.isasyncgenfunction(database.get_db)

    @pytest.mark.asyncio
    async def test_get_db_can_execute_simple_query(self):
        """The session from get_db should be able to execute a basic SQL statement."""
        from sqlalchemy import text
        import database
        gen = database.get_db()
        session = await gen.__anext__()
        result = await session.execute(text("SELECT 1"))
        row = result.scalar()
        assert row == 1
        try:
            await gen.__anext__()
        except StopAsyncIteration:
            pass
