# Projects Dashboard

A local developer portfolio dashboard that scans `~/dev` projects, computes health/status deterministically, and optionally enriches with LLM-generated descriptions.

## Setup

```bash
npm install
cp .env.local.example .env.local             # then edit values
npx prisma migrate dev                       # create/migrate SQLite database
npm run dev                                  # start Next.js dev server
```

## Configuration

All configuration is via environment variables (loaded from `.env.local` in development):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path (relative to project root) |
| `DEV_ROOT` | `~/dev` | Root directory to scan for projects |
| `EXCLUDE_DIRS` | `_projects_dashboard,node_modules,...` | Comma-separated dirs to skip |
| `FEATURE_LLM` | `false` | Enable LLM enrichment (purpose, recommendations) |
| `FEATURE_O1` | `false` | Enable O-1 evidence features |
| `SANITIZE_PATHS` | `true` | Replace absolute paths with `~/...` for OSS mode |

`config.example.json` is a reference showing available options — it is not loaded at runtime.

## Architecture

```
Python scan → Deterministic derive → Optional LLM enrichment → SQLite (Prisma)
                                                                    ↓
                                                              Next.js API → React UI
```

- **scan.py** — Collects raw git info, language indicators, file flags, TODO counts
- **derive.py** — Computes status (by inactivity thresholds) and health score (fixed rubric)
- **LLM enrichment** — Optional; generates purpose, tags, recommendations
- **Merge layer** — Combines all data sources with priority: Override > Metadata > Derived > LLM > Scan
- **Manual overrides** — Edits via UI persist in the Override table and always win

## Data Pipeline

```bash
# Scan + derive + store
POST /api/refresh

# Read merged views
GET /api/projects
GET /api/projects/:id

# Manual edits
PATCH /api/projects/:id/override
PATCH /api/projects/:id/metadata
```

## Development

```bash
npx prisma studio    # browse database
npx prisma migrate dev --name <name>  # add migration
npm run build        # production build
```
