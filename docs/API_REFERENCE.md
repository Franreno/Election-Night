# API Reference

Base URL: `http://localhost:8000`

Interactive Swagger documentation is also available at [http://localhost:8000/docs](http://localhost:8000/docs) (auto-generated from FastAPI).

---

## Health

### `GET /api/health`

Returns the service health status.

**Response** `200 OK`

```json
{
  "status": "ok"
}
```

---

## Upload

### `POST /api/upload`

Upload a result file for processing.

**Content-Type**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | A `.txt` result file (max 100 MB) |

**Response** `201 Created`

```json
{
  "upload_id": 1,
  "status": "completed",
  "total_lines": 650,
  "processed_lines": 650,
  "error_lines": 0,
  "errors": []
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `400` | No filename, non-UTF-8 encoding, or empty file |
| `413` | File exceeds 100 MB |
| `500` | Database error during processing |

When errors occur during parsing, the upload still completes but `error_lines > 0` and the `errors` array contains details:

```json
{
  "upload_id": 2,
  "status": "completed",
  "total_lines": 10,
  "processed_lines": 8,
  "error_lines": 2,
  "errors": [
    {"line": 3, "error": "Invalid party code: XX"},
    {"line": 7, "error": "Vote count must be a non-negative integer"}
  ]
}
```

---

### `GET /api/uploads`

List upload history with pagination and optional filters.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (min 1) |
| `page_size` | int | 20 | Items per page (1–100) |
| `status` | string | — | Filter by status (`completed`, `failed`, `processing`) |
| `search` | string | — | Search by filename |

**Response** `200 OK`

```json
{
  "total": 42,
  "page": 1,
  "page_size": 20,
  "uploads": [
    {
      "id": 42,
      "filename": "results-update-3.txt",
      "status": "completed",
      "total_lines": 100,
      "processed_lines": 98,
      "error_lines": 2,
      "errors": [],
      "started_at": "2024-07-04T22:15:00Z",
      "completed_at": "2024-07-04T22:15:01Z",
      "deleted_at": null
    }
  ]
}
```

Ordered by `id` descending (newest first). Excludes soft-deleted uploads.

---

### `GET /api/uploads/stats`

Aggregate upload statistics.

**Response** `200 OK`

```json
{
  "total_uploads": 42,
  "completed": 40,
  "failed": 2,
  "success_rate": 95.24,
  "total_lines_processed": 12800
}
```

Excludes soft-deleted uploads.

---

### `DELETE /api/uploads/{upload_id}`

Soft-delete an upload (sets `deleted_at` timestamp) and roll back any results it last modified.

When an upload is deleted, any results it last modified are rolled back to their previous values from the next most recent upload. If no prior upload exists for a result, the result is removed entirely.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `upload_id` | int | Upload ID to delete |

**Response** `200 OK`

```json
{
  "message": "Upload deleted"
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | Upload not found |

---

## Constituencies

### `GET /api/constituencies`

List constituencies with search, filtering, sorting, and pagination.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Case-insensitive partial name match |
| `region_ids` | string | — | Comma-separated region IDs (e.g., `1,2,5`) |
| `page` | int | 1 | Page number (min 1) |
| `page_size` | int | 50 | Items per page (1–200) |
| `sort_by` | string | — | Sort field: `name`, `total_votes`, `winning_party` |
| `sort_dir` | string | `asc` | Sort direction: `asc` or `desc` |

**Response** `200 OK`

```json
{
  "total": 650,
  "page": 1,
  "page_size": 50,
  "constituencies": [
    {
      "id": 1,
      "name": "Basildon and Billericay",
      "pcon24_code": "E14001339",
      "region_id": 3,
      "region_name": "East of England",
      "total_votes": 23584,
      "winning_party_code": "L",
      "winning_party_name": "Labour Party",
      "parties": [
        {
          "party_code": "L",
          "party_name": "Labour Party",
          "votes": 11608,
          "percentage": 49.22
        },
        {
          "party_code": "C",
          "party_name": "Conservative Party",
          "votes": 6898,
          "percentage": 29.25
        }
      ]
    }
  ]
}
```

Parties within each constituency are sorted by votes descending.

---

### `GET /api/constituencies/summary`

Lightweight, unpaginated endpoint for the choropleth map. Returns all constituencies with minimal fields.

**Response** `200 OK`

```json
{
  "total": 650,
  "constituencies": [
    {
      "id": 1,
      "name": "Basildon and Billericay",
      "pcon24_code": "E14001339",
      "region_id": 3,
      "region_name": "East of England",
      "winning_party_code": "L"
    }
  ]
}
```

Sorted by name ascending.

---

### `GET /api/constituencies/{constituency_id}`

Full details for a single constituency.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `constituency_id` | int | Constituency ID |

**Response** `200 OK`

```json
{
  "id": 1,
  "name": "Basildon and Billericay",
  "pcon24_code": "E14001339",
  "region_id": 3,
  "region_name": "East of England",
  "total_votes": 23584,
  "winning_party_code": "L",
  "winning_party_name": "Labour Party",
  "parties": [
    {
      "party_code": "L",
      "party_name": "Labour Party",
      "votes": 11608,
      "percentage": 49.22
    },
    {
      "party_code": "C",
      "party_name": "Conservative Party",
      "votes": 6898,
      "percentage": 29.25
    },
    {
      "party_code": "LD",
      "party_name": "Liberal Democrats",
      "votes": 2008,
      "percentage": 8.51
    },
    {
      "party_code": "G",
      "party_name": "Green Party",
      "votes": 1521,
      "percentage": 6.45
    },
    {
      "party_code": "Ind",
      "party_name": "Independent",
      "votes": 937,
      "percentage": 3.97
    },
    {
      "party_code": "UKIP",
      "party_name": "UKIP",
      "votes": 612,
      "percentage": 2.60
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | Constituency not found |

---

## Totals

### `GET /api/totals`

National-level election results aggregated across all constituencies.

**Response** `200 OK`

```json
{
  "total_constituencies": 649,
  "total_votes": 13589842,
  "parties": [
    {
      "party_code": "L",
      "party_name": "Labour Party",
      "total_votes": 5200000,
      "seats": 350
    },
    {
      "party_code": "C",
      "party_name": "Conservative Party",
      "total_votes": 4100000,
      "seats": 200
    }
  ]
}
```

**Seat allocation**: First-past-the-post — the party with the most votes in a constituency wins the seat. If two or more parties are tied for the lead, no seat is awarded for that constituency.

Parties are sorted by `seats` descending, then `total_votes` descending.

---

## Geography

### `GET /api/geography/regions`

List all regions with constituency counts.

**Response** `200 OK`

```json
{
  "regions": [
    {
      "id": 1,
      "name": "North East",
      "sort_order": 1,
      "constituency_count": 29
    },
    {
      "id": 2,
      "name": "North West",
      "sort_order": 2,
      "constituency_count": 73
    }
  ]
}
```

Sorted by `sort_order` ascending. There are 12 ITL1 regions.

---

### `GET /api/geography/regions/{region_id}`

Detailed view of a single region with its constituencies.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `region_id` | int | Region ID |

**Response** `200 OK`

```json
{
  "id": 1,
  "name": "North East",
  "pcon24_codes": ["E14001234", "E14001235"],
  "constituencies": [
    {
      "id": 10,
      "name": "Bishop Auckland",
      "pcon24_code": "E14001234",
      "winning_party_code": "L"
    }
  ]
}
```

Constituencies sorted by name ascending.

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | Region not found |

---

## Common Patterns

### Pagination

Paginated endpoints accept `page` and `page_size` query parameters and return:

```json
{
  "total": 650,
  "page": 1,
  "page_size": 50,
  "items": []
}
```

### Error Responses

All errors return a JSON body with a `detail` field:

```json
{
  "detail": "Constituency not found"
}
```

### Party Codes

| Code | Full Name |
|------|-----------|
| `C` | Conservative Party |
| `L` | Labour Party |
| `LD` | Liberal Democrats |
| `UKIP` | UKIP |
| `G` | Green Party |
| `SNP` | SNP |
| `Ind` | Independent |
