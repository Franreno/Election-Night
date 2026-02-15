# Setup Guide

Step-by-step instructions for getting the Election Night system running locally.

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Docker | 20+ | `docker --version` |
| Docker Compose | 2.0+ (V2 plugin) | `docker compose version` |
| Make | Any | `make --version` |
| Git | Any | `git --version` |

> Docker Desktop for macOS/Windows includes Docker Compose V2 by default.

## 1. Clone the Repository

```bash
git clone <repository-url>
cd tech_blueoasis
```

## 2. Start All Services

```bash
make up
```

This single command:
1. Pulls the `postgres:16-alpine` image (first run only)
2. Builds the backend image (`python:3.12-slim` + dependencies)
3. Builds the frontend image (multi-stage Node 20 Alpine build)
4. Creates the `pgdata` Docker volume for database persistence
5. Starts PostgreSQL, waits for it to be healthy
6. Runs Alembic migrations automatically (creates tables, seeds 650 constituencies + 12 regions)
7. Starts the FastAPI backend with hot-reload
8. Starts the Next.js frontend

## 3. Verify Services

```bash
make ps
```

You should see three running containers:

```
NAME        SERVICE     STATUS
...-db-1    db          Up (healthy)
...-backend-1  backend  Up
...-frontend-1 frontend Up
```

Check backend health:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

Check frontend:

```bash
open http://localhost:3000
```

## 4. Seed the Database

The database starts with 650 constituencies and 12 regions pre-loaded (from the migration), but no election results. Load sample data:

```bash
make seed
```

This uploads `election-results-sample.txt` (650 constituency results) via the API. After seeding, the dashboard will show live data.

To reset the database and re-seed from scratch:

```bash
make fresh-seed
```

## 5. Access the Application

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| Constituencies | http://localhost:3000/constituencies |
| Upload Page | http://localhost:3000/upload |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| PostgreSQL | `localhost:5432` (user: `postgres`, pass: `postgres`, db: `election`) |

## Makefile Command Reference

### Docker (Development)

| Command | Description |
|---------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make rebuild` | Rebuild images and start |
| `make restart` | Restart all services |
| `make logs` | Tail all service logs |
| `make logs-backend` | Tail backend logs only |
| `make logs-frontend` | Tail frontend logs only |
| `make ps` | Show running services |

### Database

| Command | Description |
|---------|-------------|
| `make db-reset` | Destroy and recreate the database |
| `make db-shell` | Open a `psql` shell |
| `make db-migrate` | Run Alembic migrations |

### Seed Data

| Command | Description |
|---------|-------------|
| `make seed` | Upload sample data |
| `make fresh-seed` | Reset database + upload sample data |

### Unit Tests

| Command | Description |
|---------|-------------|
| `make test` | Run all unit tests (backend + frontend) |
| `make test-backend` | Run backend pytest suite |
| `make test-frontend` | Run frontend vitest suite |

### E2E Tests

| Command | Description |
|---------|-------------|
| `make test-e2e` | Full E2E suite (clean + seeded DB, merged report) |
| `make test-e2e-headed` | E2E with visible browser |
| `make test-e2e-ui` | Open Playwright interactive UI |
| `make test-e2e-clean` | E2E against clean database only |
| `make test-e2e-seeded` | E2E against seeded database only |
| `make test-e2e-teardown` | Stop and remove E2E services |

### All Tests

| Command | Description |
|---------|-------------|
| `make test-all` | Run unit tests + E2E tests |

## Troubleshooting

### Port conflicts

If ports 3000, 8000, or 5432 are already in use:

```bash
# Find what's using the port
lsof -i :3000

# Stop Docker services and restart
make down && make up
```

### Database migration errors

If the backend fails to start with migration errors:

```bash
# Reset the database completely
make db-reset

# Restart services
make up
```

### Frontend build failures

If the frontend image fails to build:

```bash
# Rebuild without cache
docker compose build --no-cache frontend
make up
```

### Stale containers

If containers are in a bad state:

```bash
make down
docker compose rm -f
make up
```

### Checking logs

```bash
# All services
make logs

# Specific service
make logs-backend
make logs-frontend

# Database logs
docker compose logs db
```
