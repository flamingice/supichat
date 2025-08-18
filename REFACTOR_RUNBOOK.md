# REFACTOR-APP Execution Runbook

## 🚀 Quick Start Guide

This runbook provides step-by-step instructions for executing, validating, and maintaining the infrastructure refactor implemented during the REFACTOR-APP workflow.

## 📋 Prerequisites

### System Requirements
- **Docker**: Version 20.10+ with daemon running
- **Node.js**: Version 18+ (for local development)
- **bash**: Version 4+ with standard utilities (curl, jq)
- **Make**: GNU Make for build automation

### Validation Commands
```bash
# Check all prerequisites
make check-docker
make check-ports
which jq curl node npm

# Verify workspace structure
npm run dev --workspaces --if-present
```

## 🔧 Development Workflow

### 1. Environment Setup
```bash
# Clone and setup
git clone <repository-url>
cd supichat

# Initialize environment
make setup
# Edit .env file and add required API keys
nano .env

# Start development environment
make dev
```

### 2. Running Tests
```bash
# Unit tests
make test

# Infrastructure tests (RED phase - should fail)
cd apps/web
npm test src/tests/infrastructure/

# Performance tests
npm test src/tests/performance/

# End-to-end tests
make test-e2e
```

### 3. Build and Deployment
```bash
# Development build
make build

# Production build
make prod

# CI simulation
make ci-test
```

### 4. Health Monitoring
```bash
# Check service health
make health

# View logs
make logs
make logs-web
make logs-signaling

# Monitor performance
# Visit http://localhost:3000/supichat for built-in performance monitoring
```

## 🧪 Testing Strategy

### RED-GREEN-REFACTOR Cycle

#### RED Phase ✅ (Completed)
35+ infrastructure tests currently failing, validating:
- Version script race conditions
- Smoke test false positives  
- Missing dependency validation
- Timeout and SSL handling
- JSON validation and error reporting

#### GREEN Phase 🔄 (Next Steps)
Implement functionality to make tests pass:

```bash
# Example: Add retry logic to smoke script
# File: scripts/smoke.sh
# Add: retry_count=3, timeout handling, SSL options

# Example: Add performance monitoring to smoke script  
# File: scripts/smoke.sh
# Add: response time measurement, threshold validation

# Example: Add JSON output format support
# File: scripts/smoke.sh
# Add: --format=json option for machine-readable output
```

#### REFACTOR Phase 🔄 (Future)
Apply clean code principles:
- Extract common functions
- Improve error message consistency
- Add comprehensive documentation
- Optimize performance patterns

### Test Execution Matrix

| Test Category | Command | Expected Result | Action if Failed |
|---------------|---------|-----------------|------------------|
| Infrastructure | `npm test src/tests/infrastructure/` | 35+ failures (RED) | ✅ Expected in RED phase |
| Performance | `npm test src/tests/performance/` | All pass | Debug component rendering |
| Unit Tests | `npm test` | All pass | Fix failing logic |
| E2E Tests | `make test-e2e` | All pass | Check browser setup |
| Smoke Tests | `bash scripts/smoke.sh` | All pass | Check service health |

## 🛠 Troubleshooting Guide

### Common Issues

#### 1. Docker Issues
```bash
# Problem: Docker daemon not running
# Solution:
make check-docker
sudo systemctl start docker  # Linux
# or start Docker Desktop

# Problem: Port conflicts
# Solution:
make check-ports
lsof -i :3000 -i :4001
# Kill conflicting processes or change ports in .env
```

#### 2. Version Generation Issues
```bash
# Problem: Permission denied
# Solution:
chmod +x apps/web/scripts/gen-version.mjs
sudo chown $USER:$USER apps/web/src/version.json

# Problem: Race conditions in CI
# Solution: Already fixed with atomic operations
# Verify: VERSION_OUTPUT_PATH=/tmp/test.json node apps/web/scripts/gen-version.mjs
```

#### 3. Smoke Test Failures
```bash
# Problem: Missing dependencies
# Solution:
sudo apt-get install jq curl  # Ubuntu
brew install jq curl          # macOS

# Problem: Service not responding
# Solution:
make health
make logs
# Check if services are running in Docker
```

#### 4. Test Environment Issues
```bash
# Problem: Tests failing unexpectedly
# Solution:
npm install  # Update dependencies
npm run build  # Rebuild assets
make clean && make dev  # Clean restart

# Problem: RED tests passing (should fail)
# Solution: This indicates missing functionality is now implemented
# Move to GREEN phase implementation
```

## 📊 Monitoring and Metrics

### Performance Monitoring
```bash
# Built-in monitoring (visit in browser)
http://localhost:3000/supichat

# CLI monitoring
make health
curl -s http://localhost:3000/supichat/api/health | jq

# Performance benchmarks
cd apps/web && npm test src/tests/performance/
```

