# Code Standards & Conventions

## Backend (Python)

### Linting — Ruff

Configured in `backend/pyproject.toml`:

```toml
[tool.ruff]
line-length = 81

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "PL",   # pylint
    "N",    # pep8-naming
    "UP",   # pyupgrade
    "G",    # flake8-logging-format
    "I",    # isort
]
```

**Key rules**:
- Maximum line length: 81 characters
- Imports sorted with isort conventions
- Modern Python syntax encouraged (pyupgrade)
- `__init__.py` files are exempt from `F401` (unused imports) since they re-export

### Formatting — yapf

Available in requirements.txt. Used for consistent code formatting.

### Type Hints

- All Pydantic models use type annotations (`str`, `int | None`, `list[T]`)
- Service functions include parameter and return type hints
- SQLAlchemy models use `Mapped[]` type annotations

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | snake_case | `constituency_service.py` |
| Classes | PascalCase | `ConstituencyMatcher` |
| Functions | snake_case | `get_total_results()` |
| Constants | UPPER_SNAKE | `VALID_PARTY_CODES` |
| API routes | kebab-like prefixes | `/api/constituencies` |
| Database tables | snake_case plural | `upload_logs` |
| Database columns | snake_case | `party_code` |

### Project Conventions

- **Routers are thin**: HTTP concerns only (validation, status codes, error responses). Business logic lives in services.
- **Services accept `db: Session`**: Database sessions are injected via FastAPI's `Depends(get_db)` in routers and passed to services.
- **Schemas mirror API contracts**: One Pydantic schema per response shape. Nested schemas compose (e.g., `ConstituencyResponse` contains `list[PartyResult]`).
- **No raw SQL**: All queries use SQLAlchemy ORM or Core expressions.

---

## Frontend (TypeScript / React)

### Linting — ESLint

Configured in `frontend/eslint.config.mjs`:

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/", "out/", "build/", "next-env.d.ts"] },
];
```

Extends Next.js recommended rules including TypeScript support.

### TypeScript

Configured in `frontend/tsconfig.json`:

- **Strict mode**: enabled (`"strict": true`)
- **Target**: ES2017
- **Module**: ESNext with bundler resolution
- **Path alias**: `@/*` maps to project root (`"./*"`)

All components, hooks, and utilities are written in TypeScript. API response types are defined in `lib/types.ts`.

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Page files | `page.tsx` (App Router convention) | `app/upload/page.tsx` |
| Component files | kebab-case | `constituency-map.tsx` |
| Component exports | PascalCase | `ConstituencyMap` |
| Hook files | kebab-case with `use-` prefix | `use-totals.ts` |
| Hook exports | camelCase with `use` prefix | `useTotals` |
| Lib files | kebab-case | `api-client.ts` |
| Type files | kebab-case | `types.ts` |
| Test files | `*.test.ts` / `*.test.tsx` | `use-totals.test.ts` |
| E2E files | `*.spec.ts` | `upload.spec.ts` |
| Constants | UPPER_SNAKE | `POLLING_INTERVAL_MS` |
| CSS classes | Tailwind utilities | `"bg-primary text-sm"` |

### Component Patterns

- **Client components**: Use `"use client"` directive at the top of files that need browser APIs, state, or effects
- **Shadcn/UI**: UI primitives in `components/ui/` — imported and composed, not modified directly
- **Class merging**: Use `cn()` from `lib/utils.ts` for conditional Tailwind classes
- **Data fetching**: Always via SWR hooks — never `useEffect` + `fetch`

### File Organisation

```
components/
├── domain/          # Feature-specific components (dashboard/, map/, upload/)
│   └── feature.tsx  # One component per file
├── shared/          # Cross-feature components (PartyBadge, EmptyState)
├── layout/          # Shell, sidebar, navigation
└── ui/              # Shadcn/UI primitives (don't edit directly)
```

---

## Git & CI

### Branch Strategy

- `main` — Primary branch, always deployable
- Feature branches merge into `main` via pull requests

### CI Workflows

Two GitHub Actions workflows run on push/PR to `main`:

**Unit Tests** (`.github/workflows/tests.yml`):
- Backend: Python 3.12, `pytest`
- Frontend: Node 20, `vitest run`

**E2E Tests** (`.github/workflows/e2e.yml`):
- Starts the full E2E Docker stack
- Runs Playwright tests in `clean` then `seeded` modes
- Merges blob reports and uploads as GitHub artifact

---

## Testing Conventions

### Backend (pytest)

- Test files: `test_*.py` in `backend/tests/`
- Use the shared `conftest.py` fixtures (`db_session`, `client`, `seed_constituencies`)
- Each test function is independent — no shared state between tests (session rolls back)
- Name tests descriptively: `test_upload_empty_file_returns_400`
- Integration tests in `test_integration.py` cover full upload → query → verify flows

### Frontend (Vitest)

- Test files: `*.test.ts` / `*.test.tsx` in `frontend/tests/`
- Setup file: `tests/setup.ts` (configures jsdom, testing-library cleanup)
- Use `vi.clearAllMocks()` in `beforeEach` — not `vi.restoreAllMocks()` (the latter undoes `vi.mock()` factories)
- Assert colours as RGB values (jsdom normalises hex → `rgb()`)
- Avoid testing SWR error retry behaviour (caching makes it unreliable)

### E2E (Playwright)

- Test files: `*.spec.ts` in `frontend/e2e/`
- Sequential execution (1 worker) to avoid race conditions
- Use `E2E_DB` env var for conditional test execution (`clean` vs `seeded`)
- Use `waitForLoadState("networkidle")` after navigation
- Chromium only (no cross-browser testing)

---

## Dependencies

### Adding Backend Dependencies

```bash
# Add to requirements.txt manually, then:
docker compose exec backend pip install -r requirements.txt

# Or rebuild:
make rebuild
```

### Adding Frontend Dependencies

```bash
# Inside the frontend directory:
cd frontend && npm install <package>

# Rebuild the Docker image:
make rebuild
```
