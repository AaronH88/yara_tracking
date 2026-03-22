# Baby Tracker — v2 Feature Architecture & Requirements

## Overview

This document describes all additions to the existing Baby Tracker app for v2.
It is intended to be passed to the agentic-scaffold skill to generate a task list.

The existing app is a FastAPI + React PWA deployed on a Proxmox LXC via
Tailscale. Backend: Python 3.12, FastAPI, SQLAlchemy async, SQLite.
Frontend: React 18, Vite, Tailwind CSS.

This spec covers only new and changed functionality. Nothing not mentioned
here should be touched.

---

## Existing Codebase Reference

- Backend: `babytracker/backend/`
- Frontend: `babytracker/frontend/src/`
- Models: `babytracker/backend/models.py`
- Routers: `babytracker/backend/routers/`
- Components: `babytracker/frontend/src/components/`
- Pages: `babytracker/frontend/src/pages/`
- Hooks: `babytracker/frontend/src/hooks/`
- Context: `babytracker/frontend/src/context/`

**Database migration policy:** Never drop tables containing data. Add new
columns using `ALTER TABLE ... ADD COLUMN` with sensible defaults. New tables
can be created normally via `create_tables()`.

---

## Feature 1 — Feed Timer: Pause / Resume

### What

The active feed timer needs a pause/resume capability. When paused the timer
stops counting. Total active feeding time is stored — pause history is not needed.

### Backend Changes

Add three columns to `FeedEvent`:
```
paused_seconds  INTEGER  NOT NULL DEFAULT 0
is_paused       BOOLEAN  NOT NULL DEFAULT false
paused_at       DATETIME           -- null when not paused
```

Migration: `ALTER TABLE feededent ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0`
           `ALTER TABLE feededent ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT false`
           `ALTER TABLE feededent ADD COLUMN paused_at DATETIME`

Add two new endpoints:

`POST /api/v1/babies/{baby_id}/feeds/{id}/pause`
- Sets `is_paused=true`, `paused_at=now()`
- Returns 409 if feed is already paused or already ended

`POST /api/v1/babies/{baby_id}/feeds/{id}/resume`
- Adds `(now - paused_at)` to `paused_seconds`
- Sets `is_paused=false`, `paused_at=null`
- Returns 409 if feed is not paused or already ended

### Frontend Changes

Timer elapsed calculation must account for paused time:
- Running: `elapsed = (now - started_at) - paused_seconds`
- Paused: `elapsed = (paused_at - started_at) - paused_seconds`

Active feed timer UI:
- Running state: show "⏸ Pause" button alongside "⏹ Stop"
- Paused state: show "▶ Resume" button, timer shows "Paused" label, elapsed frozen
- "⏹ Stop" works in both states

### Acceptance Criteria
- Pause stops the timer display and sets server state
- Resume continues the timer from the paused elapsed value
- Stopping a paused feed records correct active duration excluding paused time
- Both phones see the paused state within the 10 second polling interval
- 409 is returned if pause/resume is called in an invalid state

---

## Feature 2 — Feed Timer: Quick Switch Breast

### What

While feeding on one breast, a single-tap "Switch →" button stops the current
breast timer and immediately starts the other breast. No confirmation needed.

### Backend Changes

No new endpoints. Uses existing POST and PATCH.

Switch action sequence (executed client-side):
1. `PATCH /feeds/{id}` with `ended_at=now()`
2. `POST /feeds` with opposite breast type and `started_at=now()`

### Frontend Changes

On active feed timer when type is `breast_left` or `breast_right` only:
- Show "Switch →" button (not shown for bottle or breast_both)
- Button label shows destination: "→ Right" or "→ Left"
- On tap: execute the two-step switch, update localStorage last-used breast
- New timer starts immediately with fresh elapsed (no time inherited)

### Acceptance Criteria
- Switch button only visible for breast_left and breast_right
- Two clean records created: previous ended, new started
- localStorage last-used breast updates to the new breast
- No gap between ended_at of first and started_at of second feed

