# Task 3.4 — Sleep Timer Component

## Phase
3

## Description
Implement `components/timers/SleepTimer.jsx`:

**When no active sleep:**
- Two large buttons: "Nap" and "Night Sleep"
- Tapping starts sleep (POST with type, started_at = now, user_id)

**When active sleep:**
- Shows sleep type
- Shows `ActiveTimer` ticking
- Shows "Wake Up" button → PATCH with `ended_at = now()` → optional notes modal

## Acceptance Criteria
Same pattern as feed timer.

## Verify Scope
both
