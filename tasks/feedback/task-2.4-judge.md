---
task: "2.4"
iteration: 1
role_under_review: both
verdict: pass_with_concerns
retry_target: developer
loop_back: false
---

## Scorecard

| Dimension | Score | Blocking? |
|---|---|---|
| Spec Compliance | 4 | No |
| Implementation Quality | 5 | No |
| Test Quality | 4 | No |
| Code Reuse & Consistency | 5 | No |
| Slop Detection | 4 | No |

### Spec Compliance — 4/5

All five acceptance criteria are met:
- `is_sleeping=true` when active sleep exists — implemented and tested
- Correct `awake_since` from last ended sleep — implemented and tested
- Fallback to `baby.created_at` when no sleeps — implemented with minor deviation (truncates to midnight)
- `awake_minutes` is correct integer — implemented and tested with time mocking
- pytest passes — 803 passed, 1 pre-existing failure (unrelated `test_listens_on_port_8000`)

Minor deviation: the fallback path uses `datetime.combine(baby.created_at.date(), datetime.min.time())` instead of `baby.created_at` directly. This truncates to midnight UTC rather than using the actual creation timestamp. The spec says `awake_since = baby.created_at`. In practice this only matters for a baby's first day before any sleeps are recorded, so it's not blocking.

### Implementation Quality — 5/5

The router is 65 lines, clear, and does exactly what the spec asks. Query construction is straightforward. The schema is minimal and correct. Router registration in `main.py` follows the existing pattern.

### Test Quality — 4/5

13 tests organized by acceptance criterion with clear section headers. Good coverage:
- Active sleep detection (2 tests)
- Awake since from last sleep (2 tests)
- Fallback to baby.created_at (1 test)
- Awake minutes type and calculation with time mock (2 tests)
- Response shape (1 test)
- Cross-baby isolation (2 tests)
- Mixed state and stop-then-check (2 tests)
- Nonexistent baby (1 test)

The nonexistent baby test (`test_wake_window_nonexistent_baby_id_raises_error`) asserts that the endpoint crashes with `AttributeError` rather than returning a proper 404. This is documenting a bug as a passing test rather than catching a regression — it would pass even if the crash gets worse. Not blocking since the spec doesn't require baby existence validation.

### Code Reuse & Consistency — 5/5

Follows the exact same patterns as other routers: APIRouter with tags, Depends(get_db), select() queries, response_model. Schema added at the end of `schemas.py`. Router imported and registered in `main.py` identically to others.

### Slop Detection — 4/5

Code is clean. No restating comments, no unnecessary abstractions. The variable name `data` is used throughout tests but this is standard test idiom. The docstring on `seed_baby_and_user` restates what the fixture does, but fixture docstrings are acceptable for test readability.

## Verdict Summary

PASS_WITH_CONCERNS. The implementation is clean, correct, and follows existing patterns. All acceptance criteria are met. Tests are thorough and well-organized. The two concerns below are not worth a retry cycle.

## Concerns (Non-Blocking)

1. **`routers/wake_window.py:50-53`**: The fallback `awake_since` truncates `baby.created_at` to midnight UTC via `datetime.combine()`. The spec says to use `baby.created_at` directly. This only matters for a baby with zero sleep records on their first day, but it's a spec deviation.

2. **`tests/test_routers_wake_window.py:349-355`**: `test_wake_window_nonexistent_baby_id_raises_error` asserts `AttributeError` on a missing baby. This is documenting a crash rather than testing correct behavior. If a future change adds a proper 404, this test will break — it's testing the wrong thing.
