# Task 3.2 — Feed Timer Quick Switch Breast

## Phase
3

## Description
Update `components/timers/FeedTimer.jsx`:

- When active feed type is `breast_left` or `breast_right`: show "→ Right" or "→ Left" button
- On tap:
  1. PATCH current feed with `ended_at=now()`
  2. POST new feed with opposite type and `started_at=now()`
  3. Update localStorage `lastBreastUsed_{babyId}` to new breast
  4. Update local active feed state to new feed
- Button not shown for bottle or breast_both or when timer is paused

## Acceptance Criteria
- Switch button only visible for breast_left and breast_right
- Button label shows destination breast
- Two clean API calls made in sequence
- localStorage last-used updates correctly
- Timer resets to 0 for new breast immediately
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
frontend
