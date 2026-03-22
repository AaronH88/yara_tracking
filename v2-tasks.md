# Baby Tracker v2 — Task Document

## Overview

This document breaks the v2 feature spec into discrete implementable tasks
for the agentic build loop. Read `docs/v2-feature-spec.md` for full context
on each feature before implementing any task.

All tasks assume the existing app is working. No existing functionality
should break. Run the full test suite after every task.

---

## Phase 1 — Database Migrations

### Task 1.1 — Migrate FeedEvent Table

Add new columns to the existing FeedEvent table without losing any data.

Write a migration function `migrate_feed_event_v2(engine)` in a new file
`babytracker/backend/migrations.py`:
- `ALTER TABLE feededent ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0`
- `ALTER TABLE feededent ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT false`
- `ALTER TABLE feededent ADD COLUMN paused_at DATETIME`
- `ALTER TABLE feededent ADD COLUMN quality TEXT`

Each ALTER must be wrapped in a try/except that ignores
`OperationalError: duplicate column name` so the migration is idempotent.

Call `migrate_feed_event_v2` from the `lifespan` startup function in
`main.py` before `create_tables()`.

Update the `FeedEvent` SQLAlchemy model to include all four new columns.
Update `FeedEventCreate`, `FeedEventUpdate`, and `FeedEventResponse`
Pydantic schemas to include the new fields (all optional, all nullable).

**Acceptance criteria:**
- Migration runs without error on a database that already has a FeedEvent table
- Migration is idempotent — running it twice does not error
- Existing feed records are unaffected (all new columns default to null/0/false)
- All four new columns present in the model and schemas
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

### Task 1.2 — Migrate DiaperEvent Table and Create BurpEvent Table

**Part A — DiaperEvent migration:**

Add to `migrations.py` a new function `migrate_diaper_event_v2(engine)`:
- `ALTER TABLE diaperevent ADD COLUMN wet_amount TEXT`
- `ALTER TABLE diaperevent ADD COLUMN dirty_colour TEXT`

Same idempotent pattern as Task 1.1. Call from lifespan startup.

Update `DiaperEvent` model and schemas to include both new optional fields.

**Part B — BurpEvent new table:**

Add `BurpEvent` model to `models.py`:
```
id          INTEGER PRIMARY KEY
baby_id     INTEGER FK → Baby NOT NULL
user_id     INTEGER FK → User
started_at  DATETIME NOT NULL
ended_at    DATETIME
notes       TEXT
created_at  DATETIME default now
```

Create `BurpEventCreate`, `BurpEventUpdate`, `BurpEventResponse` schemas
in `schemas.py`.

`create_tables()` already handles new tables — no migration needed for BurpEvent.

**Acceptance criteria:**
- DiaperEvent migration is idempotent
- Existing diaper records are unaffected
- BurpEvent table is created on startup
- All new model columns and schema fields present and correct
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

## Phase 2 — Backend: New and Updated Endpoints

### Task 2.1 — Feed Pause/Resume Endpoints

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

**Acceptance criteria:**
- Pause endpoint sets correct fields
- Resume endpoint calculates and stores correct paused_seconds
- All 409 edge cases return correct error messages
- Endpoints are registered in main.py router
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

### Task 2.2 — Auto-Close Conflicting Timers

Add a shared helper function in a new file `babytracker/backend/timer_helpers.py`:

```python
async def close_active_timers(baby_id: int, db: AsyncSession, exclude_model=None) -> list[dict]:
```

This function:
- Queries for any FeedEvent with ended_at IS NULL for this baby_id
- Queries for any SleepEvent with ended_at IS NULL for this baby_id
- Skips the model type passed as `exclude_model` (so creating a feed skips closing feeds)
- Sets ended_at=now() on any found active events
- Returns a list of dicts describing what was closed:
  `[{"type": "sleep", "id": 5, "started_at": "..."}]`

Update `POST /api/v1/babies/{baby_id}/feeds` to:
- Call `close_active_timers(baby_id, db, exclude_model=FeedEvent)` before creating
- Include `auto_closed` list in the response

Update `POST /api/v1/babies/{baby_id}/sleeps` to:
- Call `close_active_timers(baby_id, db, exclude_model=SleepEvent)` before creating
- Include `auto_closed` list in the response

Burp creation does NOT call this helper.

**Acceptance criteria:**
- Starting a feed while a sleep is active: sleep gets ended_at=now()
- Starting a sleep while a feed is active: feed gets ended_at=now()
- Starting a feed while a feed is active: previous feed gets ended_at=now()
- auto_closed list in response is accurate
- No conflict with burp timers
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

