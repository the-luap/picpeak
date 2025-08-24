# 🚀 Simple Setup Guide

This guide helps non-technical users install PicPeak on Raspberry Pi or VPS systems using the automated setup script.

## 📋 Quick Setup

### Step 1: Download and Run Setup Script

```bash
# Download PicPeak
wget -O simple-setup.sh https://raw.githubusercontent.com/the-luap/picpeak/main/simple-setup.sh

# Make it executable
chmod +x simple-setup.sh

# Run the setup
bash simple-setup.sh
```

**Or in one command:**
```bash
curl -fsSL https://raw.githubusercontent.com/the-luap/picpeak/main/simple-setup.sh | bash
```

### Step 2: Follow the Interactive Prompts

The script will guide you through:
1. ✅ System requirements check
2. 🐋 Docker installation (if needed)
3. 🌐 Domain/IP configuration
4. 📧 Email setup (optional)
5. 🔐 Automatic password generation
6. 📦 PicPeak download and configuration
7. 🚀 Service startup

## 📋 Prerequisites

### Minimum System Requirements
- **OS**: Ubuntu, Debian, Raspberry Pi OS, CentOS, or Fedora
- **RAM**: 2GB minimum (script will warn if less)
- **Storage**: 20GB free space minimum
- **Network**: Internet connection for downloads

### Supported Systems
- ✅ Ubuntu 20.04+
- ✅ Debian 11+
- ✅ Raspberry Pi OS (32-bit and 64-bit)
- ✅ CentOS 7+
- ✅ Fedora 30+

## 🛠️ What the Script Does

### Automatic Installation
1. **System Check**: Verifies RAM, disk space, and architecture
2. **Docker Setup**: Installs Docker and Docker Compose if missing
3. **Network Configuration**: Helps configure domain/IP access
4. **Email Configuration**: Optional setup for Gmail, SendGrid, or custom SMTP
5. **Security**: Generates secure passwords automatically
6. **Service Deployment**: Downloads, builds, and starts PicPeak
7. **SSL Support**: Optional Let's Encrypt SSL setup

### Generated Configurations
- Secure JWT secret (64 hex characters)
- Database password (PostgreSQL)
- Redis password
- Environment configuration file
- Docker Compose setup

## 🌐 Network Configuration Options

### 1. Local Network Access (Default)
- Uses your local IP address
- Accessible only on your local network
- Perfect for home/office use

### 2. Public IP Access
- Uses your server's public IP
- Accessible from the internet
- Requires firewall configuration

### 3. Domain Name
- Uses your custom domain (e.g., photos.mydomain.com)
- Supports SSL/HTTPS with Let's Encrypt
- Professional setup

### 4. Development Mode
- Uses localhost
- Only accessible from the same machine
- Good for testing

## 📧 Email Configuration

### Gmail (Recommended for Beginners)
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password for PicPeak
3. Use your Gmail address and the App Password

### SendGrid (Recommended for Production)
1. Sign up at sendgrid.com (free tier: 100 emails/day)
2. Create an API key
3. Verify your sender email address

### Custom SMTP
- Use any SMTP server
- Configure host, port, security, and credentials

### Skip Email Setup
- Configure later in the admin panel
- PicPeak works without email but notifications won't be sent

## 🔐 Security Features

### Automatic Password Generation
- JWT secret: 64 hex characters
- Database password: 32 base64 characters (no $ symbols)
- Redis password: 32 base64 characters (no $ symbols)

### First Login Security
- Auto-generated admin password shown in setup
- **Mandatory password change** on first login
- Strong password requirements enforced

### SSL/HTTPS Support
- Optional Let's Encrypt integration
- Automatic nginx reverse proxy setup
- Forced HTTPS redirects

## 📍 Access Information

After successful installation, you'll get:

### Access URLs
- **Gallery**: `http://your-domain:3000` (or `https://your-domain` with SSL)
- **Admin Panel**: `http://your-domain:3001/admin` (or `https://your-domain/admin` with SSL)

### Admin Credentials
- **Email**: `admin@example.com`
- **Password**: Auto-generated (shown during setup)

## 🚨 Important First Steps

### 1. Change Admin Password
- The password change is **mandatory** for security
- You cannot skip this step
- New password requirements:
  - Minimum 12 characters
  - Mixed case letters
  - Numbers and special characters

### 2. Configure Email (if skipped)
1. Login to admin panel
2. Go to Settings → Email Configuration
3. Enter your SMTP details
4. Test email sending

### 3. Create Your First Gallery
1. Go to Admin Panel → Events
2. Click "Create New Event"
3. Upload photos to the generated folders
4. Share the gallery URL and password

## 🛠️ Management Commands

### Service Management
```bash
# View logs
cd ~/picpeak && docker compose logs -f

# Stop services
cd ~/picpeak && docker compose down

# Start services
cd ~/picpeak && docker compose up -d

# Restart services
cd ~/picpeak && docker compose restart
```

### Admin Password Reset
```bash
# Reset admin password
docker exec picpeak-backend node scripts/show-admin-credentials.js --reset
```

### Updates
```bash
cd ~/picpeak
git pull
docker compose down
docker compose build
docker compose up -d
```

## 🐛 Troubleshooting

### Common Issues

#### "Permission denied" when running script
```bash
chmod +x simple-setup.sh
```

#### "Docker command not found" after installation
```bash
# Log out and back in, or run:
newgrp docker
```

#### Can't access web interface
1. Check if services are running: `docker compose ps`
2. Check firewall: `sudo ufw allow 3000` and `sudo ufw allow 3001`
3. Verify URLs in browser match the setup configuration

#### 502 Bad Gateway
1. Wait 60 seconds for services to fully start
2. Check backend logs: `docker compose logs backend`
3. Restart frontend: `docker restart picpeak-frontend`

#### Email not working
1. Verify SMTP settings in admin panel
2. Check email queue: Admin Panel → Settings → Email
3. Test with a simple service like Gmail first

### Getting Help
1. Check the logs: `docker compose logs -f`
2. Review this guide and the main deployment guide
3. Search existing GitHub issues
4. Create a new issue with:
   - Error messages
   - System information (`uname -a`)
   - Setup choices made

## 📁 File Locations

After installation:
- **Installation directory**: `~/picpeak`
- **Photos**: `~/picpeak/storage/events/`
- **Logs**: `~/picpeak/logs/`
- **Database**: Docker volume `picpeak_postgres-data`
- **Backups**: `~/picpeak/backup/`

## 🔒 Security Recommendations

### For Internet-Facing Installations
1. **Use HTTPS**: Enable SSL during setup
2. **Firewall**: Only open ports 80 and 443
3. **Updates**: Keep system and Docker updated
4. **Backups**: Configure automatic backups in admin panel
5. **Monitoring**: Regularly check logs for suspicious activity

### For Local Network Use
1. **Strong passwords**: Use the auto-generated passwords
2. **Network security**: Secure your local network
3. **Regular backups**: Even for local use
4. **Access control**: Only share admin credentials with trusted users

## 🎯 Next Steps

After installation:
1. **Complete admin setup** (change password)
2. **Configure email notifications**
3. **Create your first test gallery**
4. **Set up automated backups**
5. **Customize themes and branding**
6. **Configure analytics** (optional)

## 📞 Support

- **Documentation**: Check the main deployment guide
- **Issues**: GitHub Issues page
- **Community**: GitHub Discussions
- **Updates**: Star the repository for notifications

---

**PicPeak Beta Setup Script v1.0** - Making photo sharing simple for everyone! 📸