#!/usr/bin/env python3
"""
Baby Tracker — Agentic orchestrator
Usage:
  python tools/orchestrator.py           # step mode (default)
  python tools/orchestrator.py --auto    # run until done or blocked
  python tools/orchestrator.py --status  # print current state and exit
  python tools/orchestrator.py --task 1.3 --reset  # reset a specific task to PENDING
"""

import json
import subprocess
import sys
import argparse
import re
import tempfile
import os
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT         = Path(__file__).parent.parent
STATE_FILE   = ROOT / "tasks" / "task-state.json"
FEEDBACK_DIR = ROOT / "tasks" / "feedback"
PERSONA_DIR  = ROOT / "tasks" / "personas"
SPEC_DIR     = ROOT / "tasks" / "specs"
SANDBOX      = ROOT / "tools" / "run-claude-sandbox.sh"

VERIFY_COMMANDS = {
    "backend": "cd backend && python -m pytest -v 2>&1",
    "frontend": "cd frontend && npm test -- --watchAll=false 2>&1",
    "both": "cd backend && python -m pytest -v 2>&1 && cd ../frontend && npm test -- --watchAll=false 2>&1",
}

# ── State helpers ──────────────────────────────────────────────────────────────

def load_state() -> dict:
    return json.loads(STATE_FILE.read_text())

def save_state(state: dict):
    state["last_updated"] = now()
    STATE_FILE.write_text(json.dumps(state, indent=2))
    regenerate_tasks_md(state)

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_active_task(state: dict) -> dict | None:
    """Return the first task that isn't APPROVED or BLOCKED."""
    for task in state["tasks"]:
        if task["state"] not in ("APPROVED", "BLOCKED"):
            return task
    return None

def all_tasks_done(state: dict) -> bool:
    return all(t["state"] in ("APPROVED", "BLOCKED") for t in state["tasks"])

def set_task_state(state: dict, task_id: str, new_state: str):
    for t in state["tasks"]:
        if t["id"] == task_id:
            t["state"] = new_state
            return
    raise ValueError(f"Task {task_id} not found")

def append_history(task: dict, entry: dict):
    task["history"].append({"timestamp": now(), **entry})

# ── Prompt construction ────────────────────────────────────────────────────────

def build_retry_preamble(task: dict, iteration: int, feedback_file: Path) -> str:
    feedback = feedback_file.read_text()
    return f"""## ⚠️ RETRY — Iteration {iteration} of {task['max_iterations']}

This task is being retried. The Judge rejected the previous implementation.

### Judge Feedback (iteration {iteration - 1}):

{feedback}

You MUST address every item listed under "Required Fixes" before completing this task.
Do not move on until all blocking issues are resolved.
"""

def build_judge_context(diff: str, verify_output: str, task: dict) -> str:
    # Find test files changed in this iteration
    return f"""## Evidence for Review

### Git Diff (implementation + tests)
```diff
{diff}
```

### Test Runner Output
```
{verify_output}
```

### Iteration Context
Task ID: {task['id']}
Current iteration: {task['current_iteration']} of {task['max_iterations']}
"""

def build_prompt(task: dict, role: str, state: dict) -> str:
    iteration = task["current_iteration"]
    parts = []

    # Role persona
    persona_file = PERSONA_DIR / f"{role}.md"
    parts.append(persona_file.read_text())

    # Architecture doc (condensed reference)
    arch_file = ROOT / "tasks" / "ARCHITECTURE_REF.md"
    if arch_file.exists():
        parts.append(f"## Architecture Reference\n\n{arch_file.read_text()}")

    # Task spec
    spec_file = SPEC_DIR / f"task-{task['id']}.md"
    parts.append(spec_file.read_text())

    # Retry context
    if iteration > 1:
        last_feedback = get_last_feedback_file(task, iteration - 1, "judge")
        if last_feedback and last_feedback.exists():
            # Filter feedback by role — developer doesn't see test_writer notes
            relevant = filter_feedback_for_role(last_feedback, role)
            if relevant:
                parts.append(build_retry_preamble(task, iteration, last_feedback))

    # Role-specific additions
    if role == "test_writer":
        diff = run_cmd("git diff HEAD~1 -- . ':(exclude)tests/'")
        parts.append(f"## What the Developer just implemented\n\n```diff\n{diff}\n```")

    elif role == "judge":
        diff = run_cmd("git log --oneline -4") + "\n\n" + run_cmd("git diff HEAD~2")
        verify_file = get_last_feedback_file(task, iteration, "verifier")
        verify_output = verify_file.read_text() if verify_file else "No verify output found."
        parts.append(build_judge_context(diff, verify_output, task))

    return "\n\n---\n\n".join(parts)

