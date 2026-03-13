# Step mode — one role per invocation, you control the pace
tools/run-claude-sandbox.sh --task-file tasks/RUN.md

# Auto mode — wrap in a shell loop, runs until you Ctrl+C or it hits BLOCKED
while true; do
  tools/run-claude-sandbox.sh --task-file tasks/RUN.md
  # Check if final judge passed
  grep -q "✓ BUILD COMPLETE" tasks/TASK_LIST.md && break
  # Check for BLOCKED
  grep -q "\[BLOCKED\]" tasks/TASK_LIST.md && echo "BLOCKED — manual intervention needed" && break
done