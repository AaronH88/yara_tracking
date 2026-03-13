# Task 4.2 — History Page

## Phase
4

## Description
Implement `pages/History.jsx`:

- Fetches events across all types for the selected baby, most recent first
- Filter bar at top: All / Feeds / Sleeps / Diapers / Pumps / Milestones
- Date filter: "Today" (default) / "Last 7 days" / "All"
- Each event row shows:
  - Event type icon/label
  - Primary time (started_at or logged_at)
  - Duration for feeds/sleeps
  - Key details (feed type, diaper type, amount)
  - Who logged it (small text)
  - Tap row → opens edit form in a bottom sheet/modal
  - Swipe left or long-press → delete (with confirmation)
- Infinite scroll or "Load more" button

## Acceptance Criteria
Events appear in order. Filter works. Edit and delete work. "Logged by" shows correctly.

## Verify Scope
both
