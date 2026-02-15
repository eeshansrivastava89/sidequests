# Projects Dashboard

A local-first developer tool that scans your dev directory and gives you a bird's-eye view of all your projects. Tracks health scores, git status, activity, and optionally enriches metadata with LLMs.

Runs entirely on your machine. No cloud services, no telemetry.

## Install

### Desktop App (macOS)

Download the latest `.dmg` from [Releases](https://github.com/eeshans/projects-dashboard/releases), open it, and drag to Applications. The app is signed and notarized.

On first launch, the setup wizard walks you through configuration.

### From Source

```bash
git clone https://github.com/eeshans/projects-dashboard.git
cd projects-dashboard
npm install
npm run setup    # creates DB, copies default settings
npm run dev      # start on http://localhost:3000
```

**Prerequisites:** Node.js >= 20.9, git

## How It Works

1. **Scan** — walks your dev root, discovers git repos, extracts metadata (languages, frameworks, dependencies, CI config, LOC, git status)
2. **Derive** — computes health, hygiene, and momentum scores; assigns status (active/paused/stale/archived); generates tags
3. **Enrich** (optional) — uses an LLM provider to generate project summaries, purposes, and recommendations
4. **Dashboard** — displays everything in a filterable, sortable grid with project detail drawers

All data stays in a local SQLite database. The pipeline is TypeScript-native (no Python required).

## Features

- Health scoring with hygiene + momentum breakdown
- Status classification (active, paused, stale, archived, needs-attention)
- Git status tracking (dirty, ahead/behind, branch)
- Language and framework detection
- Pin and override project metadata
- Dark mode
- SSE-based live refresh progress
- Optional LLM enrichment (Claude CLI, OpenRouter, Ollama, MLX, Codex CLI)
- Desktop app with encrypted secret storage and auto-updates
- First-run onboarding wizard

## Configuration

Settings are managed in-app (Settings modal or onboarding wizard). Key options:

| Setting | Default | Description |
|---------|---------|-------------|
| Dev Root | `~/dev` | Root directory to scan |
| Exclude Dirs | `node_modules,.venv,...` | Directories to skip |
| Enable LLM | `false` | Show AI enrichment button |
| LLM Provider | `claude-cli` | Which LLM backend to use |
| Sanitize Paths | `true` | Hide absolute paths (OSS mode) |

Environment variables (`.env.local`) can override settings. The Settings UI takes precedence.

### LLM Providers

| Provider | Value | Requirements |
|---|---|---|
| Claude CLI | `claude-cli` | `claude` CLI installed and authenticated |
| OpenRouter | `openrouter` | API key (set in Settings), optional model override |
| Ollama | `ollama` | Ollama running locally, optional URL/model |
| MLX | `mlx` | `mlx-lm-server` running, optional URL/model |
| Codex CLI | `codex-cli` | `codex` CLI installed, requires **Allow Unsafe** enabled |

## Architecture

```
~/dev projects
    |
scan.ts  -->  derive.ts  -->  pipeline.ts  -->  Prisma/SQLite  -->  merge.ts  -->  API  -->  UI
```

### Merge Priority (highest wins)

1. **Override** — manual edits via UI
2. **Metadata** — workflow fields (goal, audience, next action)
3. **Derived** — deterministic status and health
4. **LLM** — generated purpose, tags, recommendations
5. **Scan** — raw data

### Status Rules

| Status | Condition |
|---|---|
| `active` | Last commit within 14 days |
| `paused` | Last commit 15-60 days ago |
| `stale` | Last commit 61-180 days ago |
| `archived` | No commits in 180+ days or no git repo |

### Health Score

Health = `round(0.65 * hygiene + 0.35 * momentum)` where:

- **Hygiene** (0-100): README, tests, CI/CD, remote, TODOs, deployment, linter, license, lockfile
- **Momentum** (0-100): commit recency, clean working tree, pushed up, low stale branches

## Project Structure

```
src/app/            Next.js App Router pages and API routes
src/components/     React components (shadcn/ui)
src/hooks/          Custom React hooks
src/lib/            Utilities, config, database, pipeline, LLM providers
desktop/            Electron main process + preload
prisma/             Database schema
build/              Electron build resources
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Run unit tests (vitest) |
| `npm run test:integration` | Run integration tests |
| `npm run setup` | First-time setup (prisma, config) |
| `npm run electron:dev` | Run Electron in dev mode |
| `npm run electron:build` | Build packaged Electron app |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "git not found" in preflight | Install git: `brew install git` |
| Database errors on first run | Run `npm run setup` or delete `dev.db` and restart |
| Scan finds 0 projects | Check Dev Root points to a directory containing git repos |
| LLM enrichment fails | Check provider config in Settings; ensure API key is set |
| Desktop app won't open (macOS) | Right-click > Open on first launch |
| Auto-update not working | Requires install from GitHub Releases (not from source) |
| Settings not persisting | Check write permissions to app data directory |

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/projects` | GET | All projects (merged view) |
| `/api/projects/:id/override` | PATCH | Set manual overrides |
| `/api/projects/:id/pin` | PATCH | Toggle pinned state |
| `/api/projects/:id/touch` | POST | Record quick action |
| `/api/refresh/stream` | GET | SSE streaming refresh |
| `/api/settings` | GET/PUT | Read or update settings |
| `/api/preflight` | GET | System diagnostics |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
