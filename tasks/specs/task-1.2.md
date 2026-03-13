# Task 1.2 — Database Models

## Phase
1

## Description
In `backend/models.py`, implement all SQLAlchemy ORM models as specified in the architecture doc:

- `Baby`
- `User`
- `FeedEvent`
- `SleepEvent`
- `DiaperEvent`
- `PumpEvent`
- `Measurement`
- `Milestone`
- `Setting`

All `*_at` fields should use `DateTime` with `timezone=True`. Use `func.now()` for `created_at` defaults.

Add a `create_tables()` async function that creates all tables if they don't exist.

## Acceptance Criteria
`create_tables()` runs without error, tables are visible in SQLite.

## Verify Scope
backend
