# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Baby Tracker is a self-hosted, mobile-first web application for tracking newborn care activities (feeds, sleep, diapers, measurements, milestones). It runs on a Proxmox LXC container accessible only via Tailscale VPN with no authentication required.

**Tech Stack**: FastAPI (Python 3.12) + React 18 + Vite + Tailwind CSS + SQLite

## Common Commands

### Backend (Python/FastAPI)
```bash
cd babytracker/backend

# Install dependencies
pip install -r requirements.txt

# Run tests (all)
python -m pytest -v

# Run specific test file
python -m pytest tests/test_routers_feeds.py -v

# Run specific test
python -m pytest tests/test_routers_feeds.py::test_create_feed_event -v

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React/Vite)
```bash
cd babytracker/frontend

# Install dependencies
npm install

# Start development server (proxies /api to localhost:8000)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Build for production
npm run build
```

### Orchestrator (Agentic Task System)
```bash
# Run in step mode (advance one task phase at a time)
python tools/orchestrator.py

# Run in auto mode (run until done or blocked)
python tools/orchestrator.py --auto

# Check current status
python tools/orchestrator.py --status

# Reset a specific task to PENDING
python tools/orchestrator.py --task 1.3 --reset
```

## Architecture Highlights

### Timer Architecture (Critical Design)

**Timers are server-side, not client-side.** This is a core architectural decision.

When a user starts a feed or sleep timer:
1. A database row is created immediately with `started_at=now()` and `ended_at=null`
2. Frontend receives the event ID and `started_at` timestamp
3. React UI counts up from `started_at` using client time (presentational only)
4. On page refresh, the app queries for events with `ended_at=null` and resumes display

This means:
- Timers survive page refreshes and browser crashes
- Both parents see the same active timer in real-time
- Stopping a timer sends a PATCH request to set `ended_at=now()`
- Both timestamps are fully editable retroactively for manual entry

### API Structure

Base path: `/api/v1`

Key patterns:
- **Baby-scoped endpoints**: `/api/v1/babies/{baby_id}/feeds`, `/api/v1/babies/{baby_id}/sleeps`, etc.
- **User-scoped endpoints**: `/api/v1/pumps` (not baby-specific)
- **Active timer endpoints**: `/api/v1/babies/{baby_id}/feeds/active`, `/api/v1/babies/{baby_id}/sleeps/active`
- **Calendar endpoints**: `/api/v1/babies/{baby_id}/calendar/month?year=YYYY&month=MM`, `/api/v1/babies/{baby_id}/calendar/day?date=YYYY-MM-DD`

All endpoints use ISO 8601 UTC timestamp strings. No authentication (Tailscale handles network access).

### Frontend Context Architecture

Three global React contexts (wrap entire app):
- **PersonaContext**: Current user (parent) stored in localStorage, sent as `user_id` on all POST/PATCH
- **BabyContext**: Currently selected baby (multi-baby support)
- **SettingsContext**: Units (imperial/metric), time format (12h/24h), dark mode

On first visit, a `PersonaGate` modal prompts "Who are you?" to set the active user.

### Database Models

All event models (`FeedEvent`, `SleepEvent`, `DiaperEvent`) follow a consistent pattern:
- Foreign keys to `babies` and `users` tables
- Timestamp fields for when the event occurred
- Optional `notes` field
- Automatic `created_at` timestamp

Feed and Sleep events have `started_at`/`ended_at` for timer support (`ended_at=null` = active timer).

### Frontend Polling

The app polls for active events every 10 seconds to keep both parents' views synchronized:
- `useActiveEvents` hook manages polling
- No WebSockets needed at this scale

## Task Orchestration System

This project uses an agentic task orchestration system (`tools/orchestrator.py`) that coordinates multiple AI personas:

**Roles**:
- **Developer**: Implements features according to specs
- **Test Writer**: Writes tests for the implementation
- **Verifier**: Runs test suites to validate work
- **Judge**: Reviews implementation and tests, provides feedback

**State Machine**: PENDING → DEVELOPING → TESTING → VERIFYING → JUDGING → (APPROVED | retry)

**Key Files**:
- `tasks/task-state.json`: Machine state (task statuses, iterations)
- `tasks/TASK_LIST.md`: Human-readable task list (auto-regenerated)
- `tasks/ARCHITECTURE_REF.md`: Condensed architecture reference for agents
- `tasks/specs/task-*.md`: Individual task specifications
- `tasks/personas/*.md`: Role-specific persona definitions
- `tasks/feedback/`: Iteration feedback from verifier and judge

When working on tasks, check `tasks/TASK_LIST.md` for the current task and `tasks/RUN.md` for agent entry point instructions.

## Testing Conventions

### Backend Tests
- Located in `babytracker/backend/tests/`
- Use pytest with async support
- `conftest.py` sets up Python path for imports
- Test files follow pattern `test_*.py`
- Comprehensive test coverage for all routers and models

### Frontend Tests
- Located in `babytracker/frontend/src/__tests__/`
- Use Vitest + React Testing Library
- Test setup in `src/test-setup.js`
- Test files follow pattern `*.test.jsx`
- Tests cover components, contexts, forms, and pages

## Project Structure Notes

### Backend Routers
Each router module (`routers/*.py`) handles CRUD operations for a specific resource:
- `babies.py`, `users.py`: Core entities
- `feeds.py`, `sleeps.py`, `diapers.py`, `pumps.py`: Event tracking
- `measurements.py`, `milestones.py`: Growth and development
- `calendar.py`: Aggregated event views for calendar UI
- `settings.py`: Key-value configuration with seeding logic

### Frontend Component Organization
- `pages/`: Top-level route components (Dashboard, History, Calendar, Admin, Settings)
- `components/forms/`: Edit/create forms for all event types
- `components/timers/`: Active timer display and controls
- `components/`: Shared layout and UI components
- `context/`: Global state management
- `hooks/`: Reusable React hooks (timer logic, API calls, active event polling)

### Special Files
- `babytracker/backend/main.py`: FastAPI app entry point with SPA fallback routing
- `babytracker/backend/database.py`: SQLAlchemy async engine configuration
- `babytracker/backend/models.py`: SQLAlchemy ORM models with `create_tables()` function
- `babytracker/backend/schemas.py`: Pydantic schemas for request/response validation
- `babytracker/frontend/vite.config.js`: Vite config with `/api` proxy and vitest setup

## Development Workflow

1. **Backend changes**: Modify routers/models/schemas, add tests in `tests/`, run `python -m pytest -v`
2. **Frontend changes**: Modify components/pages/contexts, add tests in `__tests__/`, run `npm test`
3. **Full verification**: Run both test suites (backend and frontend) before considering work complete
4. **Task-based development**: Use the orchestrator system when working on spec'd tasks

## Important Constraints

- **Mobile-first**: All UI designed for 390px viewport (iPhone size), minimum 48px tap targets
- **Dark mode**: All screens must support dark mode via Tailwind's `dark:` variants
- **No authentication**: Network access controlled by Tailscale VPN only
- **Offline capable**: App must work without external dependencies (no CDN calls)
- **Single-file database**: SQLite at `/var/lib/babytracker/db.sqlite` (production) or `./babytracker.db` (dev)

## Deployment

Production deployment is to a Proxmox LXC container running Ubuntu 24.04:
- FastAPI runs via uvicorn under systemd service
- Frontend is built to `frontend/dist/` and served as static files by FastAPI
- Single systemd service manages the entire app
- Database is a single SQLite file (snapshotted with LXC)
