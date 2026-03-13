# Task 6.1 — PWA Manifest & Meta Tags

## Phase
6

## Description
Make the app installable as a PWA:

In `index.html`:
- Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Add `<meta name="apple-mobile-web-app-capable" content="yes">`
- Add `<meta name="theme-color" ...>` (dark and light variants)
- Link a `manifest.json`

Create `public/manifest.json`:
```json
{
  "name": "Baby Tracker",
  "short_name": "Baby",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "icons": [...]
}
```

Create a simple app icon (SVG → PNG) at 192x192 and 512x512.

## Acceptance Criteria
Chrome/Safari "Add to Home Screen" works. App opens in standalone mode (no browser chrome). Correct icon appears.

## Verify Scope
frontend
