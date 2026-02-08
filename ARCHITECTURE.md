# Projects Dashboard - Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Database | SQLite via Prisma 7 (LibSQL adapter) |
| Pipeline | Python 3 (scan.py, derive.py) |
| LLM | 5 providers behind a common interface |
| Language | TypeScript 5 (strict mode) |

## Data Flow

```
~/dev projects
    |
    v
scan.py          -- raw facts: git status, languages, files, TODOs, services, LOC
    |
    v
derive.py        -- deterministic: status, health score (gradient), tags
    |
    v
pipeline.ts      -- store to Prisma, promote derived columns, hash-based LLM skip
    |
    v
LLM enrichment   -- optional, parallel (configurable concurrency)
    |
    v
SQLite (Prisma)  -- 7 models: Project, Scan, Derived, Llm, Override, Metadata, Activity
    |
    v
merge.ts         -- merge priority: Override > Metadata > Derived > LLM > Scan
    |
    v
API routes       -- Next.js API handlers
    |
    v
React UI         -- compact list view, drawer, stats bar, keyboard navigation
```

## Prisma Models

### Project
Primary entity. One per discovered directory.

| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| name | String | Directory name |
| pathHash | String (unique) | SHA-256 of absolute path (stable identity) |
| pathDisplay | String | Absolute path (sanitized in OSS mode) |
| pinned | Boolean | User-pinned to top of dashboard |
| lastTouchedAt | DateTime? | Updated on scan and quick actions |
| prunedAt | DateTime? | Non-null = soft-deleted (missing from scan) |
| createdAt / updatedAt | DateTime | Timestamps |

Relations: has one Scan, Derived, Llm, Override, Metadata; has many Activity.

### Scan
Raw scan output from scan.py, stored as JSON.

| Field | Type | Notes |
|-------|------|-------|
| rawJson | String | Full scan output |
| rawJsonHash | String? | SHA-256 of rawJson for change detection |
| scannedAt | DateTime | Timestamp |

### Derived
Deterministic computations from derive.py, with promoted columns for queries.

| Field | Type | Notes |
|-------|------|-------|
| statusAuto | String | active, paused, stale, archived |
| healthScoreAuto | Int | 0-100 (gradient scoring) |
| derivedJson | String | Tags and other derived data |
| isDirty | Boolean | Git working tree has changes |
| ahead / behind | Int | Commits ahead/behind remote |
| framework | String? | Detected framework (nextjs, fastapi, etc.) |
| branchName | String? | Current git branch |
| lastCommitDate | DateTime? | Most recent commit timestamp |
| locEstimate | Int | Lines of code estimate |

### Llm
LLM-generated enrichment (optional, gated by FEATURE_LLM).

| Field | Type | Notes |
|-------|------|-------|
| purpose | String? | Generated project description |
| tagsJson | String? | JSON array of tags |
| notableFeaturesJson | String? | JSON array |
| recommendationsJson | String? | JSON array |
| generatedAt | DateTime | When LLM ran |

### Override
Manual edits from the UI. Always wins in merge priority.

| Field | Type | Notes |
|-------|------|-------|
| statusOverride | String? | Manual status |
| purposeOverride | String? | Manual description |
| tagsOverride | String? | JSON array |
| notesOverride | String? | Free-text notes |

### Metadata
Workflow/project planning fields.

| Field | Type | Notes |
|-------|------|-------|
| goal, audience, successMetrics | String? | Project planning |
| nextAction | String? | Current action item |
| publishTarget | String? | Deployment target |
| evidenceJson / outcomesJson | String? | O-1 evidence (gated) |

### Activity
Audit log with automatic 90-day TTL.

| Field | Type | Notes |
|-------|------|-------|
| type | String | scan, override, metadata, pin, scan+llm |
| payloadJson | String? | Event details |
| createdAt | DateTime | Indexed with projectId |

## Merge Priority

Fields are resolved top-down (highest priority wins):

1. **Override** -- manual edits via UI (status, purpose, tags, notes)
2. **Metadata** -- workflow fields (goal, audience, next action)
3. **Derived** -- deterministic status and health from derive.py
4. **LLM** -- generated purpose, tags, recommendations
5. **Scan** -- raw data from scan.py

Manual overrides are never overwritten by refresh.

## Pipeline Details

