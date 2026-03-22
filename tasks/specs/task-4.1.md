# Task 4.1 — Burp Timer Component and Dashboard Integration

## Phase
4

## Description
Create `components/timers/BurpTimer.jsx` following the same pattern as
`SleepTimer.jsx`:

- When no active burp: show "Start Burp" button
- When active: show ticking timer and "Done" button
- Done tap: PATCH with ended_at=now(), optional notes modal
- Uses same `useTimer` hook as other timers

Update `useActiveEvents.js` hook to also fetch active burp:
- Add `GET /babies/{id}/burps/active` to the polling calls
- Return `activeBurp` alongside `activeFeed` and `activeSleep`

Update `pages/Dashboard.jsx`:
- Add BurpTimer to the quick actions / active timers section
- Active burp timer shows below feed and sleep timers
- Add "Burp" to the quick actions grid

Create `components/forms/BurpForm.jsx` for editing burp events (same
pattern as SleepForm).

Update `pages/History.jsx` to include burp events in the event list.

## Acceptance Criteria
- Burp timer starts, ticks, and stops correctly
- Active burp visible on dashboard
- Burp appears in history with duration
- Burp does not interact with feed/sleep auto-close logic
- useActiveEvents returns activeBurp
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
both
