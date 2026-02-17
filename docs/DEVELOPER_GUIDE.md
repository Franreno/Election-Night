# Developer Guide

Guides for working with the backend and frontend codebases.

---

## Backend

### Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, lifespan, router registration
│   ├── config.py             # Pydantic Settings (env vars)
│   ├── constants.py          # Party code → name mappings
│   ├── database.py           # SQLAlchemy engine, session, get_db()
│   ├── models/               # ORM models (Constituency, Result, Region, UploadLog)
│   ├── routers/              # API endpoints (thin handlers)
│   ├── schemas/              # Pydantic request/response models
│   └── services/             # Business logic
├── alembic/                  # Database migrations
│   ├── env.py
│   └── versions/
├── static/                   # Served at /static (TopoJSON, region config)
├── tests/                    # pytest suite
├── requirements.txt
├── pyproject.toml            # Ruff linting config
└── pytest.ini
```

### Adding a New Endpoint

The backend follows a **router → service → model** pattern. Here's how to add a new endpoint:

**1. Define the schema** (`app/schemas/`)

```python
# app/schemas/example.py
from pydantic import BaseModel

class ExampleResponse(BaseModel):
    id: int
    name: str
```

**2. Write the service** (`app/services/`)

```python
# app/services/example_service.py
from sqlalchemy.orm import Session
from app.models.example import Example

def get_example(db: Session, example_id: int) -> dict | None:
    record = db.query(Example).filter(Example.id == example_id).first()
    if not record:
        return None
    return {"id": record.id, "name": record.name}
```

**3. Create the router** (`app/routers/`)

```python
# app/routers/example.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.example import ExampleResponse
from app.services.example_service import get_example

router = APIRouter(prefix="/api/example", tags=["example"])

@router.get("/{example_id}", response_model=ExampleResponse)
def read_example(example_id: int, db: Session = Depends(get_db)):
    result = get_example(db, example_id)
    if not result:
        raise HTTPException(status_code=404, detail="Not found")
    return result
```

**4. Register the router** (`app/main.py`)

```python
from app.routers.example import router as example_router
app.include_router(example_router)
```

### Database Migrations with Alembic

Migrations live in `backend/alembic/versions/`. They run automatically on container startup.

```bash
# Create a new migration (inside the backend container)
make db-shell  # or: docker compose exec backend bash
alembic revision -m "description_of_change"

# Run pending migrations
make db-migrate
# or: docker compose exec backend alembic upgrade head

# Check current migration status
docker compose exec backend alembic current
```

Migration files follow the naming convention `NNN_description.py`. The current migrations:

| Migration | Purpose |
|-----------|---------|
| 001 | Initial schema (constituencies, results, upload_logs) |
| 002 | Regions table, geography columns, seed 650 constituencies |
| 003 | Upload tracking (soft delete, upload_id on results) |

### Parser & Ingestion Pipeline

The upload pipeline has two main components:

**Parser** (`app/services/parser.py`):
- `parse_file(content)` → splits content into lines, calls `parse_line()` on each
- `parse_line(raw_line, line_number)` → handles escaped commas, validates party codes and vote counts
- Returns `(results: list[ParsedConstituencyResult], errors: list[ParseError])`

**Ingestion** (`app/services/ingestion.py`):
- `ingest_file(db, content, filename)` → orchestrates the full pipeline synchronously (used by `make seed` and backward-compatible API)
- `ingest_file_streaming(db, content, filename, batch_size)` → generator that yields SSE progress events (`created`, `progress`, `complete`, `error`) as it processes lines. Used by `POST /api/upload/stream`
- Both create an `UploadLog` record, invoke the parser, match constituencies, upsert results, and finalise the upload log
- Wraps everything in a transaction — rolls back on error

### Fuzzy Constituency Matching

`ConstituencyMatcher` builds three lookup dictionaries on initialisation:

```python
# Tier 1: exact name → constituency
{"Basildon and Billericay": <Constituency>}

# Tier 2: lowercased name → constituency
{"basildon and billericay": <Constituency>}

