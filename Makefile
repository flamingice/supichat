# SupiChat Docker-First Development Makefile
# Provides convenient commands for Docker-based development workflow

.PHONY: help build dev prod test clean logs shell lint install health stop restart

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)SupiChat Docker Commands$(RESET)"
	@echo ""
	@echo "$(GREEN)Development:$(RESET)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST) | grep -E "(dev|build|test|lint)"
	@echo ""
	@echo "$(GREEN)Operations:$(RESET)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST) | grep -E "(logs|shell|health|clean|stop|restart)"
	@echo ""
	@echo "$(GREEN)Production:$(RESET)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST) | grep -E "(prod|deploy)"
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  make dev           # Start development environment"
	@echo "  make test          # Run all tests"
	@echo "  make logs          # View service logs"
	@echo "  make shell-web     # Open shell in web container"

# Environment setup
setup: ## Create .env from template and show next steps
	@if [ ! -f .env.example ]; then \
		echo "$(RED)Error: .env.example not found$(RESET)"; \
		echo "Please ensure .env.example exists in the project root"; \
		exit 1; \
	fi
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ Created .env from template$(RESET)"; \
		echo "$(YELLOW)⚠ Edit .env and add your DEEPL_API_KEY$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ .env already exists$(RESET)"; \
	fi

# Validation targets
check-docker: ## Check if Docker daemon is accessible
	@echo "$(GREEN)Checking Docker daemon availability...$(RESET)"
	@if ! docker info >/dev/null 2>&1; then \
		echo "$(RED)Docker daemon not accessible$(RESET)"; \
		echo "Please start Docker Desktop or check Docker installation"; \
		exit 1; \
	fi

check-ports: ## Check if required ports are available
	@echo "$(GREEN)Checking port availability...$(RESET)"
	@if lsof -i:3000 >/dev/null 2>&1; then \
		echo "$(RED)Port 3000 is already in use$(RESET)"; \
		echo "Stop the conflicting service or use a different port"; \
		exit 1; \
	fi
	@if lsof -i:4001 >/dev/null 2>&1; then \
		echo "$(RED)Port 4001 is already in use$(RESET)"; \
		echo "Stop the conflicting service or use a different port"; \
		exit 1; \
	fi

# Development commands
dev: setup check-docker ## Start development environment (with hot reload)
	@echo "$(GREEN)Starting development environment...$(RESET)"
	docker compose --profile dev up

dev-turn: setup check-docker ## Start development environment with TURN server
	@echo "$(GREEN)Starting development with TURN server...$(RESET)"
	docker compose --profile dev --profile turn up

dev-d: setup check-docker ## Start development environment in background
	@echo "$(GREEN)Starting development environment in background...$(RESET)"
	docker compose --profile dev up -d

build: check-docker ## Build all Docker images
	@echo "$(GREEN)Building Docker images...$(RESET)"
	docker compose --profile dev build

rebuild: check-docker ## Force rebuild all images (no cache)
	@echo "$(GREEN)Rebuilding all images from scratch...$(RESET)"
	docker compose --profile dev build --no-cache

# Testing commands
test: ## Run unit tests
	@echo "$(GREEN)Running unit tests...$(RESET)"
	docker compose exec web npm test

test-watch: ## Run tests in watch mode
	@echo "$(GREEN)Running tests in watch mode...$(RESET)"
	docker compose exec web npm test -- --watch

test-e2e: ## Run end-to-end tests
	@echo "$(GREEN)Running end-to-end tests...$(RESET)"
	docker compose exec web npm run e2e

lint: ## Run linting
	@echo "$(GREEN)Running linter...$(RESET)"
	docker compose exec web npm run lint

type-check: ## Run TypeScript type checking
	@echo "$(GREEN)Running type check...$(RESET)"
	docker compose exec web npm run type-check || echo "$(YELLOW)No type-check script found$(RESET)"

# Production commands
prod: ## Start production environment
	@echo "$(GREEN)Starting production environment...$(RESET)"
	@echo "BUILD_TARGET=production" >> .env
	@echo "NODE_ENV=production" >> .env
	docker compose --profile prod up -d --build

prod-logs: ## View production logs
	docker compose --profile prod logs -f

# Operations commands
logs: ## View logs from all services
	docker compose logs -f

logs-web: ## View web service logs
	docker compose logs -f web

logs-signaling: ## View signaling service logs
	docker compose logs -f signaling

shell: shell-web ## Open shell in web container (alias)

