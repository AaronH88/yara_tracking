# Baby Tracker v2 — Architecture Reference

Quick reference for agents implementing v2 tasks. Read this before every task.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), SQLite |
| Frontend | React 18, Vite, Tailwind CSS |
| Deployment | Proxmox LXC, systemd, Tailscale VPN |
| Testing | pytest (backend), Vitest + React Testing Library (frontend) |

## Project Structure

```
babytracker/
├── backend/
│   ├── main.py              # FastAPI app + lifespan
│   ├── database.py          # Async engine config
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── migrations.py        # [NEW] Migration functions
│   ├── timer_helpers.py     # [NEW] Auto-close logic
│   ├── routers/
│   │   ├── feeds.py         # Feed CRUD + active
│   │   ├── sleeps.py        # Sleep CRUD + active
│   │   ├── diapers.py       # Diaper CRUD
│   │   ├── burps.py         # [NEW] Burp CRUD + active
│   │   ├── wake_window.py   # [NEW] Wake window calc
│   │   └── insights.py      # [NEW] Dashboard insights
│   └── tests/               # pytest test files
│       └── test_*.py
└── frontend/src/
    ├── main.jsx             # App entry point
    ├── pages/               # Route components
    │   ├── Dashboard.jsx    # Main page (timers, quick actions, insights)
    │   └── History.jsx      # Event list
    ├── components/
    │   ├── timers/
    │   │   ├── ActiveTimer.jsx   # Shared timer display
    │   │   ├── FeedTimer.jsx     # Feed control + pause
    │   │   ├── SleepTimer.jsx    # Sleep control
    │   │   └── BurpTimer.jsx     # [NEW] Burp control
    │   ├── forms/
    │   │   ├── FeedForm.jsx      # Edit feeds
    │   │   ├── DiaperForm.jsx    # Edit diapers (wet/dirty fields)
    │   │   └── BurpForm.jsx      # [NEW] Edit burps
    │   ├── WakeWindow.jsx        # [NEW] Wake window display
    │   ├── Insights.jsx          # [NEW] Dashboard insights cards
    │   └── Toast.jsx             # [NEW] Toast notifications
    ├── context/
    │   ├── BabyContext.jsx       # Current baby
    │   └── PersonaContext.jsx    # Current user
    ├── hooks/
    │   ├── useActiveEvents.js    # Poll active feed/sleep/burp
    │   └── useTimer.js           # Timer tick logic
    └── __tests__/                # Vitest test files
        └── *.test.jsx
```

## Database Conventions

### Models (SQLAlchemy)

All event models follow this pattern:
```python
id: int (Primary Key)
baby_id: int (Foreign Key → Baby)
user_id: int (Foreign Key → User, nullable)
started_at: datetime (NOT NULL for timers)
ended_at: datetime (NULL = active timer)
notes: str (nullable)
created_at: datetime (default=now)
```

Model names: `FeedEvent`, `SleepEvent`, `DiaperEvent`, `BurpEvent`

### Schemas (Pydantic)

Three schemas per model:
- `{Model}Create`: fields for POST (started_at, baby_id, user_id, type-specific)
- `{Model}Update`: all fields optional for PATCH
- `{Model}Response`: full model for GET responses (includes id, created_at)

All datetime fields are strings in ISO 8601 UTC format.

### Migrations

Pattern for adding columns (idempotent):
```python
def migrate_table_v2(engine):
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE tablename ADD COLUMN col_name TYPE"))
        except OperationalError as e:
            if "duplicate column name" not in str(e):
                raise
```

Call migrations in `main.py` lifespan startup BEFORE `create_tables()`.

## API Patterns

### Router Conventions

Standard CRUD endpoints for event types:
```
GET    /api/v1/babies/{baby_id}/{resource}           # List (queryable by date)
POST   /api/v1/babies/{baby_id}/{resource}           # Create
GET    /api/v1/babies/{baby_id}/{resource}/active    # Get active (ended_at=null)
PATCH  /api/v1/babies/{baby_id}/{resource}/{id}      # Update
DELETE /api/v1/babies/{baby_id}/{resource}/{id}      # Delete
```

Active endpoints return `null` when no active event, not 404.

Status codes:
- 200: Success
- 404: Resource not found or baby_id mismatch
- 409: Conflict (e.g., starting second active timer)

### Error Messages

Be specific in 409 responses:
- "Feed is already paused"
- "Feed is not paused"
- "Feed is already ended"

## Frontend Patterns

### Component File Organization

- One component per file
- Export component as default
- Co-locate test files: `ComponentName.test.jsx` next to `ComponentName.jsx` (alternative) or in `__tests__/`

