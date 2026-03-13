# Task 1.6 — Feed Events Router

## Phase
1

## Description
Implement `routers/feeds.py`:

- `GET /babies/{baby_id}/feeds` — list feeds, accept optional `?date=YYYY-MM-DD` filter and `?limit=50` (default 50, max 200). Order by `started_at DESC`.
- `POST /babies/{baby_id}/feeds` — create feed event. If `ended_at` is null, this is an active timer.
- `GET /babies/{baby_id}/feeds/active` — return the feed with `ended_at = null`, or `null` if none active. Only one active feed per baby allowed.
- `PATCH /babies/{baby_id}/feeds/{id}` — update any fields including `started_at`, `ended_at`, `amount_oz`, `amount_ml`, `notes`, `type`, `user_id`
- `DELETE /babies/{baby_id}/feeds/{id}` — delete feed

On `POST` when an active feed already exists for that baby, return 409: "A feed is already in progress for this baby.

## Acceptance Criteria
Can start a feed (POST with no ended_at), retrieve active feed, stop it (PATCH with ended_at), and retroactively create a completed feed (POST with both started_at and ended_at).

## Verify Scope
backend
