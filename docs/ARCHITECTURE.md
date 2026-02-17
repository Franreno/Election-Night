# Architecture Overview

## C4 Context Diagram

The system sits between a data supplier (who uploads result files) and election analysts (who view the dashboard).

<!-- ```mermaid
C4Context
    title Election Night — System Context

    Person(analyst, "Election Analyst", "Views live results, browses constituencies, monitors seat distribution")
    Person(supplier, "Data Supplier", "Uploads result files throughout election night via UI or API")

    System(system, "Election Night System", "Ingests result files, maintains accurate election state, serves APIs and interactive dashboard")

    Rel(supplier, system, "Uploads .txt result files", "HTTP POST multipart")
    Rel(analyst, system, "Views dashboard, drills into constituencies", "HTTPS / browser")
    Rel(system, analyst, "Serves live results, maps, charts, tables")
``` -->

![System Context Diagram](./assets/system_context.svg)

## C4 Container Diagram

Three containerised services communicate over Docker networking.

<!-- ```mermaid
C4Container
    Person(user, "User", "Election analyst or data supplier")

    System_Boundary(system, "Election Night System") {
        Container(frontend, "Frontend", "Next.js 16, React 19 SWR, D3, Tailwind v4", "Interactive dashboard (map, charts, tables) + upload UI")
        Container(backend, "Backend API", "FastAPI, Python 3.12 SQLAlchemy", "Parses result files stores data serves REST APIs")
        ContainerDb(db, "Database", "PostgreSQL 16", "Constituencies, resultsregions, upload logs")
        Container(static, "Static Assets", "TopoJSON, JSON", "UK boundaries region config")
    }

    Rel_R(user, frontend, "Uses", "HTTP :3000")
    Rel_R(user, backend, "Uploads result files", "HTTP :8000")
    Rel_D(frontend, backend, "REST API calls", "HTTP :8000")
    Rel_D(backend, db, "Reads / writes", "SQL :5432")
    Rel_L(backend, static, "Serves", "/static")
    Rel_L(frontend, static, "Fetches TopoJSON", "HTTP")

    UpdateRelStyle(user, frontend, $offsetY="-35")
    UpdateRelStyle(user, backend,  $offsetY="-25")

    UpdateRelStyle(frontend, backend, $offsetX="-45", $offsetY="15")
    UpdateRelStyle(backend, db,       $offsetX="-38", $offsetY="15")

    UpdateRelStyle(backend, static,   $offsetY="20")
    UpdateRelStyle(frontend, static,  $offsetY="25")
``` -->

![System Container Diagram](./assets/container_diagram.svg)

## Component Diagram — Backend

![Component Diagram — Backend](./assets/backend_components.svg)

## Component Diagram — Frontend

![Component Diagram — Frontend](./assets/frontend_components.svg)

## Data Flow Overview

### Read Path (Dashboard, Constituencies)

```
Browser → Next.js page → SWR hook (polling every 30s)
       → apiFetch() → GET /api/... → FastAPI router
       → Service layer → SQLAlchemy query → PostgreSQL
       → JSON response → SWR cache → React re-render
```

### Write Path (Upload with SSE Streaming)

```
Browser → FileDropzone → useUploadFile hook
       → POST /api/upload/stream (FormData) → FastAPI router
       → StreamingResponse (text/event-stream)
       → ingest_file_streaming() generator yields:
           1. "created" event  → SWR revalidation → upload appears in table
           2. "progress" events → Progress bar updates in real-time
           3. "complete" event  → SWR revalidation → all data refreshes
       → Frontend reads via fetch + ReadableStream
       → Minimum 800ms animation ensures visible feedback even for fast uploads
```

The `POST /api/upload` endpoint is preserved for backward compatibility (e.g., API-only consumers or the `make seed` command). The frontend exclusively uses the streaming endpoint.

### Map Rendering

```
Browser → ConstituencyMap component
       → Fetch TopoJSON from /static/uk-constituencies.topojson
       → Convert to GeoJSON (topojson-client)
       → Fetch constituency summary (SWR)
       → Match features to DB records by name/pcon24_code
       → D3 geoMercator projection → SVG paths
       → Color by winning party → Render with zoom/pan/tooltips
```

