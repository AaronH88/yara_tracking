# Task 3.3 — Feed Timer Component

## Phase
3

## Description
Implement `components/timers/FeedTimer.jsx`:

**When no active feed:**
- Shows 4 large buttons: "Breast L", "Breast R", "Both Sides", "Bottle"
- Tapping any starts a feed (POST to API with type, started_at = now, user_id from persona)

**When an active feed exists for this baby:**
- Shows the feed type label (e.g. "Breast — Left")
- Shows `ActiveTimer` component ticking up from `started_at`
- Shows "Stop Feed" button
- Tapping Stop → PATCH with `ended_at = now()` → opens FeedForm to add details (amount, notes) before saving

**Breast feed specifics:**
- Track which side was used last — show a subtle "last used" label under each side button
- Store last side in `localStorage` per baby

## Acceptance Criteria
Start → timer ticks → stop → form → saved. Active timer visible to both parents within 10s.

## Verify Scope
both
