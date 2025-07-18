#!/bin/bash

# Gitea Act Runner Installation Script
set -e

echo "==================================="
echo "Gitea Act Runner Installation"
echo "==================================="

# Configuration
GITEA_URL="https://gitea.nothaft.cloud"
RUNNER_NAME="picpeak-runner-$(hostname)"
RUNNER_VERSION="0.2.10"  # Latest stable version

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}This script will help you install and register a Gitea Act Runner${NC}"
echo ""

# Step 1: Get registration token
echo -e "${GREEN}Step 1: Get Registration Token${NC}"
echo "1. Go to: $GITEA_URL/admin/runners"
echo "2. Click 'Create new Runner'"
echo "3. Copy the registration token"
echo ""
read -p "Enter your registration token: " REGISTRATION_TOKEN

if [ -z "$REGISTRATION_TOKEN" ]; then
    echo -e "${RED}Error: Registration token is required${NC}"
    exit 1
fi

# Step 2: Choose installation method
echo ""
echo -e "${GREEN}Step 2: Choose Installation Method${NC}"
echo "1. Docker (Recommended)"
echo "2. Binary installation"
read -p "Choose method (1 or 2): " METHOD

if [ "$METHOD" == "1" ]; then
    # Docker installation
    echo ""
    echo -e "${GREEN}Installing with Docker...${NC}"
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        echo "Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Create docker-compose file for runner
    cat > docker-compose.runner.yml << EOF
version: '3.8'

services:
  gitea-runner:
    image: gitea/act_runner:latest
    container_name: gitea-runner
    restart: unless-stopped
    environment:
      - GITEA_INSTANCE_URL=$GITEA_URL
      - GITEA_RUNNER_REGISTRATION_TOKEN=$REGISTRATION_TOKEN
      - GITEA_RUNNER_NAME=$RUNNER_NAME
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./runner-data:/data
    networks:
      - picpeak

networks:
  picpeak:
    external: true
EOF

    echo "Starting Gitea Runner with Docker..."
    docker-compose -f docker-compose.runner.yml up -d
    
    echo ""
    echo -e "${GREEN}✓ Runner installed and started with Docker${NC}"
    echo "Check logs with: docker logs gitea-runner"
    
elif [ "$METHOD" == "2" ]; then
    # Binary installation
    echo ""
    echo -e "${GREEN}Installing binary...${NC}"
    
    # Detect OS and architecture
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$ARCH" in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Unsupported architecture: $ARCH${NC}"
            exit 1
            ;;
    esac
    
    # Download act_runner
    DOWNLOAD_URL="https://gitea.com/gitea/act_runner/releases/download/v${RUNNER_VERSION}/act_runner-${RUNNER_VERSION}-${OS}-${ARCH}"
    
    echo "Downloading from: $DOWNLOAD_URL"
    curl -L -o act_runner "$DOWNLOAD_URL"
    chmod +x act_runner
    
    # Create config directory
    mkdir -p ~/.config/act_runner
    
    # Register the runner
    echo ""
    echo -e "${GREEN}Registering runner...${NC}"
    ./act_runner register \
        --no-interactive \
        --instance "$GITEA_URL" \
        --token "$REGISTRATION_TOKEN" \
        --name "$RUNNER_NAME" \
        --labels "ubuntu-latest:docker://node:16-bullseye,ubuntu-22.04:docker://node:16-bullseye,ubuntu-20.04:docker://node:16-bullseye"
    
    # Create systemd service
    if [ "$OS" == "linux" ]; then
        echo ""
        echo -e "${GREEN}Creating systemd service...${NC}"
        
        sudo tee /etc/systemd/system/gitea-runner.service > /dev/null << EOF
[Unit]
Description=Gitea Act Runner
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
ExecStart=$PWD/act_runner daemon
Restart=always
RestartSec=5
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable gitea-runner
        sudo systemctl start gitea-runner
        
        echo -e "${GREEN}✓ Runner installed as systemd service${NC}"
        echo "Check status with: sudo systemctl status gitea-runner"
        echo "Check logs with: sudo journalctl -u gitea-runner -f"
    else
        echo ""
        echo -e "${GREEN}✓ Runner installed${NC}"
        echo "Start runner with: ./act_runner daemon"
    fi
fi

echo ""
echo -e "${GREEN}==================================="
echo "Installation Complete!"
echo "===================================${NC}"
echo ""
echo "Next steps:"
echo "1. Go to: $GITEA_URL/paul/picpeak/settings/actions/runners"
echo "2. Verify your runner appears in the list"
echo "3. Push a commit to trigger the test workflow"
echo ""
echo "If the runner doesn't appear, check the logs for errors."