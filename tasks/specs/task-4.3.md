# Task 4.3 — Calendar Month View

## Phase
4

## Description
Implement the month grid in `pages/Calendar.jsx`:

- Month/year header with prev/next month navigation
- 7-column grid (Sun–Sat)
- Each day cell shows:
  - Day number
  - Small coloured dots for event types present that day: 🔵 feeds, 🟣 sleep, 🟡 diapers (or similar distinct colours)
  - Slightly larger dot or star if a milestone was logged
- Today's date is highlighted
- Tap a day → navigate to or reveal the day timeline below

Fetch from `GET /api/v1/babies/{id}/calendar/month?year=&month=`

## Acceptance Criteria
Correct days layout. Dots reflect real data. Navigation between months works.

## Verify Scope
both
