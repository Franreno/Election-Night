# ─────────────────────────────────────────────
#  UK Election Results – Project Commands
# ─────────────────────────────────────────────

COMPOSE      = docker compose
BACKEND      = $(COMPOSE) exec backend
SEED_FILE    = election-results-sample.txt
BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 3000
API_URL      = http://localhost:$(BACKEND_PORT)
FRONTEND_URL = http://localhost:$(FRONTEND_PORT)

# E2E uses an isolated compose stack on different ports
E2E_COMPOSE      = docker compose -f docker-compose.e2e.yml -p e2e
E2E_API_URL      = http://localhost:8001
E2E_FRONTEND_URL = http://localhost:3001

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Docker (dev) ───────────────────────────

.PHONY: up
up: ## Start all services
	$(COMPOSE) up -d

.PHONY: down
down: ## Stop all services
	$(COMPOSE) down

.PHONY: rebuild
rebuild: ## Rebuild images and start services
	$(COMPOSE) up -d --build

.PHONY: restart
restart: down up ## Restart all services

.PHONY: logs
logs: ## Tail logs for all services
	$(COMPOSE) logs -f

.PHONY: logs-backend
logs-backend: ## Tail backend logs
	$(COMPOSE) logs -f backend

.PHONY: logs-frontend
logs-frontend: ## Tail frontend logs
	$(COMPOSE) logs -f frontend

.PHONY: ps
ps: ## Show running services
	$(COMPOSE) ps

# ─── Database (dev) ─────────────────────────

.PHONY: db-reset
db-reset: ## Reset dev database (destroy volume + recreate)
	$(COMPOSE) down -v
	$(COMPOSE) up -d
	@$(MAKE) wait-ready
	@echo "✅ Database reset complete"

.PHONY: db-shell
db-shell: ## Open psql shell
	$(COMPOSE) exec db psql -U postgres -d election

.PHONY: db-migrate
db-migrate: ## Run alembic migrations
	$(BACKEND) alembic upgrade head

# ─── Seed Data (dev) ────────────────────────

.PHONY: seed
seed: ## Upload sample data via API (requires running services)
	@echo "📤 Uploading $(SEED_FILE) via API..."
	@curl -sf -X POST $(API_URL)/api/upload \
		-F "file=@$(SEED_FILE);type=text/plain" \
		-o /dev/null -w "HTTP %{http_code}\n" \
		&& echo "✅ Seed data uploaded" \
		|| echo "❌ Upload failed — are services running? (make up)"

.PHONY: fresh-seed
fresh-seed: db-reset seed ## Reset database and upload sample data

# ─── Shared Helpers ─────────────────────────

.PHONY: wait-ready
wait-ready: ## Wait until dev backend and frontend are healthy
	@$(MAKE) _wait-services WAIT_API=$(API_URL) WAIT_FE=$(FRONTEND_URL)

.PHONY: _wait-services
_wait-services:
	@echo "⏳ Waiting for backend..."
	@for i in $$(seq 1 30); do \
		curl -sf $(WAIT_API)/api/health > /dev/null 2>&1 && break; \
		sleep 2; \
	done
	@curl -sf $(WAIT_API)/api/health > /dev/null 2>&1 \
		&& echo "✅ Backend ready" \
		|| { echo "❌ Backend not responding at $(WAIT_API)"; exit 1; }
	@echo "⏳ Waiting for frontend..."
	@for i in $$(seq 1 30); do \
		curl -sf $(WAIT_FE) > /dev/null 2>&1 && break; \
		sleep 2; \
	done
	@curl -sf $(WAIT_FE) > /dev/null 2>&1 \
		&& echo "✅ Frontend ready" \
		|| { echo "❌ Frontend not responding at $(WAIT_FE)"; exit 1; }

# ─── Unit Tests ─────────────────────────────

.PHONY: test
test: test-backend test-frontend ## Run all unit tests

.PHONY: test-backend
test-backend: ## Run backend pytest suite
	cd backend && python -m pytest -v

.PHONY: test-frontend
test-frontend: ## Run frontend vitest suite
	cd frontend && npm test

# ─── E2E Tests (isolated stack) ─────────────

.PHONY: e2e-up
e2e-up: ## Start isolated E2E services (ports 3001/8001)
	$(E2E_COMPOSE) up -d
	@$(MAKE) _wait-services WAIT_API=$(E2E_API_URL) WAIT_FE=$(E2E_FRONTEND_URL)

.PHONY: e2e-down
e2e-down: ## Stop E2E services
	$(E2E_COMPOSE) down

.PHONY: e2e-reset
e2e-reset: ## Reset E2E database (destroy volume + recreate)
	$(E2E_COMPOSE) down -v
	$(E2E_COMPOSE) up -d --build
	@$(MAKE) _wait-services WAIT_API=$(E2E_API_URL) WAIT_FE=$(E2E_FRONTEND_URL)
	@echo "✅ E2E database reset complete"

.PHONY: e2e-seed
e2e-seed: ## Seed E2E database via API
	@echo "📤 Uploading $(SEED_FILE) to E2E stack..."
	@curl -sf -X POST $(E2E_API_URL)/api/upload \
		-F "file=@$(SEED_FILE);type=text/plain" \
		-o /dev/null -w "HTTP %{http_code}\n" \
		&& echo "✅ Seed data uploaded" \
		|| echo "❌ Upload failed — are E2E services running? (make e2e-up)"

.PHONY: e2e-fresh-seed
e2e-fresh-seed: e2e-reset e2e-seed ## Reset E2E database and seed

.PHONY: test-e2e
test-e2e: ## Run E2E tests: clean DB → seeded DB (single merged report)
	@rm -rf frontend/blob-report
	@echo "═══ E2E: clean database ═══"
	@$(MAKE) test-e2e-clean
	@echo ""
	@echo "═══ E2E: seeded database ═══"
	@$(MAKE) test-e2e-seeded
	@echo ""
	@echo "═══ Merging reports ═══"
	cd frontend && npx playwright merge-reports --reporter=html ./blob-report

.PHONY: test-e2e-headed
test-e2e-headed: e2e-up ## Run E2E tests with visible browser
	cd frontend && E2E_BASE_URL=$(E2E_FRONTEND_URL) npx playwright test --headed

.PHONY: test-e2e-ui
test-e2e-ui: e2e-up ## Open Playwright UI mode
	cd frontend && E2E_DB=seeded E2E_BASE_URL=$(E2E_FRONTEND_URL) npx playwright test --ui

.PHONY: test-e2e-clean
test-e2e-clean: e2e-reset ## Run E2E tests against a clean (empty) E2E database
	cd frontend && E2E_DB=clean E2E_BASE_URL=$(E2E_FRONTEND_URL) NEXT_PUBLIC_API_URL=$(E2E_API_URL) npx playwright test

.PHONY: test-e2e-seeded
test-e2e-seeded: e2e-fresh-seed ## Run E2E tests against a seeded E2E database
	cd frontend && E2E_DB=seeded E2E_BASE_URL=$(E2E_FRONTEND_URL) NEXT_PUBLIC_API_URL=$(E2E_API_URL) npx playwright test

.PHONY: test-e2e-teardown
test-e2e-teardown: ## Stop and remove E2E services and volumes
	$(E2E_COMPOSE) down -v

# ─── All Tests ──────────────────────────────

.PHONY: test-all
test-all: test test-e2e ## Run unit tests + E2E tests
