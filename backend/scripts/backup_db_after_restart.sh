#!/bin/bash

# Database Backup Script for Pocket Family
# Run with:
#=================================
# bash /home/pocket-family/pocket-family/backend/scripts/backup_db_after_restart.sh
#=================================

# Create timestamp for backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/pfinancedb_backup_${TIMESTAMP}.sql"
BACKUP_DIR="/home/pocket-family/pocket-family-backup"
FINAL_BACKUP="${BACKUP_DIR}/pfinancedb_backup_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Find the database container
echo "Looking for database container..."
CONTAINER_ID=$(docker ps --filter "name=db" --format "{{.ID}}")

if [ -z "$CONTAINER_ID" ]; then
    echo "Error: Database container not found. Are the production containers running?"
    exit 1
fi

echo "Found database container: $CONTAINER_ID"

# Create backup using pg_dump inside the container
echo "Creating database backup..."
docker exec "$CONTAINER_ID" pg_dump -U postgres -d pfinancedb > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "Error: Failed to create database backup"
    exit 1
fi

echo "Backup created: $BACKUP_FILE"

# Compress the backup
echo "Compressing backup..."
gzip "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "Error: Failed to compress backup"
    exit 1
fi

# Move to backup directory
echo "Moving backup to final location..."
mv "${BACKUP_FILE}.gz" "$FINAL_BACKUP"

# Verify backup
echo "Verifying backup..."
if [ -f "$FINAL_BACKUP" ]; then
    FILE_SIZE=$(stat -c%s "$FINAL_BACKUP")
    echo "Backup completed successfully!"
    echo "File: $FINAL_BACKUP"
    echo "Size: $FILE_SIZE bytes"
    echo "Location: $BACKUP_DIR"
else
    echo "Error: Backup file not found in final location"
    exit 1
fi

# Remove backups older than 30 days
echo "Cleaning up backups older than 30 days..."
DELETED=$(find "$BACKUP_DIR" -name "pfinancedb_backup_*.sql.gz" -mtime +30 -delete -print | wc -l)
echo "Removed $DELETED old backup(s)."

echo "Database backup process completed."