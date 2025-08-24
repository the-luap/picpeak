#!/bin/bash

# ============================================================================
# Simple Setup Script for PicPeak
# ============================================================================
# 
# This script helps non-technical users install PicPeak, a secure photo 
# sharing platform for weddings and events.
#
# Supported Systems: Ubuntu, Debian, Raspberry Pi OS, CentOS, Fedora
# Requirements: At least 2GB RAM and 20GB free storage
#
# Usage: bash simple-setup.sh
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration variables
PICPEAK_DIR="$HOME/picpeak"
DOMAIN=""
ENABLE_SSL="false"
SMTP_CONFIGURED="false"
AUTO_INSTALL="false"

# Print colored messages
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_step() { echo -e "${PURPLE}🔄 $1${NC}"; }

# Print banner
print_banner() {
    echo -e "${PURPLE}"
    echo "============================================================================"
    echo "   ____  _      ____            _    "
    echo "  |  _ \\(_) ___|  _ \\ ___  __ _| | __"
    echo "  | |_) | |/ __| |_) / _ \\/ _\` | |/ /"
    echo "  |  __/| | (__|  __/  __/ (_| |   < "
    echo "  |_|   |_|\\___|_|   \\___|\\__,_|_|\\_\\"
    echo ""
    echo "  🚀 PicPeak Setup Script v1.0"
    echo "  📸 Secure Photo Sharing for Weddings & Events"
    echo "============================================================================"
    echo -e "${NC}"
}

# Show progress bar
show_progress() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    
    printf "\r["
    printf "%*s" "$filled" | tr ' ' '▓'
    printf "%*s" "$((width - filled))" | tr ' ' '░'
    printf "] %d%% (%d/%d)" "$percentage" "$current" "$total"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect operating system
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        print_error "Cannot detect operating system"
        exit 1
    fi
    
    case $OS in
        "ubuntu"|"debian"|"raspbian")
            PACKAGE_MANAGER="apt"
            PACKAGE_UPDATE="apt update"
            PACKAGE_INSTALL="apt install -y"
            ;;
        "centos"|"rhel"|"fedora")
            PACKAGE_MANAGER="yum"
            if command_exists dnf; then
                PACKAGE_MANAGER="dnf"
                PACKAGE_UPDATE="dnf update -y"
                PACKAGE_INSTALL="dnf install -y"
            else
                PACKAGE_UPDATE="yum update -y"
                PACKAGE_INSTALL="yum install -y"
            fi
            ;;
        *)
            print_warning "Operating system $OS not specifically supported, but might work"
            PACKAGE_MANAGER="unknown"
            ;;
    esac
    
    print_info "Detected OS: $OS $OS_VERSION"
}

# Check system requirements
check_requirements() {
    print_step "Checking system requirements..."
    
    # Check RAM
    local ram_gb=$(free -m | awk 'NR==2{printf "%.1f", $2/1024}')
    local ram_int=$(printf "%.0f" "$ram_gb")
    
    if [ "$ram_int" -lt 2 ]; then
        print_warning "System has ${ram_gb}GB RAM. Minimum 2GB recommended."
        echo -n "Continue anyway? (y/N): "
        read -r continue_ram
        if [[ ! "$continue_ram" =~ ^[Yy]$ ]]; then
            print_error "Installation cancelled"
            exit 1
        fi
    else
        print_success "RAM: ${ram_gb}GB (OK)"
    fi
    
    # Check disk space
    local disk_gb=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
    local disk_int=$(printf "%.0f" "$disk_gb" 2>/dev/null || echo "0")
    
    if [ "$disk_int" -lt 20 ]; then
        print_warning "Available disk space: ${disk_gb}GB. Minimum 20GB recommended."
        echo -n "Continue anyway? (y/N): "
        read -r continue_disk
        if [[ ! "$continue_disk" =~ ^[Yy]$ ]]; then
            print_error "Installation cancelled"
            exit 1
        fi
    else
        print_success "Disk space: ${disk_gb}GB available (OK)"
    fi
    
    # Check architecture (warn for 32-bit)
    local arch=$(uname -m)
    if [[ "$arch" == "armv7l" || "$arch" == "i386" || "$arch" == "i686" ]]; then
        print_warning "32-bit architecture detected ($arch). PicPeak works better on 64-bit systems."
    else
        print_success "Architecture: $arch (OK)"
    fi
}

