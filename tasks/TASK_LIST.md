# Baby Tracker — Task List

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

→ NEXT: Task 2.2 — DEV

---

## Task 0.1 — Initialise Project Structure

- [x] **DEV** — `persona: tasks/personas/developer.md` —  
  Read spec: `tasks/specs/task-0.1.md`
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 0.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 0.1 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Read spec: `tasks/specs/task-0.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 0.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 0.1 — VERIFY`

- [x] **VERIFY** —
  Run the test suite:
  ```
  cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-0.1-verify.txt
  ```
  If exit code 0 (tests pass):
  - Check this box
  - Set cursor to: `→ NEXT: Task 0.1 — JUDGE`
  If exit code non-zero (tests fail):
  - Do NOT check this box
  - Uncheck DEV and TEST above (they must be redone)
  - Write failure summary to: `tasks/feedback/task-0.1-verify-fail.txt`
  - Update DEV and TEST attempt numbers by incrementing by 1
  - If attempt number would exceed 3: replace checkbox with `[BLOCKED]` and stop
  - Set cursor to: `→ NEXT: Task 0.1 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Read spec: `tasks/specs/task-0.1.md`
  Read diff: `git diff HEAD~2` (covers dev + test commits)
  Read verify output: `tasks/feedback/task-0.1-verify.txt`
  Write verdict to: `tasks/feedback/task-0.1-judge.md` (using the format in your persona)
  Then read the verdict file you just wrote and act on it:

  If verdict is PASS or PASS_WITH_CONCERNS:
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.1 — DEV`

  If verdict is FAIL:
  - Do NOT check this box
  - Uncheck DEV, TEST, VERIFY above (they must be redone)
  - Increment attempt numbers on DEV, TEST, VERIFY, JUDGE by 1
  - If any attempt number would exceed 3: replace that checkbox with `[BLOCKED]` and stop
  - Update the feedback reference on DEV below to point to your verdict file
  - Set cursor to: `→ NEXT: Task 0.1 — DEV`

  Feedback for DEV on retry: _(none yet — judge will update this)_

---

## Task 1.1 — Database Setup

- [x] **DEV** — `persona: tasks/personas/developer.md` —  
  Read spec: `tasks/specs/task-1.1.md`
  If retrying, read feedback: _(none yet)_
  Implement the task. When done:
  - Run `git add -A && git commit -m "dev: task 1.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.1 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Read spec: `tasks/specs/task-1.1.md`
  Read the diff: `git diff HEAD~1`
  Write tests for what the developer just built. When done:
  - Run `git add -A && git commit -m "test: task 1.1"`
  - Check this box
  - Set cursor to: `→ NEXT: Task 1.1 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.1-verify.txt`
  If pass: check box, set cursor to `→ NEXT: Task 1.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment attempts, set cursor to `→ NEXT: Task 1.1 — DEV`
  If any attempt > 3: mark `[BLOCKED]` and stop.

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Read spec: `tasks/specs/task-1.1.md`
  Read diff: `git diff HEAD~2`
  Read verify output: `tasks/feedback/task-1.1-verify.txt`
  Write verdict to: `tasks/feedback/task-1.1-judge.md`
  If PASS/PASS_WITH_CONCERNS: check box, set cursor to `→ NEXT: Task 1.2 — DEV`
  If FAIL: uncheck DEV/TEST/VERIFY/JUDGE, increment attempts, update feedback reference on DEV, set cursor to `→ NEXT: Task 1.1 — DEV`
  If any attempt > 3: mark `[BLOCKED]` and stop.
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.2 — Database Models

