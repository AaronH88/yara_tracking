# Task 3.4 — Auto-Close Toast Notification

## Phase
3

## Description
Update `components/timers/FeedTimer.jsx` and `components/timers/SleepTimer.jsx`:

When the POST response for starting a new feed or sleep includes a non-empty
`auto_closed` array, show a brief toast notification.

Create a simple `Toast` component in `components/Toast.jsx`:
- Appears at top of screen for 3 seconds then fades out
- Message: "Sleep timer automatically stopped" or "Feed timer automatically stopped"
- Dismissable by tap
- Does not block interaction

## Acceptance Criteria
- Toast appears when auto_closed is non-empty
- Correct message for the type of timer that was closed
- Toast disappears after 3 seconds without interaction
- Toast is tappable to dismiss early
- No toast when auto_closed is empty
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
frontend
