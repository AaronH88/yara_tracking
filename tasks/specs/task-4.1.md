# Task 4.1 — Event Edit Forms

## Phase
4

## Description
Implement form components for editing/creating events:

**`FeedForm.jsx`:**
- Fields: type (breast L/R/both/bottle), started_at (datetime-local input), ended_at (datetime-local input), amount (number + oz/ml toggle respecting settings), notes (textarea)
- Used for editing existing events AND retroactive creation
- Submit calls PATCH or POST as appropriate

**`SleepForm.jsx`:**
- Fields: type (nap/night), started_at, ended_at, notes

**`DiaperForm.jsx`:**
- Fields: type (wet/dirty/both), logged_at, notes

**`PumpForm.jsx`:**
- Fields: started_at, duration_minutes, left amount, right amount (with unit toggle), notes

**`MeasurementForm.jsx`:**
- Fields: measured_at (date only), weight (lbs+oz or kg), height (in or cm), head circumference (cm), notes
- Weight input: for imperial, show two fields (lbs and oz); for metric, single kg field

**`MilestoneForm.jsx`:**
- Fields: occurred_at (date), title, notes

All forms should show who logged it (persona), allow changing it via a dropdown of users.

## Acceptance Criteria
All forms render. Submission creates/updates events. Times persist correctly (no timezone shifting).

## Verify Scope
both
