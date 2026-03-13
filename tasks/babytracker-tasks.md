# Baby Tracker — Claude Code Implementation Tasks

## How to Use This Document

Work through tasks in order. Each task is self-contained with clear acceptance criteria. Tasks within a phase can sometimes be parallelised but phases must be completed in order. Reference `babytracker-architecture.md` for data models, API design, and deployment details.

---

## Project Setup

### Task 0.1 — Initialise Project Structure

Create the following directory layout:

```
babytracker/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── babies.py
│   │   ├── users.py
│   │   ├── feeds.py
│   │   ├── sleeps.py
│   │   ├── diapers.py
│   │   ├── pumps.py
│   │   ├── measurements.py
│   │   ├── milestones.py
│   │   ├── calendar.py
│   │   └── settings.py
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        ├── pages/
        ├── components/
        └── hooks/
```

**requirements.txt:**
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
sqlalchemy[asyncio]>=2.0.0
aiosqlite>=0.20.0
pydantic>=2.0.0
python-dateutil>=2.9.0
```

**package.json dependencies:**
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

**Acceptance criteria:** Directory structure exists, `pip install -r requirements.txt` succeeds, `npm install` succeeds.

---

## Phase 1 — Backend Foundation

### Task 1.1 — Database Setup

In `backend/database.py`:

- Create async SQLAlchemy engine pointing to `DATABASE_URL` env var (default: `sqlite+aiosqlite:///./babytracker.db`)
- Create `AsyncSession` factory
- Create `Base` declarative base
- Create `get_db()` async dependency for FastAPI

**Acceptance criteria:** `database.py` imports cleanly, engine connects to SQLite.

---

### Task 1.2 — Database Models

In `backend/models.py`, implement all SQLAlchemy ORM models as specified in the architecture doc:

- `Baby`
- `User`
- `FeedEvent`
- `SleepEvent`
- `DiaperEvent`
- `PumpEvent`
- `Measurement`
- `Milestone`
- `Setting`

All `*_at` fields should use `DateTime` with `timezone=True`. Use `func.now()` for `created_at` defaults.

Add a `create_tables()` async function that creates all tables if they don't exist.

**Acceptance criteria:** `create_tables()` runs without error, tables are visible in SQLite.

---

### Task 1.3 — Pydantic Schemas

In `backend/schemas.py`, create Pydantic v2 schemas for each model:

For each resource, create:
- `{Resource}Create` — fields required on creation
- `{Resource}Update` — all fields optional (for PATCH)
- `{Resource}Response` — full response shape including `id` and timestamps

`FeedEventCreate` must accept an optional `started_at` and `ended_at` to support retroactive entries. If `started_at` is not provided, default to `datetime.utcnow()`.

`SleepEventCreate` same pattern as above.

**Acceptance criteria:** All schemas importable, Pydantic validation works for required fields.

---

### Task 1.4 — FastAPI App Entry Point

In `backend/main.py`:

- Create FastAPI app instance
- Call `create_tables()` on startup via `lifespan`
- Register all routers with prefix `/api/v1`
- Mount the React `dist/` folder as static files at `/static`
- Add a catch-all route that serves `frontend/dist/index.html` for all non-API GET requests (enables client-side routing)
- Add CORS middleware allowing all origins (Tailscale network is trusted)

**Acceptance criteria:** `uvicorn main:app --reload` starts without errors. `GET /api/v1/` returns a 404 or health response (not an error).

---

### Task 1.5 — Babies & Users Routers

Implement `routers/babies.py` and `routers/users.py`:

**Babies:**
- `GET /babies` — list all babies
- `POST /babies` — create baby
- `GET /babies/{id}` — get single baby (404 if not found)
- `PATCH /babies/{id}` — update baby fields

**Users:**
- `GET /users` — list all users
- `POST /users` — create user (reject duplicate names with 409)
- `PATCH /users/{id}` — update user name
- `DELETE /users/{id}` — delete user (reject if user has associated events with 409, message: "User has logged events and cannot be deleted")

**Acceptance criteria:** All endpoints respond correctly. Test with curl or the FastAPI auto-docs at `/docs`.

---

### Task 1.6 — Feed Events Router

