# Baby Tracker v2 — Task List

## How This File Works

This file is the single source of truth for the agentic build loop.

Each time an agent is invoked it:
1. Reads the `→ NEXT:` cursor below to find its task
2. Reads the persona and spec listed in that task entry
3. Executes the task
4. Updates the checkbox for that entry `[ ]` → `[x]`
5. Advances the `→ NEXT:` cursor to the following entry
6. Exits

The judge is the only agent that can move the cursor backwards.
If the judge fails a task it unchecks the relevant entries,
resets the cursor, and writes feedback to a file for the developer to read.

Feedback files live in: `tasks/feedback/`
Persona files live in: `tasks/personas/`
Spec files live in: `tasks/specs/`

---

→ NEXT: Task 3.3 — TEST

---

## Task 1.1 — Migrate FeedEvent Table

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-1.1.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 1.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.1 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-1.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 1.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.1 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-1.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 1.1 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-1.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-1.1-verify.txt`
  Write verdict to: `tasks/feedback/task-1.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.2 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 1.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 1.2 — Migrate DiaperEvent Table and Create BurpEvent Table

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-1.2.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 1.2"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.2 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-1.2.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 1.2"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.2 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-1.2-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.2 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 1.2 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-1.2.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-1.2-verify.txt`
  Write verdict to: `tasks/feedback/task-1.2-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 1.2 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 2.1 — Feed Pause/Resume Endpoints

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 2 of 3
  Read spec: `tasks/specs/task-2.1.md`
  If retrying, read feedback: `tasks/feedback/task-2.1-verify.txt`
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 2.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.1 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 2 of 3
  Read spec: `tasks/specs/task-2.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 2.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.1 — VERIFY`

- [x] **VERIFY** — attempt 2 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-2.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 2.1 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-2.1-verify.txt`
  Write verdict to: `tasks/feedback/task-2.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.2 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 2.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 2.2 — Auto-Close Conflicting Timers

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.2.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 2.2"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.2 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.2.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 2.2"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.2 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-2.2-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.2 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 2.2 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.2.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-2.2-verify.txt`
  Write verdict to: `tasks/feedback/task-2.2-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.3 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 2.2 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 2.3 — Burp Timer Router

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.3.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 2.3"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.3 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.3.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 2.3"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.3 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-2.3-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.3 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 2.3 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.3.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-2.3-verify.txt`
  Write verdict to: `tasks/feedback/task-2.3-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.4 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 2.3 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 2.4 — Wake Window Endpoint

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.4.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 2.4"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.4 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.4.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 2.4"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.4 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-2.4-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.4 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 2.4 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.4.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-2.4-verify.txt`
  Write verdict to: `tasks/feedback/task-2.4-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.5 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 2.4 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 2.5 — Insights Endpoint

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.5.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 2.5"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.5 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.5.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 2.5"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.5 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-2.5-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 2.5 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 2.5 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-2.5.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-2.5-verify.txt`
  Write verdict to: `tasks/feedback/task-2.5-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 2.5 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 3.1 — Feed Timer Pause/Resume UI

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 2 of 3
  Read spec: `tasks/specs/task-3.1.md`
  If retrying, read feedback: `tasks/feedback/task-3.1-verify.txt`
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 3.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.1 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 2 of 3
  Read spec: `tasks/specs/task-3.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 3.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.1 — VERIFY`

- [x] **VERIFY** — attempt 2 of 3
  Run: `cd babytracker/frontend && npm test 2>&1 | tee ../../tasks/feedback/task-3.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 3.1 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-3.1-verify.txt`
  Write verdict to: `tasks/feedback/task-3.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.2 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 3.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 3.2 — Feed Timer Quick Switch Breast

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.2.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 3.2"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.2 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.2.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 3.2"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.2 — VERIFY`

