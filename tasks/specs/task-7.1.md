# Task 7.1 — LXC Deployment Script

## Phase
7

## Description
Create `deploy/setup.sh` — a script to run on a fresh Ubuntu 24.04 LXC:

```bash
# Install system deps
apt update && apt install -y python3.12 python3.12-venv nodejs npm sqlite3

# Create service user
useradd -r -s /bin/false babytracker
mkdir -p /opt/babytracker /var/lib/babytracker
chown babytracker:babytracker /var/lib/babytracker

# Install Python deps
python3.12 -m venv /opt/babytracker/venv
/opt/babytracker/venv/bin/pip install -r /opt/babytracker/backend/requirements.txt

# Build frontend
cd /opt/babytracker/frontend && npm ci && npm run build

# Install systemd service
cp deploy/babytracker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable babytracker
systemctl start babytracker
```

Create `deploy/babytracker.service` (systemd unit file as specified in architecture doc).

Create `deploy/update.sh` — a script for subsequent deploys:
```bash
# Pull code (or rsync from dev machine)
# Rebuild frontend
# Restart service
```

## Acceptance Criteria
Fresh LXC can be set up from scratch with one script. Service starts on boot. SQLite file is not in the app directory (won't get wiped on redeploy).

## Verify Scope
backend
