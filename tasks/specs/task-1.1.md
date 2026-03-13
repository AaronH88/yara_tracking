# Task 1.1 — Database Setup

## Phase
1

## Description
In `backend/database.py`:

- Create async SQLAlchemy engine pointing to `DATABASE_URL` env var (default: `sqlite+aiosqlite:///./babytracker.db`)
- Create `AsyncSession` factory
- Create `Base` declarative base
- Create `get_db()` async dependency for FastAPI

## Acceptance Criteria
`database.py` imports cleanly, engine connects to SQLite.

## Verify Scope
backend
