# Contributing to SupiChat

Thank you for your interest in contributing to SupiChat! This guide will help you set up a Docker-based development environment and understand our contribution workflow.

## Prerequisites

- **Docker** and **Docker Compose** (v2.0+)
- **Git** for version control
- Basic understanding of React, Next.js, and Socket.IO

## Development Setup

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/supichat.git
cd supichat
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Add your DeepL API key for translation testing
# Edit .env and set DEEPL_API_KEY=your-key-here
```

### 3. Start Development Environment

```bash
# Start all development services
docker compose --profile dev up

# Or start with TURN server for WebRTC testing
docker compose --profile dev --profile turn up
```

### 4. Verify Setup

- Web app: http://localhost:3000/supichat
- Signaling server health: http://localhost:4001/health
- Check logs: `docker compose logs -f`

## Development Workflow

### Container-Based Development

All development happens inside Docker containers:

```bash
# Start development environment
docker compose --profile dev up

# In another terminal, run commands inside containers:

# Run tests
docker compose exec web npm test

# Run linting
docker compose exec web npm run lint

# Install new dependencies
docker compose exec web npm install package-name

# Access container shell
docker compose exec web sh
```

### Hot Reload

The development setup includes hot reload:
- **Frontend**: Changes to `apps/web/` automatically reload
- **Signaling**: Changes to `services/signaling/` restart the service
- **Configuration**: Changes to Docker files require rebuild with `--build`

### Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes in your editor
# Files are mounted into containers automatically

# Test your changes
docker compose exec web npm test
docker compose exec web npm run lint

# Rebuild if Dockerfile changes
docker compose --profile dev up --build
```

## Testing

### Running Tests

```bash
# Unit tests
docker compose exec web npm test

# Watch mode for development
docker compose exec web npm test -- --watch

# End-to-end tests
docker compose exec web npm run e2e

# Specific test file
docker compose exec web npm test -- apps/web/src/lib/__tests__/specific-test.spec.ts
```

### Adding Tests

Follow the existing test structure:
```
apps/web/src/
├── lib/__tests__/          # Unit tests
├── tests/performance/      # Performance tests
└── components/             # Component tests alongside components
```

### Test Requirements

- All new features must include tests
- Maintain or improve test coverage
- Tests must pass in the containerized environment

## Code Quality

### Linting and Formatting

```bash
# Check linting
docker compose exec web npm run lint

# Type checking
docker compose exec web npm run type-check

# Build validation
docker compose exec web npm run build
```

### Code Standards

- Follow existing TypeScript/JavaScript patterns
- Use functional components with hooks
- Implement proper error handling
- Add TypeScript types for all new code

## Container Development Guidelines

### Working with Docker

```bash
# View container logs
docker compose logs -f web
docker compose logs -f signaling

# Rebuild after dependency changes
docker compose --profile dev up --build

# Clean up containers and volumes
docker compose down -v

# Debug container issues
docker compose exec web sh
```

### Performance Considerations

- Use `.dockerignore` to optimize build context
- Leverage Docker layer caching
- Keep containers lightweight
- Monitor resource usage during development

## Architecture

### Service Structure

```
SupiChat (Docker-only)
├── web (Next.js frontend)
│   ├── Dockerfile.web (multi-stage: dev/prod)
│   ├── Hot reload in development
│   └── Health checks at /supichat/api/health
├── signaling (Socket.IO server)  
│   ├── Dockerfile.signaling (multi-stage: dev/prod)
│   └── Health checks at /health
└── coturn (TURN server, optional)
    └── For WebRTC NAT traversal
```

### Key Components

- **Frontend**: React with Next.js, Tailwind CSS, Zustand state management
- **Signaling**: Express.js with Socket.IO for WebRTC coordination
- **Translation**: DeepL API integration for real-time message translation
- **WebRTC**: Peer-to-peer video/audio with fallback TURN server

## Submitting Changes

### Before Submitting

```bash
# Ensure all tests pass
docker compose exec web npm test

# Verify build works
docker compose exec web npm run build

# Check linting
docker compose exec web npm run lint

# Test production build
docker compose --profile prod up --build
```

### Pull Request Process

1. **Create descriptive branch name**: `feature/add-translation-api`
2. **Write clear commit messages**: Follow conventional commit format
3. **Update documentation**: If adding features, update README.md
4. **Add tests**: Ensure new functionality is tested
5. **Verify container builds**: Test both dev and production profiles

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Production build verified

## Container Testing
- [ ] Development profile works: `docker compose --profile dev up`
- [ ] Production profile works: `docker compose --profile prod up`
- [ ] Health checks pass
- [ ] No container errors in logs
```

## Debugging

### Common Development Issues

**Container Won't Start:**
```bash
# Check logs
docker compose logs web
docker compose logs signaling

# Rebuild from scratch
docker compose down -v
docker compose --profile dev up --build
```

**Port Conflicts:**
```bash
# Change ports in .env
echo "WEB_PORT=3001" >> .env
echo "SIGNALING_PORT=4002" >> .env
```

**Permission Issues:**
```bash
# Reset volumes
docker compose down -v
docker volume prune -f
```

**Hot Reload Not Working:**
```bash
# Ensure files are properly mounted
docker compose exec web ls -la /app/apps/web/src

# Check container logs for errors
docker compose logs -f web
```

### Getting Help

- Check existing [GitHub Issues](https://github.com/your-org/supichat/issues)
- Review container logs: `docker compose logs -f`
- Join development discussions in GitHub Discussions
- Test your changes in a clean environment: `docker compose down -v && docker compose --profile dev up --build`

## Development Tips

- **Use Docker exclusively**: Avoid installing Node.js locally
- **Leverage profiles**: Use appropriate Docker Compose profiles for testing
- **Monitor resources**: Keep an eye on Docker resource usage
- **Clean regularly**: Use `docker system prune` to clean up unused images
- **Test production**: Verify changes work in production profile before submitting

Happy contributing! 🚀