- [x] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/frontend && npm test -- --watchAll=false 2>&1 | tee ../../tasks/feedback/task-3.2-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.2 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 3.2 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.2.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-3.2-verify.txt`
  Write verdict to: `tasks/feedback/task-3.2-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.3 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 3.2 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 3.3 — Feed Quality Rating UI

- [x] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.3.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 3.3"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.3 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.3.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 3.3"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.3 — VERIFY`

- [ ] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/frontend && npm test -- --watchAll=false 2>&1 | tee ../../tasks/feedback/task-3.3-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.3 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 3.3 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.3.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-3.3-verify.txt`
  Write verdict to: `tasks/feedback/task-3.3-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.4 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 3.3 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 3.4 — Auto-Close Toast Notification

- [ ] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.4.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 3.4"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.4 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.4.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 3.4"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.4 — VERIFY`

- [ ] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/frontend && npm test -- --watchAll=false 2>&1 | tee ../../tasks/feedback/task-3.4-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 3.4 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 3.4 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-3.4.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-3.4-verify.txt`
  Write verdict to: `tasks/feedback/task-3.4-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 4.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 3.4 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 4.1 — Burp Timer Component and Dashboard Integration

- [ ] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-4.1.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 4.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 4.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-4.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 4.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 4.1 — VERIFY`

- [ ] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-4.1-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a ../../tasks/feedback/task-4.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 4.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 4.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-4.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-4.1-verify.txt`
  Write verdict to: `tasks/feedback/task-4.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 5.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 4.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 5.1 — Nappy Size and Colour Fields

- [ ] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-5.1.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 5.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 5.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-5.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 5.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 5.1 — VERIFY`

- [ ] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/frontend && npm test -- --watchAll=false 2>&1 | tee ../../tasks/feedback/task-5.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 5.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 5.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-5.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-5.1-verify.txt`
  Write verdict to: `tasks/feedback/task-5.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 6.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 5.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 6.1 — Wake Window Component

- [ ] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-6.1.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 6.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 6.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-6.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 6.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 6.1 — VERIFY`

- [ ] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-6.1-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a ../../tasks/feedback/task-6.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 6.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 6.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-6.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-6.1-verify.txt`
  Write verdict to: `tasks/feedback/task-6.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 7.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 6.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Task 7.1 — Insights Component

- [ ] **DEV** — `persona: tasks/personas/developer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-7.1.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 7.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 7.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-7.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 7.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 7.1 — VERIFY`

- [ ] **VERIFY** — attempt 1 of 3
  Run: `cd babytracker/backend && python -m pytest -v 2>&1 | tee ../../tasks/feedback/task-7.1-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a ../../tasks/feedback/task-7.1-verify.txt`
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 7.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 7.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` — attempt 1 of 3
  Read spec: `tasks/specs/task-7.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-7.1-verify.txt`
  Write verdict to: `tasks/feedback/task-7.1-judge.md`
  Then read the verdict and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: FINAL JUDGE`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV: replace `_(none yet)_` with path to verdict file
  - Set cursor to: `→ NEXT: Task 7.1 — DEV`

  Feedback for DEV on retry: _(none yet)_

---

## Final Judge

- [ ] **FINAL JUDGE** — `persona: tasks/personas/judge.md`
  You are doing a final review of the entire project, not a single task.

  Read:
  - `tasks/ARCHITECTURE_REF.md` — what was planned
  - `git log --oneline` — what was actually built
  - All `tasks/feedback/*-judge.md` files — what concerns were raised during the build

  Write your full verdict to: `tasks/feedback/final-judge.md`

  You are looking for systemic issues that per-task judges may have missed:
  - Patterns that were inconsistent across phases
  - Concerns that appeared in multiple pass_with_concerns verdicts and were never resolved
  - Anything that would make this codebase hard to maintain or extend

  Then update `tasks/BUILD_STATUS.md` — overwrite the entire file with one of:

  If PASS:
  APPROVED

  If FAIL:
  FAILED — see tasks/feedback/final-judge.md