def filter_feedback_for_role(feedback_file: Path, role: str) -> bool:
    """Returns True if this feedback contains items relevant to this role."""
    content = feedback_file.read_text()
    if role == "developer" and "[DEVELOPER]" in content:
        return True
    if role == "test_writer" and "[TEST_WRITER]" in content:
        return True
    if role in ("developer", "test_writer") and "[BOTH]" in content:
        return True
    return False

# ── Feedback file paths ────────────────────────────────────────────────────────

def get_last_feedback_file(task: dict, iteration: int, role: str) -> Path | None:
    f = FEEDBACK_DIR / f"task-{task['id']}-iter{iteration}-{role}.md"
    return f if f.exists() else None

def get_verify_output_path(task: dict, iteration: int) -> Path:
    return FEEDBACK_DIR / f"task-{task['id']}-iter{iteration}-verifier.txt"

def get_judge_output_path(task: dict, iteration: int) -> Path:
    return FEEDBACK_DIR / f"task-{task['id']}-iter{iteration}-judge.md"

# ── Parse judge verdict ────────────────────────────────────────────────────────

def parse_judge_verdict(feedback_file: Path) -> dict:
    """
    Parse YAML frontmatter from judge output.
    Returns dict with keys: verdict, retry_target, loop_back
    """
    content = feedback_file.read_text()
    # Extract YAML frontmatter between --- delimiters
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        # Judge didn't follow format — treat as fail, target developer
        print("  ⚠️  Judge output missing frontmatter — defaulting to fail")
        return {"verdict": "fail", "retry_target": "developer", "loop_back": True}

    frontmatter = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            frontmatter[key.strip()] = val.strip()

    return {
        "verdict": frontmatter.get("verdict", "fail"),
        "retry_target": frontmatter.get("retry_target", "developer"),
        "loop_back": frontmatter.get("loop_back", "true").lower() == "true",
    }

# ── Subprocess helpers ─────────────────────────────────────────────────────────

def run_cmd(cmd: str) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=ROOT)
    return result.stdout + result.stderr

def run_sandbox_task(prompt: str) -> int:
    # Write prompt to a temp file inside the worktree so the container can read it
    prompt_file = ROOT / "tasks" / "feedback" / ".current-prompt.md"
    prompt_file.parent.mkdir(parents=True, exist_ok=True)
    prompt_file.write_text(prompt)
    
    try:
        result = subprocess.run(
            [str(SANDBOX), "--task-file", str(prompt_file)],
            cwd=ROOT,
            stdin=subprocess.DEVNULL
        )
        return result.returncode
    finally:
        # Clean up after — don't leave prompts lying around
        prompt_file.unlink(missing_ok=True)

def run_sandbox_exec(cmd: str, output_file: Path) -> int:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [str(SANDBOX), "--exec", cmd],
        capture_output=True,
        text=True,
        cwd=ROOT,
        stdin=subprocess.DEVNULL  # same fix
    )
    combined = result.stdout + result.stderr
    output_file.write_text(combined)
    print(combined[-2000:])
    return result.returncode

# ── Role execution ─────────────────────────────────────────────────────────────

def run_developer(task: dict, state: dict) -> int:
    print(f"\n  🔨 Running Developer (iter {task['current_iteration']})")
    prompt = build_prompt(task, "developer", state)
    exit_code = run_sandbox_task(prompt)
    append_history(task, {"role": "developer", "iteration": task["current_iteration"], "exit_code": exit_code})

    if exit_code == 0:
        # Auto-commit dev work
        run_cmd(f'git add -A && git commit -m "dev: task {task["id"]} iter {task["current_iteration"]}" --allow-empty')

    return exit_code

def run_test_writer(task: dict, state: dict) -> int:
    print(f"\n  🧪 Running Test Writer (iter {task['current_iteration']})")
    prompt = build_prompt(task, "test_writer", state)
    exit_code = run_sandbox_task(prompt)
    append_history(task, {"role": "test_writer", "iteration": task["current_iteration"], "exit_code": exit_code})

    if exit_code == 0:
        run_cmd(f'git add -A && git commit -m "test: task {task["id"]} iter {task["current_iteration"]}" --allow-empty')

    return exit_code

def run_verifier(task: dict) -> tuple[int, Path]:
    print(f"\n  ✅ Running Verifier")
    iteration = task["current_iteration"]
    output_file = get_verify_output_path(task, iteration)

    # Determine what to verify based on task phase
    verify_scope = task.get("verify_scope", "both")
    cmd = VERIFY_COMMANDS.get(verify_scope, VERIFY_COMMANDS["both"])

    exit_code = run_sandbox_exec(cmd, output_file)
    append_history(task, {
        "role": "verifier",
        "iteration": iteration,
        "exit_code": exit_code,
        "output_file": str(output_file.relative_to(ROOT))
    })
    return exit_code, output_file