# Install Docker
install_docker() {
    if command_exists docker; then
        print_success "Docker is already installed"
        return 0
    fi
    
    print_step "Installing Docker..."
    
    case $PACKAGE_MANAGER in
        "apt")
            # Remove old versions
            sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            
            # Update and install prerequisites
            sudo $PACKAGE_UPDATE
            sudo $PACKAGE_INSTALL ca-certificates curl gnupg lsb-release
            
            # Add Docker's official GPG key
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            
            # Add Docker repository
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Install Docker
            sudo apt update
            sudo $PACKAGE_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        "yum"|"dnf")
            sudo $PACKAGE_INSTALL yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo $PACKAGE_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        *)
            print_error "Automatic Docker installation not supported for your OS"
            print_info "Please install Docker manually and run this script again"
            exit 1
            ;;
    esac
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    print_success "Docker installed successfully"
    print_warning "You may need to log out and back in for Docker permissions to take effect"
}

# Install Docker Compose (if not included with Docker)
install_docker_compose() {
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose is available"
        return 0
    fi
    
    print_step "Installing Docker Compose..."
    
    # Try to install via package manager first
    case $PACKAGE_MANAGER in
        "apt")
            sudo $PACKAGE_INSTALL docker-compose-plugin
            ;;
        "yum"|"dnf")
            sudo $PACKAGE_INSTALL docker-compose-plugin
            ;;
    esac
    
    # If that didn't work, install standalone version
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        local compose_version="v2.20.2"
        local arch=$(uname -m)
        
        # Map architecture names
        case $arch in
            "x86_64") arch="x86_64" ;;
            "aarch64") arch="aarch64" ;;
            "armv7l") arch="armv7" ;;
            *) 
                print_error "Unsupported architecture for Docker Compose: $arch"
                exit 1
                ;;
        esac
        
        sudo curl -L "https://github.com/docker/compose/releases/download/$compose_version/docker-compose-linux-$arch" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    print_success "Docker Compose installed successfully"
}

# Get domain/IP configuration
configure_domain() {
    print_step "Configuring domain and network settings..."
    echo ""
    
    # Auto-detect IP address
    local public_ip=""
    local local_ip=""
    
    # Try to get public IP
    public_ip=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "")
    
    # Get local IP
    local_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1 | awk '{print $NF;exit}' 2>/dev/null || echo "")
    
    echo "Network configuration options:"
    echo ""
    echo "1. Use local IP address (LAN only): $local_ip"
    if [ -n "$public_ip" ]; then
        echo "2. Use public IP address (internet): $public_ip"
        echo "3. Use custom domain name (e.g., photos.mydomain.com)"
        echo "4. Use localhost (development only)"
    else
        echo "2. Use custom domain name (e.g., photos.mydomain.com)"
        echo "3. Use localhost (development only)"
    fi
    echo ""
    echo -n "Choose option [1]: "
    read -r network_choice
    
    case $network_choice in
        "2")
            if [ -n "$public_ip" ]; then
                DOMAIN="$public_ip"
            else
                echo -n "Enter your domain name: "
                read -r DOMAIN
            fi
            ;;
        "3")
            if [ -n "$public_ip" ]; then
                echo -n "Enter your domain name: "
                read -r DOMAIN
            else
                DOMAIN="localhost"
            fi
            ;;
        "4")
            if [ -n "$public_ip" ]; then
                DOMAIN="localhost"
            else
                echo -n "Enter your domain name: "
                read -r DOMAIN
            fi
            ;;
        *)
            DOMAIN="$local_ip"
            ;;
    esac
    
    print_info "Domain/IP set to: $DOMAIN"
    
    # Ask about SSL
    if [[ "$DOMAIN" != "localhost" && "$DOMAIN" != "127.0.0.1" && ! "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo ""
        echo "Do you want to enable SSL/HTTPS with Let's Encrypt?"
        echo "(This requires a valid domain name pointing to this server)"
        echo -n "Enable SSL? (y/N): "
        read -r enable_ssl
        if [[ "$enable_ssl" =~ ^[Yy]$ ]]; then
            ENABLE_SSL="true"
        fi
    fi
}

# Configure email settings
configure_email() {
    print_step "Configuring email settings..."
    echo ""
    
    echo "PicPeak can send notification emails for:"
    echo "• New gallery creation"
    echo "• Expiration warnings"
    echo "• Password resets"
    echo ""
    echo "Email providers:"
    echo "1. Gmail (free, requires app password)"
    echo "2. SendGrid (free tier available)"
    echo "3. Custom SMTP server"
    echo "4. Skip email setup (can configure later)"
    echo ""
    echo -n "Choose option [4]: "
    read -r email_choice
    
    case $email_choice in
        "1")
            configure_gmail
            ;;
        "2")
            configure_sendgrid
            ;;
        "3")
            configure_custom_smtp
            ;;
        *)
            print_info "Email setup skipped - you can configure this later in the admin panel"
            ;;
    esac
}

