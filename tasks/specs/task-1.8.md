# Task 1.8 — Diaper, Pump, Measurement, Milestone Routers

## Phase
1

## Description
Implement the remaining routers:

**Diapers** (`routers/diapers.py`): CRUD, `logged_at` is required, no timer concept.

**Pumps** (`routers/pumps.py`): CRUD, not baby-scoped (pump events belong to a user, not a baby). Route prefix: `/api/v1/pumps`.

**Measurements** (`routers/measurements.py`): CRUD, baby-scoped.

**Milestones** (`routers/milestones.py`): CRUD, baby-scoped.

## Acceptance Criteria
All CRUD operations work via `/docs`.

## Verify Scope
backend
