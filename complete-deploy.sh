#!/bin/bash
set -e
exec > >(tee -a /var/log/myapp-deploy.log) 2>&1

echo "=== SUPICHAT COMPLETE DEPLOYMENT: $(date) ==="
echo "Target: 5.223.64.6"
echo "Repository: https://github.com/flamingice/supichat"

# Phase 1: Prepare Server
echo "=== PHASE 1: PREPARING SERVER ==="

# Create deploy user
id -u deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
echo "✅ Deploy user ready"

# Update system
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release apt-transport-https software-properties-common ufw git
echo "✅ Prerequisites installed"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker deploy
    systemctl enable --now docker
    echo "✅ Docker installed"
else
    echo "✅ Docker already present"
    usermod -aG docker deploy
fi

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin
echo "✅ Docker Compose plugin installed"

# Configure UFW
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 4001/tcp
echo "y" | ufw enable
echo "✅ Firewall configured"

# Create directories
mkdir -p /opt/myapp /etc/myapp /var/log
chown -R deploy:deploy /opt/myapp
chown deploy:deploy /etc/myapp
chmod 750 /etc/myapp
touch /var/log/myapp-deploy.log
chown deploy:deploy /var/log/myapp-deploy.log
echo "✅ Directories created"

# Phase 2: Deploy Code
echo "=== PHASE 2: DEPLOYING CODE ==="

sudo -u deploy bash -lc 'cd /opt/myapp && git clone https://github.com/flamingice/supichat . && git checkout main'
echo "✅ Code deployed"

# Create .env.example
sudo -u deploy bash -c "cat > /opt/myapp/.env.example <<'EOF'
DEEPL_API_KEY=REDACTED
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
NEXT_PUBLIC_SIGNALING_ORIGIN=http://5.223.64.6:4001
WEB_PORT=3000
SIGNALING_PORT=4001
EOF"

# Ensure .gitignore includes .env
sudo -u deploy bash -c "grep -qxF '.env' /opt/myapp/.gitignore || echo '.env' >> /opt/myapp/.gitignore"
echo "✅ Environment example created"

# Phase 3: Secure Environment
echo "=== PHASE 3: SECURE ENVIRONMENT SETUP ==="

sudo -u deploy bash -c "umask 077 && cat > /etc/myapp/.env <<'EOF'
DEEPL_API_KEY=a365247a-ead3-4ece-8488-01d270bf0501
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
NEXT_PUBLIC_SIGNALING_ORIGIN=http://5.223.64.6:4001
NEXT_PUBLIC_STUN_1=stun:stun.l.google.com:19302
WEB_PORT=3000
SIGNALING_PORT=4001
PROXY_PORT=80
EOF"

echo "✅ Secure environment configured"
ls -la /etc/myapp/.env

# Phase 4: Fix Docker Compose for External Access
echo "=== PHASE 4: CONFIGURE EXTERNAL ACCESS ==="

# Create modified docker-compose with exposed ports
sudo -u deploy bash -c "cat > /opt/myapp/docker-compose.override.yml <<'EOF'
version: '3.8'
services:
  web:
    ports:
      - \"3000:3000\"
  signaling:
    ports:
      - \"4001:4001\"
  proxy:
    ports:
      - \"80:80\"
      - \"443:443\"
EOF"

echo "✅ Docker Compose configured for external access"

# Phase 5: Start Application
echo "=== PHASE 5: STARTING APPLICATION ==="

cd /opt/myapp

# Give deploy user fresh docker group access
newgrp docker

# Start application as deploy user
sudo -u deploy bash -c "cd /opt/myapp && docker compose -f docker-compose.prod.yml -f docker-compose.override.yml --env-file /etc/myapp/.env up -d --build"

# Wait for startup
sleep 15

echo "=== PHASE 6: VERIFICATION ==="

# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check if web service is responding
if curl -f http://localhost:3000/supichat -m 10 >/dev/null 2>&1; then
    echo "✅ Web service responding"
else
    echo "⚠️  Web service not yet ready (may need more time to start)"
fi

# Create systemd service
cat > /etc/systemd/system/myapp.service <<'EOF'
[Unit]
Description=SupiChat Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml -f docker-compose.override.yml --env-file /etc/myapp/.env up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml -f docker-compose.override.yml --env-file /etc/myapp/.env down
TimeoutStartSec=0
User=deploy
Group=deploy

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable myapp.service

echo ""
echo "🎉 SUPICHAT DEPLOYMENT COMPLETE!"
echo "================================="
echo "Server: 5.223.64.6"
echo "Web App: http://5.223.64.6:3000/supichat"
echo "Signaling: http://5.223.64.6:4001"
echo "SSH: ssh root@5.223.64.6"
echo ""
echo "Environment: /etc/myapp/.env (secure)"
echo "Application: /opt/myapp"
echo "Logs: /var/log/myapp-deploy.log"
echo ""
echo "Final Status:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"