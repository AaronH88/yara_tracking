# Task 6.1 — Wake Window Component

## Phase
6

## Description
Create `components/WakeWindow.jsx`:

Fetches `GET /api/v1/babies/{baby_id}/wake-window` every 60 seconds.

**When sleeping:**
```
Sleeping 😴   1h 23m
```
Ticking up from sleep started_at.

**When awake:**
```
Awake for 47m  🟢
```
Ticking up from awake_since. Colour dot:
- 🟢 Green: within ideal range
- 🟡 Amber: within 15 min of alert threshold
- 🔴 Red: past alert threshold

Age-based threshold lookup (hardcoded constant in the component file):
```js
const WAKE_WINDOWS = [
  { maxWeeks: 2,  idealMin: 45,  idealMax: 60,  alertAt: 75  },
  { maxWeeks: 4,  idealMin: 60,  idealMax: 75,  alertAt: 90  },
  { maxWeeks: 8,  idealMin: 60,  idealMax: 90,  alertAt: 105 },
  { maxWeeks: 13, idealMin: 75,  idealMax: 120, alertAt: 135 },
  { maxWeeks: 17, idealMin: 90,  idealMax: 120, alertAt: 150 },
  { maxWeeks: 21, idealMin: 90,  idealMax: 150, alertAt: 180 },
  { maxWeeks: 26, idealMin: 120, idealMax: 180, alertAt: 210 },
  { maxWeeks: 39, idealMin: 150, idealMax: 210, alertAt: 240 },
  { maxWeeks: 999,idealMin: 180, idealMax: 240, alertAt: 270 },
]
```

Tap/hover on the dot shows a tooltip: "Ideal wake window for age: 75–120 min"

Add WakeWindow component to Dashboard, below the active timers section.

## Acceptance Criteria
- Displays "Sleeping" with correct duration when baby is asleep
- Displays "Awake for" with correct duration when awake
- Correct colour based on age and duration
- Tooltip shows correct ideal range for baby's age
- Updates every 60 seconds
- Age calculated correctly from baby birthdate
- Threshold lookup is a pure exported function with unit tests
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
both
