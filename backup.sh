#!/bin/bash
set -euo pipefail

# Run from the repo root. Loads .env (APP_NAME, optional UPLOADS_DIR), dumps
# the postgres db via `docker exec`, tars the uploads directory, prunes
# artefacts older than 90 days. Designed to be wired into host crontab:
#
#   0 3 * * * cd /path/to/issues && ./backup.sh

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found!"
  exit 1
fi

if [ -z "${APP_NAME:-}" ]; then
  echo "Error: APP_NAME not set in .env"
  exit 1
fi

BACKUP_DIR="${HOME}/backups/${APP_NAME}"
UPLOADS_SRC="${UPLOADS_DIR:-./data/uploads}"
mkdir -p "$BACKUP_DIR"

DB_CONTAINER="${APP_NAME}-db-1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Backing up database from ${DB_CONTAINER}..."
docker exec "$DB_CONTAINER" pg_dump -U "issues" -d "issues" > "$BACKUP_DIR/db-${TIMESTAMP}.sql"

if [ $? -eq 0 ]; then
    echo "Database backup completed."
else
    echo "Error: pg_dump failed!"
    exit 1
fi

echo "Backing up uploads from ${UPLOADS_SRC}..."
if [ -d "$UPLOADS_SRC" ] && [ -n "$(ls -A "$UPLOADS_SRC" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/uploads-${TIMESTAMP}.tar.gz" -C "$(dirname "$UPLOADS_SRC")" "$(basename "$UPLOADS_SRC")"
  echo "Uploads backup completed."
else
  echo "  (uploads dir empty or missing — skipping)"
fi

# Retention: 90 days for both artefacts.
find "$BACKUP_DIR" -name "db-*.sql" -type f -mtime +90 -exec rm -f {} \;
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -type f -mtime +90 -exec rm -f {} \;

echo "Backup created at $(date), old backups cleaned." >> "$BACKUP_DIR/backup.log"
