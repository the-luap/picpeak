#!/bin/sh
# init-production.sh - Production initialization script

set -e

echo "🚀 Initializing PicPeak Production Environment..."

# Wait for services to be ready
echo "⏳ Waiting for database to be fully ready..."
sleep 3

# Fix permissions if running as root (shouldn't happen with proper Dockerfile)
if [ "$(id -u)" = "0" ]; then
    echo "🔧 Fixing file permissions..."
    chown -R nodejs:nodejs /app/storage /app/data /app/logs 2>/dev/null || true
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p /app/storage/events/active \
         /app/storage/events/archived \
         /app/storage/thumbnails \
         /app/storage/uploads/logos \
         /app/storage/uploads/favicons \
         /app/data \
         /app/logs

# Run migrations with safe runner
echo "🗄️ Running database migrations (safe mode)..."
NODE_ENV=production npm run migrate:safe

# Create admin user if environment variables are set
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "👤 Creating admin user..."
    node scripts/create-admin.js \
        --email "$ADMIN_EMAIL" \
        --username "${ADMIN_USERNAME:-admin}" \
        --password "$ADMIN_PASSWORD" || echo "Admin user might already exist"
fi

# Initialize email configuration if variables are set
if [ -n "$SMTP_HOST" ]; then
    echo "📧 Email configuration detected via environment variables"
fi

echo "✅ Production initialization complete!"
echo "🌐 Starting application server..."

# Start the application
exec node server.js