---

## Feature 3 — Feed Quality Rating

### What

After stopping a feed, parent can optionally rate how the feed went.
Solves the "short feed anxiety" problem — quality matters more than duration.

### Backend Changes

Add one column to `FeedEvent`:
```
quality  TEXT  -- null | 'good' | 'okay' | 'poor'
```

Migration: `ALTER TABLE feededent ADD COLUMN quality TEXT`

Update FeedEvent schemas to include optional `quality` field.

### Frontend Changes

Post-feed form (shown after tapping Stop, before saving):
- Add optional section "How did the feed go?"
- Three large tap-target buttons:
  - 👍 Good — active swallowing
  - 😐 Okay
  - 👎 Poor — distracted / sleepy
- Tapping one selects it (highlighted), tapping again deselects (optional)
- Quality icon shown in history list row alongside other details
- Quality editable via feed edit form

### Acceptance Criteria
- Quality is optional — null is valid, existing feeds unaffected
- Selected quality saves correctly to database
- Quality icon appears in history rows
- Quality can be set and changed via edit form

---

## Feature 4 — Auto-Close Conflicting Active Timers

### What

Only one active timer per baby is allowed across feeds AND sleeps.
Starting a new feed or sleep automatically ends any currently active
feed or sleep for that baby.

Burp timers (Feature 5) are exempt — they can run alongside feeds/sleeps.

### Backend Changes

Add a shared helper function `close_active_timers(baby_id, db, exclude_type=None)`:
- Finds any active (ended_at IS NULL) FeedEvent or SleepEvent for this baby
- Sets ended_at=now() on any found
- Called at the start of POST /feeds and POST /sleeps before creating the new event

The response for the new event creation should include a field
`auto_closed` listing any events that were automatically ended, so the
frontend can notify the user.

### Frontend Changes

When a new feed or sleep is started and the response includes `auto_closed`:
- Show a brief dismissable toast notification:
  "Sleep timer automatically stopped" or "Feed timer automatically stopped"

### Acceptance Criteria
- Starting a feed while a sleep is active automatically ends the sleep
- Starting a sleep while a feed is active automatically ends the feed
- Starting a feed while a feed is active automatically ends the previous feed
- The auto-closed event gets ended_at = the new event's started_at (no gap)
- Toast notification appears on the device that started the new timer
- Burp timers are not affected by this logic

---

## Feature 5 — Burp Timer

### What

A standalone burp timer, similar to the nap timer. Not linked to feeds.
Useful for tracking burp duration after feeds.

### Backend Changes

New model `BurpEvent`:
```
id          INTEGER PRIMARY KEY
baby_id     INTEGER FK → Baby
user_id     INTEGER FK → User
started_at  DATETIME NOT NULL
ended_at    DATETIME           -- null = active timer
notes       TEXT
created_at  DATETIME
```

New router `routers/burps.py` with endpoints:
```
GET    /api/v1/babies/{baby_id}/burps
POST   /api/v1/babies/{baby_id}/burps
GET    /api/v1/babies/{baby_id}/burps/active
PATCH  /api/v1/babies/{baby_id}/burps/{id}
DELETE /api/v1/babies/{baby_id}/burps/{id}
```

Only one active burp per baby allowed. No conflict with feed/sleep timers.

### Frontend Changes

Dashboard quick actions: add "Burp" button alongside existing quick actions.

Burp timer follows same pattern as sleep timer:
- Tap "Start Burp" → live timer starts
- Tap "Done" → ends timer, optional notes
- Active burp timer shows on dashboard (below feed/sleep timers)
- Burp events appear in history list with duration

### Acceptance Criteria
- Burp timer starts, ticks, and stops correctly
- Active burp visible on dashboard while running
- Burp appears in history with correct duration
- Burp does not auto-close or conflict with feed/sleep timers
- Only one active burp per baby allowed

---