Implement `routers/feeds.py`:

- `GET /babies/{baby_id}/feeds` — list feeds, accept optional `?date=YYYY-MM-DD` filter and `?limit=50` (default 50, max 200). Order by `started_at DESC`.
- `POST /babies/{baby_id}/feeds` — create feed event. If `ended_at` is null, this is an active timer.
- `GET /babies/{baby_id}/feeds/active` — return the feed with `ended_at = null`, or `null` if none active. Only one active feed per baby allowed.
- `PATCH /babies/{baby_id}/feeds/{id}` — update any fields including `started_at`, `ended_at`, `amount_oz`, `amount_ml`, `notes`, `type`, `user_id`
- `DELETE /babies/{baby_id}/feeds/{id}` — delete feed

On `POST` when an active feed already exists for that baby, return 409: "A feed is already in progress for this baby."

**Acceptance criteria:** Can start a feed (POST with no ended_at), retrieve active feed, stop it (PATCH with ended_at), and retroactively create a completed feed (POST with both started_at and ended_at).

---

### Task 1.7 — Sleep Events Router

Implement `routers/sleeps.py` following the same pattern as feeds:

- Same endpoints as feeds, adapted for sleep fields
- Active sleep check: only one active sleep per baby allowed
- `type` field: `'nap'` or `'night'`

**Acceptance criteria:** Same as Task 1.6, adapted for sleep.

---

### Task 1.8 — Diaper, Pump, Measurement, Milestone Routers

Implement the remaining routers:

**Diapers** (`routers/diapers.py`): CRUD, `logged_at` is required, no timer concept.

**Pumps** (`routers/pumps.py`): CRUD, not baby-scoped (pump events belong to a user, not a baby). Route prefix: `/api/v1/pumps`.

**Measurements** (`routers/measurements.py`): CRUD, baby-scoped.

**Milestones** (`routers/milestones.py`): CRUD, baby-scoped.

**Acceptance criteria:** All CRUD operations work via `/docs`.

---

### Task 1.9 — Calendar Router

Implement `routers/calendar.py`:

**`GET /babies/{baby_id}/calendar/month?year=YYYY&month=MM`**

Returns a dict keyed by date string `"YYYY-MM-DD"`, where each value is:
```json
{
  "date": "2024-03-15",
  "feed_count": 7,
  "sleep_count": 4,
  "diaper_count": 6,
  "has_milestone": false
}
```
Only include dates that have at least one event.

**`GET /babies/{baby_id}/calendar/day?date=YYYY-MM-DD`**

Returns all events for the day as a unified list, sorted by their primary timestamp (`started_at` for feeds/sleeps, `logged_at` for diapers, etc.), each with a `event_type` field (`'feed'`, `'sleep'`, `'diaper'`, `'milestone'`).

**Acceptance criteria:** Month endpoint returns correct counts. Day endpoint returns all event types sorted by time.

---

### Task 1.10 — Settings Router

Implement `routers/settings.py`:

- `GET /settings` — return all settings as a flat JSON object: `{ "units": "imperial", "time_format": "24h" }`
- `PATCH /settings` — update one or more settings

Seed defaults on first run (`create_tables` or a separate `seed_settings()` call in startup):
- `units`: `"imperial"`
- `time_format`: `"24h"`

**Acceptance criteria:** Settings persist across server restarts.

---

## Phase 2 — Frontend Foundation

### Task 2.1 — Vite + Tailwind + React Router Setup

Configure the frontend build:

**`vite.config.js`:** Set up proxy so `/api` requests in dev mode forward to `http://localhost:8000`.

**`tailwind.config.js`:** Enable dark mode via `class` strategy. Extend theme with no required changes (defaults are fine).

**`index.css`:** Import Tailwind directives. Set `font-family` to system sans-serif stack.

**`App.jsx`:** Set up `react-router-dom` `BrowserRouter` with routes:
- `/` → `Dashboard`
- `/history` → `History`
- `/calendar` → `Calendar`
- `/admin` → `Admin`
- `/settings` → `Settings`

Wrap app in context providers (create stubs for now): `PersonaProvider`, `BabyProvider`, `SettingsProvider`.

