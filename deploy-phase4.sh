#!/bin/bash
set -e
exec >> /var/log/myapp-deploy.log 2>&1

echo "=== PHASE 4: START APPLICATION ==="

cd /opt/myapp

# Copy production docker-compose if it exists
if [ -f "docker-compose.prod.yml" ]; then
    cp docker-compose.prod.yml docker-compose.yml
    echo "✅ Using production docker-compose configuration"
else
    echo "ℹ️  Using default docker-compose.yml"
fi

# Show current Docker Compose configuration
echo "Current Docker Compose file:"
head -20 docker-compose.yml

# Build and start containers as deploy user with environment file
echo "Building and starting containers..."
sudo -u deploy bash -c "
    cd /opt/myapp && 
    docker compose --env-file /etc/myapp/.env pull 2>/dev/null || docker compose --env-file /etc/myapp/.env build --pull
"

echo "Starting containers in detached mode..."
sudo -u deploy bash -c "
    cd /opt/myapp &&
    docker compose --env-file /etc/myapp/.env up -d --remove-orphans
"

# Wait for containers to start
sleep 10

# Check container status
echo "Container status:"
sudo -u deploy bash -c "cd /opt/myapp && docker compose ps"

echo "Docker containers:"
docker ps --filter 'name=myapp' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# Show sample logs
echo "Sample application logs:"
CONTAINER_ID=$(docker compose ps -q 2>/dev/null | head -n1)
if [ -n "$CONTAINER_ID" ]; then
    docker logs --tail 50 "$CONTAINER_ID"
else
    echo "No containers found to show logs"
fi

echo "✅ Phase 4 completed - Application started"