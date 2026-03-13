# Task 7.3 — Basic Backup Script

## Phase
7

## Description
Create `deploy/backup.sh`:

```bash
#!/bin/bash
# Copy SQLite to a timestamped backup
BACKUP_DIR="/var/lib/babytracker/backups"
mkdir -p "$BACKUP_DIR"
sqlite3 /var/lib/babytracker/db.sqlite ".backup '$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sqlite'"
# Keep last 30 backups
ls -t "$BACKUP_DIR"/*.sqlite | tail -n +31 | xargs -r rm
```

Document how to add this to cron (e.g. daily at 2am).

## Acceptance Criteria
Script runs, creates a valid SQLite backup, old backups are pruned.

## Verify Scope
backend