# Configure Gmail
configure_gmail() {
    echo ""
    echo "Gmail Configuration:"
    echo "1. Go to your Google Account settings"
    echo "2. Enable 2-Factor Authentication"
    echo "3. Generate an App Password for PicPeak"
    echo "4. Use that App Password (not your regular password)"
    echo ""
    
    echo -n "Enter your Gmail address: "
    read -r gmail_user
    
    echo -n "Enter your Gmail App Password: "
    read -s gmail_pass
    echo ""
    
    # Set SMTP variables
    SMTP_HOST="smtp.gmail.com"
    SMTP_PORT="587"
    SMTP_SECURE="false"
    SMTP_USER="$gmail_user"
    SMTP_PASS="$gmail_pass"
    EMAIL_FROM="$gmail_user"
    SMTP_CONFIGURED="true"
    
    print_success "Gmail configured successfully"
}

# Configure SendGrid
configure_sendgrid() {
    echo ""
    echo "SendGrid Configuration:"
    echo "1. Sign up at sendgrid.com (free tier: 100 emails/day)"
    echo "2. Create an API key in Settings > API Keys"
    echo "3. Verify your sender email address"
    echo ""
    
    echo -n "Enter your SendGrid API key: "
    read -s sendgrid_key
    echo ""
    
    echo -n "Enter your verified sender email: "
    read -r sender_email
    
    # Set SMTP variables
    SMTP_HOST="smtp.sendgrid.net"
    SMTP_PORT="587"
    SMTP_SECURE="false"
    SMTP_USER="apikey"
    SMTP_PASS="$sendgrid_key"
    EMAIL_FROM="$sender_email"
    SMTP_CONFIGURED="true"
    
    print_success "SendGrid configured successfully"
}

# Configure custom SMTP
configure_custom_smtp() {
    echo ""
    echo "Custom SMTP Configuration:"
    
    echo -n "SMTP Host: "
    read -r SMTP_HOST
    
    echo -n "SMTP Port (usually 587 or 465): "
    read -r SMTP_PORT
    
    echo -n "Use SSL/TLS? (y/N): "
    read -r smtp_secure
    if [[ "$smtp_secure" =~ ^[Yy]$ ]]; then
        SMTP_SECURE="true"
    else
        SMTP_SECURE="false"
    fi
    
    echo -n "SMTP Username: "
    read -r SMTP_USER
    
    echo -n "SMTP Password: "
    read -s SMTP_PASS
    echo ""
    
    echo -n "From email address: "
    read -r EMAIL_FROM
    
    SMTP_CONFIGURED="true"
    print_success "Custom SMTP configured successfully"
}

# Generate secure passwords
generate_passwords() {
    print_step "Generating secure passwords..."
    
    # Generate JWT secret (64 hex characters)
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -A n -t x1 | tr -d ' \n')
    
    # Generate database password (avoid $ character for Docker Compose)
    DB_PASSWORD=$(openssl rand -base64 32 2>/dev/null | tr -d '$' || head -c 24 /dev/urandom | base64 | tr -d '$')
    
    # Generate Redis password (avoid $ character for Docker Compose)
    REDIS_PASSWORD=$(openssl rand -base64 32 2>/dev/null | tr -d '$' || head -c 24 /dev/urandom | base64 | tr -d '$')
    
    print_success "Secure passwords generated"
}

