# Baby Tracker — Architecture & Requirements

## Overview

A self-hosted, mobile-first web application for tracking a newborn's feeds, sleep, diapers, and more. Runs on a Proxmox LXC container, accessible only via Tailscale VPN. Two users (parents), up to 3 babies. No authentication required — network access is controlled by Tailscale.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend | Python 3.12, FastAPI | Familiar to developer, async, lightweight |
| Database | SQLite via SQLAlchemy (async) | Zero ops, single file, sufficient for scale |
| Frontend | React 18 + Vite | Live timers require reactive state; Vite builds to static files |
| Styling | Tailwind CSS | Utility-first, dark mode support built-in |
| HTTP Server | Uvicorn | ASGI server for FastAPI |
| Process Manager | systemd | LXC-native, reliable |
| Deployment | Proxmox LXC (Ubuntu 24.04) | Lightweight, snapshotable |
| Network Access | Tailscale | Replaces authentication entirely |

---

## System Architecture

```
Tailscale VPN
     │
     ▼
LXC Container (Ubuntu 24.04)
├── systemd service: babytracker
│   └── uvicorn → FastAPI app
│       ├── /api/*         → REST API routes
│       └── /              → Serves React static files (dist/)
│
├── /var/lib/babytracker/
│   └── db.sqlite          → SQLite database (bind mount or local)
│
└── /opt/babytracker/
    ├── backend/           → FastAPI app
    └── frontend/dist/     → Built React app (served as static)
```

Both parents access via Tailscale IP or hostname on their phones. No login screen.

---

## Data Models

### Baby
```
id          INTEGER PRIMARY KEY
name        TEXT NOT NULL
birthdate   DATE NOT NULL
gender      TEXT  -- 'male' | 'female' | 'other' | null
created_at  DATETIME
```

### User (for "who logged it")
```
id          INTEGER PRIMARY KEY
name        TEXT NOT NULL UNIQUE
created_at  DATETIME
```
Managed via admin screen. No passwords. Referenced by events.

### FeedEvent
```
id              INTEGER PRIMARY KEY
baby_id         INTEGER FK → Baby
user_id         INTEGER FK → User
type            TEXT  -- 'breast_left' | 'breast_right' | 'breast_both' | 'bottle'
started_at      DATETIME NOT NULL
ended_at        DATETIME  -- null = active timer
amount_oz       REAL      -- bottle or pumped
amount_ml       REAL      -- bottle or pumped (store both, display per setting)
notes           TEXT
created_at      DATETIME
```

### SleepEvent
```
id              INTEGER PRIMARY KEY
baby_id         INTEGER FK → Baby
user_id         INTEGER FK → User
type            TEXT  -- 'nap' | 'night'
started_at      DATETIME NOT NULL
ended_at        DATETIME  -- null = active timer
notes           TEXT
created_at      DATETIME
```

### DiaperEvent
```
id          INTEGER PRIMARY KEY
baby_id     INTEGER FK → Baby
user_id     INTEGER FK → User
logged_at   DATETIME NOT NULL
type        TEXT NOT NULL  -- 'wet' | 'dirty' | 'both'
notes       TEXT
created_at  DATETIME
```

### PumpEvent
```
id          INTEGER PRIMARY KEY
user_id     INTEGER FK → User
logged_at   DATETIME NOT NULL
duration_minutes  INTEGER
left_oz     REAL
left_ml     REAL
right_oz    REAL
right_ml    REAL
notes       TEXT
created_at  DATETIME
```

### Measurement
```
id          INTEGER PRIMARY KEY
baby_id     INTEGER FK → Baby
user_id     INTEGER FK → User
measured_at DATE NOT NULL
weight_oz   REAL
height_in   REAL
head_cm     REAL
notes       TEXT
created_at  DATETIME
```

### Milestone
```
id          INTEGER PRIMARY KEY
baby_id     INTEGER FK → Baby
user_id     INTEGER FK → User
occurred_at DATE NOT NULL
title       TEXT NOT NULL
notes       TEXT
created_at  DATETIME
```

### Settings (key-value, global)
```
key         TEXT PRIMARY KEY
value       TEXT
```
Keys: `units` ('imperial' | 'metric'), `time_format` ('24h' | '12h', default 24h)

---

## Timer Architecture

**Critical design decision:** timers are server-side, not client-side.