## Key Design Patterns

### Service Layer

All business logic lives in `backend/app/services/`. Routers are thin — they handle HTTP concerns (validation, status codes) and delegate to services. This makes business logic independently testable.

### Upsert-Based Ingestion

The `(constituency_id, party_code)` unique constraint on `results` enables PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` for atomic, idempotent updates. This is the foundation of the update semantics: new data overwrites existing data for the same constituency + party pair, while leaving other parties untouched.

### Fuzzy Constituency Matching

The `ConstituencyMatcher` in `ingestion.py` uses a 3-tier strategy to match uploaded constituency names to the canonical 650-constituency dataset:

1. **Exact match** — Case-sensitive string comparison
2. **Case-insensitive match** — Lowercased comparison
3. **Normalized match** — NFD Unicode normalisation, diacritic removal, comma stripping, and lowercasing (e.g., `"Ynys Mon"` → matches `"Ynys Môn"`, `"BIRMINGHAM HALL GREEN"` → matches `"Birmingham, Hall Green"`)

### SSE Streaming for Upload Progress

The upload endpoint uses Server-Sent Events (SSE) via FastAPI's `StreamingResponse` to provide real-time progress feedback. The `ingest_file_streaming()` generator in `ingestion.py` yields events as it processes lines, and the router formats them as SSE (`event: type\ndata: json\n\n`).

The frontend consumes the stream using `fetch` + `ReadableStream` (not `EventSource`, which only supports GET). Key events:
- **created**: Upload appears in the history table immediately with "processing" status
- **progress**: Progress bar updates with percentage (emitted every 10 lines)
- **complete/error**: Final result triggers SWR cache invalidation

A minimum 800ms animation delay in the hook ensures the progress bar is always visible, even for small files that process instantly.

### SWR Polling for Near-Real-Time Updates

Rather than WebSockets, the frontend uses SWR's `refreshInterval` to poll the backend:
- **30 seconds** for election data (totals, constituencies, map)
- **10 seconds** for upload history

This provides near-real-time updates with minimal complexity. SWR also handles caching, deduplication, and revalidation on window focus.

### URL-Persisted Filters

Region filter selections on the constituencies page are stored in URL query parameters (`?regions=1,2,3`). This means:
- Filtered views are shareable via URL
- Browser back/forward navigation preserves filters
- Page refreshes don't lose filter state

### Soft Delete with Result Rollback

Upload logs are never physically deleted. Setting `deleted_at` provides an audit trail while hiding deleted records from the UI and API responses.

When an upload is soft-deleted, the system also rolls back any results that were last modified by that upload. A `result_history` table records every vote snapshot per upload, enabling the system to restore results to their previous values. If no prior upload exists for a result, it is removed entirely. This ensures that deleting an upload cleanly reverts the election state rather than leaving orphaned or zeroed-out results.

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | FastAPI | Async-capable, automatic OpenAPI docs, Pydantic validation |
| ORM | SQLAlchemy 2.0 | Mature, flexible, supports upsert patterns |
| Database | PostgreSQL 16 | Robust, supports `ON CONFLICT`, JSON columns, mature |
| Frontend framework | Next.js 16 (App Router) | React 19 features, file-based routing, standalone Docker output |
| Data fetching | SWR | Lightweight, built-in polling, cache invalidation, stale-while-revalidate |
| Map rendering | D3 + TopoJSON | Full control over SVG rendering, smooth zoom/pan, small bundle |
| Charts | Recharts | Declarative React charts, good for standard bar/pie/donut |
| Parliament viz | d3-parliament-chart | Purpose-built hemicycle layout |
| Styling | Tailwind CSS v4 | Utility-first, OKLCH theme tokens, dark mode |
| UI primitives | Shadcn/UI (Radix) | Accessible, unstyled headless components |
| Migrations | Alembic | SQLAlchemy-native, versioned, supports data seeding |
| Testing | pytest + Vitest + Playwright | Unit + E2E coverage across both stacks |
| Containerisation | Docker Compose | Single-command dev environment, isolated E2E stack |