## Feature 6 — Nappy: Size and Colour Fields

### What

Nappy logging gets two new optional fields:
1. **Wetness amount** for wet component: small / medium / heavy
2. **Dirty colour** for dirty component: yellow / green / brown / other

One log entry covers the whole nappy — wet and dirty fields are separate.

### Backend Changes

Add to `DiaperEvent`:
```
wet_amount    TEXT  -- null | 'small' | 'medium' | 'heavy'
dirty_colour  TEXT  -- null | 'yellow' | 'green' | 'brown' | 'other'
```

Migration:
```
ALTER TABLE diaperevent ADD COLUMN wet_amount TEXT
ALTER TABLE diaperevent ADD COLUMN dirty_colour TEXT
```

Update DiaperEvent schemas to include these optional fields.

### Frontend Changes

**Quick log one-tap buttons (Dashboard):**
Keep the existing Wet / Dirty / Both buttons for speed.
These log without amount/colour — null values, same as before.

**Nappy detail form (shown on tap of existing buttons OR via edit):**
- Wet section (shown if type includes wet): Small / Medium / Heavy selector
- Dirty section (shown if type includes dirty): colour selector with
  coloured circles: 🟡 Yellow / 🟢 Green / 🟤 Brown / ⚪ Other

The quick-log one-tap path must remain — do not force the detail form
on every log. Show a small "Add details" link after quick-logging that
opens the form if they want to add more.

**History rows:** show wet amount and dirty colour as small labels when present.

### Acceptance Criteria
- Existing one-tap quick log still works with no extra taps required
- Detail form accessible after quick log or via edit
- wet_amount only shown/required when type includes wet
- dirty_colour only shown/required when type includes dirty
- Both fields optional — null is valid for all existing and new entries
- Fields visible in history list when set

---

## Feature 7 — Wake Window: Auto-Calculated with Age-Based Thresholds

### What

Wake window is the time since the baby last woke up. It is automatically
calculated — no manual logging needed. The baby is considered awake whenever
they are not in an active or recently ended sleep/nap event.

The current wake window duration is shown prominently on the dashboard.
It is colour-coded based on the baby's age and established wake window norms.

### Reference Data (static, hardcoded in frontend)

| Age | Ideal wake window | Alert threshold |
|-----|------------------|-----------------|
| 0–2 weeks   | 45–60 min  | 75 min  |
| 2–4 weeks   | 60–75 min  | 90 min  |
| 4–8 weeks   | 60–90 min  | 105 min |
| 2–3 months  | 75–120 min | 135 min |
| 3–4 months  | 90–120 min | 150 min |
| 4–5 months  | 90–150 min | 180 min |
| 5–6 months  | 120–180 min| 210 min |
| 6–9 months  | 150–210 min| 240 min |
| 9–12 months | 180–240 min| 270 min |

### Backend Changes

New endpoint:
`GET /api/v1/babies/{baby_id}/wake-window`

Returns:
```json
{
  "awake_since": "2026-03-22T14:30:00Z",
  "awake_minutes": 47,
  "is_sleeping": false
}
```

Logic:
- If there is an active sleep (ended_at IS NULL): `is_sleeping=true`, `awake_minutes=0`
- Otherwise: find the most recent ended sleep, `awake_since = that sleep's ended_at`
- If no sleep on record: `awake_since = baby's created_at`

### Frontend Changes

Dashboard — prominently display wake window when baby is awake:

```
Awake for 1h 23m  ●
```

The `●` dot is colour-coded:
- 🟢 Green: within ideal range for age
- 🟡 Amber: approaching alert threshold (within 15 min)
- 🔴 Red: past alert threshold

When sleeping: show "Sleeping 😴" instead, with sleep duration ticking up.

Wake window display polls the same endpoint every 60 seconds (not 10 —
it changes slowly).

A small legend on hover/tap: "Ideal wake window for [age]: 75–120 min"

