#!/bin/bash
set -e
exec >> /var/log/myapp-deploy.log 2>&1

echo "=== PHASE 2-3: CODE & SECRETS ==="

cd /opt/myapp

# Check for docker compose files
echo "Docker configuration files:"
ls -la docker-compose* || echo "No docker-compose files found"
ls -la Dockerfile* || echo "No Dockerfile found"

# Create .env.example
sudo -u deploy bash -c "cat > .env.example <<'EOF'
DEEPL_API_KEY=REDACTED
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
NEXT_PUBLIC_SIGNALING_ORIGIN=http://localhost:4001
WEB_PORT=3000
SIGNALING_PORT=4001
EOF"

echo "✅ .env.example created"

# Ensure .gitignore includes .env
sudo -u deploy bash -c "grep -qxF '.env' .gitignore || echo '.env' >> .gitignore"
echo "✅ .gitignore updated"

# Phase 3: Secure DeepL API Key Storage
echo "=== PHASE 3: SECURE DEEPL KEY STORAGE ==="

# Create secure environment directory
mkdir -p /etc/myapp
chown deploy:deploy /etc/myapp
chmod 750 /etc/myapp

# Create secure .env file with DeepL key
sudo -u deploy bash -c "umask 077 && cat > /etc/myapp/.env <<'EOF'
DEEPL_API_KEY=a365247a-ead3-4ece-8488-01d270bf0501
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/supichat
NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
NEXT_PUBLIC_SIGNALING_ORIGIN=http://165.22.241.229:4001
NEXT_PUBLIC_STUN_1=stun:stun.l.google.com:19302
WEB_PORT=3000
SIGNALING_PORT=4001
EOF"

# Verify secure permissions
ls -la /etc/myapp/.env
echo "✅ Secure environment file created"

echo "Phase 2-3 completed successfully!"