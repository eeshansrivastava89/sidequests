# Projects Dashboard

A local developer portfolio dashboard that scans `~/dev` projects, computes health and status deterministically, and optionally enriches with LLM-generated descriptions.

## Features

- Automatic project discovery and scanning via Python pipeline
- Deterministic status (`active`, `in-progress`, `stale`, `archived`) and health score (0-100)
- Optional LLM enrichment with multiple provider support
- Manual overrides that persist across refreshes
- Workflow views: Next Actions, Publish Queue, Stalled
- O-1 evidence export (gated by feature flag)
- Path sanitization for open-source sharing

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

After starting the dev server, trigger an initial scan:

```bash
curl -X POST http://localhost:3000/api/refresh
```

Or click the **Refresh** button in the UI. This runs the scan/derive pipeline and populates the database.

## Configuration

All configuration is via environment variables (loaded from `.env.local` in development):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `DEV_ROOT` | `~/dev` | Root directory to scan for projects |
| `EXCLUDE_DIRS` | `_projects_dashboard,node_modules,...` | Comma-separated dirs to skip |
| `FEATURE_LLM` | `false` | Enable LLM enrichment |
| `LLM_PROVIDER` | `claude-cli` | LLM provider (see below) |
| `LLM_ALLOW_UNSAFE` | `false` | Required for agentic providers |
| `FEATURE_O1` | `false` | Enable O-1 evidence features |
| `SANITIZE_PATHS` | `true` | Replace absolute paths with `~/...` |
| `CLAUDE_CLI_MODEL` | *(none)* | Model override for claude-cli provider (e.g. `haiku`, `sonnet`) |
| `LLM_DEBUG` | `false` | Log raw LLM output to server console |
| `LLM_OVERWRITE_METADATA` | `false` | Overwrite existing metadata with LLM values on refresh |

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
    ↓
scan.py (raw facts: git, languages, files, TODOs)
    ↓
derive.py (status, health score, tags)
    ↓
Optional LLM enrichment (purpose, recommendations)
    ↓
SQLite via Prisma (Scan, Derived, LLM, Override, Metadata tables)
    ↓
Next.js API → React UI
```

### Merge Priority (highest wins)

1. **Override** — manual edits via UI
2. **Metadata** — workflow fields (goal, audience, next action)
3. **Derived** — deterministic status and health
4. **LLM** — generated purpose, tags, recommendations
5. **Scan** — raw data

Manual overrides always win and are never overwritten by refresh.

### Status Rules

| Status | Condition |
|---|---|
| `active` | Last commit within 14 days |
| `in-progress` | Last commit 15–60 days ago |
| `stale` | Last commit 61–180 days ago |
| `archived` | No commits in 180+ days or no git repo |

### Health Score Rubric (0–100)

| Indicator | Points |
|---|---|
| README present | +15 |
| Tests present | +20 |
| CI/CD configured | +15 |
| Recent commits (≤30 days) | +20 |
| Remote configured | +10 |
| Low TODO count (<10) | +10 |
| Deployment config | +10 |

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/projects` | GET | All projects (merged view) |
| `/api/projects/:id` | GET | Single project detail |
| `/api/projects/:id/override` | PATCH | Set manual overrides |
| `/api/projects/:id/metadata` | PATCH | Set workflow metadata |
| `/api/refresh` | POST | Run scan/derive/LLM pipeline |
| `/api/o1/export` | POST | Export evidence (requires `FEATURE_O1`) |
| `/api/config` | GET | Client-safe feature flags |

## Development

```bash
npx prisma studio                     # browse database
npx prisma migrate dev --name <name>  # add migration
npm run build                         # production build
```

## Sample Data

To test without scanning real projects, you can seed the database manually:

```bash
# After running migrations, insert a sample project
npx prisma db execute --stdin <<'SQL'
INSERT INTO Project (id, name, pathHash, pathDisplay, createdAt, updatedAt)
VALUES ('sample1', 'my-app', 'abc123', '~/dev/my-app', datetime('now'), datetime('now'));

INSERT INTO Scan (id, projectId, rawJson, scannedAt)
VALUES ('scan1', 'sample1', '{"isRepo":true,"lastCommitDate":"2026-01-15","commitCount":42,"daysInactive":5,"languages":{"primary":"TypeScript","detected":["TypeScript","CSS"]},"files":{"readme":true,"tests":true,"env":false,"envExample":false,"dockerfile":false,"dockerCompose":false},"cicd":{"githubActions":false,"circleci":false,"travis":false,"gitlabCi":false},"deployment":{"fly":false,"vercel":false,"netlify":false},"todoCount":3,"fixmeCount":0}', datetime('now'));

INSERT INTO Derived (id, projectId, statusAuto, healthScoreAuto, derivedJson)
VALUES ('der1', 'sample1', 'active', 75, '{"tags":["typescript","web"]}');
SQL
```

All paths in sample data use `~/...` format — no absolute paths are included.

## Open-Source Mode

By default, `SANITIZE_PATHS=true` replaces absolute paths with relative `~/...` paths in:
- API responses (`pathDisplay` field)
- LLM prompts (project paths and scan data)

Set `SANITIZE_PATHS=false` in `.env.local` if you want full paths locally.
