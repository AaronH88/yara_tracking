# Task 7.2 — Environment Configuration

## Phase
7

## Description
Add environment-based config to the backend:

- `DATABASE_URL` — SQLite path, default `sqlite+aiosqlite:////var/lib/babytracker/db.sqlite`
- `CORS_ORIGINS` — comma-separated allowed origins, default `*`
- `LOG_LEVEL` — default `info`

Load via `python-dotenv` or just `os.environ.get()`. Document in a `.env.example` file.

## Acceptance Criteria
Database path is configurable without code changes. Service uses `/var/lib/babytracker/db.sqlite` in production.

## Verify Scope
backend
