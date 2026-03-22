# Task 2.5 — Insights Endpoint

## Phase
2

## Description
Create new endpoint in a new file `routers/insights.py`:

`GET /api/v1/babies/{baby_id}/insights`

All date calculations use the baby's timezone (use UTC, assume UTC throughout).
"Today" = midnight UTC to now UTC.
"Last night" = 8pm UTC yesterday to 8am UTC today.
"7-day average" = total over last 7 days / 7.

Calculate and return:
```json
{
  "has_enough_data": true,
  "feeds": {
    "count_since_midnight": 6,
    "average_per_day_this_week": 11.4
  },
  "sleep": {
    "total_last_24h_minutes": 847,
    "average_per_day_7day_minutes": 912,
    "nap_count_today": 3,
    "longest_night_stretch_minutes": 185
  },
  "nappies": {
    "wet_count_today": 4,
    "average_wet_per_day_7day": 6.2,
    "days_since_dirty": 0
  },
  "alerts": []
}
```

`has_enough_data` is false if the baby has fewer than 2 days of any logged events.

Alert logic (add to alerts array when condition met, max 3 alerts):
- `{"type": "warning", "message": "Fewer wet nappies than usual today"}` — if wet_count_today < 70% of average AND hour >= 16
- `{"type": "warning", "message": "More frequent feeds than usual today"}` — if count_since_midnight > 130% of average AND it's past noon
- `{"type": "warning", "message": "No dirty nappy in 2+ days"}` — if days_since_dirty >= 2
- `{"type": "info", "message": "Great sleep stretch last night! 🎉"}` — if longest_night_stretch_minutes >= 240

Register router in `main.py` with prefix `/api/v1`.

## Acceptance Criteria
- All insight values calculate correctly against known test data
- has_enough_data=false when fewer than 2 days of data
- Each alert fires only under its stated condition
- Maximum 3 alerts returned
- Empty alerts array when no conditions met
- Each calculation has its own unit test
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