**Acceptance criteria:** `npm run dev` starts, all routes render without crashing.

---

### Task 2.2 — Context Providers

Implement the three context providers:

**`SettingsContext.jsx`:**
- Fetches settings from `GET /api/v1/settings` on mount
- Exposes `settings`, `updateSetting(key, value)`, `isDark`, `toggleDark`
- Dark mode: reads from `localStorage` first (`darkMode: true/false`), syncs `dark` class on `document.documentElement`
- Re-fetches settings on focus (in case other parent changed them)

**`PersonaContext.jsx`:**
- Reads `localStorage` key `babytracker_persona` (`{ userId, userName }`)
- Exposes `persona`, `setPersona(user)`, `clearPersona()`
- If no persona set, `persona` is `null`

**`BabyContext.jsx`:**
- Fetches `GET /api/v1/babies` on mount
- Exposes `babies`, `selectedBaby`, `setSelectedBaby(baby)`
- Persists `selectedBabyId` in `localStorage`
- Auto-selects first baby if none stored

**Acceptance criteria:** Contexts provide data to children. Persona and baby selection survive page refresh.

---

### Task 2.3 — Persona Gate (Who Are You Modal)

In `App.jsx`, before rendering the main app:

If `persona` is null, render a full-screen modal:
- Title: "Welcome — who are you?"
- Fetches `GET /api/v1/users` and shows a button for each user
- Tap a user → sets persona in context and localStorage → modal dismisses
- If no users exist yet: show message "No users set up yet. Ask an admin to add users first." with a link to `/admin`

This modal must be mobile-friendly with large touch targets.

**Acceptance criteria:** First visit shows modal. Selecting a user dismisses it and shows the app. Refresh remembers the selection.

---

### Task 2.4 — Layout Shell

Implement the persistent layout:

**`BottomNav.jsx`:** Fixed bottom navigation bar with 5 items: Dashboard, History, Calendar, Admin, Settings. Active state highlighted. Icons: use simple SVG icons or emoji as placeholders (can be replaced later). Safe area padding for iOS home bar.

**`BabySwitcher.jsx`:** Top bar showing current baby name with a dropdown/sheet to switch babies (if more than one exists). Shows baby age in weeks/months next to name.

**`PersonaBadge.jsx`:** Small chip in top bar showing "You: [Name]", tappable to open persona switcher sheet.

Compose into a `Layout.jsx` wrapper that all pages use.

**Acceptance criteria:** Navigation works. Baby switcher updates selected baby. Bottom nav highlights active route.

---

## Phase 3 — Dashboard & Core Timers

### Task 3.1 — useTimer Hook

In `hooks/useTimer.js`:

```js
// useTimer(startedAt: ISO string | null) → { elapsed: string, isRunning: bool }
// elapsed format: "1h 23m" or "45m" or "2h 04m 32s" (seconds shown when < 2 min)
// Updates every second when isRunning
// Returns isRunning: false and elapsed: null when startedAt is null
```

Use `setInterval` in `useEffect`, clean up on unmount. Calculate elapsed from `startedAt` to `Date.now()` each tick.

**Acceptance criteria:** Hook ticks every second. Correct elapsed format. Cleans up interval on unmount.

---

### Task 3.2 — useActiveEvents Hook

In `hooks/useActiveEvents.js`:

```js
// useActiveEvents(babyId) → { activeFeed, activeSleep, refetch }
// Polls GET /babies/{babyId}/feeds/active and /sleeps/active every 10 seconds
// Returns null for each if none active
// Calls refetch() can force immediate refresh
```

**Acceptance criteria:** Returns active events. Polling updates state. Both parents' views sync within ~10 seconds.

---

### Task 3.3 — Feed Timer Component

Implement `components/timers/FeedTimer.jsx`:

**When no active feed:**
- Shows 4 large buttons: "Breast L", "Breast R", "Both Sides", "Bottle"
- Tapping any starts a feed (POST to API with type, started_at = now, user_id from persona)

**When an active feed exists for this baby:**
- Shows the feed type label (e.g. "Breast — Left")
- Shows `ActiveTimer` component ticking up from `started_at`
- Shows "Stop Feed" button
- Tapping Stop → PATCH with `ended_at = now()` → opens FeedForm to add details (amount, notes) before saving

