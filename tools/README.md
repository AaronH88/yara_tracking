# Tools

This directory contains development automation tools for the Baby Tracker project, including an agentic task orchestration system and a sandboxed Claude Code environment.

## Overview

The tools in this directory support an AI-assisted development workflow where tasks are:
1. Specified in markdown files
2. Executed by AI agents (Developer, Test Writer, Judge) in isolated roles
3. Verified automatically via test suites
4. Reviewed for quality before approval

## Tools

### 1. orchestrator.py

An agentic task orchestration system that coordinates multiple AI personas to build features end-to-end.

**Personas:**
- **Developer**: Implements features according to specifications
- **Test Writer**: Writes comprehensive tests for implementations
- **Verifier**: Runs test suites (backend pytest, frontend vitest)
- **Judge**: Reviews code quality, test coverage, and adherence to specs

**State Machine:**
```
PENDING → DEVELOPING → TESTING → VERIFYING → JUDGING → APPROVED
                ↑                                ↓
                └──────── (retry loop) ──────────┘
```

Tasks can iterate up to a configurable maximum (default: 3 iterations) before being marked as BLOCKED.

#### Usage

```bash
# Step mode: advance one phase at a time (interactive)
python tools/orchestrator.py

# Auto mode: run until completion or blocked
python tools/orchestrator.py --auto

# Check status without making changes
python tools/orchestrator.py --status

# Reset a specific task to PENDING
python tools/orchestrator.py --task 1.3 --reset
```

#### File Structure

The orchestrator uses these directories and files:

```
tasks/
├── task-state.json           # Machine state (current phase, iteration counts)
├── TASK_LIST.md              # Human-readable status (auto-regenerated)
├── ARCHITECTURE_REF.md       # Condensed architecture reference for agents
├── personas/
│   ├── developer.md          # Developer persona instructions
│   ├── test_writer.md        # Test writer persona instructions
│   └── judge.md              # Judge persona instructions
├── specs/
│   ├── task-1.1.md           # Individual task specifications
│   ├── task-1.2.md
│   └── ...
└── feedback/
    ├── task-1.1-iter1-verifier.txt
    ├── task-1.1-iter1-judge.md
    └── ...                   # Iteration feedback files
```

#### How It Works

1. Reads current state from `task-state.json`
2. Finds the first task not in `APPROVED` or `BLOCKED` state
3. Executes the appropriate persona for the current phase:
   - **DEVELOPING**: Runs Developer with the task spec
   - **TESTING**: Runs Test Writer with the implementation diff
   - **VERIFYING**: Runs test suite and captures output
   - **JUDGING**: Runs Judge with diff + test output
4. Commits work after each successful phase
5. Advances to next phase or loops back based on results
6. Updates `task-state.json` and regenerates `TASK_LIST.md`

#### Retry Logic

If the Judge rejects work:
- Feedback is written to `tasks/feedback/task-{id}-iter{N}-judge.md`
- The task iterates and returns to DEVELOPING or TESTING (based on `retry_target`)
- The next execution receives the feedback as additional context
- After `max_iterations` (default: 3), the task is marked BLOCKED

#### State File Format

`task-state.json` contains:
```json
{
  "tasks": [
    {
      "id": "1.1",
      "title": "Task description",
      "phase": "backend",
      "state": "APPROVED",
      "current_iteration": 1,
      "max_iterations": 3,
      "verify_scope": "backend",
      "history": [...]
    }
  ],
  "final_judge_status": "PENDING",
  "last_updated": "2026-03-14T12:34:56Z"
}
```

---

### 2. run-claude-sandbox.sh

A Podman-based sandbox wrapper for running Claude Code in an isolated, controlled environment.

#### Features

- **Filesystem isolation**: Only mounts the current worktree - Claude cannot access files outside the project
- **Persistent auth**: Tokens stored in `~/.claude-sandbox/auth/` (isolated from host `~/.claude`)
- **Network modes**:
  - Unrestricted: full host network access (default)
  - Isolated: only project's podman-compose services
- **Runs with `--dangerously-skip-permissions`**: Claude can read/write all files in the worktree
- **Resource limits**: Configurable memory (default 4GB) and CPU (default 2 cores)

#### Usage Modes

**Interactive mode** (default):
```bash
tools/run-claude-sandbox.sh
# Drops you into an interactive Claude Code session
```

**Agentic mode** (automated task execution):
```bash
tools/run-claude-sandbox.sh --task "implement pagination on /jobs endpoint"

# Or from a file:
tools/run-claude-sandbox.sh --task-file tasks/specs/task-1.1.md
```

**Continue previous session:**
```bash
tools/run-claude-sandbox.sh --continue
```

**Resume specific session:**
```bash
tools/run-claude-sandbox.sh --resume abc123def456
# Or pick interactively:
tools/run-claude-sandbox.sh --resume
```

