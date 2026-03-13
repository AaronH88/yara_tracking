# Task 1.4 — FastAPI App Entry Point

## Phase
1

## Description
In `backend/main.py`:

- Create FastAPI app instance
- Call `create_tables()` on startup via `lifespan`
- Register all routers with prefix `/api/v1`
- Mount the React `dist/` folder as static files at `/static`
- Add a catch-all route that serves `frontend/dist/index.html` for all non-API GET requests (enables client-side routing)
- Add CORS middleware allowing all origins (Tailscale network is trusted)

## Acceptance Criteria
`uvicorn main:app --reload` starts without errors. `GET /api/v1/` returns a 404 or health response (not an error).

## Verify Scope
backend