**Breast feed specifics:**
- Track which side was used last — show a subtle "last used" label under each side button
- Store last side in `localStorage` per baby

**Acceptance criteria:** Start → timer ticks → stop → form → saved. Active timer visible to both parents within 10s.

---

### Task 3.4 — Sleep Timer Component

Implement `components/timers/SleepTimer.jsx`:

**When no active sleep:**
- Two large buttons: "Nap" and "Night Sleep"
- Tapping starts sleep (POST with type, started_at = now, user_id)

**When active sleep:**
- Shows sleep type
- Shows `ActiveTimer` ticking
- Shows "Wake Up" button → PATCH with `ended_at = now()` → optional notes modal

**Acceptance criteria:** Same pattern as feed timer.

---

### Task 3.5 — ActiveTimer Display Component

Implement `components/timers/ActiveTimer.jsx`:

- Takes `startedAt` prop (ISO string)
- Uses `useTimer` hook
- Renders a large, prominent elapsed time display
- Shows start time below it in small text (e.g. "Started 2:14 PM" or "Started 14:14" per settings)
- Visually distinct — this is the most important thing on screen when a timer is active

**Acceptance criteria:** Ticks every second. Correct format. Readable on a dark phone screen.

---

### Task 3.6 — Quick Actions & Dashboard

Implement the Dashboard page (`pages/Dashboard.jsx`):

**Structure (top to bottom):**

1. **Active Timers section** — if any feed or sleep is active, render the relevant timer component full-width at the top. This is the most prominent thing.

2. **Quick Log section** — grid of large tap targets:
   - Diaper: Wet / Dirty / Both (one tap = logged immediately with current time + persona, no form required)
   - "Log Feed" shortcut (opens FeedTimer)
   - "Log Sleep" shortcut (opens SleepTimer)

3. **Last Events summary** — cards showing:
   - Last feed: type, how long ago, duration
   - Last sleep: type, how long ago, duration
   - Last diaper: type, how long ago
   - Since last feed: time elapsed (prominent — parents check this constantly)

**Acceptance criteria:** Dashboard renders all sections. One-tap diaper logging works. Active timers appear immediately when a timer is running.

---

## Phase 4 — History, Calendar & Forms

### Task 4.1 — Event Edit Forms

Implement form components for editing/creating events:

**`FeedForm.jsx`:**
- Fields: type (breast L/R/both/bottle), started_at (datetime-local input), ended_at (datetime-local input), amount (number + oz/ml toggle respecting settings), notes (textarea)
- Used for editing existing events AND retroactive creation
- Submit calls PATCH or POST as appropriate

**`SleepForm.jsx`:**
- Fields: type (nap/night), started_at, ended_at, notes

**`DiaperForm.jsx`:**
- Fields: type (wet/dirty/both), logged_at, notes

**`PumpForm.jsx`:**
- Fields: started_at, duration_minutes, left amount, right amount (with unit toggle), notes

**`MeasurementForm.jsx`:**
- Fields: measured_at (date only), weight (lbs+oz or kg), height (in or cm), head circumference (cm), notes
- Weight input: for imperial, show two fields (lbs and oz); for metric, single kg field

**`MilestoneForm.jsx`:**
- Fields: occurred_at (date), title, notes

All forms should show who logged it (persona), allow changing it via a dropdown of users.

**Acceptance criteria:** All forms render. Submission creates/updates events. Times persist correctly (no timezone shifting).

---

### Task 4.2 — History Page

Implement `pages/History.jsx`:

- Fetches events across all types for the selected baby, most recent first
- Filter bar at top: All / Feeds / Sleeps / Diapers / Pumps / Milestones
- Date filter: "Today" (default) / "Last 7 days" / "All"
- Each event row shows:
  - Event type icon/label
  - Primary time (started_at or logged_at)
  - Duration for feeds/sleeps
  - Key details (feed type, diaper type, amount)
  - Who logged it (small text)
  - Tap row → opens edit form in a bottom sheet/modal
  - Swipe left or long-press → delete (with confirmation)
