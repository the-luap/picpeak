#!/bin/sh
# wait-for-db.sh - Wait for PostgreSQL to be ready before starting the application

set -e

host="${DB_HOST:-postgres}"
port="${DB_PORT:-5432}"
user="${DB_USER:-picpeak}"
target_db="${DB_NAME:-picpeak}"
# Use target database for checks - the picpeak user may not have access to 'postgres' database
default_db="${DB_CHECK_DB:-$target_db}"

sanitize_identifier() {
  printf '%s' "$1" | sed "s/'/''/g"
}

echo "Waiting for PostgreSQL at $host:$port..."

# First, wait for PostgreSQL server to be reachable
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "$target_db" -c '\q' >/dev/null 2>&1; then
    >&2 echo "PostgreSQL is up - database \"$target_db\" is accessible."
    break
  fi

  # If target DB doesn't work, try connecting to 'postgres' or 'template1' to create it
  if PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "template1" -c '\q' >/dev/null 2>&1; then
    >&2 echo "PostgreSQL is up - checking if database \"$target_db\" needs to be created..."

    # Check if database exists
    db_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "template1" -tAc "SELECT 1 FROM pg_database WHERE datname = '$(sanitize_identifier "$target_db")'" 2>/dev/null || echo 0)

    if [ "$db_exists" != "1" ]; then
      >&2 echo "Database \"$target_db\" not found. Attempting to create..."
      if PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "template1" -c "CREATE DATABASE \"$target_db\";" >/dev/null 2>&1; then
        >&2 echo "Database \"$target_db\" created successfully."
      else
        >&2 echo "Warning: Could not create database. It may already exist or user lacks permissions."
      fi
    fi
    break
  fi

  attempt=$((attempt + 1))
  >&2 echo "PostgreSQL is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  >&2 echo "Failed to connect to PostgreSQL after $max_attempts attempts."
  exit 1
fi

# Final verification - wait for target database to accept connections
until PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "$target_db" -c '\q' >/dev/null 2>&1; do
  >&2 echo "Waiting for database \"$target_db\" to accept connections..."
  sleep 2
done

>&2 echo "Target database \"$target_db\" is ready."

# Ensure storage directories exist with proper permissions (Issue #67 fix)
# When host directories are bind-mounted, the container's built-in directories are overridden
# This ensures the required directory structure exists before the application starts
echo "Ensuring storage directories exist..."
STORAGE_BASE="${STORAGE_PATH:-/app/storage}"
mkdir -p "$STORAGE_BASE/events/active" "$STORAGE_BASE/events/archived" "$STORAGE_BASE/thumbnails" 2>/dev/null || true

# Run migrations (use safe runner in production)
echo "Running database migrations..."
if [ "$NODE_ENV" = "production" ]; then
  npm run migrate:safe
else
  npm run migrate
fi

# Execute the main command
exec "$@"
