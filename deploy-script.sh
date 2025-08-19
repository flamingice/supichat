#!/bin/bash
set -e
exec > >(tee -a /var/log/myapp-deploy.log) 2>&1

echo "=== SUPICHAT DEPLOYMENT STARTED: $(date) ==="

# Phase 1: Prepare Server
echo "Phase 1: Preparing server..."

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
    usermod -aG docker deploy
    systemctl enable --now docker
    echo "✅ Docker installed"
else
    echo "✅ Docker already present"
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

# Create app directory
mkdir -p /opt/myapp
chown -R deploy:deploy /opt/myapp
echo "✅ App directory created"

# Create log directory
mkdir -p /var/log
touch /var/log/myapp-deploy.log
chown deploy:deploy /var/log/myapp-deploy.log
echo "✅ Logging configured"

echo "Phase 1 completed successfully!"