### Task 2.3 — Burp Timer Router

Create `babytracker/backend/routers/burps.py` with full CRUD:

```
GET    /api/v1/babies/{baby_id}/burps          list, ?date=, ?limit=50
POST   /api/v1/babies/{baby_id}/burps          create (start timer or log complete)
GET    /api/v1/babies/{baby_id}/burps/active   returns active burp or null
PATCH  /api/v1/babies/{baby_id}/burps/{id}     update/stop
DELETE /api/v1/babies/{baby_id}/burps/{id}     delete
```

Follow exact same patterns as `routers/sleeps.py`.
Only one active burp per baby (ended_at IS NULL) allowed — return 409 if
a second is started while one is active.

Register the router in `main.py` with prefix `/api/v1`.

**Acceptance criteria:**
- All 5 endpoints work correctly
- 409 returned if second active burp started
- Active burp endpoint returns null when none active
- Router registered and accessible
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

### Task 2.4 — Wake Window Endpoint

Create new endpoint in a new file `routers/wake_window.py`:

`GET /api/v1/babies/{baby_id}/wake-window`

Logic:
1. Check for active sleep (SleepEvent where ended_at IS NULL for this baby)
   - If found: return `{ "is_sleeping": true, "awake_since": null, "awake_minutes": 0, "sleep_started_at": sleep.started_at }`
2. Find most recent ended SleepEvent for this baby (order by ended_at DESC, limit 1)
   - If found: `awake_since = sleep.ended_at`
   - If not found: `awake_since = baby.created_at`
3. Return:
```json
{
  "is_sleeping": false,
  "awake_since": "2026-03-22T14:30:00Z",
  "awake_minutes": 47,
  "sleep_started_at": null
}
```

Register router in `main.py` with prefix `/api/v1`.

**Acceptance criteria:**
- Returns is_sleeping=true when active sleep exists
- Returns correct awake_since from last ended sleep
- Falls back to baby.created_at when no sleeps on record
- awake_minutes is correct integer
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

### Task 2.5 — Insights Endpoint

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

**Acceptance criteria:**
- All insight values calculate correctly against known test data
- has_enough_data=false when fewer than 2 days of data
- Each alert fires only under its stated condition
- Maximum 3 alerts returned
- Empty alerts array when no conditions met
- Each calculation has its own unit test
- `python -m pytest babytracker/backend/tests/ -v` passes

**verify_scope:** backend

---

## Phase 3 — Frontend: Feed Timer Updates

### Task 3.1 — Feed Timer Pause/Resume UI

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

**Acceptance criteria:**
- Pause freezes timer display at correct elapsed
- Resume continues from correct elapsed
- "PAUSED" badge visible when paused
- Switch button hidden when paused
- Both phones see paused state within 10s polling
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** frontend

---

### Task 3.2 — Feed Timer Quick Switch Breast

Update `components/timers/FeedTimer.jsx`:

- When active feed type is `breast_left` or `breast_right`: show "→ Right" or "→ Left" button
- On tap:
  1. PATCH current feed with `ended_at=now()`
  2. POST new feed with opposite type and `started_at=now()`
  3. Update localStorage `lastBreastUsed_{babyId}` to new breast
  4. Update local active feed state to new feed
- Button not shown for bottle or breast_both or when timer is paused

**Acceptance criteria:**
- Switch button only visible for breast_left and breast_right
- Button label shows destination breast
- Two clean API calls made in sequence
- localStorage last-used updates correctly
- Timer resets to 0 for new breast immediately
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** frontend

---

### Task 3.3 — Feed Quality Rating UI

Update the post-feed form (shown after tapping Stop in FeedTimer):

- Add "How did the feed go?" section below existing fields
- Three large buttons in a row:
  - 👍 Good
  - 😐 Okay  
  - 👎 Poor
- Tapping selects (highlighted with Tailwind ring), tapping again deselects
- Selected value included as `quality` in the PATCH request when saving
- Add `quality` field to `FeedForm.jsx` for editing existing feeds

Update history list rows to show quality icon when present (small, right-aligned).

**Acceptance criteria:**
- Quality selector renders in post-feed form
- Selection highlights correctly
- Quality saves to database via PATCH
- Null quality is valid (no selection = null)
- Quality icon appears in history rows when set
- Quality editable via feed edit form
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** frontend

---

### Task 3.4 — Auto-Close Toast Notification

Update `components/timers/FeedTimer.jsx` and `components/timers/SleepTimer.jsx`:

