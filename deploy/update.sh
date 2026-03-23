#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/babytracker"
SERVICE_FILE="babytracker.service"
DB_PATH="/var/lib/babytracker/db.sqlite"

echo "=== Baby Tracker — Update Deploy ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Backup database before any changes
echo "Creating database backup..."
"$SCRIPT_DIR/backup.sh"

# Stop service during update
echo "Stopping service..."
systemctl stop "$SERVICE_FILE"

# Update application code
echo "Updating application code..."
rsync -a --delete "$REPO_DIR/babytracker/backend/" "$APP_DIR/backend/"
rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    "$REPO_DIR/babytracker/frontend/" "$APP_DIR/frontend/"

# Run database migrations if they exist
echo "Checking for database migrations..."
for migration_script in "$APP_DIR/backend"/migrate_*.py; do
    if [ -f "$migration_script" ]; then
        echo "Running migration: $(basename "$migration_script")"
        "$APP_DIR/venv/bin/python" "$migration_script" "$DB_PATH" <<< "yes"
    fi
done

# Update Python dependencies
echo "Updating Python dependencies..."
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# Rebuild frontend
echo "Rebuilding frontend..."
cd "$APP_DIR/frontend"
npm ci
npm run build
cd -

# Update systemd service file if changed
# echo "Updating systemd service..."
# cp "$SCRIPT_DIR/$SERVICE_FILE" /etc/systemd/system/
# systemctl daemon-reload

# Restart service
echo "Starting service..."
systemctl start "$SERVICE_FILE"

echo "=== Update complete ==="