def run_judge(task: dict, state: dict) -> dict:
    print(f"\n  ⚖️  Running Judge (iter {task['current_iteration']})")
    iteration = task["current_iteration"]
    output_file = get_judge_output_path(task, iteration)

    prompt = build_prompt(task, "judge", state)
    # Append output instruction — judge must write verdict to a specific path
    output_instruction = f"""
## Output Instruction

Write your complete verdict to the file:
`{output_file.relative_to(ROOT)}`

This is mandatory. The orchestrator reads this file to determine next steps.
Begin the file with the YAML frontmatter block exactly as specified in your persona.
"""
    full_prompt = prompt + "\n\n---\n\n" + output_instruction

    exit_code = run_sandbox_task(full_prompt)
    append_history(task, {
        "role": "judge",
        "iteration": iteration,
        "exit_code": exit_code,
        "feedback_file": str(output_file.relative_to(ROOT))
    })

    if not output_file.exists():
        print("  ⚠️  Judge did not write verdict file — treating as fail")
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text("---\nverdict: fail\nretry_target: developer\nloop_back: true\n---\n\nJudge failed to produce output.\n")

    return parse_judge_verdict(output_file)

# ── State transitions ──────────────────────────────────────────────────────────

def advance(task: dict, state: dict) -> str:
    """
    Execute the next step for the active task.
    Returns a string describing what happened.
    """
    task_state = task["state"]
    iteration  = task["current_iteration"]

    # ── PENDING → DEVELOPING ──────────────────────────────────────────────────
    if task_state == "PENDING":
        set_task_state(state, task["id"], "DEVELOPING")
        save_state(state)
        exit_code = run_developer(task, state)
        if exit_code != 0:
            return f"Developer exited with code {exit_code} — staying in DEVELOPING for retry"
        set_task_state(state, task["id"], "TESTING")
        save_state(state)
        return f"Developer done → TESTING"

    # ── DEVELOPING → TESTING ─────────────────────────────────────────────────
    elif task_state == "DEVELOPING":
        exit_code = run_developer(task, state)
        if exit_code != 0:
            return f"Developer exited with code {exit_code}"
        set_task_state(state, task["id"], "TESTING")
        save_state(state)
        return "Developer done → TESTING"

    # ── TESTING → VERIFYING ───────────────────────────────────────────────────
    elif task_state == "TESTING":
        exit_code = run_test_writer(task, state)
        if exit_code != 0:
            return f"Test Writer exited with code {exit_code}"
        set_task_state(state, task["id"], "VERIFYING")
        save_state(state)
        return "Test Writer done → VERIFYING"

    # ── VERIFYING → JUDGING or back to DEVELOPING ────────────────────────────
    elif task_state == "VERIFYING":
        exit_code, output_file = run_verifier(task)
        if exit_code != 0:
            print(f"  ✗ Tests failed — looping back to Developer")
            if iteration >= task["max_iterations"]:
                set_task_state(state, task["id"], "BLOCKED")
                save_state(state)
                return f"BLOCKED — max iterations ({task['max_iterations']}) reached with failing tests"
            task["current_iteration"] += 1
            set_task_state(state, task["id"], "DEVELOPING")
            save_state(state)
            return f"Tests failed → DEVELOPING (iter {task['current_iteration']})"

        set_task_state(state, task["id"], "JUDGING")
        save_state(state)
        return "Tests passed → JUDGING"

    # ── JUDGING → APPROVED or retry ───────────────────────────────────────────
    elif task_state == "JUDGING":
        verdict = run_judge(task, state)
        print(f"\n  Verdict: {verdict['verdict'].upper()}")

        if not verdict["loop_back"]:
            set_task_state(state, task["id"], "APPROVED")
            save_state(state)
            return f"Judge approved → APPROVED ✓"

        # Failed — check iteration limit
        if iteration >= task["max_iterations"]:
            set_task_state(state, task["id"], "BLOCKED")
            save_state(state)
            return f"BLOCKED — max iterations reached. Manual intervention required."

        # Loop back
        task["current_iteration"] += 1
        retry_target = verdict["retry_target"]
        next_state = "DEVELOPING" if retry_target in ("developer", "both") else "TESTING"
        set_task_state(state, task["id"], next_state)
        save_state(state)
        return f"Judge rejected → {next_state} (iter {task['current_iteration']}, target: {retry_target})"

    return f"Unknown state: {task_state}"

# ── TASKS.md regeneration ──────────────────────────────────────────────────────

STATE_ICONS = {
    "PENDING":    "⏳",
    "DEVELOPING": "🔨",
    "TESTING":    "🧪",
    "VERIFYING":  "✅",
    "JUDGING":    "⚖️ ",
    "APPROVED":   "✅",
    "BLOCKED":    "🚫",
}

