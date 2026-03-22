# Task 2.4 — Wake Window Endpoint

## Phase
2

## Description
Create new endpoint in a new file `routers/wake_window.py`:

`GET /api/v1/babies/{baby_id}/wake-window`

Logic:
1. Check for active sleep (SleepEvent where ended_at IS NULL for this baby)
   - If found: return `{ "is_sleeping": true, "awake_since": null, "awake_minutes": 0, "sleep_started_at": sleep.started_at }`
2. Find most recent ended SleepEvent for this baby (order by ended_at DESC, limit 1)
   - If found: `awake_since = sleep.ended_at`
   - If not found: `awake_since = baby.created_at`
3. Return:
```json
{
  "is_sleeping": false,
  "awake_since": "2026-03-22T14:30:00Z",
  "awake_minutes": 47,
  "sleep_started_at": null
}
```

Register router in `main.py` with prefix `/api/v1`.

## Acceptance Criteria
- Returns is_sleeping=true when active sleep exists
- Returns correct awake_since from last ended sleep
- Falls back to baby.created_at when no sleeps on record
- awake_minutes is correct integer
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
