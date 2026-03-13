# Task 2.1 — Vite + Tailwind + React Router Setup

## Phase
2

## Description
Configure the frontend build:

**`vite.config.js`:** Set up proxy so `/api` requests in dev mode forward to `http://localhost:8000`.

**`tailwind.config.js`:** Enable dark mode via `class` strategy. Extend theme with no required changes (defaults are fine).

**`index.css`:** Import Tailwind directives. Set `font-family` to system sans-serif stack.

**`App.jsx`:** Set up `react-router-dom` `BrowserRouter` with routes:
- `/` → `Dashboard`
- `/history` → `History`
- `/calendar` → `Calendar`
- `/admin` → `Admin`
- `/settings` → `Settings`

Wrap app in context providers (create stubs for now): `PersonaProvider`, `BabyProvider`, `SettingsProvider`.

## Acceptance Criteria
`npm run dev` starts, all routes render without crashing.

## Verify Scope
frontend