def regenerate_tasks_md(state: dict):
    lines = ["# Baby Tracker — Task Status\n",
             f"_Last updated: {state['last_updated']}_\n\n"]

    current_phase = None
    for task in state["tasks"]:
        if task["phase"] != current_phase:
            current_phase = task["phase"]
            lines.append(f"\n## Phase {current_phase}\n")

        icon  = STATE_ICONS.get(task["state"], "?")
        iters = f"iter {task['current_iteration']}/{task['max_iterations']}"
        lines.append(f"- {icon} **{task['id']}** — {task['title']}  `{task['state']}` _{iters}_\n")

    lines.append(f"\n## Final Judge\n")
    lines.append(f"- {STATE_ICONS.get(state['final_judge_status'], '⏳')} `{state['final_judge_status']}`\n")

    (ROOT / "tasks" / "TASKS.md").write_text("".join(lines))

# ── Main ───────────────────────────────────────────────────────────────────────

def cmd_status(state: dict):
    regenerate_tasks_md(state)
    task = get_active_task(state)
    print("\n=== Baby Tracker — Orchestrator Status ===\n")
    for t in state["tasks"]:
        icon = STATE_ICONS.get(t["state"], "?")
        print(f"  {icon}  {t['id']:6} {t['title'][:40]:40} {t['state']}")
    if task:
        print(f"\nActive task: {task['id']} — {task['title']}")
        print(f"State:       {task['state']}")
        print(f"Iteration:   {task['current_iteration']} / {task['max_iterations']}")
    else:
        print("\nAll tasks complete.")

def cmd_step(state: dict):
    task = get_active_task(state)
    if not task:
        print("All tasks complete. Run final judge? (not yet implemented)")
        return

    print(f"\n→ Task {task['id']}: {task['title']}")
    print(f"  State: {task['state']}  |  Iteration: {task['current_iteration']}")

    result = advance(task, state)
    print(f"\n  Result: {result}")

def cmd_auto(state: dict):
    while True:
        task = get_active_task(state)
        if not task:
            print("\n✓ All tasks complete.")
            # TODO: run final judge
            break

        print(f"\n→ Task {task['id']}: {task['title']} [{task['state']}]")
        result = advance(task, state)
        print(f"  Result: {result}")

        if "BLOCKED" in result:
            print(f"\n🚫 Blocked on task {task['id']}. Manual intervention required.")
            print(f"   Review: tasks/feedback/task-{task['id']}-*.md")
            sys.exit(1)

        # Re-load state after each step (advance() mutates in place but save_state() flushes)
        state = load_state()

def main():
    parser = argparse.ArgumentParser(description="Baby Tracker agentic orchestrator")
    parser.add_argument("--auto",   action="store_true", help="Run until done or blocked")
    parser.add_argument("--status", action="store_true", help="Print status and exit")
    parser.add_argument("--task",   help="Target a specific task ID")
    parser.add_argument("--reset",  action="store_true", help="Reset task to PENDING (use with --task)")
    args = parser.parse_args()

    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

    if args.status:
        cmd_status(state)
        return

    if args.reset and args.task:
        for t in state["tasks"]:
            if t["id"] == args.task:
                t["state"] = "PENDING"
                t["current_iteration"] = 1
                save_state(state)
                print(f"Reset task {args.task} to PENDING")
                return
        print(f"Task {args.task} not found")
        return

    if args.auto:
        cmd_auto(state)
    else:
        cmd_step(state)

if __name__ == "__main__":
    main()

"""

---

## What's Not In The Script Yet (Intentionally)

Three things worth calling out that you'll want to add but need your input:

**The final judge** — same structure as a per-task judge but it receives the full git log summary, all TASKS.md history, and all `pass_with_concerns` feedback files aggregated. It writes to `tasks/feedback/final-judge.md`. The outer loop in `cmd_auto` has a `# TODO` marker where this plugs in.

**The verify scope per task** — the `task-state.json` schema has a `verify_scope` field (`backend`, `frontend`, `both`). You'll want to set this per task when you populate the state file. Backend-only tasks (Phase 1) shouldn't run the frontend test suite.

**The spec files** — `tasks/specs/task-1.1.md` etc. These are just the task descriptions from the task doc, one file per task. Worth splitting them out as a separate step.

---

## File Layout This Creates
```
tasks/
├── task-state.json          # machine state
├── TASKS.md                 # human-readable status (auto-regenerated)
├── ARCHITECTURE_REF.md      # condensed arch doc for agent context
├── personas/
│   ├── developer.md
│   ├── test_writer.md
│   └── judge.md
├── specs/
│   ├── task-1.1.md
│   ├── task-1.2.md
│   └── ...
└── feedback/
    ├── task-1.1-iter1-verifier.txt
    ├── task-1.1-iter1-judge.md
    └── ...
"""