When a user starts a feed or sleep:
1. A `FeedEvent` or `SleepEvent` row is immediately written to the DB with `started_at = now()` and `ended_at = null`
2. The frontend receives the event `id` and `started_at`
3. The React timer UI counts up from `started_at` using the current client time
4. On page load / refresh, the app checks for any events with `ended_at = null` and resumes the timer display

This means:
- Timers survive page refreshes and browser crashes
- Both parents see the same active timer (any active event is visible to both)
- The timer display is purely presentational — it just counts up from a stored timestamp

**Ending a timer:**
- User taps "Stop" → a PATCH request sets `ended_at = now()` on the event
- User can then edit notes, amount, etc.

**Retroactive time editing:**
- Both `started_at` and `ended_at` are editable after the fact via the event edit form
- Useful for "I forgot to start the timer" — user can add the event manually with correct times

---

## API Design

### Conventions
- Base path: `/api/v1`
- Auth: None (Tailscale handles network access)
- Content-Type: `application/json`
- Timestamps: ISO 8601 UTC strings
- "Who am I" persona is sent as `user_id` header or query param on writes (set from localStorage)

### Core Endpoints

**Babies**
```
GET    /api/v1/babies
POST   /api/v1/babies
GET    /api/v1/babies/{id}
PATCH  /api/v1/babies/{id}
```

**Users (admin)**
```
GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/{id}
DELETE /api/v1/users/{id}
```

**Feed Events**
```
GET    /api/v1/babies/{baby_id}/feeds           ?date=YYYY-MM-DD&limit=50
POST   /api/v1/babies/{baby_id}/feeds           (starts timer or logs completed)
GET    /api/v1/babies/{baby_id}/feeds/active    (returns any in-progress feed)
PATCH  /api/v1/babies/{baby_id}/feeds/{id}      (stop timer, edit details, retroactive times)
DELETE /api/v1/babies/{baby_id}/feeds/{id}
```

**Sleep Events**
```
GET    /api/v1/babies/{baby_id}/sleeps
POST   /api/v1/babies/{baby_id}/sleeps
GET    /api/v1/babies/{baby_id}/sleeps/active
PATCH  /api/v1/babies/{baby_id}/sleeps/{id}
DELETE /api/v1/babies/{baby_id}/sleeps/{id}
```

**Diaper Events**
```
GET    /api/v1/babies/{baby_id}/diapers
POST   /api/v1/babies/{baby_id}/diapers
PATCH  /api/v1/babies/{baby_id}/diapers/{id}
DELETE /api/v1/babies/{baby_id}/diapers/{id}
```

**Pump Events**
```
GET    /api/v1/pumps
POST   /api/v1/pumps
PATCH  /api/v1/pumps/{id}
DELETE /api/v1/pumps/{id}
```

**Measurements**
```
GET    /api/v1/babies/{baby_id}/measurements
POST   /api/v1/babies/{baby_id}/measurements
PATCH  /api/v1/babies/{baby_id}/measurements/{id}
DELETE /api/v1/babies/{baby_id}/measurements/{id}
```

**Milestones**
```
GET    /api/v1/babies/{baby_id}/milestones
POST   /api/v1/babies/{baby_id}/milestones
PATCH  /api/v1/babies/{baby_id}/milestones/{id}
DELETE /api/v1/babies/{baby_id}/milestones/{id}
```

**Calendar**
```
GET    /api/v1/babies/{baby_id}/calendar/month?year=YYYY&month=MM
       → returns daily event summary (counts + types) for dot indicators
GET    /api/v1/babies/{baby_id}/calendar/day?date=YYYY-MM-DD
       → returns all events for the day, sorted by time, for timeline rendering
```

**Settings**
```
GET    /api/v1/settings
PATCH  /api/v1/settings
```

---

## Frontend Structure

