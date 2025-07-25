# 🚀 PicPeak Deployment Guide

This guide covers deploying PicPeak using Docker Compose with direct port exposure. For internet-facing deployments, you'll need to add a reverse proxy (nginx, Traefik, Caddy, etc.) for SSL/HTTPS.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker and Docker Compose installed
- Domain name (for production)
- SMTP server credentials for emails
- At least 2GB RAM and 20GB storage

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/the-luap/picpeak.git
   cd picpeak
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

3. **Create required directories**
   ```bash
   mkdir -p events/active events/archived data logs backup storage
   chmod -R 755 events data logs backup storage
   ```

4. **Deploy**
   ```bash
   docker compose up -d
   ```

5. **Check logs**
   ```bash
   docker compose logs -f
   ```

## 🔧 Configuration

### Essential Environment Variables

Generate secure values:
```bash
# JWT Secret
openssl rand -base64 64

# Database Password (avoid $ character - see warning below)
openssl rand -base64 32 | tr -d '$'

# Redis Password (avoid $ character - see warning below)
openssl rand -base64 32 | tr -d '$'
```

⚠️ **PASSWORD WARNING**: Docker Compose interprets `$` as variable substitution. Either:
- Avoid `$` in passwords (recommended - use the commands above)
- Escape `$` as `$$` (e.g., `Pass$$word` instead of `Pass$word`)
- Quote the entire value: `DB_PASSWORD='Pass$word'` (less reliable)

Update `.env` with:
- `JWT_SECRET` - Authentication secret (REQUIRED - generate a secure random value)
- `DB_PASSWORD` - PostgreSQL password
- `REDIS_PASSWORD` - Redis password
- `SMTP_*` - Email configuration
- **CRITICAL URL Configuration** (must match your deployment):
  - `FRONTEND_URL` - Frontend URL with port (e.g., `http://yourdomain.com:3000`)
  - `ADMIN_URL` - Backend URL with port (e.g., `http://yourdomain.com:3001`)
  - `VITE_API_URL` - Backend API URL (e.g., `http://yourdomain.com:3001/api`)

⚠️ **IMPORTANT**: These URLs MUST include the correct ports and match exactly how users will access your site. Mismatched URLs will cause CORS errors and login failures!

### Email Configuration Examples

#### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## 📦 Deployment

### Build and Start Services

```bash
# Build images
docker compose build

# Start all services
docker compose up -d

# View running containers
docker compose ps
```

### Access Points

By default, services are exposed on:
- Frontend: http://localhost:3000
- Backend/API: http://localhost:3001
- PostgreSQL: localhost:5432 (if needed)
- Redis: localhost:6379 (if needed)

### Initial Admin Setup

When deploying for the first time, an admin account is automatically created with a secure random password. You need to retrieve this password to access the admin panel.

#### Finding the Admin Password

**Option 1: Check the backend logs** (recommended)
```bash
# View the initial setup logs
docker compose logs backend | grep -A 10 "Admin user created"
```

You should see output like:
```
========================================
✅ Admin user created successfully!
========================================
Email: admin@example.com
Password: BraveTiger6231!

⚠️  IMPORTANT:
1. Save these credentials securely
2. Please change the password after first login
========================================
```

**Note**: You login with the **email address**, not a username!

**Option 2: Check the saved credentials file**
```bash
# The password is saved in the backend container
docker exec picpeak-backend cat data/ADMIN_CREDENTIALS.txt
```

**Option 3: Use the helper script**
```bash
# Show current admin username and email (password is hidden)
docker exec picpeak-backend node scripts/show-admin-credentials.js

# Reset the admin password to a new random password
docker exec picpeak-backend node scripts/show-admin-credentials.js --reset
```

#### Important Notes

- **Login requires the email address**, not username
- The admin password is only shown once during initial setup
- If you lose the password, use the `--reset` option to generate a new one
- You must change the password on first login (enforced by the system)
- Password requirements: minimum 12 characters, mixed case, numbers, and special characters

#### Configuring Admin Email

By default, the admin email is `admin@example.com`. To use a different email address, set it in your `.env` file before first deployment:

```env
# .env
ADMIN_EMAIL=your-email@yourdomain.com
```

**Note**: This only works on first deployment. To change the admin email after deployment, you'll need to update it in the database or create a new admin user through the admin panel.

## 🔒 Reverse Proxy Setup

For production deployments, you should use a reverse proxy for SSL/HTTPS. The application exposes ports directly, allowing you to use any reverse proxy solution.

### Option 1: Nginx

