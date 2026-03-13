# Task 1.5 — Babies & Users Routers

## Phase
1

## Description
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

## Acceptance Criteria
All endpoints respond correctly. Test with curl or the FastAPI auto-docs at `/docs`.

## Verify Scope
backend
