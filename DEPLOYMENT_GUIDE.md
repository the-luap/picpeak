# 🚀 PicPeak Complete Deployment Guide

This comprehensive guide covers all deployment methods for PicPeak, including Docker, PM2, manual installation, and deployment without a reverse proxy.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Security Requirements](#security-requirements)
- [Quick Start (Docker)](#quick-start-docker)
- [Deployment Methods](#deployment-methods)
  - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Method 2: PM2 (Node.js Process Manager)](#method-2-pm2-nodejs-process-manager)
  - [Method 3: Manual Installation](#method-3-manual-installation)
  - [Method 4: Without Nginx (Direct Access)](#method-4-without-nginx-direct-access)
- [Environment Configuration](#environment-configuration)
- [Admin Setup](#admin-setup)
- [SSL/HTTPS Configuration](#sslhttps-configuration)
- [Maintenance & Operations](#maintenance--operations)
- [Troubleshooting](#troubleshooting)
- [Security Checklist](#security-checklist)

## Prerequisites

### Basic Requirements
- Linux server (Ubuntu 20.04+ or similar)
- Domain name (for SSL certificates)
- SMTP credentials for email notifications
- Basic command line knowledge

### Software Requirements (varies by method)
- **Docker method**: Docker and Docker Compose
- **PM2 method**: Node.js 18+, PostgreSQL 14+
- **Manual method**: Node.js 18+, PostgreSQL 14+, nginx (optional)

### Development Setup
For local development, use `docker-compose.dev.yml` which includes Mailhog for email testing:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

## 🔐 Security Requirements

### Critical: JWT Secret Setup

**NEVER use the default JWT secret in production!** The application will refuse to start if JWT_SECRET is not properly configured.

Generate a secure JWT secret:
```bash
# Generate a 64-character secret
openssl rand -base64 32

# Or for even more security (recommended)
openssl rand -base64 64

# Or use the included script
./scripts/generate-jwt-secret.sh
```

### Critical: Database Password

Generate a strong database password:
```bash
openssl rand -base64 24
```

## 🚀 Quick Start (Docker)

The fastest way to deploy PicPeak in production:

```bash
# 1. Clone the repository
git clone https://github.com/the-luap/picpeak.git
cd picpeak

# 2. Use the automated install script (recommended)
sudo ./scripts/install.sh

# Or manually:
# 2. Copy production environment template
cp .env.production.example .env

# 3. Generate and add JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 4. Edit configuration
nano .env  # Update all required values

# 5. Create directories
mkdir -p storage/events/active storage/events/archived storage/thumbnails storage/uploads
mkdir -p data logs certbot/conf certbot/www

# 6. Deploy
docker-compose -f docker-compose.prod.yml up -d

# 7. Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 📦 Deployment Methods

### Method 1: Docker Compose (Recommended)

#### Step 1: Environment Configuration

Create `.env` file with all required variables:

```env
# SECURITY - MUST CHANGE ALL!
JWT_SECRET=<your-64-character-secret-from-openssl>
DB_PASSWORD=<your-secure-database-password>

# Application URLs
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com
ADMIN_URL=https://your-domain.com

# Database (PostgreSQL for Docker)
DATABASE_CLIENT=pg
DB_HOST=db
DB_PORT=5432
DB_NAME=picpeak
DB_USER=picpeak

# Email (Example: SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=PicPeak <noreply@your-domain.com>

# Application
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Backend URL (if different from frontend)
# BACKEND_URL=https://api.your-domain.com
```

#### Step 2: Docker Volume Permissions

Create `docker-compose.override.yml` for proper permissions:

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

#### Step 3: Build and Deploy

```bash
# Set correct permissions
chmod -R 755 storage data logs

# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Admin credentials will be displayed and saved to ADMIN_CREDENTIALS.txt
```

#### Step 4: Configure Nginx

Update `nginx/sites-enabled/default` with your domain:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Protected images
    location /photos {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
    }

    # Thumbnails
    location /thumbnails {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
    }

    # Public uploads
    location /uploads {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
    }
}
```

### Method 2: PM2 (Node.js Process Manager)

#### Step 1: Install Dependencies

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install PM2 globally
sudo npm install -g pm2

# Install nginx (if using reverse proxy)
sudo apt-get install -y nginx
```

#### Step 2: Setup Database

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE picpeak;
CREATE USER picpeak WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE picpeak TO picpeak;
\q
```

#### Step 3: Clone and Configure

```bash
# Clone repository
git clone https://github.com/the-luap/picpeak.git
cd picpeak

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cd ..
cp .env.production.example .env
nano .env  # Update all values
```

#### Step 4: Build Frontend

```bash
cd frontend
npm run build
cd ..
```

#### Step 5: Start with PM2

```bash
cd backend

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

#### Step 6: Configure Nginx

Create `/etc/nginx/sites-available/picpeak`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (static files)
    location / {
        root /path/to/picpeak/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Protected photos
    location /photos {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }

    # Other proxied paths
    location ~ ^/(thumbnails|uploads) {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/picpeak /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Method 3: Manual Installation

Similar to PM2 method but using systemd instead:

#### Create Systemd Service

Create `/etc/systemd/system/picpeak.service`:

```ini
[Unit]
Description=PicPeak Photo Sharing
After=network.target

[Service]
Type=simple
User=picpeak
WorkingDirectory=/home/picpeak/picpeak/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable picpeak
sudo systemctl start picpeak
```

### Method 4: Without Nginx (Direct Access)

For deployments without a reverse proxy:

#### Option A: Direct Backend Access

1. **Configure environment for direct access**:
```env
# .env
FRONTEND_URL=http://your-domain.com:5173
BACKEND_URL=http://your-domain.com:3001
ADMIN_URL=http://your-domain.com:5173

# Enable CORS for direct access
CORS_ENABLED=true
```

2. **Run backend directly**:
```bash
cd backend
NODE_ENV=production node server.js
```

3. **Run frontend development server** (not recommended for production):
```bash
cd frontend
VITE_API_URL=http://your-domain.com:3001/api npm run dev -- --host
```

#### Option B: Backend Serves Frontend

1. **Build frontend**:
```bash
cd frontend
VITE_API_URL=/api npm run build
```

2. **Configure backend to serve frontend**:
```javascript
// Add to backend/server.js after API routes
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}
```

3. **Access everything on backend port**:
```bash
# Application available at http://your-domain.com:3001
NODE_ENV=production node server.js
```

#### Option C: Using Node.js HTTP Proxy

Create a simple proxy server:

```javascript
// proxy-server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Proxy API requests
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true
}));

// Proxy other backend routes
app.use(['/photos', '/thumbnails', '/uploads'], createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true
}));

// Catch all - serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(80);
```

## 🔧 Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | **CRITICAL** - Authentication secret (min 32 chars) | Use `openssl rand -base64 32` |
| `DATABASE_CLIENT` | Database type | `pg` for PostgreSQL, `sqlite3` for SQLite |
| `DB_HOST` | Database host | `localhost` or `db` (Docker) |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `picpeak` |
| `DB_USER` | Database user | `picpeak` |
| `DB_PASSWORD` | Database password | Strong password |
| `SMTP_HOST` | Email server | `smtp.gmail.com` |
| `SMTP_PORT` | Email port | `587` |
| `SMTP_USER` | Email username | `your-email@gmail.com` |
| `SMTP_PASS` | Email password | App-specific password |
| `EMAIL_FROM` | From address | `PicPeak <noreply@domain.com>` |
| `FRONTEND_URL` | Frontend URL | `https://your-domain.com` |
| `BACKEND_URL` | Backend URL | `https://your-domain.com` |
| `ADMIN_URL` | Admin panel URL | `https://your-domain.com` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Backend port | `3001` |
| `LOG_LEVEL` | Logging level | `info` |
| `SESSION_TIMEOUT_MINUTES` | Session timeout | `60` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests | `100` |
| `DB_POOL_MIN` | Min DB connections | `5` |
| `DB_POOL_MAX` | Max DB connections | `25` |
| `DEFAULT_EXPIRATION_DAYS` | Gallery expiration | `30` |
| `WARNING_DAYS_BEFORE_EXPIRY` | Warning period | `7` |

### Frontend Environment

For production builds:
```bash
# frontend/.env.production
VITE_API_URL=/api  # For reverse proxy
# or
VITE_API_URL=https://api.your-domain.com  # For direct access
```

## 👤 Admin Setup

### Automatic Admin Creation

When you run migrations for the first time, an admin account is automatically created:

```bash
# Docker
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# PM2/Manual
cd backend && npm run migrate
```

Output:
```
========================================
✅ Admin user created successfully!
========================================
Username: admin
Password: SwiftEagle3847!

⚠️  IMPORTANT: Change password on first login
========================================
```

### Important Admin Notes

1. **Credentials are saved** to `backend/ADMIN_CREDENTIALS.txt`
2. **Must change password** on first login (enforced)
3. **Password requirements**:
   - Minimum 12 characters
   - Uppercase and lowercase letters
   - Numbers and special characters
   - Not a common password

### Lost Admin Password

```bash
# Docker
docker-compose -f docker-compose.prod.yml exec backend node scripts/reset-admin-password.js

# PM2/Manual
cd backend && node scripts/reset-admin-password.js
```

## 🔒 SSL/HTTPS Configuration

### Option 1: Let's Encrypt with Certbot

```bash
# Initial certificate
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d your-domain.com -d www.your-domain.com

# Auto-renewal is handled by certbot container
```

### Option 2: Using Traefik

Add to `docker-compose.override.yml`:

```yaml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.picpeak.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.picpeak.entrypoints=websecure"
      - "traefik.http.routers.picpeak.tls.certresolver=letsencrypt"
```

### Option 3: CloudFlare or Other CDN

1. Set up your domain in CloudFlare
2. Enable "Full SSL/TLS encryption mode"
3. Use CloudFlare's origin certificates

## 🔧 Maintenance & Operations

### Backup Procedures

Use the included backup script or create your own:

```bash
# Use the provided backup script
./scripts/backup.sh

# Or create custom backup script:
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"

mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U picpeak picpeak > $BACKUP_DIR/database.sql

# Files backup
tar -czf $BACKUP_DIR/storage.tar.gz storage/

echo "Backup completed: $BACKUP_DIR"
```

### Automated Backups

The application includes a built-in backup service. Configure via Admin Panel:
- Settings → Backup Configuration
- Set schedule (cron expression)
- Configure destination (local, rsync, S3)
- Enable email notifications

### Updates

```bash
# Docker method
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# PM2 method
git pull
cd backend && npm install
cd ../frontend && npm install && npm run build
pm2 restart picpeak
```

### Monitoring

#### Health Checks
```bash
# API health
curl https://your-domain.com/api/health

# Database connection
docker-compose -f docker-compose.prod.yml exec backend \
  psql -U picpeak -d picpeak -c "SELECT 1"

# Service status
docker-compose -f docker-compose.prod.yml ps
```

#### Logs
```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f

# PM2 logs
pm2 logs picpeak

# System logs
tail -f /var/log/nginx/error.log
```

## 🚨 Troubleshooting

### Common Issues

#### JWT Secret Errors
**Error**: "Missing required environment variable: JWT_SECRET"
- **Solution**: Set JWT_SECRET in your .env file
- **Generate**: `openssl rand -base64 32`

**Error**: "JWT_SECRET is set to the insecure default value"
- **Solution**: Change from default to secure value

#### Database Connection Failed
**Error**: "connect ECONNREFUSED"
- **Check**: Database is running
- **Check**: Correct host/port in .env
- **Docker**: Use `db` as host, not `localhost`

#### Permission Errors
**Error**: "EACCES: permission denied"
```bash
# Fix Docker permissions
sudo chown -R 1001:1001 storage data logs

# Fix PM2/Manual permissions
sudo chown -R $USER:$USER storage data logs
chmod -R 755 storage
```

#### Email Not Sending
- **Check**: SMTP credentials are correct
- **Gmail**: Use app-specific password
- **Test**: Admin Panel → Settings → Email → Test Email
- **Logs**: Check `email_queue` table for errors

#### Photos Not Appearing
- **Check**: File watcher is running
- **Permissions**: `chmod -R 755 storage/`
- **Logs**: `grep watcher` in backend logs

#### Frontend Can't Connect to Backend
- **CORS**: Ensure FRONTEND_URL matches in backend .env
- **Proxy**: Check nginx configuration
- **Direct**: Set CORS_ENABLED=true for non-proxy setup

### Debug Commands

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Backend shell access
docker-compose -f docker-compose.prod.yml exec backend sh

# Database access
docker-compose -f docker-compose.prod.yml exec db psql -U picpeak

# Test API
curl -I http://localhost:3001/api/health

# Check disk space
df -h storage/

# View running processes
ps aux | grep node
```

## ✅ Security Checklist

- [ ] **JWT_SECRET** is randomly generated (min 32 chars)
- [ ] **Database password** is strong and unique
- [ ] **Admin password** changed from auto-generated
- [ ] **SSL/HTTPS** enabled and working
- [ ] **Firewall** configured (only 80/443 open)
- [ ] **File permissions** set correctly (755 for storage)
- [ ] **Rate limiting** enabled (default: 100 req/15min)
- [ ] **CORS** properly configured
- [ ] **Environment files** not in version control
- [ ] **Backups** configured and tested
- [ ] **Monitoring** alerts set up
- [ ] **Updates** scheduled regularly
- [ ] **Access logs** being monitored
- [ ] **Email** using app-specific passwords
- [ ] **Umami analytics** configured (optional)

## 📞 Support

- 📘 [Documentation](https://github.com/the-luap/picpeak)
- 🐛 [Report Issues](https://github.com/the-luap/picpeak/issues)
- 💬 [Discussions](https://github.com/the-luap/picpeak/discussions)

---

**Need help?** Check the logs first, then open an issue with:
- Deployment method used
- Error messages
- Relevant log output
- Environment (without secrets)