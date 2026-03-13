# Task 1.3 — Pydantic Schemas

## Phase
1

## Description
In `backend/schemas.py`, create Pydantic v2 schemas for each model:

For each resource, create:
- `{Resource}Create` — fields required on creation
- `{Resource}Update` — all fields optional (for PATCH)
- `{Resource}Response` — full response shape including `id` and timestamps

`FeedEventCreate` must accept an optional `started_at` and `ended_at` to support retroactive entries. If `started_at` is not provided, default to `datetime.utcnow()`.

`SleepEventCreate` same pattern as above.

## Acceptance Criteria
All schemas importable, Pydantic validation works for required fields.

## Verify Scope
backend
