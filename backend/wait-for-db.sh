#!/bin/sh
# wait-for-db.sh - Wait for PostgreSQL to be ready before starting the application

set -e

host="${DB_HOST:-postgres}"
port="${DB_PORT:-5432}"
user="${DB_USER:-picpeak}"
target_db="${DB_NAME:-picpeak}"
default_db="${DB_CHECK_DB:-postgres}"

sanitize_identifier() {
  printf '%s' "$1" | sed "s/'/''/g"
}

echo "Waiting for PostgreSQL at $host:$port..."

# Wait for PostgreSQL server to accept connections (using the default database)
until PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "$default_db" -c '\q' >/dev/null 2>&1; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

>&2 echo "PostgreSQL is up - verifying target database \"$target_db\""

# Ensure the target database exists (helps when volumes are reused or DB_NAME is customised)
db_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "$default_db" -tAc "SELECT 1 FROM pg_database WHERE datname = '$(sanitize_identifier "$target_db")'" 2>/dev/null || echo 0)

if [ "$db_exists" != "1" ]; then
  >&2 echo "Database \"$target_db\" not found. Attempting to create..."
  if ! PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "$default_db" -c "CREATE DATABASE \"$target_db\";" >/dev/null 2>&1; then
    >&2 echo "Failed to create database \"$target_db\". Please ensure it exists and is accessible."
    exit 1
  fi
  >&2 echo "Database \"$target_db\" created successfully."
fi

# Wait until the target database itself is ready to accept connections
until PGPASSWORD="$DB_PASSWORD" psql -h "$host" -p "$port" -U "$user" -d "$target_db" -c '\q' >/dev/null 2>&1; do
  >&2 echo "Waiting for database \"$target_db\" to accept connections..."
  sleep 2
done

>&2 echo "Target database \"$target_db\" is ready."

# Run migrations (use safe runner in production)
echo "Running database migrations..."
if [ "$NODE_ENV" = "production" ]; then
  npm run migrate:safe
else
  npm run migrate
fi

# Execute the main command
exec "$@"