shell-web: ## Open shell in web container
	@echo "$(GREEN)Opening shell in web container...$(RESET)"
	docker compose exec web sh

shell-signaling: ## Open shell in signaling container
	@echo "$(GREEN)Opening shell in signaling container...$(RESET)"
	docker compose exec signaling sh

health: ## Check health of all services
	@echo "$(GREEN)Checking service health...$(RESET)"
	@echo "$(CYAN)Web app health:$(RESET)"
	@docker compose exec web wget --no-verbose --tries=1 --spider http://localhost:3000/supichat/api/health && echo "$(GREEN)✓ Web app healthy$(RESET)" || echo "$(RED)✗ Web app unhealthy$(RESET)"
	@echo "$(CYAN)Signaling server health:$(RESET)"
	@docker compose exec signaling wget --no-verbose --tries=1 --spider http://localhost:4001/health && echo "$(GREEN)✓ Signaling server healthy$(RESET)" || echo "$(RED)✗ Signaling server unhealthy$(RESET)"

ps: ## Show running containers
	docker compose ps

stop: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(RESET)"
	docker compose down

restart: ## Restart all services
	@echo "$(YELLOW)Restarting all services...$(RESET)"
	docker compose restart

# Cleanup commands
clean: ## Stop services and remove volumes
	@echo "$(YELLOW)Cleaning up containers and volumes...$(RESET)"
	docker compose down -v

clean-all: ## Stop services, remove volumes, and prune Docker system
	@echo "$(RED)Warning: This will remove all unused Docker resources$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose down -v
	docker system prune -f
	docker volume prune -f

# Installation and dependency management
install: ## Install/update dependencies in containers
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	docker compose exec web npm install
	docker compose exec signaling npm install

install-web: ## Install dependency in web container (Usage: make install-web PACKAGE=package-name)
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)Error: PACKAGE variable is required$(RESET)"; \
		echo "Usage: make install-web PACKAGE=package-name"; \
		exit 1; \
	fi
	docker compose exec web npm install $(PACKAGE)

# CI/CD simulation
ci-test: ## Run the same tests as CI pipeline
	@echo "$(GREEN)Running CI test suite...$(RESET)"
	@echo "$(CYAN)Building images...$(RESET)"
	docker compose --profile dev build
	@echo "$(CYAN)Starting services...$(RESET)"
	docker compose --profile dev up -d
	@echo "$(CYAN)Waiting for health checks...$(RESET)"
	@timeout 60 bash -c 'until docker compose exec web wget --no-verbose --tries=1 --spider http://localhost:3000/supichat/api/health; do sleep 2; done' || (echo "$(RED)Health check failed$(RESET)" && exit 1)
	@echo "$(CYAN)Running tests...$(RESET)"
	docker compose exec -T web npm test
	docker compose exec -T web npm run lint
	docker compose exec -T web npm run build
	@echo "$(GREEN)✓ All CI tests passed$(RESET)"
	@echo "$(YELLOW)Cleaning up...$(RESET)"
	docker compose down

# Utility commands
env: ## Show current environment variables
	@echo "$(CYAN)Current environment:$(RESET)"
	@cat .env 2>/dev/null || echo "$(RED)No .env file found$(RESET)"

urls: ## Show application URLs
	@echo "$(CYAN)Application URLs:$(RESET)"
	@echo "  Web app:         http://localhost:3000/supichat"
	@echo "  Signaling:       http://localhost:4001/health"
	@echo "  API Health:      http://localhost:3000/supichat/api/health"

ports: ## Show port usage
	@echo "$(CYAN)Port configuration:$(RESET)"
	@echo "  3000: Web application"
	@echo "  4001: Signaling server"
	@echo "  3478: TURN server (UDP, when enabled)"
	@echo "  49160-49200: TURN server range (UDP, when enabled)"

# Advanced commands
debug-web: ## Start web container with debugging capabilities
	@echo "$(GREEN)Starting web container in debug mode...$(RESET)"
	docker compose run --rm --service-ports web sh

debug-signaling: ## Start signaling container with debugging capabilities
	@echo "$(GREEN)Starting signaling container in debug mode...$(RESET)"
	docker compose run --rm --service-ports signaling sh

reset: ## Reset development environment completely
	@echo "$(RED)This will destroy all containers, volumes, and data$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose down -v
	docker system prune -f
	@echo "$(GREEN)Environment reset. Run 'make dev' to start fresh$(RESET)"