When the POST response for starting a new feed or sleep includes a non-empty
`auto_closed` array, show a brief toast notification.

Create a simple `Toast` component in `components/Toast.jsx`:
- Appears at top of screen for 3 seconds then fades out
- Message: "Sleep timer automatically stopped" or "Feed timer automatically stopped"
- Dismissable by tap
- Does not block interaction

**Acceptance criteria:**
- Toast appears when auto_closed is non-empty
- Correct message for the type of timer that was closed
- Toast disappears after 3 seconds without interaction
- Toast is tappable to dismiss early
- No toast when auto_closed is empty
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** frontend

---

## Phase 4 — Frontend: Burp Timer

### Task 4.1 — Burp Timer Component and Dashboard Integration

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

**Acceptance criteria:**
- Burp timer starts, ticks, and stops correctly
- Active burp visible on dashboard
- Burp appears in history with duration
- Burp does not interact with feed/sleep auto-close logic
- useActiveEvents returns activeBurp
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** both

---

## Phase 5 — Frontend: Nappy Updates

### Task 5.1 — Nappy Size and Colour Fields

Update `components/forms/DiaperForm.jsx`:

**Wet amount selector** (shown when type includes 'wet'):
- Three buttons: Small / Medium / Heavy
- Optional — null is valid

**Dirty colour selector** (shown when type includes 'dirty'):
- Four coloured circle buttons:
  - 🟡 Yellow
  - 🟢 Green
  - 🟤 Brown
  - ⚪ Other
- Optional — null is valid

Update `pages/Dashboard.jsx` quick-log nappy buttons:
- Keep existing one-tap Wet/Dirty/Both buttons unchanged
- After a one-tap log, show a small dismissable "Add details →" chip
- Tapping "Add details →" opens DiaperForm pre-filled with the just-logged event

Update history list nappy rows to show amount and colour labels when present.

**Acceptance criteria:**
- Existing one-tap quick log requires no extra taps
- "Add details" path works and pre-fills correctly
- wet_amount saves correctly for wet/both nappies
- dirty_colour saves correctly for dirty/both nappies
- Fields hidden when not relevant to nappy type
- History rows show amount/colour when set
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** frontend

---

## Phase 6 — Frontend: Wake Window Display

### Task 6.1 — Wake Window Component

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

**Acceptance criteria:**
- Displays "Sleeping" with correct duration when baby is asleep
- Displays "Awake for" with correct duration when awake
- Correct colour based on age and duration
- Tooltip shows correct ideal range for baby's age
- Updates every 60 seconds
- Age calculated correctly from baby birthdate
- Threshold lookup is a pure exported function with unit tests
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** both

---

## Phase 7 — Frontend: Dashboard Insights

### Task 7.1 — Insights Component

Create `components/Insights.jsx`:

Fetches `GET /api/v1/babies/{baby_id}/insights` on mount and every 5 minutes.
Shows a skeleton loader while fetching.
Does not render if `has_enough_data=false` (baby has less than 2 days of data).

Renders three cards and an alerts section:

**Feeds card:**
- "Feeds since midnight: 6"
- "This week avg: 11/day"

**Sleep card:**
- "Sleep last 24h: 14h 7m"
- "Naps today: 3"
- "Longest stretch last night: 3h 5m"

**Nappies card:**
- "Wet nappies today: 4 (avg: 6)"
- "Last dirty: today" (amber if 1 day ago, red if 2+ days)

**Alerts section** (only rendered when alerts.length > 0):
- Each alert as a chip with appropriate icon
- warning type: 🚨 amber chip
- info type: ℹ️ blue chip / 🎉 for positive

Add Insights component to the bottom of `pages/Dashboard.jsx`.

**Acceptance criteria:**
- All insight values render correctly
- Skeleton shown while loading
- No render when has_enough_data=false
- Alerts section hidden when no alerts
- Each card renders correct values with correct units
- Dirty nappy last seen changes colour correctly
- Refreshes every 5 minutes
- `cd frontend && npm test -- --watchAll=false` passes

**verify_scope:** both

---

## Appendix: Testing Notes

**Backend:** All new endpoints must be tested via `httpx.AsyncClient` with
the FastAPI test client. Test both happy paths and all stated error conditions.

**Migration tests:** Test that migrations are idempotent (run twice = no error).

**Calculation tests:** Insight calculations and wake window threshold lookup
must have unit tests with known input/output pairs.

**Frontend:** All new components must have tests covering render and key
interactions. Tests use Vitest + Testing Library.

**Do not break existing tests.** Run the full suite before marking any task complete.