```
src/
├── main.jsx
├── App.jsx                    # Router, theme provider, persona gate
├── context/
│   ├── PersonaContext.jsx     # Current user (from localStorage)
│   ├── BabyContext.jsx        # Selected baby
│   └── SettingsContext.jsx    # Units, time format, dark mode
├── pages/
│   ├── Dashboard.jsx          # Main view — active timers + last events
│   ├── History.jsx            # Scrollable event log, filterable
│   ├── Calendar.jsx           # Month picker + day timeline
│   ├── Admin.jsx              # User management, baby management
│   └── Settings.jsx           # Units, dark mode, time format
├── components/
│   ├── layout/
│   │   ├── BottomNav.jsx      # Mobile bottom navigation
│   │   ├── BabySwitcher.jsx   # Top bar baby selector
│   │   └── PersonaBadge.jsx   # "Logged as Aaron" indicator
│   ├── timers/
│   │   ├── ActiveTimer.jsx    # Ticking live timer display
│   │   ├── FeedTimer.jsx      # Feed start/stop with type selector
│   │   └── SleepTimer.jsx     # Sleep start/stop with type selector
│   ├── quicklog/
│   │   ├── DiaperButton.jsx   # One-tap diaper logging
│   │   └── QuickActions.jsx   # Grid of quick action buttons
│   ├── forms/
│   │   ├── FeedForm.jsx       # Edit/create feed event
│   │   ├── SleepForm.jsx      # Edit/create sleep event
│   │   ├── DiaperForm.jsx     # Edit/create diaper event
│   │   ├── PumpForm.jsx
│   │   ├── MeasurementForm.jsx
│   │   └── MilestoneForm.jsx
│   ├── calendar/
│   │   ├── MonthView.jsx      # Grid with dot indicators
│   │   └── DayTimeline.jsx    # Vertical timeline of day's events
│   └── common/
│       ├── TimeDisplay.jsx    # Respects 24h/12h setting
│       └── AmountDisplay.jsx  # Respects oz/ml setting
└── hooks/
    ├── useTimer.js            # Counts up from a server timestamp
    ├── useActiveEvents.js     # Polls for active feed/sleep events
    └── useApi.js              # Fetch wrapper
```

### Persona Selection (Who Am I)

- On first visit (no `persona` key in localStorage), a modal prompts "Who are you?" with a list of configured users
- Selection is stored in `localStorage` as `{ userId, userName }`
- Shown as a small badge in the UI, tappable to switch
- Every POST/PATCH to events includes this `user_id`

### Real-time / Polling

No websockets needed at this scale. The frontend polls:
- Active events (`/feeds/active`, `/sleeps/active`) every 10 seconds
- This keeps both parents' views roughly in sync without complexity

### Dark Mode

- Toggled via a switch in Settings
- Stored in localStorage and in the global Settings context
- Implemented via Tailwind's `dark:` variant with a `dark` class on `<html>`

---

## Deployment

### LXC Container Setup

```
OS:       Ubuntu 24.04 LTS
CPU:      1-2 cores
RAM:      512MB (SQLite is very light)
Disk:     8GB
Network:  Tailscale only (no bridged/public interface needed beyond initial setup)
```

### Directory Layout on LXC

```
/opt/babytracker/
├── backend/          # FastAPI application
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── routers/
│   └── requirements.txt
└── frontend/
    └── dist/         # Built React app (served as static files)

/var/lib/babytracker/
└── db.sqlite         # Database (persistent, excluded from deploys)
```

### systemd Service

```ini
[Unit]
Description=Baby Tracker API
After=network.target

[Service]
User=babytracker
WorkingDirectory=/opt/babytracker/backend
ExecStart=/opt/babytracker/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.end
```

FastAPI serves the React `dist/` folder as a static mount at `/`, with the API under `/api/v1`. All non-API routes fall through to `index.html` for client-side routing.

### Build & Deploy Script

A simple shell script:
1. Pull latest code
2. `cd frontend && npm run build`
3. Copy `dist/` to `/opt/babytracker/frontend/dist/`
4. `pip install -r requirements.txt`
5. `systemctl restart babytracker`

---

## Non-Functional Requirements

- **Mobile-first:** All UI designed for 390px viewport (iPhone size). Large tap targets (min 48px).
- **Performance:** Page load < 2s on LAN. Timer updates every second without jank.
- **Offline resilience:** Timer display continues counting even if API is briefly unreachable. Retry on reconnect.
- **Dark mode:** All screens support dark mode. Default follows system preference, overridable in settings.
- **Backup:** SQLite file at `/var/lib/babytracker/db.sqlite` — snapshot LXC or rsync this file.
- **No external dependencies:** App runs fully offline on the LAN. No CDN calls, no cloud services.

---

## Out of Scope (v1)

- Push notifications / reminders
- WHO growth percentile charts
- PDF export for pediatrician
- Huckleberry-style sleep scheduling / predictions
- User accounts / passwords
- HTTPS (Tailscale handles encryption in transit)