# Tier 3: normalised name → constituency
# (NFD unicode, strip diacritics, remove commas, lowercase)
{"ynys mon": <Constituency>}  # matches "Ynys Môn"
{"birmingham hall green": <Constituency>}  # matches "Birmingham, Hall Green"
```

Matching cascades through tiers until a match is found.

### Backend Testing

Tests use **in-memory SQLite** with `StaticPool` for speed. Configuration is in `tests/conftest.py`.

```bash
# Run all backend tests
make test-backend

# Run a specific test file
docker compose exec backend python -m pytest tests/test_parser.py -v

# Run with coverage
docker compose exec backend python -m pytest --cov=app
```

**Key fixtures** (from `conftest.py`):
- `db_engine` — Creates in-memory SQLite engine
- `db_session` — Provides a transactional session (rolls back after each test)
- `client` — FastAPI `TestClient` with dependency override
- `seed_constituencies(db_session, names)` — Helper to create test constituencies

**Test organisation**:

| File | Tests |
|------|-------|
| `test_parser.py` | Line parsing, escaped commas, validation |
| `test_ingestion_service.py` | Full ingestion pipeline, fuzzy matching |
| `test_ingestion_streaming.py` | Streaming generator events, progress batching |
| `test_upload.py` | Upload endpoint (HTTP level) |
| `test_upload_stream.py` | SSE streaming endpoint |
| `test_upload_service.py` | Upload stats, soft delete |
| `test_upload_service_streaming.py` | Streaming delete generator events, progress batching |
| `test_delete_stream.py` | SSE streaming delete endpoint |
| `test_constituency_service.py` | Constituency queries, sorting, filtering |
| `test_constituencies.py` | Constituency endpoints |
| `test_totals_service.py` | Vote aggregation, seat allocation, ties |
| `test_totals.py` | Totals endpoint |
| `test_geography_service.py` | Region queries |
| `test_geography.py` | Geography endpoints |
| `test_integration.py` | End-to-end flows (upload → query → verify) |

---

## Frontend

### Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (fonts, AppShell, metadata)
│   ├── page.tsx                  # Dashboard (/)
│   ├── globals.css               # Tailwind v4 theme + dark mode
│   ├── constituencies/
│   │   ├── page.tsx              # List (/constituencies)
│   │   ├── page-content.tsx      # List logic (search, filter, sort)
│   │   └── [id]/page.tsx         # Detail (/constituencies/[id])
│   └── upload/page.tsx           # Upload (/upload)
├── components/
│   ├── dashboard/                # Hemicycle, charts, stat cards
│   ├── map/                      # D3 choropleth map
│   ├── constituencies/           # Table, search, region filter, pagination
│   ├── constituency-detail/      # Winner banner, charts, mini map
│   ├── upload/                   # Dropzone, history, stats, filters
│   ├── layout/                   # AppShell, Sidebar
│   ├── shared/                   # PartyBadge, EmptyState, LoadingSkeleton
│   └── ui/                       # Shadcn/UI primitives (button, card, table, etc.)
├── hooks/                        # SWR data-fetching hooks
├── lib/                          # API client, types, utilities, constants
├── tests/                        # Vitest unit tests
├── e2e/                          # Playwright E2E tests
├── next.config.ts                # Standalone output
├── vitest.config.mts             # Test config (jsdom)
└── playwright.config.ts          # E2E config
```

### Adding a New Page

Next.js 16 uses the App Router with file-based routing.

**1. Create the page file**

```
app/my-feature/page.tsx
```

```tsx
"use client";

export default function MyFeaturePage() {
  return <h1>My Feature</h1>;
}
```

**2. Add navigation** (optional)

In `components/layout/sidebar.tsx`, add to the nav items array:

```tsx
{ href: "/my-feature", label: "My Feature", icon: SomeIcon }
```

### Creating SWR Hooks

All data fetching follows a consistent pattern using SWR.

```tsx
// hooks/use-my-data.ts
import useSWR from "swr";
import { fetchMyData } from "@/lib/api";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export function useMyData(id: number) {
  const { data, error, isLoading } = useSWR(
    `my-data/${id}`,
    () => fetchMyData(id),
    { refreshInterval: POLLING_INTERVAL_MS }
  );

  return { data, error, isLoading };
}
```