# Download PicPeak
download_picpeak() {
    print_step "Downloading PicPeak..."
    
    if [ -d "$PICPEAK_DIR" ]; then
        print_warning "Directory $PICPEAK_DIR already exists"
        echo -n "Remove existing directory and download fresh copy? (y/N): "
        read -r remove_existing
        if [[ "$remove_existing" =~ ^[Yy]$ ]]; then
            rm -rf "$PICPEAK_DIR"
        else
            print_error "Installation cancelled"
            exit 1
        fi
    fi
    
    # Try git clone first, fall back to wget if git is not available
    if command_exists git; then
        git clone https://github.com/the-luap/picpeak.git "$PICPEAK_DIR"
    else
        print_warning "Git not found, downloading archive..."
        mkdir -p "$PICPEAK_DIR"
        cd "$PICPEAK_DIR"
        
        if command_exists wget; then
            wget -O picpeak.tar.gz "https://github.com/the-luap/picpeak/archive/refs/heads/main.tar.gz"
        elif command_exists curl; then
            curl -L -o picpeak.tar.gz "https://github.com/the-luap/picpeak/archive/refs/heads/main.tar.gz"
        else
            print_error "Neither git, wget, nor curl found. Please install one of these tools."
            exit 1
        fi
        
        tar -xzf picpeak.tar.gz --strip-components=1
        rm picpeak.tar.gz
    fi
    
    print_success "PicPeak downloaded to $PICPEAK_DIR"
}

# Create directories and set permissions
setup_directories() {
    print_step "Setting up directories..."
    
    cd "$PICPEAK_DIR"
    
    # Create required directories
    mkdir -p events/active events/archived data logs backup storage/temp storage/thumbnails storage/uploads
    
    # Set proper permissions
    chmod -R 755 events data logs backup storage
    
    print_success "Directories created and permissions set"
}

# Create environment file
create_env_file() {
    print_step "Creating environment configuration..."
    
    cd "$PICPEAK_DIR"
    
    # Determine protocol and port
    local protocol="http"
    local frontend_port="3000"
    local backend_port="3001"
    
    if [ "$ENABLE_SSL" = "true" ]; then
        protocol="https"
        frontend_port="443"
        backend_port="443"
    fi
    
    # Create .env file
    cat > .env << EOF
# PicPeak Configuration - Generated by setup script
# Generated on: $(date)

# Node Environment
NODE_ENV=production

# Database Configuration
DB_USER=picpeak
DB_PASSWORD=$DB_PASSWORD
DB_NAME=picpeak_prod

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD

# Security
JWT_SECRET=$JWT_SECRET

# Network Configuration
FRONTEND_URL=${protocol}://${DOMAIN}$([ "$frontend_port" != "80" ] && [ "$frontend_port" != "443" ] && echo ":$frontend_port" || echo "")
ADMIN_URL=${protocol}://${DOMAIN}$([ "$backend_port" != "80" ] && [ "$backend_port" != "443" ] && echo ":$backend_port" || echo "")
VITE_API_URL=${protocol}://${DOMAIN}$([ "$backend_port" != "80" ] && [ "$backend_port" != "443" ] && echo ":$backend_port" || echo "")/api

# Port Configuration (for direct access without reverse proxy)
FRONTEND_PORT=$frontend_port
BACKEND_PORT=$backend_port

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com

# Timezone
TZ=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "UTC")

EOF

    # Add email configuration if configured
    if [ "$SMTP_CONFIGURED" = "true" ]; then
        cat >> .env << EOF
# Email Configuration
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
EMAIL_FROM=$EMAIL_FROM

EOF
    else
        cat >> .env << EOF
# Email Configuration (disabled - configure in admin panel)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# EMAIL_FROM=noreply@yourdomain.com

EOF
    fi
    
    # Set secure permissions
    chmod 600 .env
    
    print_success "Environment file created"
}

