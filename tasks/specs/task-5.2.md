# Task 5.2 — Settings Page

## Phase
5

## Description
Implement `pages/Settings.jsx`:

- **Dark Mode:** toggle switch, updates immediately (class on `<html>`)
- **Units:** radio/toggle between "Imperial (oz, lbs, in)" and "Metric (ml, kg, cm)". Updates via PATCH /settings. All amount displays across the app update.
- **Time Format:** radio between "24-hour" and "12-hour". Updates via PATCH /settings.
- **Who am I:** shows current persona, button to "Switch user" which re-opens the persona modal
- **About:** App name, version string

## Acceptance Criteria
Dark mode toggles instantly. Unit change is reflected in History and Dashboard. Time format change reflects everywhere.

## Verify Scope
both
