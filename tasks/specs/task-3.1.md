# Task 3.1 — useTimer Hook

## Phase
3

## Description
In `hooks/useTimer.js`:

```js
// useTimer(startedAt: ISO string | null) → { elapsed: string, isRunning: bool }
// elapsed format: "1h 23m" or "45m" or "2h 04m 32s" (seconds shown when < 2 min)
// Updates every second when isRunning
// Returns isRunning: false and elapsed: null when startedAt is null
```

Use `setInterval` in `useEffect`, clean up on unmount. Calculate elapsed from `startedAt` to `Date.now()` each tick.

## Acceptance Criteria
Hook ticks every second. Correct elapsed format. Cleans up interval on unmount.

## Verify Scope
frontend