- [x] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-1.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.2"`
  On done: check box, set cursor to `→ NEXT: Task 1.2 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Read spec: `tasks/specs/task-1.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.2"`
  On done: check box, set cursor to `→ NEXT: Task 1.2 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.2 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.2-verify.txt`
  Verdict → `tasks/feedback/task-1.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.3 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.3 — Pydantic Schemas

- [x] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-1.3.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.3"`
  On done: check box, cursor → `→ NEXT: Task 1.3 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.3.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.3"`
  On done: check box, cursor → `→ NEXT: Task 1.3 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.3-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.3 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.3 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.3.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.3-verify.txt`
  Verdict → `tasks/feedback/task-1.3-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.4 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.3 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.4 — FastAPI App Entry Point

- [x] **DEV** — `persona: tasks/personas/developer.md` —  
  Read spec: `tasks/specs/task-1.4.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.4"`
  On done: check box, cursor → `→ NEXT: Task 1.4 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.4.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.4"`
  On done: check box, cursor → `→ NEXT: Task 1.4 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.4-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.4 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.4 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.4.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.4-verify.txt`
  Verdict → `tasks/feedback/task-1.4-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.5 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.4 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.5 — Babies & Users Routers

- [x] **DEV** — `persona: tasks/personas/developer.md` —  
  Read spec: `tasks/specs/task-1.5.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.5"`
  On done: check box, cursor → `→ NEXT: Task 1.5 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.5.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.5"`
  On done: check box, cursor → `→ NEXT: Task 1.5 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.5-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.5 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.5 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.5.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.5-verify.txt`
  Verdict → `tasks/feedback/task-1.5-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.6 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.5 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.6 — Feed Events Router

- [x] **DEV** — `persona: tasks/personas/developer.md` —  
  Read spec: `tasks/specs/task-1.6.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.6"`
  On done: check box, cursor → `→ NEXT: Task 1.6 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.6.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.6"`
  On done: check box, cursor → `→ NEXT: Task 1.6 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.6-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.6 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.6 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.6.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.6-verify.txt`
  Verdict → `tasks/feedback/task-1.6-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.7 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.6 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.7 — Sleep Events Router

- [x] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-1.7.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.7"`
  On done: check box, cursor → `→ NEXT: Task 1.7 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.7.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.7"`
  On done: check box, cursor → `→ NEXT: Task 1.7 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.7-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.7 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.7 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.7.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.7-verify.txt`
  Verdict → `tasks/feedback/task-1.7-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.8 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.7 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.8 — Remaining Routers

- [x] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-1.8.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 1.8"`
  On done: check box, cursor → `→ NEXT: Task 1.8 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.8.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.8"`
  On done: check box, cursor → `→ NEXT: Task 1.8 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.8-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.8 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.8 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.8.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.8-verify.txt`
  Verdict → `tasks/feedback/task-1.8-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.9 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.8 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.9 — Calendar Router

- [x] **DEV** (attempt 2) — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-1.9.md`
  If retrying, read feedback: `tasks/feedback/task-1.9-verify.txt`
  Commit: `git add -A && git commit -m "dev: task 1.9"`
  On done: check box, cursor → `→ NEXT: Task 1.9 — TEST`

- [x] **TEST** (attempt 2) — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.9.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.9"`
  On done: check box, cursor → `→ NEXT: Task 1.9 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.9-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.9 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.9 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.9.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.9-verify.txt`
  Verdict → `tasks/feedback/task-1.9-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 1.10 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.9 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 1.10 — Settings Router

- [x] **DEV** (attempt 2) — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-1.10.md`
  If retrying, read feedback: `tasks/feedback/task-1.10-verify-fail.txt`
  Commit: `git add -A && git commit -m "dev: task 1.10"`
  On done: check box, cursor → `→ NEXT: Task 1.10 — TEST`

- [x] **TEST** (attempt 2) — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-1.10.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 1.10"`
  On done: check box, cursor → `→ NEXT: Task 1.10 — VERIFY`

- [x] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-1.10-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 1.10 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 1.10 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-1.10.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-1.10-verify.txt`
  Verdict → `tasks/feedback/task-1.10-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 2.1 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 1.10 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 2.1 — Vite + Tailwind + React Router Setup

- [x] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-2.1.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 2.1"`
  On done: check box, cursor → `→ NEXT: Task 2.1 — TEST`

- [x] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-2.1.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 2.1"`
  On done: check box, cursor → `→ NEXT: Task 2.1 — VERIFY`

- [x] **VERIFY** —
  Run: `cd frontend && npm test 2>&1 | tee tasks/feedback/task-2.1-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 2.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 2.1 — DEV`

