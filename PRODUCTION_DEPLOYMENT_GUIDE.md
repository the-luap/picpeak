# Production Deployment Guide

This comprehensive guide addresses all production deployment scenarios and common issues.

## Pre-Deployment Checklist

### 1. Environment Variables
Create a `.env` file with ALL required variables:

```bash
# CRITICAL - Must change these!
JWT_SECRET=<generate-with-openssl-rand-base64-32>
DB_PASSWORD=<strong-password>

# Application URLs (your actual domain)
ADMIN_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# Database (PostgreSQL)
DATABASE_CLIENT=pg
DB_HOST=postgres  # or external host
DB_PORT=5432
DB_USER=picpeak
DB_NAME=picpeak

# Email Configuration (required for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use app-specific password
EMAIL_FROM=PicPeak <noreply@yourdomain.com>

# Port Configuration
PORT=3001

# Performance Tuning
DB_POOL_MIN=5
DB_POOL_MAX=25
NODE_ENV=production
LOG_LEVEL=info

# Optional: Umami Analytics (configured via Admin UI)
# UMAMI_URL=https://analytics.yourdomain.com
# UMAMI_WEBSITE_ID=your-website-id
```

### 2. Generate Secrets

```bash
# Generate JWT Secret (REQUIRED)
openssl rand -base64 32

# Generate Database Password
openssl rand -base64 24
```

## Frontend Configuration

For production deployment behind a reverse proxy:

### Frontend Environment
```bash
# frontend/.env.production
VITE_API_URL=/api  # Uses relative path for reverse proxy

# Optional: Umami fallback (primary config via Admin UI)
# VITE_UMAMI_URL=https://analytics.yourdomain.com
# VITE_UMAMI_WEBSITE_ID=your-website-id
```

This ensures all API calls use the same domain/protocol as the frontend.

### Nginx Proxy Configuration

The frontend nginx configuration already includes proper proxy settings for:
- `/api` → Backend API
- `/photos` → Protected photo access
- `/thumbnails` → Thumbnail images
- `/uploads` → Public uploads (logos, favicons)

All static assets are served through the nginx proxy, inheriting authentication headers.

## Deployment Steps

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/the-luap/wedding-photo-sharing.git
cd wedding-photo-sharing

# Create required directories
mkdir -p storage/events/active storage/events/archived storage/thumbnails storage/uploads
mkdir -p data logs
mkdir -p certbot/conf certbot/www

# Set permissions (important!)
chmod -R 755 storage data logs
```

### 2. Fix Docker Volume Permissions

Create `docker-compose.override.yml` for local volume configuration:

```yaml
version: '3.8'

services:
  backend:
    volumes:
      - ./storage:/app/storage:delegated
      - ./data:/app/data:delegated
      - ./logs:/app/logs:delegated
    user: "1001:1001"  # nodejs user

  db:
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
```

### 3. Build and Deploy

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

### 4. Initial Admin Setup

The admin user is automatically created during database migration:

```bash
# Run migrations (this creates admin user)
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Admin credentials will be displayed in console and saved to ADMIN_CREDENTIALS.txt
# Example output:
# ========================================
# ✅ Admin user created successfully!
# ========================================
# Username: admin
# Password: SwiftEagle3847!
# 
# ⚠️  IMPORTANT: Change password on first login
# ========================================

# Retrieve credentials if needed
docker-compose -f docker-compose.prod.yml exec backend cat ADMIN_CREDENTIALS.txt
```

**Important**: You MUST change the auto-generated password on first login.

### 5. Configure Email (if using database config)

1. Login to admin panel: https://yourdomain.com/admin
2. Go to Settings > Email Configuration
3. Enter SMTP details
4. Test email sending

## Common Issues and Solutions

### Issue 1: Migration Failures

**Error**: "relation already exists"

**Solution**: The safe migration runner handles this automatically. If issues persist:

```bash
# Reset migrations tracking
docker-compose -f docker-compose.prod.yml exec db psql -U picpeak -d picpeak

