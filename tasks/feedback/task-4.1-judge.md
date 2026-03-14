---
task: "4.1"
iteration: 1
role_under_review: both
verdict: pass_with_concerns
retry_target: developer
loop_back: false
---

## Scorecard

### Dimension 1: Spec Compliance — 5/5 (non-blocking)
All six forms implemented with correct fields: FeedForm (type with breast L/R/both/bottle, started_at, ended_at, amount with oz/ml toggle, notes), SleepForm (type nap/night, started_at, ended_at, notes), DiaperForm (type wet/dirty/both, logged_at, notes), PumpForm (started_at, duration_minutes, left/right amounts with unit toggle, notes), MeasurementForm (measured_at as date, weight as lbs+oz or kg, height in/cm, head_cm, notes), MilestoneForm (occurred_at as date, title, notes). All forms show user dropdown, use POST for creation and PATCH for editing, and handle timezone conversion for datetime-local inputs.

### Dimension 2: Implementation Quality — 4/5 (non-blocking)
Clean, straightforward form components. Each form handles its own state, submission, and conditional create/update logic correctly. The `toLocalDatetime`/`fromLocalDatetime` helpers and the user-fetch `useEffect` are duplicated across files rather than extracted, but the forms are otherwise well-structured and readable.

### Dimension 3: Test Quality — 4/5 (non-blocking)
Tests cover rendering all fields, populating from existing events, POST vs PATCH routing, unit-specific behavior (oz vs ml, lbs+oz vs kg), the no-baby guard, and conditional cancel button rendering. FeedForm tests verify actual request body contents for both unit systems. MeasurementForm tests verify lbs+oz to total-oz conversion. No test covers error responses from the server (non-ok fetch), but this is acceptable for form-level tests at this stage.

### Dimension 4: Code Reuse & Consistency — 3/5 (non-blocking)
The `toLocalDatetime`/`fromLocalDatetime` utility pair is copy-pasted identically in FeedForm, SleepForm, DiaperForm, and PumpForm. The user-list fetch pattern (useEffect with `/api/v1/users`) is repeated in all 6 forms. These should be extracted to shared utilities. The forms otherwise follow consistent patterns with each other and with the broader codebase (Tailwind classes, context hooks).

### Dimension 5: Slop Detection — 5/5 (non-blocking)
No unnecessary comments, no generic variable names, no padding functions. Variable names are specific (`feedType`, `sleepType`, `diaperType`, `weightLbs`, `weightOzPart`). No TODO/FIXME markers. No unused imports. The code reads as purposeful throughout.

## Concerns (Non-Blocking)

- `toLocalDatetime`/`fromLocalDatetime` are duplicated in 4 files. Should be extracted to a shared `src/utils/datetime.js` module in a future cleanup pass.
- User-list fetch is duplicated in all 6 forms. Could be a `useUsers()` hook.
- PumpForm does not use `useBaby()` or `selectedBaby` — it constructs URLs as `/api/v1/pumps/${event.id}` and `/api/v1/pumps`. This is inconsistent with other forms that scope to baby. If the pump router is indeed not baby-scoped this is correct, but worth verifying against the backend.
- No error handling surfaced to the user on failed submissions — the `finally` block resets submitting but a non-ok response is silently ignored.

## Verdict Summary

PASS_WITH_CONCERNS. All six forms meet spec requirements, tests meaningfully verify rendering, submission routing, and unit-dependent behavior. The primary concern is duplicated utility code (`toLocalDatetime`/`fromLocalDatetime` and user-fetch) across form files, which should be consolidated in a future cleanup pass but does not block progress.