### scan.py
Walks `DEV_ROOT` (default `~/dev`), collects per-project:
- Git: branch, remote, commit count, dirty state, ahead/behind, recent commits (last 10), stash count, branch count
- Languages: primary + detected (from file indicators)
- Files: README, tests, env, Dockerfile, lockfile, linter config, license
- CI/CD: GitHub Actions, CircleCI, Travis, GitLab CI
- Deployment: Fly, Vercel, Netlify
- TODO/FIXME counts, LOC estimate
- Framework detection (Next.js, Express, FastAPI, etc.)
- External services (Supabase, PostHog, Stripe, etc. -- from deps and .env key prefixes, never values)
- Package manager detection (npm, pnpm, yarn, bun, cargo, uv, poetry)
- npm/pnpm scripts from package.json

### derive.py
Reads scan JSON from stdin, outputs derived data.

**Status rules** (by daysInactive):
| Status | Condition |
|--------|-----------|
| active | <= 14 days |
| paused | 15-60 days |
| stale | 61-180 days |
| archived | > 180 days or no commits |

**Health score** (gradient, 0-110 raw, normalized to 0-100):
| Signal | Points |
|--------|--------|
| README present | +15 |
| Tests present | +20 |
| CI/CD configured | +15 |
| Recent commits: <=7d / <=14d / <=30d / <=60d | +20 / +15 / +10 / +5 |
| Remote configured | +10 |
| Low TODO count (<10) | +10 |
| Deployment config | +10 |
| Linter config | +5 |
| License present | +5 |
| Lockfile present | +5 |

**Tags**: derived from detected languages, framework, services, and capability indicators (docker, ci-cd, deployed, tested).