# Start PicPeak services
start_services() {
    print_step "Starting PicPeak services..."
    
    cd "$PICPEAK_DIR"
    
    # Create docker-compose override for port configuration if needed
    if [ "$ENABLE_SSL" = "false" ]; then
        cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  frontend:
    ports:
      - "${FRONTEND_PORT:-3000}:80"
  
  backend:
    ports:
      - "${BACKEND_PORT:-3001}:3001"
EOF
    fi
    
    # Start services
    echo ""
    print_info "Building and starting Docker containers..."
    echo "This may take several minutes on first run..."
    echo ""
    
    # Use docker compose if available, fallback to docker-compose
    if docker compose version >/dev/null 2>&1; then
        docker compose up -d --build
    else
        docker-compose up -d --build
    fi
    
    print_success "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    print_step "Waiting for services to be ready..."
    
    local max_attempts=60
    local attempt=0
    local backend_ready=false
    
    echo ""
    
    while [ $attempt -lt $max_attempts ] && [ "$backend_ready" = false ]; do
        attempt=$((attempt + 1))
        show_progress $attempt $max_attempts
        
        # Check if backend is responding
        if curl -s "http://localhost:${BACKEND_PORT:-3001}/api/health" >/dev/null 2>&1; then
            backend_ready=true
        else
            sleep 2
        fi
    done
    
    echo ""
    
    if [ "$backend_ready" = true ]; then
        print_success "Services are ready!"
    else
        print_warning "Services are starting but may need more time"
        print_info "You can check status with: docker compose logs -f"
    fi
}

# Get admin credentials
get_admin_credentials() {
    print_step "Retrieving admin credentials..."
    
    cd "$PICPEAK_DIR"
    
    local max_attempts=30
    local attempt=0
    local admin_password=""
    
    # Wait for admin password to be generated
    while [ $attempt -lt $max_attempts ] && [ -z "$admin_password" ]; do
        attempt=$((attempt + 1))
        
        # Try to get password from logs
        if docker compose logs backend 2>/dev/null | grep -o "Admin password generated: [A-Za-z0-9!@#$%^&*]*" | tail -1 | cut -d' ' -f4 >/dev/null 2>&1; then
            admin_password=$(docker compose logs backend 2>/dev/null | grep -o "Admin password generated: [A-Za-z0-9!@#$%^&*]*" | tail -1 | cut -d' ' -f4)
            break
        fi
        
        # Try to get password from credentials file
        if docker exec picpeak-backend cat data/ADMIN_CREDENTIALS.txt 2>/dev/null | grep "Password:" | cut -d' ' -f2 >/dev/null 2>&1; then
            admin_password=$(docker exec picpeak-backend cat data/ADMIN_CREDENTIALS.txt 2>/dev/null | grep "Password:" | cut -d' ' -f2)
            break
        fi
        
        sleep 2
    done
    
    if [ -n "$admin_password" ]; then
        ADMIN_PASSWORD="$admin_password"
        print_success "Admin credentials retrieved"
    else
        print_warning "Could not automatically retrieve admin password"
        print_info "You can get it manually with: docker compose logs backend | grep 'Admin password'"
    fi
}

# Install reverse proxy (nginx) for SSL
setup_ssl() {
    if [ "$ENABLE_SSL" = "false" ]; then
        return 0
    fi
    
    print_step "Setting up SSL with nginx and Let's Encrypt..."
    
    # Install nginx and certbot
    case $PACKAGE_MANAGER in
        "apt")
            sudo $PACKAGE_UPDATE
            sudo $PACKAGE_INSTALL nginx certbot python3-certbot-nginx
            ;;
        "yum"|"dnf")
            sudo $PACKAGE_INSTALL nginx certbot python3-certbot-nginx
            ;;
        *)
            print_warning "Automatic nginx/certbot installation not supported for your OS"
            print_info "Please install nginx and certbot manually"
            return 1
            ;;
    esac
    
    # Create nginx configuration
    sudo tee /etc/nginx/sites-available/picpeak > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Temporary configuration - certbot will modify this
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location ~ ^/(photos|thumbnails|uploads|admin) {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/picpeak /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    # Get SSL certificate
    print_info "Obtaining SSL certificate from Let's Encrypt..."
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
    
    # Update .env for HTTPS URLs
    sed -i "s|http://|https://|g" "$PICPEAK_DIR/.env"
    sed -i "s|:3000||g" "$PICPEAK_DIR/.env"
    sed -i "s|:3001||g" "$PICPEAK_DIR/.env"
    
    print_success "SSL certificate installed and configured"
}

