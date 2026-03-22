# Task 3.1 — Feed Timer Pause/Resume UI

## Phase
3

## Description
Update `components/timers/FeedTimer.jsx` and `components/timers/ActiveTimer.jsx`:

**ActiveTimer.jsx:**
- Accept new props: `pausedSeconds`, `isPaused`, `pausedAt`
- Elapsed calculation: `(now - startedAt) - pausedSeconds` when running
- When paused: freeze display at `(pausedAt - startedAt) - pausedSeconds`
- Show "PAUSED" badge on timer when isPaused=true

**FeedTimer.jsx:**
- When active feed is running: show three buttons — "⏸ Pause", "⏹ Stop", and (if breast) "Switch →"
- When active feed is paused: show "▶ Resume" and "⏹ Stop" (no Switch when paused)
- Pause button calls `POST /feeds/{id}/pause`, updates local state
- Resume button calls `POST /feeds/{id}/resume`, updates local state
- Update `useActiveEvents` hook to return `paused_seconds`, `is_paused`, `paused_at` fields

## Acceptance Criteria
- Pause freezes timer display at correct elapsed
- Resume continues from correct elapsed
- "PAUSED" badge visible when paused
- Switch button hidden when paused
- Both phones see paused state within 10s polling
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
frontend