Install nginx and create `/etc/nginx/sites-available/picpeak`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Protected photos and uploads
    location ~ ^/(photos|thumbnails|uploads) {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Admin routes
    location /admin {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/picpeak /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Traefik

Add labels to `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.picpeak.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.picpeak.entrypoints=websecure"
      - "traefik.http.routers.picpeak.tls.certresolver=letsencrypt"
      - "traefik.http.services.picpeak.loadbalancer.server.port=80"

  backend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.picpeak-api.rule=Host(`your-domain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.picpeak-api.entrypoints=websecure"
      - "traefik.http.routers.picpeak-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.picpeak-api.loadbalancer.server.port=3001"
```

### Option 3: Caddy

Create a `Caddyfile`:

```caddyfile
your-domain.com {
    # Frontend
    handle /* {
        reverse_proxy localhost:3000
    }

    # Backend API and admin
    handle /api/* {
        reverse_proxy localhost:3001
    }
    
    handle /admin/* {
        reverse_proxy localhost:3001
    }

    # Protected resources
    handle /photos/* {
        reverse_proxy localhost:3001
    }

    handle /thumbnails/* {
        reverse_proxy localhost:3001
    }

    handle /uploads/* {
        reverse_proxy localhost:3001
    }
}
```

### SSL Certificates

For any reverse proxy, you can use Let's Encrypt:

```bash
# With Certbot
sudo certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# Or use your reverse proxy's built-in ACME support
```

## 🔧 Maintenance

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Backup

#### Manual Backup
```bash
# Database backup
docker exec picpeak-postgres pg_dump -U picpeak picpeak_prod > backup/db_$(date +%Y%m%d_%H%M%S).sql

# Files backup
tar -czf backup/photos_$(date +%Y%m%d_%H%M%S).tar.gz events/
```

#### Automated Backup
The application includes a built-in backup service. Configure it in the admin panel:
1. Login to admin panel
2. Go to Settings → Backup
3. Configure destination and schedule
4. Enable backup service

### Updates

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

### Database Migrations

Migrations run automatically on startup, but you can run them manually:

```bash
docker exec picpeak-backend npm run migrate
```

## 🚨 Troubleshooting

### Common Issues

#### 502 Bad Gateway / Login Failures
**This is the most common deployment issue!** Usually caused by misconfigured URLs or network problems:

1. **CORS Configuration Errors**:
   ```bash
   # WRONG - Missing port will cause CORS errors
   FRONTEND_URL=http://10.0.252.12
   
   # CORRECT - Include the port you're accessing from
   FRONTEND_URL=http://10.0.252.12:3000
   ```
   
   The backend validates Origin headers against `FRONTEND_URL` for CORS. If they don't match exactly, you'll get 500 errors on login.

2. **After Container Restarts**:
   - Nginx may have cached old container IPs
   - Solution: `docker restart picpeak-frontend`
   - Always wait 30-60 seconds for health checks

3. **Backend Not Starting After Migrations**:
   - The logs may only show migrations completed
   - Check if server is actually running: `docker exec picpeak-backend ps aux | grep node`
   - Should see `node server.js` process

4. **Login After Fresh Install**:
   - Check migration logs for generated credentials
   - Username: `admin` or the email shown in logs
   - Password: Shown during first migration (e.g., `SharpPhoenix9920$`)

5. **Complete Fix Sequence**:
   ```bash
   # 1. Fix your .env file URLs
   # 2. Full restart
   docker-compose down
   docker-compose up -d
   
   # 3. Wait for healthy status
   sleep 60
   docker ps  # All should show (healthy)
   
   # 4. Test backend directly
   curl http://localhost:3001/health
   
   # 5. Test through frontend
   curl http://localhost:3000/api/public/settings
   ```

#### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :3001

# Change ports in .env
FRONTEND_PORT=3002
BACKEND_PORT=3003
```

#### Docker Compose Variable Substitution Errors
If you see warnings like:
```
WARN[0000] The "fgbf" variable is not set. Defaulting to a blank string.
```

This means your password contains `$` which Docker Compose interprets as a variable. Solutions:
1. **Best**: Generate passwords without `$`: `openssl rand -base64 32 | tr -d '$'`
2. **Alternative**: Escape `$` as `$$` in your .env file
3. **Example**: `DB_PASSWORD=Pass@#$$fgbf` instead of `DB_PASSWORD=Pass@#$fgbf`

#### Permission Errors
```bash
# Fix ownership
sudo chown -R 1000:1000 events data logs backup storage
chmod -R 755 events data logs backup storage
```

#### Database Connection Issues
```bash
# Check if database is running
docker compose ps
docker compose logs postgres

# Test connection
docker exec picpeak-postgres pg_isready
```

#### Email Not Sending
- Verify SMTP settings in .env
- Check email queue: `docker exec picpeak-backend psql -U picpeak -d picpeak_prod -c "SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 10;"`
- For Gmail, use app-specific password
- Check logs: `docker compose logs backend | grep email`

### Health Checks

```bash
# Backend health
curl http://localhost:3001/api/health

# Frontend health
curl http://localhost:3000

# Database health
docker exec picpeak-postgres pg_isready
```

### Useful Commands

```bash
# Enter backend container
docker exec -it picpeak-backend sh

# Enter database
docker exec -it picpeak-postgres psql -U picpeak picpeak_prod

# Reset admin password
docker exec picpeak-backend node scripts/show-admin-credentials.js --reset

# Check disk usage
df -h
du -sh events/ storage/ backup/

# View running processes
docker compose top
```

## Security Recommendations

1. **Use HTTPS**: Always use a reverse proxy with SSL in production
2. **Firewall**: Only expose necessary ports (80, 443)
3. **Secure passwords**: Use strong, unique passwords for all services
4. **Regular updates**: Keep Docker images and system packages updated
5. **Backup strategy**: Set up automated backups and test restoration
6. **Monitor logs**: Regularly check logs for suspicious activity
7. **Rate limiting**: The app includes built-in rate limiting, configure as needed

## Support

For issues and questions:
- Check logs first: `docker compose logs`
- Review documentation in the repository
- Check existing issues on GitHub
- Create a new issue with:
  - Error messages
  - Log output
  - Environment details (without secrets)
  - Steps to reproduce