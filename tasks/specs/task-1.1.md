# Task 1.1 — Migrate FeedEvent Table

## Phase
1

## Description
Add new columns to the existing FeedEvent table without losing any data.

Write a migration function `migrate_feed_event_v2(engine)` in a new file
`babytracker/backend/migrations.py`:
- `ALTER TABLE feededent ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0`
- `ALTER TABLE feededent ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT false`
- `ALTER TABLE feededent ADD COLUMN paused_at DATETIME`
- `ALTER TABLE feededent ADD COLUMN quality TEXT`

Each ALTER must be wrapped in a try/except that ignores
`OperationalError: duplicate column name` so the migration is idempotent.

Call `migrate_feed_event_v2` from the `lifespan` startup function in
`main.py` before `create_tables()`.

Update the `FeedEvent` SQLAlchemy model to include all four new columns.
Update `FeedEventCreate`, `FeedEventUpdate`, and `FeedEventResponse`
Pydantic schemas to include the new fields (all optional, all nullable).

## Acceptance Criteria
- Migration runs without error on a database that already has a FeedEvent table
- Migration is idempotent — running it twice does not error
- Existing feed records are unaffected (all new columns default to null/0/false)
- All four new columns present in the model and schemas
- `python -m pytest babytracker/backend/tests/ -v` passes

## Verify Scope
backend
