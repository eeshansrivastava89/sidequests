# Projects Dashboard

A local developer dashboard that scans `~/dev` projects, computes health and status deterministically, and optionally enriches with LLM-generated descriptions. Designed as a daily starting point for developers managing multiple projects.

## Features

- **Automatic project discovery** -- Python pipeline scans for git repos and language indicators
- **Deterministic status and health** -- gradient scoring based on git activity, tests, CI/CD, and more
- **Compact list view** -- dense, scannable rows (~40px each) with status dots, health scores, and last commit messages
- **Sort and filter** -- sort by last commit, name, health, status, or days inactive; filter by All, Active, Needs Attention, Stale, Archived
- **Project pinning** -- pin important projects to the top of the dashboard
- **Keyboard navigation** -- vim-style (`j`/`k`) and arrow key navigation, plus shortcuts for quick actions
- **Quick actions** -- open in VS Code, copy Claude/Codex/terminal commands (one click from the list)
- **Detail drawer** -- flat layout with At a Glance, Recent Activity, Details, and Workflow sections (all inline-editable)
- **Live refresh progress** -- SSE streaming shows per-project scan/LLM status in real time
- **Pipeline optimizations** -- hash-based LLM skip, parallel LLM calls, activity cleanup
- **Soft-prune** -- missing projects auto-hide and auto-restore when they return
- **Optional LLM enrichment** -- 5 provider adapters (Claude CLI, OpenRouter, Ollama, MLX, Codex CLI)
- **O-1 evidence export** -- gated Markdown + JSON export for project evidence
- **Path sanitization** -- OSS-safe mode replaces absolute paths with `~/...`

## Prerequisites

- Node.js 18+
- Python 3.8+
- Git

## Setup

```bash
git clone <repo-url> && cd projects-dashboard
npm install
cp .env.local.example .env.local   # edit values for your setup
npx prisma migrate dev             # create SQLite database
npm run dev                        # start on http://localhost:3000
```

### First Run

After starting the dev server, click the **Refresh** button in the UI or trigger a scan via API:

```bash
curl -X POST http://localhost:3000/api/refresh
```

This runs the scan/derive pipeline and populates the database.

## Configuration

All configuration is via environment variables (`.env.local` in development):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `DEV_ROOT` | `~/dev` | Root directory to scan for projects |
| `EXCLUDE_DIRS` | `_projects_dashboard,node_modules,...` | Comma-separated dirs to skip |
| `FEATURE_LLM` | `false` | Enable LLM enrichment |
| `LLM_PROVIDER` | `claude-cli` | LLM provider (see below) |
| `LLM_ALLOW_UNSAFE` | `false` | Required for agentic providers (codex-cli) |
| `LLM_CONCURRENCY` | `3` | Max parallel LLM calls during refresh |
| `LLM_OVERWRITE_METADATA` | `false` | Overwrite existing metadata with LLM values on refresh |
| `LLM_DEBUG` | `false` | Log raw LLM output to server console |
| `CLAUDE_CLI_MODEL` | *(none)* | Model override for claude-cli provider |
| `FEATURE_O1` | `false` | Enable O-1 evidence features |
| `SANITIZE_PATHS` | `true` | Replace absolute paths with `~/...` |

### LLM Providers

Set `FEATURE_LLM=true` and `LLM_PROVIDER` to one of:

| Provider | Value | Requirements |
|---|---|---|
| Claude CLI | `claude-cli` | `claude` CLI installed and authenticated |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL` |
| Ollama | `ollama` | Ollama running locally, optional `OLLAMA_URL`, `OLLAMA_MODEL` |
| MLX | `mlx` | `mlx-lm-server` running, optional `MLX_URL`, `MLX_MODEL` |
| Codex CLI | `codex-cli` | `codex` CLI installed, requires `LLM_ALLOW_UNSAFE=true` |

## Architecture

```
~/dev projects
    |
scan.py  -->  derive.py  -->  pipeline.ts  -->  Prisma/SQLite  -->  merge.ts  -->  API  -->  UI
```

### Merge Priority (highest wins)

1. **Override** -- manual edits via UI
2. **Metadata** -- workflow fields (goal, audience, next action)
3. **Derived** -- deterministic status and health
4. **LLM** -- generated purpose, tags, recommendations
5. **Scan** -- raw data

Manual overrides are never overwritten by refresh.

### Status Rules

| Status | Condition |
|---|---|
| `active` | Last commit within 14 days |
| `paused` | Last commit 15-60 days ago |
| `stale` | Last commit 61-180 days ago |
| `archived` | No commits in 180+ days or no git repo |

### Health Score (0-100, gradient)

| Signal | Points |
|---|---|
| README present | +15 |
| Tests present | +20 |
| CI/CD configured | +15 |
| Recent commits (<=7d / <=14d / <=30d / <=60d) | +20 / +15 / +10 / +5 |
| Remote configured | +10 |
| Low TODO count (<10) | +10 |
| Deployment config | +10 |
| Linter config | +5 |
| License present | +5 |
| Lockfile present | +5 |

Raw max is 110, normalized to 100.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `j` / `ArrowDown` | Select next project |
| `k` / `ArrowUp` | Select previous project |
| `Enter` | Open drawer for selected project |
| `Escape` | Close drawer |
| `v` | Open in VS Code |
| `c` | Copy Claude CLI command |
| `x` | Copy Codex CLI command |
| `t` | Copy terminal cd command |
| `p` | Toggle pin |

Shortcuts are disabled when focus is in a text input.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/projects` | GET | All projects (merged view) + `lastRefreshedAt` |
| `/api/projects/:id` | GET | Single project detail |
| `/api/projects/:id/override` | PATCH | Set manual overrides |
| `/api/projects/:id/metadata` | PATCH | Set workflow metadata |
| `/api/projects/:id/pin` | PATCH | Toggle pinned state |
| `/api/projects/:id/activity` | GET | Last 20 activity records |
| `/api/projects/:id/touch` | POST | Record quick action usage, update lastTouchedAt |
| `/api/refresh` | POST | Run scan/derive/LLM pipeline |
| `/api/refresh/stream` | GET | SSE streaming refresh with progress events |
| `/api/config` | GET | Client-safe feature flags |
| `/api/o1/export` | POST | Export evidence (requires `FEATURE_O1`) |

## Development

```bash
npx prisma studio                     # browse database
npx prisma migrate dev --name <name>  # add migration
npm run build                         # production build
```

## Open-Source Mode

By default, `SANITIZE_PATHS=true` replaces absolute paths with relative `~/...` paths in:
- API responses (`pathDisplay` field)
- LLM prompts (project paths and scan data)

Quick action buttons are hidden when paths are sanitized.

Set `SANITIZE_PATHS=false` in `.env.local` for full paths locally.
