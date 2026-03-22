# Task 2.2 — Auto-Close Conflicting Timers

## Phase
2

## Description
Add a shared helper function in a new file `babytracker/backend/timer_helpers.py`:

```python
async def close_active_timers(baby_id: int, db: AsyncSession, exclude_model=None) -> list[dict]:
```

This function:
- Queries for any FeedEvent with ended_at IS NULL for this baby_id
- Queries for any SleepEvent with ended_at IS NULL for this baby_id
- Skips the model type passed as `exclude_model` (so creating a feed skips closing feeds)
- Sets ended_at=now() on any found active events
- Returns a list of dicts describing what was closed:
  `[{"type": "sleep", "id": 5, "started_at": "..."}]`

Update `POST /api/v1/babies/{baby_id}/feeds` to:
- Call `close_active_timers(baby_id, db, exclude_model=FeedEvent)` before creating
- Include `auto_closed` list in the response

Update `POST /api/v1/babies/{baby_id}/sleeps` to:
- Call `close_active_timers(baby_id, db, exclude_model=SleepEvent)` before creating
- Include `auto_closed` list in the response

Burp creation does NOT call this helper.

## Acceptance Criteria
- Starting a feed while a sleep is active: sleep gets ended_at=now()
- Starting a sleep while a feed is active: feed gets ended_at=now()
- Starting a feed while a feed is active: previous feed gets ended_at=now()
- auto_closed list in response is accurate
- No conflict with burp timers
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
