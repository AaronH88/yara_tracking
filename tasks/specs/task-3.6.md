# Task 3.6 — Quick Actions & Dashboard

## Phase
3

## Description
Implement the Dashboard page (`pages/Dashboard.jsx`):

**Structure (top to bottom):**

1. **Active Timers section** — if any feed or sleep is active, render the relevant timer component full-width at the top. This is the most prominent thing.

2. **Quick Log section** — grid of large tap targets:
   - Diaper: Wet / Dirty / Both (one tap = logged immediately with current time + persona, no form required)
   - "Log Feed" shortcut (opens FeedTimer)
   - "Log Sleep" shortcut (opens SleepTimer)

3. **Last Events summary** — cards showing:
   - Last feed: type, how long ago, duration
   - Last sleep: type, how long ago, duration
   - Last diaper: type, how long ago
   - Since last feed: time elapsed (prominent — parents check this constantly)

## Acceptance Criteria
Dashboard renders all sections. One-tap diaper logging works. Active timers appear immediately when a timer is running.

## Verify Scope
both