- Infinite scroll or "Load more" button

**Acceptance criteria:** Events appear in order. Filter works. Edit and delete work. "Logged by" shows correctly.

---

### Task 4.3 — Calendar Month View

Implement the month grid in `pages/Calendar.jsx`:

- Month/year header with prev/next month navigation
- 7-column grid (Sun–Sat)
- Each day cell shows:
  - Day number
  - Small coloured dots for event types present that day: 🔵 feeds, 🟣 sleep, 🟡 diapers (or similar distinct colours)
  - Slightly larger dot or star if a milestone was logged
- Today's date is highlighted
- Tap a day → navigate to or reveal the day timeline below

Fetch from `GET /api/v1/babies/{id}/calendar/month?year=&month=`

**Acceptance criteria:** Correct days layout. Dots reflect real data. Navigation between months works.

---

### Task 4.4 — Calendar Day Timeline

Below the month grid (or on tap of a day), render `components/calendar/DayTimeline.jsx`:

- Vertical timeline from 00:00 to 23:59 (or compressed to show only hours with events)
- Sleep events: horizontal coloured bars spanning their duration
- Feed events: icon marker at `started_at` with a label (type, duration, amount)
- Diaper events: icon marker at `logged_at`
- Milestones: star icon at date
- If any event overlaps, offset them horizontally (don't hide them)
- Tapping any event opens the edit form

Fetch from `GET /api/v1/babies/{id}/calendar/day?date=`

**Acceptance criteria:** Sleep blocks render with correct duration. Feed/diaper markers appear at right times. Overlapping events don't hide each other.

---

## Phase 5 — Admin & Settings

### Task 5.1 — Admin Page

Implement `pages/Admin.jsx`:

**Users section:**
- List of current users with edit (name) and delete buttons
- Add user form (name input + submit)
- Delete shows confirmation; shows error if user has logged events

**Babies section:**
- List of current babies with edit and (soft) delete
- Add baby form: name, birthdate (date picker), gender (optional select)
- Edit baby: same fields

**Acceptance criteria:** Can add/edit/delete users. Can add/edit babies. Baby age shows correctly on switcher after adding.

---

### Task 5.2 — Settings Page

Implement `pages/Settings.jsx`:

- **Dark Mode:** toggle switch, updates immediately (class on `<html>`)
- **Units:** radio/toggle between "Imperial (oz, lbs, in)" and "Metric (ml, kg, cm)". Updates via PATCH /settings. All amount displays across the app update.
- **Time Format:** radio between "24-hour" and "12-hour". Updates via PATCH /settings.
- **Who am I:** shows current persona, button to "Switch user" which re-opens the persona modal
- **About:** App name, version string

**Acceptance criteria:** Dark mode toggles instantly. Unit change is reflected in History and Dashboard. Time format change reflects everywhere.

---

## Phase 6 — Polish & PWA

### Task 6.1 — PWA Manifest & Meta Tags

Make the app installable as a PWA:

In `index.html`:
- Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Add `<meta name="apple-mobile-web-app-capable" content="yes">`
- Add `<meta name="theme-color" ...>` (dark and light variants)
- Link a `manifest.json`

Create `public/manifest.json`:
```json
{
  "name": "Baby Tracker",
  "short_name": "Baby",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "icons": [...]
}
```

Create a simple app icon (SVG → PNG) at 192x192 and 512x512.

**Acceptance criteria:** Chrome/Safari "Add to Home Screen" works. App opens in standalone mode (no browser chrome). Correct icon appears.

---

### Task 6.2 — Mobile UX Polish

Review and fix mobile UX issues:

- All interactive elements minimum 48px tap target
- No horizontal overflow / scroll on any page
- Safe area insets: bottom nav has padding for iPhone home bar (`env(safe-area-inset-bottom)`)
- Input focus doesn't zoom on iOS (font-size ≥ 16px on all inputs)
- Form datetime-local inputs show time correctly (not shifted by timezone)
- Loading states: show skeleton or spinner when data is fetching
- Error states: if API is unreachable, show a banner rather than crashing
- Empty states: friendly message when no events logged yet

**Acceptance criteria:** App is comfortable to use one-handed on a phone. No layout bugs. Feels like a native app when added to home screen.

---

### Task 6.3 — Retroactive Entry UX

Add a clear entry point for logging past events:

On the Dashboard, add a "Log past event" button (or FAB) that opens a modal/sheet to:
1. Select event type (Feed / Sleep / Diaper / Pump / Milestone / Measurement)
2. Opens the appropriate form with the time fields pre-focused

This is the main path for "I forgot to log it at the time".

**Acceptance criteria:** Can create a completed feed event with custom start/end times from the dashboard. Event appears correctly in history and calendar.

---

## Phase 7 — Deployment

### Task 7.1 — LXC Deployment Script

Create `deploy/setup.sh` — a script to run on a fresh Ubuntu 24.04 LXC:

```bash
# Install system deps
apt update && apt install -y python3.12 python3.12-venv nodejs npm sqlite3

# Create service user
useradd -r -s /bin/false babytracker
mkdir -p /opt/babytracker /var/lib/babytracker
chown babytracker:babytracker /var/lib/babytracker

# Install Python deps
python3.12 -m venv /opt/babytracker/venv
/opt/babytracker/venv/bin/pip install -r /opt/babytracker/backend/requirements.txt

# Build frontend
cd /opt/babytracker/frontend && npm ci && npm run build

# Install systemd service
cp deploy/babytracker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable babytracker
systemctl start babytracker
```

Create `deploy/babytracker.service` (systemd unit file as specified in architecture doc).

Create `deploy/update.sh` — a script for subsequent deploys:
```bash
# Pull code (or rsync from dev machine)
# Rebuild frontend
# Restart service
```

**Acceptance criteria:** Fresh LXC can be set up from scratch with one script. Service starts on boot. SQLite file is not in the app directory (won't get wiped on redeploy).

---

### Task 7.2 — Environment Configuration

Add environment-based config to the backend:

- `DATABASE_URL` — SQLite path, default `sqlite+aiosqlite:////var/lib/babytracker/db.sqlite`
- `CORS_ORIGINS` — comma-separated allowed origins, default `*`
- `LOG_LEVEL` — default `info`

Load via `python-dotenv` or just `os.environ.get()`. Document in a `.env.example` file.

**Acceptance criteria:** Database path is configurable without code changes. Service uses `/var/lib/babytracker/db.sqlite` in production.

---

### Task 7.3 — Basic Backup Script

Create `deploy/backup.sh`:

```bash
#!/bin/bash
# Copy SQLite to a timestamped backup
BACKUP_DIR="/var/lib/babytracker/backups"
mkdir -p "$BACKUP_DIR"
sqlite3 /var/lib/babytracker/db.sqlite ".backup '$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sqlite'"
# Keep last 30 backups
ls -t "$BACKUP_DIR"/*.sqlite | tail -n +31 | xargs -r rm
```

Document how to add this to cron (e.g. daily at 2am).

**Acceptance criteria:** Script runs, creates a valid SQLite backup, old backups are pruned.

---

## Appendix: Testing Notes

No formal test suite is required for v1, but Claude Code should verify each task with:

- For backend tasks: test key endpoints using the FastAPI `/docs` interactive UI or `curl` examples
- For frontend tasks: manually verify on a mobile-sized browser window (Chrome DevTools mobile emulation)
- For timer tasks: verify that refreshing the page while a timer is running resumes the timer correctly
- For the calendar: verify that events logged in one timezone don't shift to the wrong day

## Appendix: Known Gotchas

**Timezone handling:** Store all timestamps as UTC in the database. The frontend should send times as UTC ISO strings and display them in local time. The `datetime-local` HTML input produces local time — convert to UTC before sending to the API.

**SQLite concurrency:** Two parents could write simultaneously. SQLite handles this fine with WAL mode. Enable WAL mode on startup: `PRAGMA journal_mode=WAL`.

**Amount units:** Store amounts in both oz and ml in the database (compute the conversion on write). This avoids lossy round-trip conversions if the user switches units.

**Active timer constraint:** Enforce at the API level that only one active (ended_at IS NULL) feed and one active sleep per baby can exist at a time. This prevents ghost timers from accumulating if the UI gets out of sync.
