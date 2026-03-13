# Task 1.9 — Calendar Router

## Phase
1

## Description
Implement `routers/calendar.py`:

**`GET /babies/{baby_id}/calendar/month?year=YYYY&month=MM`**

Returns a dict keyed by date string `"YYYY-MM-DD"`, where each value is:
```json
{
  "date": "2024-03-15",
  "feed_count": 7,
  "sleep_count": 4,
  "diaper_count": 6,
  "has_milestone": false
}
```
Only include dates that have at least one event.

**`GET /babies/{baby_id}/calendar/day?date=YYYY-MM-DD`**

Returns all events for the day as a unified list, sorted by their primary timestamp (`started_at` for feeds/sleeps, `logged_at` for diapers, etc.), each with a `event_type` field (`'feed'`, `'sleep'`, `'diaper'`, `'milestone'`).

## Acceptance Criteria
Month endpoint returns correct counts. Day endpoint returns all event types sorted by time.

## Verify Scope
backend
