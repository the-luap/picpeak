# 🚀 PicPeak Deployment Guide

This guide covers multiple deployment options for PicPeak, from simple local setups to production-ready configurations.

## 🎯 Quick Start - Simple Setup (Recommended for Beginners)

For the easiest installation without Docker or complex configurations, use our **unified setup script**:

```bash
curl -fsSL https://raw.githubusercontent.com/the-luap/picpeak/main/scripts/picpeak-setup.sh -o picpeak-setup.sh && \
chmod +x picpeak-setup.sh && \
sudo ./picpeak-setup.sh
```

This automated script handles everything including:
- Choice between Docker or Native installation
- OS detection and dependency installation
- Database setup and service configuration
- SSL/HTTPS setup (optional)

Perfect for:
- Small to medium deployments
- Local or VPS installations  
- Users new to server management
- Quick testing and evaluation

👉 **See [SIMPLE_SETUP.md](./SIMPLE_SETUP.md) for detailed instructions.**

---

## 🐳 Docker Compose Deployment

### Option 1: Using Pre-built Images (Recommended)

PicPeak provides official Docker images via GitHub Container Registry for quick deployment without building:

```bash
# Clone repository for configuration files
git clone https://github.com/the-luap/picpeak.git
cd picpeak

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your values

# Use pre-built images deployment
docker compose -f docker-compose.production.yml up -d
```

The production compose file uses:
- **Backend**: `ghcr.io/the-luap/picpeak/backend:latest`
- **Frontend**: `ghcr.io/the-luap/picpeak/frontend:latest`

Available tags:
- `latest` - Latest stable release
- `main` - Latest main branch build
- `develop` - Development branch (may be unstable)
- `v1.0.0` - Specific version tags

### Option 2: Building from Source