**Shell mode** (debugging):
```bash
tools/run-claude-sandbox.sh --shell
# Drops into a bash shell inside the container
```

**Command execution:**
```bash
tools/run-claude-sandbox.sh --exec "make test"
# Runs a single command and exits
```

#### Network Isolation

**Unrestricted mode** (default):
```bash
tools/run-claude-sandbox.sh --task "..."
# Can access localhost:8000, localhost:5432, etc.
```

**Isolated mode** (only project services):
```bash
tools/run-claude-sandbox.sh --isolated --task "..."
# Can only reach containers in the project's podman-compose network
```

#### Advanced Options

**Custom system prompt:**
```bash
tools/run-claude-sandbox.sh --task "..." \
  --append-system-prompt-file tasks/ARCHITECTURE_REF.md
```

**Custom subagents:**
```bash
tools/run-claude-sandbox.sh --task "..." \
  --agents '{"explore": {"description": "Custom explorer"}}'
```

#### Configuration

Environment variable overrides (set in `.env` or shell):

- `CLAUDE_SANDBOX_CONTAINERFILE`: Path to Containerfile (default: auto-detect)
- `CLAUDE_SANDBOX_IMAGE`: Image name (default: `localhost/claude-sandbox:latest`)
- `CLAUDE_SANDBOX_AUTH_DIR`: Auth directory (default: `~/.claude-sandbox/auth`)
- `CLAUDE_SANDBOX_MEMORY`: Memory limit (default: `4g`)
- `CLAUDE_SANDBOX_CPUS`: CPU limit (default: `2`)

#### First-Time Setup

1. **Create auth directory:**
   ```bash
   mkdir -p ~/.claude-sandbox/auth
   ```

2. **Run the sandbox:**
   ```bash
   tools/run-claude-sandbox.sh
   ```

3. **Authenticate:**
   - Claude will print a browser URL
   - Open it and sign in
   - Tokens are saved to `~/.claude-sandbox/auth/` and reused on future runs

4. **The Containerfile** should be in one of these locations:
   - `containers/claude-sandbox/Containerfile`
   - `.claude-sandbox/Containerfile`
   - `docker/claude-sandbox/Containerfile`
   - `Containerfile.claude-sandbox`

## Integration: Orchestrator + Sandbox

The orchestrator uses the sandbox script to run AI agents in isolation:

```python
def run_sandbox_task(prompt: str) -> int:
    prompt_file = ROOT / "tasks" / "feedback" / ".current-prompt.md"
    prompt_file.write_text(prompt)

    result = subprocess.run(
        [str(SANDBOX), "--task-file", str(prompt_file)],
        cwd=ROOT,
        stdin=subprocess.DEVNULL
    )
    return result.returncode
```

This ensures:
- Each agent runs in a clean environment
- File changes are committed to git after each phase
- Agents can't access anything outside the project worktree
- Resource usage is bounded

## Workflow Example

**Starting a new task:**

1. Add task spec to `tasks/specs/task-4.5.md`
2. Add task entry to `task-state.json`
3. Run `python tools/orchestrator.py --auto`
4. The orchestrator will:
   - Run Developer in sandbox → commit implementation
   - Run Test Writer in sandbox → commit tests
   - Run Verifier → save test output
   - Run Judge → approve or request fixes
   - Iterate if needed
   - Mark as APPROVED when done

**Checking status:**
```bash
python tools/orchestrator.py --status
```

**Manually running a single agent:**
```bash
tools/run-claude-sandbox.sh --task-file tasks/specs/task-4.5.md
```

## Troubleshooting

**Orchestrator stuck on a task:**
- Check feedback files in `tasks/feedback/`
- Review the judge's rejection reason
- Manually fix issues and reset: `python tools/orchestrator.py --task 4.5 --reset`

**Sandbox won't start:**
- Check if Podman is installed: `podman --version`
- Check if image exists: `podman images | grep claude-sandbox`
- Rebuild image: Remove it and let the script rebuild on next run

**Permission denied in sandbox:**
- The script runs with `--dangerously-skip-permissions` - this should not happen
- Check volume mounts with `podman inspect <container-name>`

**Network issues in isolated mode:**
- Ensure `make services-run` has been run first
- Check network exists: `podman network ls`
- Verify containers are on the same network

## Development Notes

- The orchestrator auto-commits work after successful phases
- Commit messages follow pattern: `dev: task {id} iter {N}` or `test: task {id} iter {N}`
- Judge feedback is preserved in `tasks/feedback/` for debugging
- State file is updated after every phase transition
- `TASK_LIST.md` is regenerated automatically - don't edit it manually

## See Also

- `../tasks/ARCHITECTURE_REF.md` - Architecture reference for AI agents
- `../tasks/RUN.md` - Entry point instructions for fresh Claude agents
- `../tasks/personas/` - Role-specific persona definitions
- `../CLAUDE.md` - Project guidance for Claude Code