### Acceptance Criteria
- Wake window calculates correctly from last sleep ended_at
- Colour changes correctly based on age thresholds
- Shows "Sleeping" when an active sleep is running
- Updates every 60 seconds
- Age is correctly calculated from baby birthdate
- First use (no sleep logged yet) shows time since baby was added to app
- The age-threshold lookup is a pure function with unit tests

---

## Feature 8 — Dashboard Insights & Smart Alerts

### What

A new "Insights" section at the bottom of the Dashboard showing
auto-calculated summaries and gentle alerts based on logged data.

### Backend Changes

New endpoint:
`GET /api/v1/babies/{baby_id}/insights`

Returns a structured JSON object with all insight data. This single endpoint
does all the calculation server-side so the frontend just renders.

Response shape:
```json
{
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
  "alerts": [
    {
      "type": "warning",
      "message": "Fewer wet nappies than usual today"
    }
  ]
}
```

**Alert logic (server-side):**

| Alert | Condition |
|-------|-----------|
| Fewer wet nappies | Today's wet count < 70% of 7-day average AND it's past 4pm |
| More frequent feeds | Today's feed count > 130% of 7-day average |
| Long wake window | Current wake window > age-based alert threshold |
| No dirty nappy | days_since_dirty >= 2 |
| Good sleep night | Longest night stretch >= 4 hours (positive alert 🎉) |

Alerts array is empty if no conditions are met.
Maximum 3 alerts shown at once — most important first.

### Frontend Changes

New `Insights` component at the bottom of Dashboard page.

Renders three card rows:

**Feeds card:**
- "Feeds since midnight: 6"
- "Average this week: 11/day"

**Sleep card:**
- "Sleep last 24h: 14h 7m"
- "Naps today: 3"
- "Longest stretch last night: 3h 5m"

**Nappies card:**
- "Wet nappies today: 4 (avg: 6)"
- "Last dirty: today" or "2 days ago" (shown in amber/red if >1 day)

**Alerts section** (only shown if alerts exist):
- Each alert as a pill/chip with appropriate emoji
- Gentle tone — informational not alarming

Insights endpoint is fetched on dashboard load and refreshed every
5 minutes (not real-time — these are summaries).

### Acceptance Criteria
- All insight values calculate correctly against real logged data
- Alerts fire only when their stated conditions are met
- Empty alerts array produces no alerts UI
- Insights section does not appear if baby has fewer than 2 days of data
  (not enough data to be meaningful)
- Each insight value has a unit test covering its calculation logic
- Dashboard loads without waiting for insights (load insights async,
  show skeleton then populate)

---

## Summary of All Database Changes

| Table | New Columns |
|-------|------------|
| FeedEvent | paused_seconds, is_paused, paused_at, quality |
| DiaperEvent | wet_amount, dirty_colour |
| BurpEvent | new table (id, baby_id, user_id, started_at, ended_at, notes, created_at) |

All existing columns and tables are unchanged.
All new FeedEvent and DiaperEvent columns use NULL as default and are optional.

---

## Summary of All New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/babies/{id}/feeds/{id}/pause | Pause active feed |
| POST | /api/v1/babies/{id}/feeds/{id}/resume | Resume paused feed |
| GET | /api/v1/babies/{id}/burps | List burps |
| POST | /api/v1/babies/{id}/burps | Start/create burp |
| GET | /api/v1/babies/{id}/burps/active | Get active burp |
| PATCH | /api/v1/babies/{id}/burps/{id} | Update/stop burp |
| DELETE | /api/v1/babies/{id}/burps/{id} | Delete burp |
| GET | /api/v1/babies/{id}/wake-window | Get current wake window |
| GET | /api/v1/babies/{id}/insights | Get all dashboard insights |

---

## Out of Scope for v2

- Growth spurt detection
- Feed duration trend comparisons week over week
- Push notifications or reminders
- PDF export
- WHO growth percentile charts
- Any changes to existing pump, measurement, or milestone features
