# Task 2.3 — Persona Gate (Who Are You Modal)

## Phase
2

## Description
In `App.jsx`, before rendering the main app:

If `persona` is null, render a full-screen modal:
- Title: "Welcome — who are you?"
- Fetches `GET /api/v1/users` and shows a button for each user
- Tap a user → sets persona in context and localStorage → modal dismisses
- If no users exist yet: show message "No users set up yet. Ask an admin to add users first." with a link to `/admin`

This modal must be mobile-friendly with large touch targets.

## Acceptance Criteria
First visit shows modal. Selecting a user dismisses it and shows the app. Refresh remembers the selection.

## Verify Scope
both
