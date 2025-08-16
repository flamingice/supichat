#!/usr/bin/env bash
set -euo pipefail

# Ultra-lean Docker installer for SupiChat
# Minimal dependencies, maximum security

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Ensure not running as root
if [ "$(id -u)" = "0" ]; then
    error "Please run as non-root user. Docker should be configured for non-root access."
fi

# Check Docker
command -v docker >/dev/null || error "Docker not found. Install Docker first: curl -fsSL https://get.docker.com | sh"
command -v docker-compose >/dev/null || error "docker-compose not found. Install it first."

# Check Docker permissions
docker ps >/dev/null 2>&1 || error "Docker permission denied. Add user to docker group: sudo usermod -aG docker \$USER"

# Create environment file
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
    log "Creating environment configuration..."
    cat > "$ENV_FILE" <<EOF
WEB_PORT=3000
SIGNALING_PORT=4001
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
# DEEPL_API_KEY=your_key_here
EOF
    warn "Please edit $ENV_FILE and add your API keys"
fi

# Build and start
log "Building containers..."
docker-compose -f docker-compose.prod.yml build

log "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Create management scripts
cat > start.sh <<'EOF'
#!/bin/bash
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml ps
EOF

cat > stop.sh <<'EOF'
#!/bin/bash
docker-compose -f docker-compose.prod.yml down
EOF

cat > restart.sh <<'EOF'
#!/bin/bash
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml ps
EOF

cat > logs.sh <<'EOF'
#!/bin/bash
docker-compose -f docker-compose.prod.yml logs -f
EOF

chmod +x {start,stop,restart,logs}.sh

# Status check
sleep 3
log "Container status:"
docker-compose -f docker-compose.prod.yml ps

HOST=$(curl -fsS https://api.ipify.org 2>/dev/null || echo "localhost")

log ""
log "✅ SupiChat is running!"
log "🌐 Access: http://$HOST:3000/supichat"
log ""
log "Management:"
log "  Start:   ./start.sh"
log "  Stop:    ./stop.sh" 
log "  Restart: ./restart.sh"
log "  Logs:    ./logs.sh"
log ""
warn "Next steps:"
warn "  1. Add API keys to $ENV_FILE"
warn "  2. Set up nginx reverse proxy (optional)"
warn "  3. Configure firewall if needed"