**API function** (`lib/api.ts`):

```tsx
export async function fetchMyData(id: number): Promise<MyDataResponse> {
  return apiFetch(`/api/my-data/${id}`);
}
```

**Key conventions**:
- SWR keys are descriptive strings (e.g., `"totals"`, `"constituencies/42"`)
- Use `refreshInterval` for polling (30s for election data, 10s for uploads)
- Use `useSWRImmutable` for static data (regions) that won't change
- After mutations, invalidate relevant caches with `mutate()`

### Component Patterns

**Shadcn/UI**: UI primitives live in `components/ui/`. These are from the Shadcn/UI library (built on Radix). Import and compose them:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

**Tailwind v4**: Styles use utility classes. The `cn()` helper from `lib/utils.ts` merges classes conditionally:

```tsx
import { cn } from "@/lib/utils";

<div className={cn("p-4 rounded-lg", isActive && "bg-primary")} />
```

**Party styling**: Use `PARTY_COLORS` and `PARTY_NAMES` from `lib/constants.ts` for consistent party representation:

```tsx
import { PARTY_COLORS, PARTY_NAMES } from "@/lib/constants";

const color = PARTY_COLORS["L"]; // "#DC241F"
const name = PARTY_NAMES["L"];   // "Labour Party"
```

### D3 Map Integration

The choropleth map (`components/map/constituency-map.tsx`) renders UK constituency boundaries using D3 + TopoJSON.

**Key files**:
- `components/map/constituency-map.tsx` — Main SVG map component
- `components/map/map-controls.tsx` — Zoom buttons
- `components/map/map-legend.tsx` — Party colour legend
- `components/map/map-tooltip.tsx` — Hover tooltip
- `hooks/use-map-viewport.ts` — Zoom/pan state management
- `lib/map-utils.ts` — Name normalisation and feature matching

**How it works**:
1. TopoJSON fetched from `/static/uk-constituencies.topojson`
2. Converted to GeoJSON via `topojson-client`
3. Matched to DB records by `pcon24_code` or normalised name
4. D3 `geoMercator` projection fits features to SVG dimensions
5. Each constituency is an SVG `<path>` coloured by winning party
6. `useMapViewport` hook manages zoom (1–8x) and pan with smooth animations

### Frontend Testing

#### Unit Tests (Vitest)

```bash
# Run all frontend tests
make test-frontend

# Watch mode (during development)
cd frontend && npm run test:watch
```

Config: `vitest.config.mts` — uses jsdom environment, setup file at `tests/setup.ts`.

**Test structure**:

| Directory | Tests |
|-----------|-------|
| `tests/hooks/` | SWR hook tests (data fetching, error handling) |
| `tests/components/` | Component rendering and interaction tests |
| `tests/lib/` | Utility function tests |

**Key patterns**:
- Mock API calls with `vi.mock("@/lib/api")`
- Use `vi.clearAllMocks()` in `beforeEach` (not `restoreAllMocks`)
- Assert RGB values for colours (jsdom normalises hex to `rgb()`)
- Avoid testing SWR error/retry behaviour (complex caching interactions)

#### E2E Tests (Playwright)

```bash
# Full suite (clean + seeded database)
make test-e2e

# Interactive UI mode
make test-e2e-ui

# Headed (visible browser)
make test-e2e-headed
```

Config: `playwright.config.ts` — Chromium only, single worker, 30s timeout.

**E2E test files**:

| File | Scope |
|------|-------|
| `health.spec.ts` | Service health checks |
| `navigation.spec.ts` | Sidebar navigation |
| `dashboard.spec.ts` | Dashboard rendering (empty + seeded) |
| `constituencies.spec.ts` | Table, search, filter, sort, pagination |
| `upload.spec.ts` | File upload, history, delete |

**Database modes**: Tests use `E2E_DB` env var to run conditionally:
- `clean` — Tests against empty database (verifies empty states)
- `seeded` — Tests against pre-loaded data (verifies data display)
- Tests use `test.skip(DB_MODE !== "clean")` for conditional execution
