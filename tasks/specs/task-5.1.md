# Task 5.1 — Nappy Size and Colour Fields

## Phase
5

## Description
Update `components/forms/DiaperForm.jsx`:

**Wet amount selector** (shown when type includes 'wet'):
- Three buttons: Small / Medium / Heavy
- Optional — null is valid

**Dirty colour selector** (shown when type includes 'dirty'):
- Four coloured circle buttons:
  - 🟡 Yellow
  - 🟢 Green
  - 🟤 Brown
  - ⚪ Other
- Optional — null is valid

Update `pages/Dashboard.jsx` quick-log nappy buttons:
- Keep existing one-tap Wet/Dirty/Both buttons unchanged
- After a one-tap log, show a small dismissable "Add details →" chip
- Tapping "Add details →" opens DiaperForm pre-filled with the just-logged event

Update history list nappy rows to show amount and colour labels when present.

## Acceptance Criteria
- Existing one-tap quick log requires no extra taps
- "Add details" path works and pre-fills correctly
- wet_amount saves correctly for wet/both nappies
- dirty_colour saves correctly for dirty/both nappies
- Fields hidden when not relevant to nappy type
- History rows show amount/colour when set
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
frontend
