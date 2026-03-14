#!/usr/bin/env bash
set -euo pipefail

DB_PATH="/var/lib/babytracker/db.sqlite"
BACKUP_DIR="/var/lib/babytracker/backups"
MAX_BACKUPS=30

mkdir -p "$BACKUP_DIR"

# Use sqlite3 .backup for a consistent, safe copy (handles WAL mode)
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sqlite'"

# Keep only the most recent backups, remove older ones
ls -t "$BACKUP_DIR"/*.sqlite | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

echo "Backup complete: $BACKUP_DIR"

# To run daily at 2am, add a cron entry:
#   sudo crontab -e
#   0 2 * * * /opt/babytracker/deploy/backup.sh >> /var/log/babytracker-backup.log 2>&1