### Context Usage

Wrap entire app in contexts (already done):
```jsx
<PersonaContext.Provider>
  <BabyContext.Provider>
    <SettingsContext.Provider>
      <App />
```

Access current baby: `const { currentBaby } = useBaby()`
Access current user: `const { persona } = usePersona()`

### Timer Architecture (CRITICAL)

**Timers are server-side, not client-side.**

Starting a timer:
1. POST to create event with `started_at=now()`, `ended_at=null`
2. Backend returns event with ID and `started_at`
3. Frontend stores event and ticks up from `started_at`

Stopping a timer:
1. PATCH event with `ended_at=now()`

Active timer polling:
- `useActiveEvents` hook polls every 10 seconds
- Fetches `/babies/{id}/feeds/active`, `/babies/{id}/sleeps/active`, `/babies/{id}/burps/active`
- Returns `{ activeFeed, activeSleep, activeBurp }`

### Tailwind Conventions

- Mobile-first (min 390px viewport)
- All screens support dark mode: `dark:bg-gray-900`, `dark:text-white`
- Minimum tap target: 48px (`min-h-12`, `min-w-12`)

## V2 New Features Summary

### Database Changes

| Table | New Columns |
|-------|------------|
| FeedEvent | paused_seconds, is_paused, paused_at, quality |
| DiaperEvent | wet_amount, dirty_colour |
| BurpEvent | [NEW TABLE] id, baby_id, user_id, started_at, ended_at, notes, created_at |

All new FeedEvent/DiaperEvent columns nullable/default.

### New Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/babies/{id}/feeds/{id}/pause | Pause feed timer |
| POST | /api/v1/babies/{id}/feeds/{id}/resume | Resume feed timer |
| GET/POST/PATCH/DELETE | /api/v1/babies/{id}/burps/* | Burp CRUD |
| GET | /api/v1/babies/{id}/wake-window | Current wake window calc |
| GET | /api/v1/babies/{id}/insights | Dashboard insights data |

### Auto-Close Logic

Helper: `timer_helpers.close_active_timers(baby_id, db, exclude_model)`
- Called when creating feed or sleep
- Sets `ended_at=now()` on any active feed/sleep for that baby
- Returns list of closed events for toast notification
- Does NOT close burp timers

### Feed Pause/Resume

Pause calculation:
- Running: `elapsed = (now - started_at) - paused_seconds`
- Paused: `elapsed = (paused_at - started_at) - paused_seconds`

On resume: add `(now - paused_at)` to `paused_seconds`.

### Wake Window Thresholds (hardcoded in frontend)

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

### Insights Calculations

All calculated server-side:
- "Today" = midnight UTC to now UTC
- "Last night" = 8pm UTC yesterday to 8am UTC today
- "7-day average" = sum over last 7 days / 7
- `has_enough_data` = false if < 2 days of any events

Alert conditions (max 3 shown):
- Fewer wet nappies: wet_count_today < 70% of avg AND hour >= 16
- More frequent feeds: count > 130% of avg AND past noon
- No dirty nappy: days_since_dirty >= 2
- Great sleep: longest_night_stretch >= 240 min

## Testing Conventions

Backend (pytest):
- Test file: `tests/test_{router_name}.py`
- Use `httpx.AsyncClient` with FastAPI test client
- Test happy paths AND all error conditions
- Idempotent migration tests (run twice = no error)

Frontend (Vitest):
- Test file: `__tests__/{Component}.test.jsx` or `{Component}.test.jsx`
- Use `@testing-library/react`
- Test render + key interactions
- Mock API calls with mock functions

Run tests:
- Backend: `cd babytracker/backend && python -m pytest -v`
- Frontend: `cd babytracker/frontend && npm test -- --watchAll=false`

## Naming Rules

Variables: Descriptive, not generic
- Bad: `result`, `data`, `response`, `temp`, `obj`, `val`
- Good: `active_feed`, `closed_timers`, `updated_event`

Functions: Verb phrases describing action
- `close_active_timers`, `calculate_awake_minutes`, `get_wake_window_status`

## Reusable Helpers

Backend:
- `database.get_db()` — async session dependency
- Existing router patterns in `routers/sleeps.py` (copy for burps)

Frontend:
- `useActiveEvents()` — poll for active timers
- `useTimer(startedAt)` — ticking elapsed display
- `ActiveTimer.jsx` — shared timer display component

## Constraints

- Mobile-first UI (390px viewport)
- Dark mode required on all screens
- No authentication (Tailscale VPN only)
- Offline-capable (no external CDN calls)
- SQLite single-file database
