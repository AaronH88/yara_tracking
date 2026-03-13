# Task 1.10 — Settings Router

## Phase
1

## Description
Implement `routers/settings.py`:

- `GET /settings` — return all settings as a flat JSON object: `{ "units": "imperial", "time_format": "24h" }`
- `PATCH /settings` — update one or more settings

Seed defaults on first run (`create_tables` or a separate `seed_settings()` call in startup):
- `units`: `"imperial"`
- `time_format`: `"24h"`

## Acceptance Criteria
Settings persist across server restarts.

## Verify Scope
backend
