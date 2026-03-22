# Task 7.1 — Insights Component

## Phase
7

## Description
Create `components/Insights.jsx`:

Fetches `GET /api/v1/babies/{baby_id}/insights` on mount and every 5 minutes.
Shows a skeleton loader while fetching.
Does not render if `has_enough_data=false` (baby has less than 2 days of data).

Renders three cards and an alerts section:

**Feeds card:**
- "Feeds since midnight: 6"
- "This week avg: 11/day"

**Sleep card:**
- "Sleep last 24h: 14h 7m"
- "Naps today: 3"
- "Longest stretch last night: 3h 5m"

**Nappies card:**
- "Wet nappies today: 4 (avg: 6)"
- "Last dirty: today" (amber if 1 day ago, red if 2+ days)

**Alerts section** (only rendered when alerts.length > 0):
- Each alert as a chip with appropriate icon
- warning type: 🚨 amber chip
- info type: ℹ️ blue chip / 🎉 for positive

Add Insights component to the bottom of `pages/Dashboard.jsx`.

## Acceptance Criteria
- All insight values render correctly
- Skeleton shown while loading
- No render when has_enough_data=false
- Alerts section hidden when no alerts
- Each card renders correct values with correct units
- Dirty nappy last seen changes colour correctly
- Refreshes every 5 minutes
- `cd frontend && npm test -- --watchAll=false` passes

## Verify Scope
both