### Success Metrics
- **Build Success Rate**: >95% (track via CI logs)
- **Smoke Test Pass Rate**: 100% (when services healthy)
- **Response Time**: <2s for health checks
- **Version Generation**: <100ms per execution

### Alert Thresholds
- Build failures > 2 consecutive
- Smoke test failures > 1 in 10 attempts  
- Response time > 5s
- Version generation errors

## 🔄 Maintenance Procedures

### Daily Operations
```bash
# Health check
make health

# Log review
make logs | grep -i error

# Performance check
curl -w "@curl-format.txt" -s http://localhost:3000/supichat/api/health
```

### Weekly Maintenance
```bash
# Update dependencies
make install

# Clean unused Docker resources
make clean-all

# Run full test suite
make ci-test

# Review metrics
# Check version.json growth rate
# Review error logs
```

### Monthly Reviews
- Review RED test coverage for new failure modes
- Update documentation based on operational learnings
- Performance optimization based on metrics
- Security review of new dependencies

## 🚨 Emergency Procedures

### Service Outage Response
```bash
# 1. Quick diagnosis
make health
make ps
docker ps -a

# 2. Service restart
make restart

# 3. Full reset if needed
make reset
make dev

# 4. Rollback if necessary (see MIGRATION_PLAN.md)
mv scripts/smoke.sh.backup scripts/smoke.sh
mv apps/web/scripts/gen-version.mjs.backup apps/web/scripts/gen-version.mjs
```

### Performance Degradation
```bash
# 1. Check resource usage
docker stats

# 2. Review logs for errors
make logs | tail -100

# 3. Restart specific service
docker compose restart web
# or
docker compose restart signaling

# 4. Scale if needed (production)
docker compose up --scale web=2
```

### Security Incident Response
```bash
# 1. Immediate isolation
make stop

# 2. Log preservation
make logs > incident-logs-$(date +%Y%m%d-%H%M%S).txt

# 3. Security scan
# Review file permissions, check for unauthorized changes
find . -type f -perm /o+w  # World-writable files
git status  # Unauthorized changes

# 4. Clean restart with latest patches
git pull
make clean-all
make dev
```

## 📚 Reference Documentation

### Quick Reference Commands
```bash
# Essential commands
make help          # Show all available commands
make dev          # Start development
make test         # Run tests
make health       # Check service health
make logs         # View logs
make clean        # Clean environment

# Debugging commands
make shell-web        # Open shell in web container
make shell-signaling  # Open shell in signaling container
make debug-web        # Start web in debug mode
```

### File Locations
- **Main Config**: `docker-compose.yml`, `.env`
- **Scripts**: `scripts/smoke.sh`, `apps/web/scripts/gen-version.mjs`
- **Build**: `Makefile`, `Dockerfile.web`
- **Tests**: `apps/web/src/tests/`
- **Docs**: `MIGRATION_PLAN.md`, `REFACTOR_PATCHES.md`

### Environment Variables
```bash
# Development
NODE_ENV=development
PORT=3000
SIGNALING_PORT=4001

# Testing
SMOKE_BASE_URL=http://localhost:3000/supichat
SMOKE_SIGNALING_URL=http://localhost:4001
VERSION_OUTPUT_PATH=/tmp/test-version.json

# Production
NODE_ENV=production
BUILD_TARGET=production
DEEPL_API_KEY=your-api-key-here
```

## 🎯 Success Checklist

### Pre-Deployment
- [ ] All prerequisites installed and verified
- [ ] Environment setup completed (`.env` configured)
- [ ] Docker daemon running and accessible
- [ ] Required ports available (3000, 4001)

### Post-Deployment
- [ ] Services starting successfully (`make dev`)
- [ ] Health checks passing (`make health`)
- [ ] Smoke tests passing (`bash scripts/smoke.sh`)
- [ ] Version generation working (`node apps/web/scripts/gen-version.mjs`)
- [ ] Performance monitoring active (check browser)

### Ongoing Operations
- [ ] Daily health checks scheduled
- [ ] Log monitoring configured
- [ ] Backup procedures tested
- [ ] Team trained on new workflows
- [ ] Documentation updated for operational changes

---

## 🤖 Automation Integration

### CI/CD Pipeline Integration
```yaml
# Example GitHub Actions workflow
- name: Run Infrastructure Tests
  run: |
    make check-docker
    make ci-test
    bash scripts/smoke.sh

- name: Deploy if Tests Pass
  if: success()
  run: |
    make prod
    make health
```

### Monitoring Integration
```bash
# Prometheus metrics endpoint (future enhancement)
curl http://localhost:3000/supichat/metrics

# Health check for monitoring systems
curl -f http://localhost:3000/supichat/api/health || exit 1
```

---
*This runbook is maintained as part of the REFACTOR-APP workflow and should be updated with operational learnings.*