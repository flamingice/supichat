#!/usr/bin/env bash
set -euo pipefail

# Lean systemd-based installer for SupiChat
# Follows security best practices with non-root execution

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Check if running as root and handle appropriately
if [ "$(id -u)" = "0" ]; then
    warn "Running as root. Creating dedicated user 'supichat' for security."
    INSTALL_USER="supichat"
    
    # Create dedicated user if it doesn't exist
    if ! id "$INSTALL_USER" >/dev/null 2>&1; then
        log "Creating user: $INSTALL_USER"
        useradd -r -s /bin/bash -d /opt/supichat -m "$INSTALL_USER"
    fi
    
    # Move to user directory and change ownership
    INSTALL_DIR="/opt/supichat"
    if [ "$(pwd)" != "$INSTALL_DIR" ]; then
        log "Copying source to $INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
        rsync -av --exclude='.git' . "$INSTALL_DIR/"
        chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR"
    fi
    
    # Re-execute as the dedicated user
    log "Switching to user: $INSTALL_USER"
    exec sudo -u "$INSTALL_USER" -H bash "$INSTALL_DIR/$(basename "$0")" "$@"
else
    INSTALL_USER="$(whoami)"
    INSTALL_DIR="$(pwd)"
    log "Installing as user: $INSTALL_USER"
fi

cd "$INSTALL_DIR"

# Install Node.js if needed
if ! command -v node >/dev/null 2>&1; then
    error "Node.js not found. Please install Node.js 18+ first."
fi

# Install dependencies and build
log "Installing dependencies..."
npm ci

log "Building application..."
npm run build -w apps/web

# Create environment file
ENV_FILE="$INSTALL_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
    log "Creating environment configuration..."
    cat > "$ENV_FILE" <<EOF
NODE_ENV=production
WEB_PORT=3000
SIGNALING_PORT=4001
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
# DEEPL_API_KEY=your_key_here
EOF
    warn "Please edit $ENV_FILE and add your API keys"
fi

# Create systemd service files (requires sudo)
log "Creating systemd services..."

# Web service
sudo tee /etc/systemd/system/supichat-web.service > /dev/null <<EOF
[Unit]
Description=SupiChat Web Application
After=network.target
Wants=supichat-signaling.service

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$INSTALL_DIR/apps/web
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=supichat-web

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF

# Signaling service
sudo tee /etc/systemd/system/supichat-signaling.service > /dev/null <<EOF
[Unit]
Description=SupiChat Signaling Server
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$INSTALL_DIR/services/signaling
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=supichat-signaling

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable services
sudo systemctl daemon-reload
sudo systemctl enable supichat-web supichat-signaling

log "Starting services..."
sudo systemctl start supichat-signaling
sudo systemctl start supichat-web

# Create management scripts
cat > "$INSTALL_DIR/start.sh" <<'EOF'
#!/bin/bash
sudo systemctl start supichat-signaling supichat-web
sudo systemctl status supichat-signaling supichat-web --no-pager
EOF

cat > "$INSTALL_DIR/stop.sh" <<'EOF'
#!/bin/bash
sudo systemctl stop supichat-web supichat-signaling
EOF

cat > "$INSTALL_DIR/restart.sh" <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
git pull
npm ci
npm run build -w apps/web
sudo systemctl restart supichat-signaling supichat-web
sudo systemctl status supichat-signaling supichat-web --no-pager
EOF

cat > "$INSTALL_DIR/logs.sh" <<'EOF'
#!/bin/bash
sudo journalctl -f -u supichat-web -u supichat-signaling
EOF

chmod +x "$INSTALL_DIR"/{start,stop,restart,logs}.sh

# Check service status
sleep 2
log "Service status:"
sudo systemctl status supichat-signaling supichat-web --no-pager || true

# Get server IP
HOST=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}' || echo "localhost")

log ""
log "✅ Installation complete!"
log "🌐 Web app: http://$HOST:3000/supichat"
log "📁 Install directory: $INSTALL_DIR"
log ""
log "Management commands:"
log "  Start:   $INSTALL_DIR/start.sh"
log "  Stop:    $INSTALL_DIR/stop.sh"
log "  Restart: $INSTALL_DIR/restart.sh"
log "  Logs:    $INSTALL_DIR/logs.sh"
log ""
warn "Remember to:"
warn "  1. Configure API keys in $ENV_FILE"
warn "  2. Set up nginx reverse proxy (see infra/nginx.conf)"
warn "  3. Configure firewall (ports 3000, 4001)"
log ""
