# Task 4.4 — Calendar Day Timeline

## Phase
4

## Description
Below the month grid (or on tap of a day), render `components/calendar/DayTimeline.jsx`:

- Vertical timeline from 00:00 to 23:59 (or compressed to show only hours with events)
- Sleep events: horizontal coloured bars spanning their duration
- Feed events: icon marker at `started_at` with a label (type, duration, amount)
- Diaper events: icon marker at `logged_at`
- Milestones: star icon at date
- If any event overlaps, offset them horizontally (don't hide them)
- Tapping any event opens the edit form

Fetch from `GET /api/v1/babies/{id}/calendar/day?date=`

## Acceptance Criteria
Sleep blocks render with correct duration. Feed/diaper markers appear at right times. Overlapping events don't hide each other.

## Verify Scope
both
