# Production Deployment Guide

This guide addresses all known production deployment issues and provides solutions.

## Pre-Deployment Checklist

### 1. Environment Variables
Create a `.env` file with ALL required variables:

```bash
# Required
JWT_SECRET=<generate-with-openssl-rand-base64-32>
DB_PASSWORD=<strong-password>
ADMIN_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database
DB_USER=picpeak
DB_NAME=picpeak

# Email (Optional but recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Umami Analytics (Optional)
UMAMI_URL=https://analytics.yourdomain.com
UMAMI_WEBSITE_ID=your-website-id
UMAMI_HASH_SALT=<generate-random-string>
```

### 2. Generate Secrets

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Database Password
openssl rand -base64 24

# Generate Umami Hash Salt
openssl rand -hex 32
```

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

### 4. Create Admin User

After deployment, create the first admin user:

```bash
# Enter backend container
docker-compose -f docker-compose.prod.yml exec backend sh

# Create admin
node scripts/create-admin.js \
  --username admin \
  --email admin@yourdomain.com \
  --password <your-secure-password>

# Exit container
exit
```

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
- [ ] SSL/HTTPS enabled
- [ ] Firewall configured (only 80/443 open)
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Access logs monitored
- [ ] Rate limiting enabled
- [ ] File upload restrictions configured

## Support

For issues not covered here:
1. Check application logs
2. Review error messages carefully
3. Ensure all environment variables are set
4. Verify file permissions
5. Check Docker daemon logs