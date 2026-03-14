# Baby Tracker

A self-hosted, mobile-first web application for tracking newborn care activities including feeds, sleep, diapers, measurements, and milestones.

## Features

- **Feed Tracking**: Timer-based tracking for breast and bottle feeds with amount logging
- **Sleep Tracking**: Track naps and night sleep with start/stop timers
- **Diaper Logging**: Quick logging of wet, dirty, or both
- **Pump Sessions**: Track pumping duration and output (left/right)
- **Measurements**: Log weight, height, and head circumference over time
- **Milestones**: Record important developmental milestones
- **Calendar View**: Month view with daily event summaries and detailed day timelines
- **Multi-Baby Support**: Track up to 3 babies with easy switching
- **Multi-User**: Two parents can log events independently
- **Server-Side Timers**: Active timers survive page refreshes and are visible to both parents
- **Dark Mode**: Full dark mode support throughout the app
- **Mobile-First**: Optimized for 390px viewport with 48px minimum tap targets

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy (async)
- **Database**: SQLite with aiosqlite
- **Frontend**: React 18, Vite, React Router
- **Styling**: Tailwind CSS
- **Testing**: pytest (backend), vitest + React Testing Library (frontend)

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Node.js 18+ and npm
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd yara_tracking/babytracker
   ```

2. **Set up the backend**
   ```bash
   cd backend

   # Create virtual environment
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt

   # Set database URL (optional - defaults to ./babytracker.db)
   export DATABASE_URL="sqlite+aiosqlite:///$(pwd)/babytracker.db"

   # Start the server
   uvicorn main:app --reload
   ```

   The backend will be available at **http://localhost:8000**

3. **Set up the frontend** (in a new terminal)
   ```bash
   cd frontend

   # Install dependencies
   npm install

   # Start development server
   npm run dev
   ```

   The frontend will be available at **http://localhost:5173**

4. **Access the application**
   - Open http://localhost:5173 in your browser
   - On first visit, you'll see a "Welcome — who are you?" modal
   - Click "Admin" to proceed (default user created automatically)
   - Go to the Admin page to add proper users (e.g., "Mom", "Dad") and babies
   - Refresh and select your persona to start tracking!

### Running Tests

**Backend tests:**
```bash
cd backend
python -m pytest -v

# Run specific test file
python -m pytest tests/test_routers_feeds.py -v

# Run specific test
python -m pytest tests/test_routers_feeds.py::test_create_feed_event -v
```

**Frontend tests:**
```bash
cd frontend
npm test

# Watch mode
npm test -- --watch
```

## Project Structure

```
babytracker/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLAlchemy async engine config
│   ├── models.py            # ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── requirements.txt     # Python dependencies
│   ├── routers/             # API route handlers
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
│   └── tests/               # pytest test suite
│
└── frontend/
    ├── src/
    │   ├── App.jsx          # Router and context providers
    │   ├── main.jsx         # React entry point
    │   ├── pages/           # Route components
    │   │   ├── Dashboard.jsx
    │   │   ├── History.jsx
    │   │   ├── Calendar.jsx
    │   │   ├── Admin.jsx
    │   │   └── Settings.jsx
    │   ├── components/      # Reusable components
    │   │   ├── forms/       # Event edit/create forms
    │   │   ├── timers/      # Timer components
    │   │   ├── Layout.jsx
    │   │   ├── BottomNav.jsx
    │   │   ├── BabySwitcher.jsx
    │   │   └── PersonaGate.jsx
    │   ├── context/         # React contexts
    │   │   ├── PersonaContext.jsx
    │   │   ├── BabyContext.jsx
    │   │   └── SettingsContext.jsx
    │   ├── hooks/           # Custom React hooks
    │   └── __tests__/       # Component tests
    ├── package.json
    └── vite.config.js
```

## Configuration

### Backend

Environment variables (optional):
- `DATABASE_URL`: SQLite database path (default: `sqlite+aiosqlite:///./babytracker.db`)
- `CORS_ORIGINS`: Comma-separated list of allowed origins (default: `*`)
- `LOG_LEVEL`: Logging level (default: `info`)

### Frontend

The frontend proxies `/api` requests to the backend. In production, the backend serves the built frontend as static files.

### Settings (Runtime)

Access via Settings page in the app:
- **Units**: Imperial or Metric
- **Time Format**: 12h or 24h
- **Dark Mode**: Toggle dark theme

## Deployment

### Production Deployment (Proxmox LXC)

The app is designed for deployment on a Proxmox LXC container running Ubuntu 24.04:

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Set up the production environment**
   ```bash
   # Copy backend and frontend/dist/ to /opt/babytracker/
   # Set up Python virtual environment
   # Install dependencies
   ```

3. **Configure systemd service**
   ```ini
   [Unit]
   Description=Baby Tracker API
   After=network.target

   [Service]
   User=babytracker
   WorkingDirectory=/opt/babytracker/backend
   Environment="DATABASE_URL=sqlite+aiosqlite:////var/lib/babytracker/db.sqlite"
   ExecStart=/opt/babytracker/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

4. **Enable and start the service**
   ```bash
   sudo systemctl enable babytracker
   sudo systemctl start babytracker
   ```

The FastAPI app serves both the API (`/api/v1/*`) and the static frontend (`/`).

## Architecture Notes

### Server-Side Timers

Timers for feeds and sleep are stored in the database with `started_at` and `ended_at` timestamps. Active timers have `ended_at=null`. The frontend displays a live countdown based on the `started_at` timestamp, which means:
- Timers survive page refreshes
- Both parents see the same active timer
- Timers continue running even if all devices are offline

### Persona System

There's no traditional authentication. Instead:
- Users are managed via the Admin page
- On first visit, you select "who you are" from available users
- This choice is stored in localStorage
- All events are tagged with the user who logged them

### Network Security

The app is designed to run on a private network accessible only via Tailscale VPN. No passwords or authentication are implemented - network access control is handled by Tailscale.

## Development Tips

- Backend runs on port 8000, frontend dev server on 5173
- Frontend proxies `/api` to `http://localhost:8000` in development
- Database file is created in `backend/` directory by default
- Dark mode is implemented via Tailwind's `dark:` variants
- All timestamps are stored as ISO 8601 UTC strings
- Check the browser console for API errors during development

## License

This is a personal project. See license file for details.
