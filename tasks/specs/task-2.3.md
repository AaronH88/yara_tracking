# Task 2.3 — Burp Timer Router

## Phase
2

## Description
Create `babytracker/backend/routers/burps.py` with full CRUD:

```
GET    /api/v1/babies/{baby_id}/burps          list, ?date=, ?limit=50
POST   /api/v1/babies/{baby_id}/burps          create (start timer or log complete)
GET    /api/v1/babies/{baby_id}/burps/active   returns active burp or null
PATCH  /api/v1/babies/{baby_id}/burps/{id}     update/stop
DELETE /api/v1/babies/{baby_id}/burps/{id}     delete
```

Follow exact same patterns as `routers/sleeps.py`.
Only one active burp per baby (ended_at IS NULL) allowed — return 409 if
a second is started while one is active.

Register the router in `main.py` with prefix `/api/v1`.

## Acceptance Criteria
- All 5 endpoints work correctly
- 409 returned if second active burp started
- Active burp endpoint returns null when none active
- Router registered and accessible
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
