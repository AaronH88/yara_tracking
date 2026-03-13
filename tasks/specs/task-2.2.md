# Task 2.2 — Context Providers

## Phase
2

## Description
Implement the three context providers:

**`SettingsContext.jsx`:**
- Fetches settings from `GET /api/v1/settings` on mount
- Exposes `settings`, `updateSetting(key, value)`, `isDark`, `toggleDark`
- Dark mode: reads from `localStorage` first (`darkMode: true/false`), syncs `dark` class on `document.documentElement`
- Re-fetches settings on focus (in case other parent changed them)

**`PersonaContext.jsx`:**
- Reads `localStorage` key `babytracker_persona` (`{ userId, userName }`)
- Exposes `persona`, `setPersona(user)`, `clearPersona()`
- If no persona set, `persona` is `null`

**`BabyContext.jsx`:**
- Fetches `GET /api/v1/babies` on mount
- Exposes `babies`, `selectedBaby`, `setSelectedBaby(baby)`
- Persists `selectedBabyId` in `localStorage`
- Auto-selects first baby if none stored

## Acceptance Criteria
Contexts provide data to children. Persona and baby selection survive page refresh.

## Verify Scope
both
