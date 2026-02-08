# Projects Dashboard

A local developer dashboard that scans your projects directory, computes health and status deterministically, and optionally enriches with LLM-generated descriptions. Designed as a daily starting point for developers managing multiple projects.

## Features

- **Automatic project discovery** — Python pipeline scans for git repos and language indicators
- **Split health scoring** — Hygiene (structural) and Momentum (operational) scores computed deterministically
- **Compact list view** — dense, scannable rows with status dots, health scores, and last commit messages
- **Sort and filter** — sort by last commit, name, health, status, or days inactive; filter by All, Active, Needs Attention, Stale, Archived
- **Project pinning** — pin important projects to the top of the dashboard
- **Quick actions** — open in VS Code, copy Claude/Codex/terminal commands (one click from the list)
- **Detail drawer** — pitch, details, timeline, AI insights, and O-1 evidence sections
- **Live refresh progress** — SSE streaming shows per-project scan/enrich status in real time
- **Soft-prune** — missing projects auto-hide and auto-restore when they return
- **Optional LLM enrichment** — 5 provider adapters (Claude CLI, OpenRouter, Ollama, MLX, Codex CLI)
- **Settings UI** — configure everything from the in-app Settings modal
- **Path sanitization** — OSS-safe mode replaces absolute paths with `~/...`

## Prerequisites

- Node.js >= 20.9.0
- Python 3.8+
- Git

## Setup

```bash
git clone <repo-url> && cd projects-dashboard
npm install
npm run setup    # creates DB, copies default settings
npm run dev      # start on http://localhost:3000
```

### First Run

1. Click the **Settings** gear icon in the top-right
2. Set your **Dev Root** (e.g. `~/dev`)
3. Close Settings, then click **Scan** to discover projects
4. (Optional) Enable **LLM** in Settings, then click **Enrich with AI** for generated descriptions

## Configuration

The primary configuration method is the **Settings modal** in the UI. Settings are stored in `settings.json` at the project root.

Environment variables (`.env.local`) can be used as overrides. The Settings UI takes precedence for any field it manages.

See [`settings.example.json`](settings.example.json) for all available fields.

### LLM Providers

Enable LLM in Settings and select a provider:

| Provider | Value | Requirements |
|---|---|---|
| Claude CLI | `claude-cli` | `claude` CLI installed and authenticated |
| OpenRouter | `openrouter` | API key (set in Settings), optional model override |
| Ollama | `ollama` | Ollama running locally, optional URL/model in Settings |
| MLX | `mlx` | `mlx-lm-server` running, optional URL/model in Settings |
| Codex CLI | `codex-cli` | `codex` CLI installed, requires **Allow Unsafe** enabled |

## Architecture

```
~/dev projects
    |
scan.py  -->  derive.py  -->  pipeline.ts  -->  Prisma/SQLite  -->  merge.ts  -->  API  -->  UI
```

### Merge Priority (highest wins)

1. **Override** — manual edits via UI
2. **Metadata** — workflow fields (goal, audience, next action)
3. **Derived** — deterministic status and health
4. **LLM** — generated purpose, tags, recommendations
5. **Scan** — raw data

Manual overrides are never overwritten by refresh.

### Status Rules

| Status | Condition |
|---|---|
| `active` | Last commit within 14 days |
| `paused` | Last commit 15–60 days ago |
| `stale` | Last commit 61–180 days ago |
| `archived` | No commits in 180+ days or no git repo |

### Health Score

Health is composed of two sub-scores:

**Hygiene Score** (structural, slow-moving, 0–100):
| Signal | Raw Points |
|---|---|
| README present | +15 |
| Tests present | +20 |
| CI/CD configured | +15 |
| Remote configured | +10 |
| Low TODO count (<10) | +10 |
| Deployment config | +10 |
| Linter config | +5 |
| License present | +5 |
| Lockfile present | +5 |

**Momentum Score** (operational, fast-moving, 0–100):
| Signal | Raw Points |
|---|---|
| Commit recency (<=7d / <=14d / <=30d / <=60d) | +25 / +20 / +15 / +5 |
| Clean working tree | +20 |
| Pushed up (ahead == 0) | +15 |
| Low stale branches (<=3) | +10 |

**Combined:** `round(0.65 * hygiene + 0.35 * momentum)`

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/projects` | GET | All projects (merged view) + `lastRefreshedAt` |
| `/api/projects/:id` | GET | Single project detail |
| `/api/projects/:id/override` | PATCH | Set manual overrides |
| `/api/projects/:id/metadata` | PATCH | Set workflow metadata |
| `/api/projects/:id/pin` | PATCH | Toggle pinned state |
| `/api/projects/:id/activity` | GET | Last 20 activity records |
| `/api/projects/:id/touch` | POST | Record quick action usage |
| `/api/refresh` | POST | Run scan/derive pipeline |
| `/api/refresh/stream` | GET | SSE streaming refresh with progress events |
| `/api/settings` | GET/PUT | Read or update application settings |

## Development

```bash
npm run lint                          # check for errors
npx prisma studio                     # browse database
npx prisma migrate dev --name <name>  # add migration
npm run build                         # production build
```

## Open-Source Mode

Set **Sanitize Paths** in Settings (or `SANITIZE_PATHS=true`) to replace absolute paths with relative `~/...` paths in API responses and LLM prompts. Quick action buttons are hidden when paths are sanitized.

## License

[MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.