# In PostgreSQL:
DROP TABLE IF EXISTS migrations;
\q

# Re-run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate:safe
```

### Issue 2: Permission Denied Errors

**Error**: "EACCES: permission denied"

**Solution**: Fix container permissions:

```bash
# Stop containers
docker-compose -f docker-compose.prod.yml down

# Fix permissions on host
sudo chown -R 1001:1001 storage data logs

# Restart
docker-compose -f docker-compose.prod.yml up -d
```

### Issue 3: Database Connection Failed

**Error**: "no pg_hba.conf entry"

**Solution**: Already fixed in docker-compose.prod.yml with:
- SSL disabled for internal Docker network
- Proper authentication method (scram-sha-256)

### Issue 4: Frontend Can't Connect to Backend

**Error**: CORS errors or connection refused

**Solution**: Ensure environment variables match:
- Backend: `FRONTEND_URL` must match your frontend URL
- Frontend: `VITE_API_URL` must be set during build

### Issue 5: Email Not Sending

**Solution**: Check email configuration:

```bash
# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend | grep email

# Verify SMTP settings
# Gmail users: Use app password, not regular password
# Enable "Less secure app access" or use OAuth2
```

## SSL/HTTPS Setup

### Option 1: Using Traefik (Recommended)

Add these labels to your docker-compose override:

```yaml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.picpeak.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.picpeak.entrypoints=websecure"
      - "traefik.http.routers.picpeak.tls.certresolver=letsencrypt"
      - "traefik.http.services.picpeak.loadbalancer.server.port=80"
```

### Option 2: Using Certbot

1. Update `nginx/sites-enabled/default` with your domain
2. Run certbot:

```bash
# Initial certificate
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is handled by the certbot container
```

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost/api/health

# Database connection
docker-compose -f docker-compose.prod.yml exec backend \
  psql -U picpeak -d picpeak -c "SELECT 1"
```

### Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Backup and Restore

### Backup

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"

mkdir -p $BACKUP_DIR

# Database
docker-compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U picpeak picpeak > $BACKUP_DIR/database.sql

# Files
tar -czf $BACKUP_DIR/storage.tar.gz storage/

echo "Backup completed: $BACKUP_DIR"
```

### Restore

```bash
# Database
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U picpeak picpeak < ./backups/20240713_120000/database.sql

# Files
tar -xzf ./backups/20240713_120000/storage.tar.gz
```

## Production Best Practices

1. **Always use named volumes** in production for better data persistence
2. **Set up monitoring** with Prometheus/Grafana
3. **Enable backups** with automated scripts
4. **Use a reverse proxy** (Nginx) for SSL termination
5. **Implement rate limiting** at the Nginx level
6. **Regular updates** - Keep Docker images updated
7. **Log rotation** - Configure log rotation for application logs

## Troubleshooting Commands

```bash
# Check running containers
docker-compose -f docker-compose.prod.yml ps

# Restart a service
docker-compose -f docker-compose.prod.yml restart backend

# View real-time logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Execute commands in container
docker-compose -f docker-compose.prod.yml exec backend sh

# Database shell
docker-compose -f docker-compose.prod.yml exec db psql -U picpeak

# Clean restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Security Checklist

- [ ] Strong JWT_SECRET (min 32 chars)
- [ ] Strong database password
- [ ] Admin password changed from auto-generated one
- [ ] SSL/HTTPS enabled
- [ ] Firewall configured (only 80/443 open)
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Access logs monitored
- [ ] Rate limiting enabled (built-in)
- [ ] File upload restrictions configured
- [ ] Password complexity requirements configured (Admin > Settings)
- [ ] Session timeout configured (default 60 min)
- [ ] Umami analytics configured (if using)
- [ ] SMTP credentials secured with app-specific password

## Support

For issues not covered here:
1. Check application logs
2. Review error messages carefully
3. Ensure all environment variables are set
4. Verify file permissions
5. Check Docker daemon logs