- [x] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-2.1.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-2.1-verify.txt`
  Verdict → `tasks/feedback/task-2.1-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 2.2 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 2.1 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 2.2 — Context Providers

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-2.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 2.2"`
  On done: check box, cursor → `→ NEXT: Task 2.2 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-2.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 2.2"`
  On done: check box, cursor → `→ NEXT: Task 2.2 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-2.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 2.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 2.2 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-2.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-2.2-verify.txt`
  Verdict → `tasks/feedback/task-2.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 2.3 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 2.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 2.3 — Persona Gate (Who Are You Modal)

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-2.3.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 2.3"`
  On done: check box, cursor → `→ NEXT: Task 2.3 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-2.3.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 2.3"`
  On done: check box, cursor → `→ NEXT: Task 2.3 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-2.3-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-2.3-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 2.3 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 2.3 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-2.3.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-2.3-verify.txt`
  Verdict → `tasks/feedback/task-2.3-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 2.4 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 2.3 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 2.4 — Layout Shell

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-2.4.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 2.4"`
  On done: check box, cursor → `→ NEXT: Task 2.4 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-2.4.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 2.4"`
  On done: check box, cursor → `→ NEXT: Task 2.4 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-2.4-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 2.4 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 2.4 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-2.4.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-2.4-verify.txt`
  Verdict → `tasks/feedback/task-2.4-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 3.1 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 2.4 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 3.1 — useTimer Hook

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-3.1.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 3.1"`
  On done: check box, cursor → `→ NEXT: Task 3.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-3.1.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 3.1"`
  On done: check box, cursor → `→ NEXT: Task 3.1 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-3.1-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 3.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 3.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-3.1.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-3.1-verify.txt`
  Verdict → `tasks/feedback/task-3.1-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 3.2 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 3.1 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 3.2 — useActiveEvents Hook

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-3.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 3.2"`
  On done: check box, cursor → `→ NEXT: Task 3.2 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-3.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 3.2"`
  On done: check box, cursor → `→ NEXT: Task 3.2 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-3.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 3.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 3.2 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-3.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-3.2-verify.txt`
  Verdict → `tasks/feedback/task-3.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 3.3 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 3.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 3.3 — Feed Timer Component

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-3.3.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 3.3"`
  On done: check box, cursor → `→ NEXT: Task 3.3 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-3.3.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 3.3"`
  On done: check box, cursor → `→ NEXT: Task 3.3 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-3.3-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-3.3-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 3.3 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 3.3 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-3.3.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-3.3-verify.txt`
  Verdict → `tasks/feedback/task-3.3-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 3.4 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 3.3 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 3.4 — Sleep Timer Component

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-3.4.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 3.4"`
  On done: check box, cursor → `→ NEXT: Task 3.4 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-3.4.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 3.4"`
  On done: check box, cursor → `→ NEXT: Task 3.4 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-3.4-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-3.4-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 3.4 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 3.4 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-3.4.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-3.4-verify.txt`
  Verdict → `tasks/feedback/task-3.4-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 3.5 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 3.4 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 3.5 — ActiveTimer Display Component

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-3.5.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 3.5"`
  On done: check box, cursor → `→ NEXT: Task 3.5 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-3.5.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 3.5"`
  On done: check box, cursor → `→ NEXT: Task 3.5 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-3.5-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 3.5 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 3.5 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-3.5.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-3.5-verify.txt`
  Verdict → `tasks/feedback/task-3.5-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 3.6 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 3.5 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 3.6 — Quick Actions & Dashboard

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-3.6.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 3.6"`
  On done: check box, cursor → `→ NEXT: Task 3.6 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-3.6.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 3.6"`
  On done: check box, cursor → `→ NEXT: Task 3.6 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-3.6-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-3.6-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 3.6 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 3.6 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-3.6.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-3.6-verify.txt`
  Verdict → `tasks/feedback/task-3.6-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 4.1 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 3.6 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 4.1 — Event Edit Forms

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-4.1.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 4.1"`
  On done: check box, cursor → `→ NEXT: Task 4.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-4.1.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 4.1"`
  On done: check box, cursor → `→ NEXT: Task 4.1 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-4.1-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-4.1-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 4.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 4.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-4.1.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-4.1-verify.txt`
  Verdict → `tasks/feedback/task-4.1-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 4.2 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 4.1 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 4.2 — History Page

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-4.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 4.2"`
  On done: check box, cursor → `→ NEXT: Task 4.2 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-4.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 4.2"`
  On done: check box, cursor → `→ NEXT: Task 4.2 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-4.2-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-4.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 4.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 4.2 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-4.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-4.2-verify.txt`
  Verdict → `tasks/feedback/task-4.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 4.3 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 4.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 4.3 — Calendar Month View

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-4.3.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 4.3"`
  On done: check box, cursor → `→ NEXT: Task 4.3 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-4.3.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 4.3"`
  On done: check box, cursor → `→ NEXT: Task 4.3 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-4.3-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-4.3-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 4.3 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 4.3 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-4.3.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-4.3-verify.txt`
  Verdict → `tasks/feedback/task-4.3-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 4.4 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 4.3 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 4.4 — Calendar Day Timeline

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-4.4.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 4.4"`
  On done: check box, cursor → `→ NEXT: Task 4.4 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-4.4.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 4.4"`
  On done: check box, cursor → `→ NEXT: Task 4.4 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-4.4-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-4.4-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 4.4 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 4.4 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-4.4.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-4.4-verify.txt`
  Verdict → `tasks/feedback/task-4.4-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 5.1 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 4.4 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 5.1 — Admin Page

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-5.1.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 5.1"`
  On done: check box, cursor → `→ NEXT: Task 5.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-5.1.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 5.1"`
  On done: check box, cursor → `→ NEXT: Task 5.1 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-5.1-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-5.1-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 5.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 5.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-5.1.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-5.1-verify.txt`
  Verdict → `tasks/feedback/task-5.1-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 5.2 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 5.1 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 5.2 — Settings Page

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-5.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 5.2"`
  On done: check box, cursor → `→ NEXT: Task 5.2 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-5.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 5.2"`
  On done: check box, cursor → `→ NEXT: Task 5.2 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-5.2-verify.txt && cd ../frontend && npm test -- --watchAll=false 2>&1 | tee -a tasks/feedback/task-5.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 5.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 5.2 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-5.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-5.2-verify.txt`
  Verdict → `tasks/feedback/task-5.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 6.1 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 5.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 6.1 — PWA Manifest & Meta Tags

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-6.1.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 6.1"`
  On done: check box, cursor → `→ NEXT: Task 6.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-6.1.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 6.1"`
  On done: check box, cursor → `→ NEXT: Task 6.1 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-6.1-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 6.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 6.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-6.1.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-6.1-verify.txt`
  Verdict → `tasks/feedback/task-6.1-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 6.2 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 6.1 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 6.2 — Mobile UX Polish

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-6.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 6.2"`
  On done: check box, cursor → `→ NEXT: Task 6.2 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-6.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 6.2"`
  On done: check box, cursor → `→ NEXT: Task 6.2 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-6.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 6.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 6.2 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-6.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-6.2-verify.txt`
  Verdict → `tasks/feedback/task-6.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 6.3 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 6.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 6.3 — Retroactive Entry UX

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-6.3.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 6.3"`
  On done: check box, cursor → `→ NEXT: Task 6.3 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-6.3.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 6.3"`
  On done: check box, cursor → `→ NEXT: Task 6.3 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd frontend && npm test -- --watchAll=false 2>&1 | tee tasks/feedback/task-6.3-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 6.3 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 6.3 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-6.3.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-6.3-verify.txt`
  Verdict → `tasks/feedback/task-6.3-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 7.1 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 6.3 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 7.1 — LXC Deployment Script

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-7.1.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 7.1"`
  On done: check box, cursor → `→ NEXT: Task 7.1 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-7.1.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 7.1"`
  On done: check box, cursor → `→ NEXT: Task 7.1 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-7.1-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 7.1 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 7.1 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-7.1.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-7.1-verify.txt`
  Verdict → `tasks/feedback/task-7.1-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 7.2 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 7.1 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 7.2 — Environment Configuration

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-7.2.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 7.2"`
  On done: check box, cursor → `→ NEXT: Task 7.2 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-7.2.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 7.2"`
  On done: check box, cursor → `→ NEXT: Task 7.2 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-7.2-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 7.2 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 7.2 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-7.2.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-7.2-verify.txt`
  Verdict → `tasks/feedback/task-7.2-judge.md`
  If PASS: check box, cursor → `→ NEXT: Task 7.3 — DEV`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 7.2 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Task 7.3 — Basic Backup Script

