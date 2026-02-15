# Database Schema

PostgreSQL 16, managed via SQLAlchemy ORM with Alembic migrations.

## Entity-Relationship Diagram

<!-- ```mermaid
erDiagram
    regions {
        int id PK
        varchar(100) name UK "NOT NULL"
        int sort_order "NOT NULL"
        timestamptz created_at "DEFAULT now()"
    }

    constituencies {
        int id PK
        varchar(255) name UK "NOT NULL"
        varchar(20) pcon24_code UK "Nullable — ONS 2024 code"
        int region_id FK "Nullable"
        timestamptz created_at "DEFAULT now()"
        timestamptz updated_at "DEFAULT now()"
    }

    results {
        int id PK
        int constituency_id FK "NOT NULL"
        varchar(10) party_code "NOT NULL"
        int votes "NOT NULL, >= 0"
        int upload_id FK "Nullable"
        timestamptz created_at "DEFAULT now()"
        timestamptz updated_at "DEFAULT now()"
    }

    upload_logs {
        int id PK
        varchar(512) filename "Nullable"
        varchar(20) status "NOT NULL, DEFAULT processing"
        int total_lines "Nullable"
        int processed_lines "DEFAULT 0"
        int error_lines "DEFAULT 0"
        json errors "DEFAULT []"
        timestamptz started_at "DEFAULT now()"
        timestamptz completed_at "Nullable"
        timestamptz deleted_at "Nullable — soft delete"
    }

    regions ||--o{ constituencies : "has"
    constituencies ||--o{ results : "has"
    upload_logs ||--o{ results : "created"
``` -->

![ER Diagram](./assets/er_diagram.svg)

## Tables

### `regions`

Stores the 12 ITL1 (International Territorial Level 1) statistical regions of the UK.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | INTEGER | PK, auto-increment | Region ID |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Region name (e.g., "East of England") |
| `sort_order` | INTEGER | NOT NULL | Display ordering (1–12) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Record creation time |

**Seeded with**: North East, North West, Yorkshire and The Humber, East Midlands, West Midlands, East of England, London, South East, South West, Wales, Scotland, Northern Ireland.

---

### `constituencies`

Stores the 650 UK parliamentary constituencies. Pre-seeded from ONS data.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | INTEGER | PK, auto-increment | Constituency ID |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL, indexed | Canonical constituency name |
| `pcon24_code` | VARCHAR(20) | UNIQUE, nullable, indexed | ONS 2024 parliamentary constituency code (e.g., `E14001339`) |
| `region_id` | INTEGER | FK → regions.id, nullable, indexed | Region assignment |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT now(), on update | Last modification time |

**Relationship**: belongs to one `region`, has many `results`.

---

### `results`

Stores vote counts per party per constituency. The core data table.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | INTEGER | PK, auto-increment | Result ID |
| `constituency_id` | INTEGER | FK → constituencies.id (CASCADE), NOT NULL, indexed | Parent constituency |
| `party_code` | VARCHAR(10) | NOT NULL, indexed | Party identifier (C, L, LD, UKIP, G, SNP, Ind) |
| `votes` | INTEGER | NOT NULL, CHECK >= 0 | Vote count |
| `upload_id` | INTEGER | FK → upload_logs.id (SET NULL), nullable, indexed | Upload that created/last updated this result |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT now(), on update | Last modification time |

**Constraints**:
- `uq_constituency_party` — UNIQUE(constituency_id, party_code): enforces one result per party per constituency
- `ck_votes_non_negative` — CHECK(votes >= 0): prevents negative vote counts

**Relationship**: belongs to one `constituency`, optionally linked to one `upload_log`.

**Upsert behaviour**: New uploads use `INSERT ... ON CONFLICT (constituency_id, party_code) DO UPDATE SET votes = excluded.votes` to idempotently update results.

---

### `upload_logs`

Tracks every file upload with processing statistics and soft-delete support.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | INTEGER | PK, auto-increment | Upload ID |
| `filename` | VARCHAR(512) | nullable | Original filename |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT "processing" | Status: `processing`, `completed`, `failed` |
| `total_lines` | INTEGER | nullable | Total lines in the file |
| `processed_lines` | INTEGER | DEFAULT 0 | Successfully processed lines |
| `error_lines` | INTEGER | DEFAULT 0 | Lines with parse errors |
| `errors` | JSON | DEFAULT [] | Array of error details `[{line, error}]` |
| `started_at` | TIMESTAMPTZ | DEFAULT now() | Upload start time |
| `completed_at` | TIMESTAMPTZ | nullable | Processing completion time |
| `deleted_at` | TIMESTAMPTZ | nullable, indexed | Soft-delete timestamp |

**Soft delete**: Records are never physically deleted. The `deleted_at` field is set, and queries filter on `deleted_at IS NULL`.

---

## Indexes

| Table | Index | Columns | Type |
|-------|-------|---------|------|
| constituencies | PK | id | Primary |
| constituencies | uq | name | Unique |
| constituencies | uq | pcon24_code | Unique |
| constituencies | idx | region_id | Foreign key |
| results | PK | id | Primary |
| results | uq_constituency_party | (constituency_id, party_code) | Unique composite |
| results | idx | constituency_id | Foreign key |
| results | idx | party_code | Lookup |
| results | idx | upload_id | Foreign key |
| upload_logs | PK | id | Primary |
| upload_logs | idx | deleted_at | Soft-delete filter |

## Migration History

Migrations are in `backend/alembic/versions/` and run automatically on container startup.

### Migration 001 — Initial Schema

Creates the three core tables:
- `constituencies` (id, name, created_at, updated_at)
- `results` (id, constituency_id, party_code, votes, created_at, updated_at) with unique constraint and check constraint
- `upload_logs` (id, filename, status, total_lines, processed_lines, error_lines, errors, started_at, completed_at)

### Migration 002 — Regions and Geography

- Creates the `regions` table
- Adds `pcon24_code` and `region_id` columns to `constituencies`
- Seeds all 12 regions with sort orders
- Seeds all 650 constituencies with their names, ONS codes, and region assignments from `static/itl1_constituencies_config.json`

### Migration 003 — Upload Tracking

- Adds `deleted_at` to `upload_logs` for soft-delete support
- Adds `upload_id` foreign key to `results` for tracking which upload created/updated each result

## Seed Data

The migration pipeline (002) pre-seeds the database with:

- **12 regions**: Derived from ITL1 statistical regions
- **650 constituencies**: Full set of UK parliamentary constituencies with ONS 2024 codes (`pcon24_code`) and region assignments

This canonical dataset ensures uploaded result files are matched against known constituencies rather than creating ad-hoc entries. The matching uses a 3-tier fuzzy strategy (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## Update Semantics

When a result file is uploaded:

1. Each line is parsed into `(constituency_name, [(votes, party_code), ...])`
2. The constituency name is matched against the pre-seeded `constituencies` table
3. For each party result, an upsert is performed on `results`:
   - **Key**: `(constituency_id, party_code)` unique constraint
   - **Insert**: if no result exists for this constituency + party
   - **Update**: if a result already exists, `votes` is overwritten with the new value
4. Party results from previous uploads that are **not** in the current file remain unchanged

This ensures the database always represents the latest known state while preserving results from earlier uploads that haven't been superseded.
