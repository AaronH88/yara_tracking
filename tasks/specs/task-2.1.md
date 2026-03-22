# Task 2.1 — Feed Pause/Resume Endpoints

## Phase
2

## Description
Create two new endpoints in `routers/feeds.py`:

`POST /api/v1/babies/{baby_id}/feeds/{feed_id}/pause`
- 404 if feed not found or belongs to different baby
- 409 with message "Feed is already paused" if is_paused=true
- 409 with message "Feed is already ended" if ended_at is not null
- Sets is_paused=true, paused_at=now()
- Returns updated FeedEventResponse

`POST /api/v1/babies/{baby_id}/feeds/{feed_id}/resume`
- 404 if feed not found or belongs to different baby
- 409 with message "Feed is not paused" if is_paused=false
- 409 with message "Feed is already ended" if ended_at is not null
- Calculates pause duration: `pause_duration = now() - paused_at`
- Adds pause_duration seconds to paused_seconds
- Sets is_paused=false, paused_at=null
- Returns updated FeedEventResponse

## Acceptance Criteria
- Pause endpoint sets correct fields
- Resume endpoint calculates and stores correct paused_seconds
- All 409 edge cases return correct error messages
- Endpoints are registered in main.py router
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
