# Task 6.2 — Mobile UX Polish

## Phase
6

## Description
Review and fix mobile UX issues:

- All interactive elements minimum 48px tap target
- No horizontal overflow / scroll on any page
- Safe area insets: bottom nav has padding for iPhone home bar (`env(safe-area-inset-bottom)`)
- Input focus doesn't zoom on iOS (font-size ≥ 16px on all inputs)
- Form datetime-local inputs show time correctly (not shifted by timezone)
- Loading states: show skeleton or spinner when data is fetching
- Error states: if API is unreachable, show a banner rather than crashing
- Empty states: friendly message when no events logged yet

## Acceptance Criteria
App is comfortable to use one-handed on a phone. No layout bugs. Feels like a native app when added to home screen.

## Verify Scope
frontend