# Display final information
show_completion_info() {
    echo ""
    echo -e "${GREEN}============================================================================"
    echo "   🎉 PicPeak Installation Complete!"
    echo "============================================================================${NC}"
    echo ""
    
    # Determine access URLs
    local protocol="http"
    local port_suffix=""
    
    if [ "$ENABLE_SSL" = "true" ]; then
        protocol="https"
    else
        port_suffix=":3000"
    fi
    
    local gallery_url="${protocol}://${DOMAIN}${port_suffix}"
    local admin_url="${protocol}://${DOMAIN}${port_suffix}/admin"
    
    if [ "$ENABLE_SSL" = "false" ]; then
        admin_url="${protocol}://${DOMAIN}:3001/admin"
    fi
    
    echo -e "${BLUE}📍 Access URLs:${NC}"
    echo "   Gallery: $gallery_url"
    echo "   Admin Panel: $admin_url"
    echo ""
    
    echo -e "${YELLOW}🔐 Admin Login Credentials:${NC}"
    echo "   Email: admin@example.com"
    if [ -n "$ADMIN_PASSWORD" ]; then
        echo "   Password: $ADMIN_PASSWORD"
    else
        echo "   Password: (check logs with: docker compose logs backend | grep 'Admin password')"
    fi
    echo ""
    
    echo -e "${RED}⚠️  IMPORTANT SECURITY NOTES:${NC}"
    echo "   • You MUST change the admin password on first login"
    echo "   • The password change is mandatory for security"
    echo "   • Save your new password securely"
    if [ "$ENABLE_SSL" = "false" ]; then
        echo "   • Consider enabling HTTPS for production use"
    fi
    echo ""
    
    echo -e "${PURPLE}📖 Quick Start Guide:${NC}"
    echo "   1. Visit the admin panel: $admin_url"
    echo "   2. Login with the credentials above"
    echo "   3. Complete the mandatory password change"
    echo "   4. Configure email settings (if not done during setup)"
    echo "   5. Create your first photo gallery!"
    echo ""
    
    echo -e "${BLUE}🛠️  Useful Commands:${NC}"
    echo "   View logs:    cd $PICPEAK_DIR && docker compose logs -f"
    echo "   Stop services: cd $PICPEAK_DIR && docker compose down"
    echo "   Start services: cd $PICPEAK_DIR && docker compose up -d"
    echo "   Reset admin password: docker exec picpeak-backend node scripts/show-admin-credentials.js --reset"
    echo ""
    
    if [ "$SMTP_CONFIGURED" = "false" ]; then
        echo -e "${YELLOW}📧 Email Configuration:${NC}"
        echo "   Email notifications are not configured. You can set them up in:"
        echo "   Admin Panel → Settings → Email Configuration"
        echo ""
    fi
    
    echo -e "${GREEN}Installation directory: $PICPEAK_DIR${NC}"
    echo -e "${GREEN}For support and documentation: https://github.com/the-luap/picpeak${NC}"
    echo ""
    echo -e "${PURPLE}============================================================================${NC}"
}

# Handle interruption
cleanup() {
    echo ""
    print_warning "Installation interrupted"
    exit 130
}

# Main installation function
main() {
    # Handle Ctrl+C gracefully
    trap cleanup INT
    
    print_banner
    
    echo "This script will install PicPeak on your system."
    echo "It will automatically:"
    echo "• Check system requirements"
    echo "• Install Docker and Docker Compose"
    echo "• Download and configure PicPeak"
    echo "• Generate secure passwords"
    echo "• Start all services"
    echo ""
    echo -n "Continue with installation? (Y/n): "
    read -r continue_install
    
    if [[ "$continue_install" =~ ^[Nn]$ ]]; then
        print_info "Installation cancelled by user"
        exit 0
    fi
    
    echo ""
    print_info "Starting PicPeak installation..."
    echo ""
    
    # Installation steps
    detect_os
    check_requirements
    
    # Check for Docker
    if ! command_exists docker; then
        echo -n "Docker is not installed. Install it automatically? (Y/n): "
        read -r install_docker_prompt
        if [[ ! "$install_docker_prompt" =~ ^[Nn]$ ]]; then
            install_docker
        else
            print_error "Docker is required for PicPeak. Please install it manually."
            exit 1
        fi
    fi
    
    install_docker_compose
    configure_domain
    configure_email
    generate_passwords
    download_picpeak
    setup_directories
    create_env_file
    
    if [ "$ENABLE_SSL" = "true" ]; then
        setup_ssl
    fi
    
    start_services
    wait_for_services
    get_admin_credentials
    
    show_completion_info
    
    print_success "PicPeak is now running!"
}

# Run main function
main "$@"