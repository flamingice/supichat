#!/usr/bin/env bash
set -euo pipefail

# 🐳 SupiChat Docker Installer
# One command to rule them all - handles everything automatically!

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; exit 1; }
info() { echo -e "${BLUE}ℹ${NC} $*"; }

echo -e "${BLUE}"
cat << 'EOF'
╔══════════════════════════════════════╗
║            SupiChat Docker           ║
║     🐳 Production-Ready Deploy      ║
╚══════════════════════════════════════╝
EOF
echo -e "${NC}"

# Auto-install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    log "Adding current user to docker group..."
    sudo usermod -aG docker "$USER"
    warn "Please log out and back in, then re-run this script!"
    exit 0
fi

# Auto-install docker-compose if missing
if ! command -v docker-compose >/dev/null 2>&1; then
    log "Installing docker-compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Check Docker permissions and auto-fix
if ! docker ps >/dev/null 2>&1; then
    if groups "$USER" | grep -q docker; then
        warn "Docker group detected but not active. Please log out and back in!"
        exit 1
    else
        log "Adding user to docker group..."
        sudo usermod -aG docker "$USER"
        warn "Please log out and back in, then re-run this script!"
        exit 0
    fi
fi

# Get server info
HOST=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}' || echo "localhost")

# Create environment file with smart defaults
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
    log "Creating environment configuration..."
    cat > "$ENV_FILE" <<EOF
# SupiChat Configuration
WEB_PORT=3000
SIGNALING_PORT=4001
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io

# Translation API (optional - get from https://www.deepl.com/api)
# DEEPL_API_KEY=your_deepl_key_here

# Production URL (auto-detected)
NEXT_PUBLIC_SIGNALING_ORIGIN=http://$HOST:4001
EOF
else
    log "Using existing configuration: $ENV_FILE"
fi

# Build and start
log "Building SupiChat containers..."
docker-compose -f docker-compose.prod.yml build --parallel

log "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Create management scripts
log "Creating management scripts..."

cat > start.sh <<'EOF'
#!/bin/bash
echo "🚀 Starting SupiChat..."
docker-compose -f docker-compose.prod.yml up -d
echo ""
docker-compose -f docker-compose.prod.yml ps
EOF

cat > stop.sh <<'EOF'
#!/bin/bash
echo "🛑 Stopping SupiChat..."
docker-compose -f docker-compose.prod.yml down
EOF

cat > restart.sh <<'EOF'
#!/bin/bash
echo "🔄 Updating and restarting SupiChat..."
git pull
docker-compose -f docker-compose.prod.yml build --parallel
docker-compose -f docker-compose.prod.yml up -d
echo ""
docker-compose -f docker-compose.prod.yml ps
EOF

cat > logs.sh <<'EOF'
#!/bin/bash
echo "📋 SupiChat logs (Ctrl+C to exit):"
docker-compose -f docker-compose.prod.yml logs -f
EOF

cat > ssl-setup.sh <<'EOF'
#!/bin/bash
# Quick SSL setup for production
echo "🔒 Setting up SSL with Let's Encrypt..."
read -p "Enter your domain (e.g., supichat.example.com): " DOMAIN
sudo apt-get update
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d "$DOMAIN"
echo "✅ SSL certificates obtained for $DOMAIN"
echo "💡 Now update your docker-compose.prod.yml to use port 443 and mount certificates"
EOF

chmod +x {start,stop,restart,logs,ssl-setup}.sh

# Wait for services to start
log "Waiting for services to initialize..."
sleep 5

# Status check
log "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}🎉 SupiChat is now running!${NC}"
echo ""
echo -e "${BLUE}📱 Access Methods:${NC}"

if [ "$HOST" = "localhost" ] || [[ "$HOST" =~ ^127\. ]] || [[ "$HOST" =~ ^192\.168\. ]]; then
    echo -e "   ${GREEN}✓${NC} Local: http://localhost:3000/supichat"
    echo -e "   ${GREEN}✓${NC} Camera/Mic: ${GREEN}Works on localhost${NC}"
else
    echo -e "   🌐 Public: http://$HOST:3000/supichat"
    echo -e "   ${YELLOW}⚠${NC} Camera/Mic: ${YELLOW}HTTP won't work on public IP${NC}"
    echo ""
    echo -e "${BLUE}📹 For Camera/Microphone Access:${NC}"
    echo -e "   ${GREEN}Option 1:${NC} Test locally: http://localhost:3000/supichat"
    echo -e "   ${GREEN}Option 2:${NC} Set up SSL: ./ssl-setup.sh"
    echo -e "   ${GREEN}Option 3:${NC} Use browser flags (Chrome): --unsafely-treat-insecure-origin-as-secure=http://$HOST:3000"
fi

echo ""
echo -e "${BLUE}🔧 Management:${NC}"
echo "   ./start.sh    - Start services"
echo "   ./stop.sh     - Stop services"
echo "   ./restart.sh  - Update & restart"
echo "   ./logs.sh     - View logs"
echo "   ./ssl-setup.sh - Configure HTTPS"

echo ""
echo -e "${BLUE}⚙️ Configuration:${NC}"
echo "   Edit: $ENV_FILE"
echo "   Add your DeepL API key for translations"

echo ""
echo -e "${GREEN}🚀 Ready to chat across languages!${NC}"
