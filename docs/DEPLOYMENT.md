# Deployment & Docker Configuration

This document describes the Docker setup, service architecture, environment variables, and deployment concerns for the Election Night system.

## Service Architecture

![Service Architecture Diagram](./assets/service-architecture.svg)

## docker-compose.yml (Development)

The development stack defines three services with hot-reload and bind mounts for fast iteration.

### Services

#### `db` — PostgreSQL 16

```yaml
image: postgres:16-alpine
ports: 5432:5432
environment:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_DB: election
volumes:
  - pgdata:/var/lib/postgresql/data
healthcheck:
  test: pg_isready -U postgres
  interval: 5s
  retries: 5
```

- Uses the lightweight Alpine variant
- Health check ensures the backend only starts after PostgreSQL is ready
- Data persists across restarts via the `pgdata` named volume

#### `backend` — FastAPI

```yaml
build: ./backend
ports: 8000:8000
environment:
  DATABASE_URL: postgresql://postgres:postgres@db:5432/election
  CORS_ORIGINS: '["http://localhost:3000"]'
depends_on:
  db:
    condition: service_healthy
volumes:
  - ./backend/app:/app/app
  - ./backend/static:/app/static
  - ./backend/alembic:/app/alembic
command: >
  sh -c "alembic upgrade head &&
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
```

- Waits for the database to be healthy before starting
- Runs Alembic migrations automatically on startup
- Bind-mounts `app/`, `static/`, `alembic/` for hot-reload during development
- Uvicorn runs with `--reload` for auto-restart on code changes

#### `frontend` — Next.js 16

```yaml
build:
  context: ./frontend
  args:
    NEXT_PUBLIC_API_URL: http://localhost:8000
ports: 3000:3000
depends_on:
  - backend
```

- `NEXT_PUBLIC_API_URL` is a **build-time** argument baked into the Next.js bundle
- Depends on backend (but does not wait for health — the UI handles API unavailability gracefully via SWR)

### Volumes

| Volume | Purpose |
|--------|---------|
| `pgdata` | PostgreSQL data directory — survives `docker compose down` |

To destroy data and start fresh:

```bash
make db-reset
# or manually:
docker compose down -v   # removes volumes
docker compose up -d
```

## Dockerfiles

### Backend (`backend/Dockerfile`)

Single-stage build:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- `python:3.12-slim` base for small image size
- `--no-cache-dir` avoids caching pip packages in the image
- The default CMD is overridden by docker-compose.yml in development (adds `--reload` and migration step)

### Frontend (`frontend/Dockerfile`)

Multi-stage build for minimal production image:

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `deps` | `node:20-alpine` | Install dependencies (`npm ci`) |
| `builder` | `node:20-alpine` | Build Next.js app (`next build`, standalone output) |
| `runner` | `node:20-alpine` | Production runtime (non-root user, minimal files) |

Key details:
- **Standalone output** (`output: "standalone"` in `next.config.ts`) creates a self-contained build with only the necessary files
- **Non-root user**: `nextjs:nodejs` (UID/GID 1001) for security
- **Build arg**: `NEXT_PUBLIC_API_URL` controls the API base URL at build time
- Final image contains only `public/`, `.next/standalone/`, `.next/static/`

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/election` | PostgreSQL connection string |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins (JSON array) |
| `MAX_UPLOAD_SIZE_BYTES` | `104857600` (100 MB) | Maximum upload file size |

Configured via Pydantic Settings in `backend/app/config.py`. Values can be set through environment variables or a `.env` file (not committed).

### Frontend

| Variable | Default | Build/Runtime | Description |
|----------|---------|--------------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Build-time | Backend API base URL |
| `NODE_ENV` | `production` | Runtime | Node environment |
| `PORT` | `3000` | Runtime | Server port |
| `HOSTNAME` | `0.0.0.0` | Runtime | Server bind address |

`NEXT_PUBLIC_API_URL` is set as a Docker build argument and baked into the JavaScript bundle. Changing it requires rebuilding the frontend image.

## E2E Test Stack

An isolated stack (`docker-compose.e2e.yml`) runs on different ports to avoid conflicts with development:

| Service | Dev Port | E2E Port |
|---------|----------|----------|
| PostgreSQL | 5432 | 5433 |
| Backend | 8000 | 8001 |
| Frontend | 3000 | 3001 |

Key differences from dev:
- Separate database: `election_e2e`
- Separate volume: `pgdata_e2e`
- CORS allows `http://localhost:3001`
- Frontend points to `http://localhost:8001`

```bash
# Start E2E stack
make e2e-up

# Run tests
make test-e2e

# Tear down
make test-e2e-teardown
```

## Health Checks

| Service | Endpoint / Command | Interval |
|---------|-------------------|----------|
| PostgreSQL | `pg_isready -U postgres` | 5 seconds |
| Backend | `GET /api/health` → `{"status": "ok"}` | On demand |
| Frontend | HTTP 200 on `/` | On demand |

The `make wait-ready` target polls both backend and frontend health before proceeding (used by E2E and seed targets).

## Data Persistence

- **PostgreSQL data** is stored in the `pgdata` Docker volume
- Running `make down` preserves the volume (data survives restarts)
- Running `make db-reset` or `docker compose down -v` destroys the volume
- Static files (TopoJSON, region config) are served from `backend/static/` and are part of the image

## Network

Docker Compose creates a default bridge network. Services communicate by service name:

- Backend connects to DB at `db:5432`
- Frontend calls backend at the `NEXT_PUBLIC_API_URL` build arg value (from the browser, this is `localhost:8000`)

There is no custom network configuration — the default is sufficient for this single-host deployment.
