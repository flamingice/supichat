# SupiChat

A real-time video chat application with automatic message translation powered by Docker.

## Prerequisites

- **Docker** and **Docker Compose** (v2.0+)
- 2GB RAM minimum, 4GB recommended

## Quick Start

### 1. Clone and Configure

```bash
git clone <repository-url>
cd supichat
cp .env.example .env
```

### 2. Add Your Translation API Key

Edit `.env` and add your DeepL API key:
```bash
DEEPL_API_KEY=your-deepl-api-key-here
```

### 3. Start SupiChat

```bash
# Development mode (with hot reload)
docker compose --profile dev up

# Production mode  
docker compose --profile prod up -d

# With TURN server (for better NAT traversal)
docker compose --profile dev --profile turn up
```

### 4. Access the Application

- **Web App**: http://localhost:3000/supichat
- **Signaling Server**: http://localhost:4001/health

## Development

### Development Workflow

```bash
# Start development environment
docker compose --profile dev up

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose --profile dev up --build

# Run tests
docker compose exec web npm test

# Open a shell in the web container
docker compose exec web sh
```

### Development Features

- **Hot Reload**: Code changes automatically update in containers
- **Health Monitoring**: Built-in health checks for all services
- **Isolated Environment**: Complete development environment in containers

## Testing

```bash
# Unit tests
docker compose exec web npm test

# End-to-end tests (Playwright)
docker compose exec web npm run e2e

# Smoke tests
docker compose exec web npm run smoke
```

## Production Deployment

### Quick Production Setup

```bash
# Set production environment
echo "NODE_ENV=production" >> .env
echo "BUILD_TARGET=production" >> .env

# Start production services
docker compose --profile prod up -d

# Check health
docker compose exec web wget -qO- http://localhost:3000/supichat/api/health
docker compose exec signaling wget -qO- http://localhost:4001/health
```

### Production Considerations

- **Environment Variables**: Review `.env.example` and configure all required settings
- **HTTPS**: Configure nginx proxy for SSL/TLS in production
- **Secrets**: Use Docker secrets or external secret management for sensitive values
- **Monitoring**: Health endpoints available at `/supichat/api/health` and `/health`

## Available Services

### Core Services
- **web**: Next.js frontend application
- **signaling**: Socket.IO signaling server

### Optional Services  
- **coturn**: TURN server for WebRTC NAT traversal (`--profile turn`)
- **proxy**: nginx reverse proxy (`--profile prod`)

## Configuration

### Environment Variables

All configuration is handled through environment variables. See `.env.example` for complete documentation.

**Key Variables:**
- `DEEPL_API_KEY`: Required for message translation
- `TURN_SECRET`: Change in production for security
- `WEB_PORT` / `SIGNALING_PORT`: Customize service ports

### Docker Profiles

```bash
# Development
docker compose --profile dev up

# Production
docker compose --profile prod up

# With TURN server
docker compose --profile dev --profile turn up

# Multiple profiles
docker compose --profile dev --profile turn --profile proxy up
```

## Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Change ports in .env
echo "WEB_PORT=3001" >> .env
echo "SIGNALING_PORT=4002" >> .env
```

**Build Issues:**
```bash
# Clean rebuild
docker compose down
docker system prune -f
docker compose --profile dev up --build
```

**Permission Issues:**
```bash
# Reset Docker volumes
docker compose down -v
docker compose --profile dev up
```

**Health Check Failures:**
```bash
# Check service logs
docker compose logs web
docker compose logs signaling

# Manual health check
docker compose exec web wget -qO- http://localhost:3000/supichat/api/health
```

### Debug Mode

```bash
# Verbose logging
docker compose --profile dev up --verbose

# Container shell access
docker compose exec web sh
docker compose exec signaling sh
```

## Camera/Microphone Access

- **Localhost**: Camera and microphone work automatically
- **Production**: Requires HTTPS for camera/microphone access
- **Testing**: Use `http://localhost:3000/supichat` for development

## Project Structure

```
supichat/
├── apps/web/                 # Next.js frontend
├── services/signaling/       # Socket.IO signaling server
├── infra/                    # Infrastructure configurations
├── docker-compose.yml        # Unified Docker setup
├── Dockerfile.web           # Web app container
├── Dockerfile.signaling     # Signaling server container
├── .env.example             # Environment configuration template
└── .dockerignore            # Docker build context optimization
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[Your License Here]