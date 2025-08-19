#!/bin/bash
set -e
exec >> /var/log/myapp-deploy.log 2>&1

echo "=== FINAL DEPLOYMENT PHASE ==="
date

cd /opt/myapp

# Ensure environment file exists
ls -la /etc/myapp/.env

# Check if we have the correct compose file
if [ -f "docker-compose.prod.yml" ]; then
    echo "Using production compose file"
    COMPOSE_FILE="docker-compose.prod.yml"
else
    echo "Using default compose file"  
    COMPOSE_FILE="docker-compose.yml"
fi

# Start the application
echo "Starting SupiChat application..."
sudo -u deploy docker compose -f "$COMPOSE_FILE" --env-file /etc/myapp/.env up -d

sleep 5

# Check status
echo "=== APPLICATION STATUS ==="
docker ps
echo ""
echo "=== COMPOSE STATUS ==="
cd /opt/myapp && sudo -u deploy docker compose -f "$COMPOSE_FILE" ps

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
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file /etc/myapp/.env up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml --env-file /etc/myapp/.env down
TimeoutStartSec=0
User=deploy
Group=deploy

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable myapp.service

echo "✅ SupiChat deployed successfully!"
echo "Server IP: 165.22.241.229"
echo "Access via: http://165.22.241.229:3000"

# Show running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"