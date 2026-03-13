# Task 3.2 — useActiveEvents Hook

## Phase
3

## Description
In `hooks/useActiveEvents.js`:

```js
// useActiveEvents(babyId) → { activeFeed, activeSleep, refetch }
// Polls GET /babies/{babyId}/feeds/active and /sleeps/active every 10 seconds
// Returns null for each if none active
// Calls refetch() can force immediate refresh
```

## Acceptance Criteria
Returns active events. Polling updates state. Both parents' views sync within ~10 seconds.

## Verify Scope
both