- [ ] **DEV** — `persona: tasks/personas/developer.md` —
  Read spec: `tasks/specs/task-7.3.md`
  If retrying, read feedback: _(none yet)_
  Commit: `git add -A && git commit -m "dev: task 7.3"`
  On done: check box, cursor → `→ NEXT: Task 7.3 — TEST`

- [ ] **TEST** — `persona: tasks/personas/test_writer.md` —
  Spec: `tasks/specs/task-7.3.md` | Diff: `git diff HEAD~1`
  Commit: `git add -A && git commit -m "test: task 7.3"`
  On done: check box, cursor → `→ NEXT: Task 7.3 — VERIFY`

- [ ] **VERIFY** —
  Run: `cd backend && python -m pytest -v 2>&1 | tee tasks/feedback/task-7.3-verify.txt`
  If pass: check box, cursor → `→ NEXT: Task 7.3 — JUDGE`
  If fail: uncheck DEV + TEST, increment, cursor → `→ NEXT: Task 7.3 — DEV`

- [ ] **JUDGE** — `persona: tasks/personas/judge.md` —
  Spec: `tasks/specs/task-7.3.md` | Diff: `git diff HEAD~2` | Verify: `tasks/feedback/task-7.3-verify.txt`
  Verdict → `tasks/feedback/task-7.3-judge.md`
  If PASS: check box, cursor → `→ NEXT: FINAL JUDGE`
  If FAIL: uncheck all, increment, update feedback ref, cursor → `→ NEXT: Task 7.3 — DEV`
  Feedback for DEV on retry: _(none yet)_

---

## Final Judge

- [ ] **FINAL JUDGE** — `persona: tasks/personas/judge.md`
  You are doing a final review of the entire project, not a single task.

  Read:
  - `tasks/ARCHITECTURE_REF.md` — what was planned
  - `git log --oneline` — what was actually built
  - All `tasks/feedback/*-judge.md` files — what concerns were raised

  Write your full verdict to: `tasks/feedback/final-judge.md`

  Then update `tasks/BUILD_STATUS.md` — overwrite the entire file with one of:

  If PASS:
  APPROVED

  If FAIL:
  FAILED — see tasks/feedback/final-judge.md
