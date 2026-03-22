# Task 3.3 — Feed Quality Rating UI

## Phase
3

## Description
Update the post-feed form (shown after tapping Stop in FeedTimer):

- Add "How did the feed go?" section below existing fields
- Three large buttons in a row:
  - 👍 Good
  - 😐 Okay
  - 👎 Poor
- Tapping selects (highlighted with Tailwind ring), tapping again deselects
- Selected value included as `quality` in the PATCH request when saving
- Add `quality` field to `FeedForm.jsx` for editing existing feeds

Update history list rows to show quality icon when present (small, right-aligned).

## Acceptance Criteria
- Quality selector renders in post-feed form
- Selection highlights correctly
- Quality saves to database via PATCH
- Null quality is valid (no selection = null)
- Quality icon appears in history rows when set
- Quality editable via feed edit form
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
frontend