### pipeline.ts
Orchestrates the full refresh:
1. Run scan.py (spawn Python, 30s timeout)
2. Run derive.py (stdin pipe from scan output)
3. Soft-prune: mark missing projects (`prunedAt`), restore returning ones
4. Store phase (sequential): upsert Project, Scan (with hash), Derived (with promoted columns)
5. LLM phase (batched parallel): skip unchanged projects (hash comparison), process in batches of `LLM_CONCURRENCY` using `Promise.allSettled`
6. Log Activity for each project
7. Cleanup: delete Activity records older than 90 days
8. Emit SSE events throughout for live progress

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/projects` | GET | All non-pruned projects (merged view) + `lastRefreshedAt` |
| `/api/projects/[id]` | GET | Single project detail (merged) |
| `/api/projects/[id]/override` | PATCH | Set manual overrides (status, purpose, tags, notes) |
| `/api/projects/[id]/metadata` | PATCH | Set workflow metadata (goal, audience, nextAction, etc.) |
| `/api/projects/[id]/pin` | PATCH | Toggle pinned state |
| `/api/projects/[id]/activity` | GET | Last 20 activity records for a project |
| `/api/projects/[id]/touch` | POST | Record quick action usage, update lastTouchedAt |
| `/api/refresh` | POST | Run full pipeline (non-streaming) |
| `/api/refresh/stream` | GET | Run full pipeline with SSE progress events |
| `/api/config` | GET | Client-safe feature flags (featureLlm, featureO1, sanitizePaths) |
| `/api/o1/export` | POST | Export evidence as Markdown + JSON (gated by FEATURE_O1) |

## LLM Provider System

5 providers behind a common `LlmProvider` interface (`enrich(input) -> LlmEnrichment`):

| Provider | Config Value | Requirements |
|----------|-------------|--------------|
| Claude CLI | `claude-cli` | `claude` CLI installed |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |
| Ollama | `ollama` | Local Ollama server |
| MLX | `mlx` | `mlx-lm-server` running |
| Codex CLI | `codex-cli` | `codex` CLI, `LLM_ALLOW_UNSAFE=true` |

Gated by `FEATURE_LLM=true`. Agentic providers (codex-cli) additionally require `LLM_ALLOW_UNSAFE=true`.

### Pipeline Optimizations
- **Hash-based skip**: SHA-256 of rawJson stored on Scan. If hash unchanged and Llm record exists, skip LLM call.
- **Parallel LLM**: Batched with configurable concurrency (`LLM_CONCURRENCY`, default 3).
- **Activity cleanup**: Records older than 90 days deleted on each refresh.
- **AbortSignal**: Client disconnect cancels in-flight pipeline and LLM calls.

## Frontend Architecture

### Page (src/app/page.tsx)
Orchestrates the dashboard:
- Search (name, status, tags, purpose, language)
- Filter tabs: All, Active, Needs Attention, Stale, Archived
- Sort: Last Commit (default), Name, Health, Status, Days Inactive (persisted in localStorage)
- Pinned section (above main list, excluded from main to avoid duplication)
- Recently active derived from sort
- Last refreshed timestamp in header

### Components
| Component | Purpose |
|-----------|---------|
| `project-list.tsx` | Compact list view (~40px rows): status dot, pin toggle, name, language badge, health score, days inactive, last commit message, quick actions |
| `project-drawer.tsx` | Detail modal: top summary + 5 always-visible bordered sections (Now, Recent Work, Details, Workflow, O-1 Evidence). All fields inline-editable. |
| `stats-bar.tsx` | Summary counts by status |
| `refresh-panel.tsx` | Live SSE progress during refresh |
| `project-card.tsx` | Legacy card view (retained but unused) |

### Hooks
| Hook | Purpose |
|------|---------|
| `use-projects.ts` | Fetch, cache, and mutate projects. Includes `togglePin`, `touchProject`. |
| `use-refresh.ts` | SSE streaming for refresh progress. Start, cancel, state. |
| `use-config.ts` | Fetch client-safe feature flags. |

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `j` / `ArrowDown` | Select next project |
| `k` / `ArrowUp` | Select previous project |
| `Enter` | Open drawer for first/selected project |
| `Escape` | Close drawer |
| `v` | Open selected project in VS Code |
| `c` | Copy Claude CLI command |
| `x` | Copy Codex CLI command |
| `t` | Copy terminal cd command |
| `p` | Toggle pin on selected project |

Shortcuts are disabled when focus is in an input/textarea/select.

## Configuration

All via environment variables (`.env.local` in development):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `DEV_ROOT` | `~/dev` | Root directory to scan |
| `EXCLUDE_DIRS` | `_projects_dashboard,node_modules,...` | Comma-separated dirs to skip |
| `FEATURE_LLM` | `false` | Enable LLM enrichment |
| `LLM_PROVIDER` | `claude-cli` | Provider selection |
| `LLM_ALLOW_UNSAFE` | `false` | Required for agentic providers |
| `LLM_CONCURRENCY` | `3` | Max parallel LLM calls during refresh |
| `LLM_OVERWRITE_METADATA` | `false` | LLM overwrites existing metadata |
| `LLM_DEBUG` | `false` | Log raw LLM output to console |
| `CLAUDE_CLI_MODEL` | *(none)* | Model override for claude-cli |
| `FEATURE_O1` | `false` | Enable O-1 evidence features |
| `SANITIZE_PATHS` | `true` | Replace absolute paths with `~/...` |

## Soft-Prune

When a project directory disappears from scan:
- `prunedAt` is set on the Project record
- Pruned projects are excluded from API responses
- If the project reappears in a future scan, `prunedAt` is cleared (auto-restore)
- All overrides, metadata, and activity are preserved through prune/restore cycles

## Directory Layout

```
src/
  app/
    page.tsx                     -- Main dashboard page
    api/
      projects/route.ts          -- GET all projects
      projects/[id]/route.ts     -- GET single project
      projects/[id]/override/    -- PATCH overrides
      projects/[id]/metadata/    -- PATCH metadata
      projects/[id]/pin/         -- PATCH toggle pin
      projects/[id]/activity/    -- GET activity timeline
      projects/[id]/touch/       -- POST quick action tracking
      refresh/route.ts           -- POST non-streaming refresh
      refresh/stream/route.ts    -- GET SSE streaming refresh
      config/route.ts            -- GET feature flags
      o1/export/route.ts         -- POST evidence export
  components/
    project-list.tsx             -- Compact list view
    project-drawer.tsx           -- Detail sheet (inline-editable)
    project-card.tsx             -- Legacy card view
    stats-bar.tsx                -- Status summary counts
    refresh-panel.tsx            -- Live refresh progress
    ui/                          -- shadcn/ui primitives
  hooks/
    use-projects.ts              -- Project data management
    use-refresh.ts               -- SSE refresh streaming
    use-config.ts                -- Feature flag fetching
  lib/
    merge.ts                     -- Merge priority logic
    pipeline.ts                  -- Pipeline orchestration
    config.ts                    -- Environment config loader
    db.ts                        -- Prisma client
    types.ts                     -- Shared TypeScript types
    llm/
      index.ts                   -- Provider factory
      provider.ts                -- LlmProvider interface
      prompt.ts                  -- Prompt template
      claude-cli.ts              -- Claude CLI adapter
      codex-cli.ts               -- Codex CLI adapter
      openrouter.ts              -- OpenRouter adapter
      ollama.ts                  -- Ollama adapter
      mlx.ts                     -- MLX adapter
pipeline/
  scan.py                        -- Project scanner
  derive.py                      -- Deterministic derivation
prisma/
  schema.prisma                  -- 7 models
```
