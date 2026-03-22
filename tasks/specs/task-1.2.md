# Task 1.2 — Migrate DiaperEvent Table and Create BurpEvent Table

## Phase
1

## Description
**Part A — DiaperEvent migration:**

Add to `migrations.py` a new function `migrate_diaper_event_v2(engine)`:
- `ALTER TABLE diaperevent ADD COLUMN wet_amount TEXT`
- `ALTER TABLE diaperevent ADD COLUMN dirty_colour TEXT`

Same idempotent pattern as Task 1.1. Call from lifespan startup.

Update `DiaperEvent` model and schemas to include both new optional fields.

**Part B — BurpEvent new table:**

Add `BurpEvent` model to `models.py`:
```
id          INTEGER PRIMARY KEY
baby_id     INTEGER FK → Baby NOT NULL
user_id     INTEGER FK → User
started_at  DATETIME NOT NULL
ended_at    DATETIME
notes       TEXT
created_at  DATETIME default now
```

Create `BurpEventCreate`, `BurpEventUpdate`, `BurpEventResponse` schemas
in `schemas.py`.

`create_tables()` already handles new tables — no migration needed for BurpEvent.

## Acceptance Criteria
- DiaperEvent migration is idempotent
- Existing diaper records are unaffected
- BurpEvent table is created on startup
- All new model columns and schema fields present and correct
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
