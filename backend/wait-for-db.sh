#!/bin/sh
# wait-for-db.sh - Wait for PostgreSQL to be ready before starting the application

set -e

host="$DB_HOST"
port="${DB_PORT:-5432}"
user="${DB_USER:-picpeak}"

echo "Waiting for PostgreSQL at $host:$port..."

# Wait for PostgreSQL to be ready
until PGPASSWORD=$DB_PASSWORD psql -h "$host" -p "$port" -U "$user" -d "${DB_NAME:-picpeak}" -c '\q' 2>/dev/null; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

>&2 echo "PostgreSQL is up - executing command"

# Run migrations (use safe runner in production)
echo "Running database migrations..."
if [ "$NODE_ENV" = "production" ]; then
  npm run migrate:safe
else
  npm run migrate
fi

# Execute the main command
exec "$@"