# 🚀 PicPeak Deployment Guide

This guide will help you deploy PicPeak in production. The entire process takes about 10-15 minutes.

## 📋 Prerequisites

- A server with Docker and Docker Compose installed
- A domain name (for SSL certificates)
- SMTP credentials for sending emails
- Basic command line knowledge

## 🏃 Quick Deploy (Recommended)

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/the-luap/picpeak.git
cd picpeak

# Copy environment template
cp .env.production.example .env

# Generate a secure JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Edit configuration
nano .env
```

### 2. Required Environment Variables

Edit your `.env` file with these essential settings:

```env
# Application URLs
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com

# Email Configuration (Required for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Admin Configuration
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=your-secure-password

# Database (PostgreSQL for production)
DATABASE_CLIENT=pg
DB_HOST=postgres
DB_NAME=picpeak
DB_USER=picpeak
DB_PASSWORD=secure-db-password
```

### 3. Deploy with Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f

# Access your site at https://your-domain.com
```

## 🔧 Configuration Options

### Storage Settings

```env
# Storage paths (default: ./storage)
STORAGE_PATH=./storage
ARCHIVE_PATH=./storage/archives

# Gallery expiration (days)
DEFAULT_EXPIRATION_DAYS=30
WARNING_DAYS_BEFORE_EXPIRY=7
```

### Security Settings

```env
# Session timeout (minutes)
SESSION_TIMEOUT=60

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Analytics (Optional)

```env
# Umami Analytics
VITE_UMAMI_URL=https://analytics.your-domain.com
VITE_UMAMI_WEBSITE_ID=your-website-id
```

## 🔒 SSL/TLS Setup

The production Docker Compose includes automatic SSL via Let's Encrypt:

1. **Ensure your domain points to your server**
2. **Update nginx configuration**:
   ```bash
   nano nginx/nginx.conf
   # Replace your-domain.com with your actual domain
   ```
3. **Start services** - Certbot will automatically obtain certificates

## 📁 Directory Structure

After deployment, your directory structure will be:

```
picpeak/
├── backend/          # API server
├── frontend/         # React app
├── storage/          # Photo storage
│   ├── events/       # Active galleries
│   │   ├── active/   # Current photos
│   │   └── archived/ # Expired galleries
│   ├── thumbnails/   # Generated thumbnails
│   └── uploads/      # User uploads
├── data/            # Database files
└── logs/            # Application logs
```

## 🔄 Maintenance

### Backup

```bash
# Backup database and photos
./scripts/backup.sh

# Backups are stored in ./backups/
```

### Update

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Logs

```bash
# View all logs
docker-compose logs

# View specific service
docker-compose logs backend
docker-compose logs frontend
```

## 🚨 Troubleshooting

### Common Issues

**Photos not appearing:**
- Check storage permissions: `chmod -R 755 storage/`
- Verify file watcher is running: `docker-compose logs backend | grep watcher`

**Email not sending:**
- Test SMTP settings: Admin Panel → Settings → Email → Send Test
- Check email queue: Admin Panel → System → Email Queue

**Can't access admin panel:**
- Default login: Use email/password from `.env`
- Reset password: `docker exec picpeak-backend npm run reset-admin`

### Health Check

```bash
# Check service status
docker-compose ps

# Test backend API
curl https://your-domain.com/api/health

# Check disk space
df -h storage/
```

## 🐳 Alternative Deployment Methods

### Using Docker Swarm

For high availability deployments, see [Docker Swarm Setup](deploy/README.md).

### Manual Installation

If you prefer not to use Docker:

1. Install Node.js 18+
2. Install PostgreSQL
3. Clone repository
4. Install dependencies: `npm install` in both `/backend` and `/frontend`
5. Build frontend: `cd frontend && npm run build`
6. Start services with PM2

## 📞 Support

- 📘 [Documentation](https://github.com/the-luap/picpeak)
- 🐛 [Report Issues](https://github.com/the-luap/picpeak/issues)
- 💬 [Discussions](https://github.com/the-luap/picpeak/discussions)

---

**Need help?** Open an issue on GitHub and we'll assist you!