If you need to customize the application or the pre-built images aren't available, you can build locally:

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [First Login](#first-login)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)
 - [External Media Library](#external-media-library)

## Prerequisites

- Docker and Docker Compose installed
- Domain name (for production)
- SMTP server credentials for emails
- At least 2GB RAM and 20GB storage

## 🚀 Quick Start

### Method 1: Using Pre-built Images (Fastest)

1. **Clone the repository for configs**
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

4. **Deploy using pre-built images**
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

5. **Check logs**
   ```bash
   docker compose -f docker-compose.production.yml logs -f
   ```

## External Media Library

PicPeak can reference an existing, read‑only media library mounted into the backend container. This avoids copying originals into PicPeak storage.

- Map your host library path to the container as read‑only in `docker-compose.production.yml`:
  - Add volume under `backend`: `- ${EXTERNAL_MEDIA}:/external-media:ro`
  - Add backend env: `EXTERNAL_MEDIA_ROOT=/external-media`
- In `.env`, set:
  - `EXTERNAL_MEDIA=/mnt/photos` (example host path)
  - `EXTERNAL_MEDIA_ROOT=/external-media`

Usage:
- In Admin → Events, set “Source Mode” to “Reference (external folder)”, select a folder under `/external-media`, then import to index and generate thumbnails. Originals stay in your library.

Backups and Archives:
- Backups only include data under `STORAGE_PATH` and exclude external originals. The backup manifest includes `metadata.external_references = { excluded: true, events: N, photos: M }` and the Admin UI surfaces a warning.
- Archiving reference events creates a manifest‑only ZIP and deletes thumbnails for that event. External originals are never moved or deleted.

Local (npm) setup (no Docker):

1. Create or choose a folder that contains your external originals, e.g. `/Users/you/Pictures/picpeak-external` (macOS/Linux) or `C:\\Pictures\\picpeak-external` (Windows).
2. In `backend/.env` (or your shell), set:
   - `EXTERNAL_MEDIA_ROOT=/absolute/path/to/picpeak-external`
   - Ensure `STORAGE_PATH` points to your PicPeak storage (defaults to `./storage`).
3. Start services from source:
   - Backend: `cd backend && npm install && npm run migrate && JWT_SECRET=... npm start`
   - Frontend: `cd frontend && npm install && npm run dev` (or build + serve)
4. In Admin → Events:
   - Create an event, set “Source Mode” to “Reference (external folder)”.
   - Use the folder picker to browse under your `EXTERNAL_MEDIA_ROOT` and select the subfolder to reference.
   - Click “Import from selected folder” to index files and generate thumbnails on demand.

Notes:
- PicPeak only reads from `EXTERNAL_MEDIA_ROOT`; it never modifies or deletes your originals there.
- Thumbnails are generated under `STORAGE_PATH/thumbnails` and are included in backups; originals in `EXTERNAL_MEDIA_ROOT` are excluded.
- On Windows, use absolute paths (e.g., `C:\\Photos\\Library`) for `EXTERNAL_MEDIA_ROOT`.

### Method 2: Building from Source

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

4. **Build and deploy**
   ```bash
   docker compose build
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

### Public Landing Page

- `npm run migrate` now seeds three general settings: `general_public_site_enabled`, `general_public_site_html`, and `general_public_site_custom_css` so existing installs stay disabled by default.
- Configure the feature from **Admin → CMS Pages**. The landing page panel exposes the toggle, HTML editor, optional CSS overrides, preview, and a reset-to-default action.
- All HTML and CSS submitted through the UI is sanitized server-side. Scripts, inline event handlers, disallowed attributes, `@import` rules, and `javascript:` URLs are stripped before content is cached or rendered.
- Resetting via the UI (or calling `POST /api/admin/settings/public-site/reset`) restores the bundled template and clears custom CSS.
- The landing page response is cached in-memory. Override the default 60s cache window by setting `PUBLIC_SITE_CACHE_TTL_MS` (milliseconds) in your environment if you need faster cache busting.
- When the toggle is off PicPeak continues to serve the SPA/login redirect at `/`, preserving legacy behaviour until you explicitly enable the feature.

### Backend Configuration (.env)
Update `.env` with:
- `JWT_SECRET` - Authentication secret (REQUIRED - generate a secure random value)
- `DB_PASSWORD` - PostgreSQL password
- `REDIS_PASSWORD` - Redis password
- `SMTP_*` - Email configuration
- **URL Configuration** (for backend CORS):
  - `FRONTEND_URL` - Frontend origin (use full URL with scheme, no trailing slash)
    - Example (Docker): `http://localhost:3000`
  - `ADMIN_URL` - Admin origin (same as `FRONTEND_URL` for Docker; full URL, no trailing slash)
    - Example (Docker): `http://localhost:3000`
  
  Notes:
  - Do not include trailing `/` (e.g., use `http://host:3000`, not `http://host:3000/`).
  - Always include the scheme (`http://` or `https://`).
  - The backend compares origins strictly for CORS; malformed values will cause login requests to fail with 500.

#### External Database Example
To use an external PostgreSQL instead of the bundled container, set the following in `.env` and ensure the `postgres` service is disabled or removed:

```env
DB_HOST=db.example.com
DB_PORT=5432
DB_USER=picpeak
DB_PASSWORD=change_me
DB_NAME=picpeak_prod
```

Compose uses these values via `env_file: .env`. The backend service also defaults `DB_HOST=${DB_HOST:-postgres}` so if you don’t set `DB_HOST` it will use the bundled `postgres` container.

### Frontend Configuration (frontend/.env)
Create `frontend/.env` from `frontend/.env.example`:
```bash
cp frontend/.env.example frontend/.env
```

Update `frontend/.env` with:
- `VITE_API_URL` - Backend API URL
  - Docker (pre-built images) and production behind reverse proxy: `/api` (recommended; avoids CORS and matches the frontend Nginx proxy in the image)
  - Local dev (Vite): `http://localhost:3001` or `/api` if proxying through a dev proxy

Note: When using pre-built frontend images, runtime container env does not change the already-built JS. Prefer the default `/api` and let the frontend Nginx proxy forward to the backend.

⚠️ **IMPORTANT PORT CONFIGURATION**: 
- The frontend runs on port **3000** in Docker (exposed via nginx)
- The backend API runs on port **3001**
- The frontend `.env` file MUST point to the correct backend port (3001)
- Default `.env.example` is configured for Docker deployment

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

### Using Pre-built Images (Fastest)

```bash
# Pull latest images from GitHub Container Registry
docker pull ghcr.io/the-luap/picpeak/backend:latest
docker pull ghcr.io/the-luap/picpeak/frontend:latest

# Start services using production compose file
docker compose -f docker-compose.production.yml up -d

# View running containers
docker compose ps
```

### Building from Source (For Customization)

```bash
# Build images locally
docker compose build

# Or build with no cache for clean build
docker compose build --no-cache

# Start all services
docker compose up -d

# View running containers
docker compose ps
```

### Access Points

By default, services are exposed on:
- Frontend (UI + Admin): http://localhost:3000 (admin at `/admin`)
- Backend/API: http://localhost:3001 (API only; no UI routes)
- PostgreSQL: localhost:5432 (if needed)
- Redis: localhost:6379 (if needed)

### Initial Admin Setup

When deploying for the first time, an admin account is automatically created with a secure, randomly generated password. This password is displayed in the Docker logs during initialization and **must be changed** on first login.

#### Finding the Auto-Generated Admin Password

The admin password is automatically generated during the first startup and displayed in the backend container logs. Here's how to find it:

**Option 1: Search Docker logs for admin password** (recommended)
```bash
# Find the auto-generated admin password in logs
docker compose logs backend | grep "Admin password"
```

You should see output like:
```
✅ Admin password generated: BraveTiger6231!
```

**Option 2: View the complete initialization logs**
```bash
# View the complete admin setup logs
docker compose logs backend | grep -A 10 "Admin user created"
```

**Option 3: Check the saved credentials file**
```bash
# The password is also saved in the backend container
docker exec picpeak-backend cat data/ADMIN_CREDENTIALS.txt
```

**Option 4: Use the helper script**
```bash
# Show current admin username and email (password is hidden)
docker exec picpeak-backend node scripts/show-admin-credentials.js

# Reset the admin password to a new random password
docker exec picpeak-backend node scripts/show-admin-credentials.js --reset
```

#### Important Security Notes

- **Login requires the email address**, not username
- The admin password is only displayed once during initial setup
- **Password change is MANDATORY** on first login - the system will force you to change it
- If you lose the password before first login, use the `--reset` option to generate a new one
- New password requirements: minimum 12 characters, mixed case, numbers, and special characters

## 🔐 First Login

After deployment, you must complete the first login process which includes mandatory password change for security.

### Step 1: Locate Your Admin Password

1. **Find the auto-generated password** from the credentials file:
   ```bash
   # Docker deployment
   docker compose exec backend cat /app/data/ADMIN_CREDENTIALS.txt
   
   # Or directly from the host (if you have access)
   cat data/ADMIN_CREDENTIALS.txt
   ```

2. **Note the admin email** (default: `admin@example.com` unless customized)

### Step 2: Access Admin Panel

1. Navigate to your frontend domain and open the admin section:
   - `http://your-domain.com/admin` (behind reverse proxy)
   - `http://localhost:3000/admin` (Docker local)
   
   The backend at `:3001` serves API only and does not serve the admin UI.
2. Login using:
   - **Email**: `admin@example.com` (or your custom admin email)
   - **Password**: The auto-generated password from the logs

### Step 3: Mandatory Password Change

Upon first login, the system will **automatically redirect** you to change your password:

1. **You cannot skip this step** - it's enforced for security
2. Enter the current auto-generated password
3. Create a new secure password meeting these requirements:
   - Minimum 12 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character (!@#$%^&*)

### Security Best Practices for New Password

- **Use a unique password** not used elsewhere
- **Consider a password manager** for generation and storage
- **Include mixed characters**: `MySecureP@ssw0rd2024!`
- **Avoid personal information** (names, dates, etc.)
- **Save securely** - you cannot recover this password easily

### If You Lose Access

If you lose your admin credentials after the first login, you'll need to manually reset the password in the database or create a new admin user through the database.

**Note**: The credentials file (`ADMIN_CREDENTIALS.txt`) is only created during initial deployment and contains the first admin password. After changing the password, this file becomes outdated but is kept for reference. If you need to regenerate the password and file during a reinstall, re-run the installer with the `--force-admin-password-reset` flag:

```bash
# Native reinstall example
sudo ./picpeak-setup.sh --native --force-admin-password-reset

# Docker reinstall example
sudo ./picpeak-setup.sh --docker --force-admin-password-reset
```

The flag calls `scripts/reset-admin-password.js` in non-interactive mode, writes a fresh random password into `data/ADMIN_CREDENTIALS.txt`, and prints the new credentials at the end of the installer run.

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

    # Frontend (serves UI and /admin/*)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API and protected resources
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location ~ ^/(photos|thumbnails|uploads) {
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

#### Method 1: Using Pre-built Images (Recommended)

```bash
# Pull latest changes (for configuration updates)
git pull

# Pull latest images from GitHub Container Registry
docker compose -f docker-compose.production.yml pull

# Restart with new images
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d

# Verify services are healthy
docker compose -f docker-compose.production.yml ps
```

#### Method 2: Building from Source

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify services are healthy
docker compose ps
```

#### Specific Version Updates

To use a specific version of the images:

```bash
# Edit docker-compose.production.yml to specify version tags
# Change: ghcr.io/the-luap/picpeak/backend:latest
# To:     ghcr.io/the-luap/picpeak/backend:v1.0.0

# Then pull and restart
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
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
   - Check backend logs for auto-generated admin password: `docker compose logs backend | grep "Admin password"`
   - Email: `admin@example.com` (or your custom admin email from .env)
   - Password: Auto-generated and shown in logs (e.g., `BraveTiger6231!`)
   - Remember: Password MUST be changed on first login

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
