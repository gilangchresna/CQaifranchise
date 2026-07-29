# =============================================================================
# CYBERQUOTE MAKEFILE
# =============================================================================
# Common commands for development and deployment
#
# Usage:
#   make setup          Install all dependencies
#   make dev            Start local development
#   make dev-backend    Backend only
#   make dev-frontend   Frontend only
#   make test           Run all tests
#   make lint           Run linting
#   make build          Build for production
#   make docker-build   Build Docker images
#   make deploy-staging Deploy to staging
#   make deploy-prod    Deploy to production
# =============================================================================

.PHONY: help setup dev dev-backend dev-frontend test lint build docker-build deploy-staging deploy-prod clean

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

# Default target
help:
	@echo "$(BLUE)CyberQuote$(NC) - AI Franchise Monitoring Platform"
	@echo ""
	@echo "Usage:"
	@echo "  make setup          Install all dependencies"
	@echo "  make dev            Start local development (all services)"
	@echo "  make dev-backend    Backend development only"
	@echo "  make dev-frontend   Frontend development only"
	@echo "  make test           Run all tests"
	@echo "  make lint           Run linting"
	@echo "  make build          Build for production"
	@echo "  make docker-build   Build Docker images"
	@echo "  make deploy-staging Deploy to staging"
	@echo "  make deploy-prod   Deploy to production"
	@echo "  make clean          Clean build artifacts"

# Install dependencies
setup:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	@echo "$(YELLOW)Backend...$(NC)"
	cd backend && pip install -r requirements.txt
	cd backend && pip install -r requirements-dev.txt
	@echo "$(YELLOW)Frontend...$(NC)"
	cd frontend/web && npm install
	@echo "$(GREEN)Done!$(NC)"

# Development
dev:
	@echo "$(GREEN)Starting all services...$(NC)"
	@echo "$(YELLOW)Note: Run 'make dev-backend' and 'make dev-frontend' in separate terminals$(NC)"

dev-backend:
	@echo "$(GREEN)Starting backend services...$(NC)"
	cd backend && \
	python -m uvicorn common.main:app --reload --port 8000

dev-frontend:
	@echo "$(GREEN)Starting frontend...$(NC)"
	cd frontend/web && npm run dev

# Testing
test:
	@echo "$(GREEN)Running tests...$(NC)"
	@echo "$(YELLOW)Backend tests...$(NC)"
	cd backend && pytest --cov=src tests/
	@echo "$(YELLOW)Frontend tests...$(NC)"
	cd frontend/web && npm run test

test-backend:
	cd backend && pytest --cov=src tests/ -v

test-frontend:
	cd frontend/web && npm run test -- --watchAll=false

# Linting
lint:
	@echo "$(GREEN)Running linting...$(NC)"
	@echo "$(YELLOW)Backend (ruff)...$(NC)"
	cd backend && ruff check src/
	@echo "$(YELLOW)Frontend (eslint)...$(NC)"
	cd frontend/web && npm run lint

format:
	@echo "$(GREEN)Formatting code...$(NC)"
	cd backend && ruff format src/
	cd frontend/web && npm run format

# Build
build:
	@echo "$(GREEN)Building for production...$(NC)"
	cd frontend/web && npm run build
	@echo "$(GREEN)Frontend built!$(NC)"

docker-build:
	@echo "$(GREEN)Building Docker images...$(NC)"
	docker build -t cyberquote/backend:latest ./backend
	docker build -t cyberquote/frontend:latest ./frontend/web

# Deployment
deploy-staging:
	@echo "$(YELLOW)Deploying to staging...$(NC)"
	cd infra/terraform/environments/staging && terraform apply
	cd frontend/web && npm run build && aws s3 sync dist/ s3://cyberquote-staging-frontend/

deploy-prod:
	@echo "$(RED)Deploying to PRODUCTION - requires approval!$(NC)"
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ]
	cd infra/terraform/environments/prod && terraform apply
	cd frontend/web && npm run build && aws s3 sync dist/ s3://cyberquote-prod-frontend/

# Infrastructure
infra-init:
	@echo "$(GREEN)Initializing Terraform...$(NC)"
	cd infra/terraform/environments/dev && terraform init

infra-plan:
	cd infra/terraform/environments/dev && terraform plan

# Database
db-migrate:
	cd backend && alembic upgrade head

db-seed:
	cd backend && python -m common.db.seed

db-reset:
	cd backend && alembic downgrade base && alembic upgrade head

# Utilities
clean:
	@echo "$(GREEN)Cleaning...$(NC)"
	rm -rf frontend/web/dist
	rm -rf frontend/web/node_modules/.vite
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

clean-all: clean
	docker system prune -f
	rm -rf .terraform

# Docker Compose (local development)
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# Check health
health:
	curl -s http://localhost:8000/health || echo "Backend not running"
	@echo "Frontend: http://localhost:5173"
