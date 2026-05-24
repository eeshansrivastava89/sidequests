# Sidequests — Architecture & Implementation Plan

**Updated:** 2026-05-24
**Status:** Revised plan — post architecture review, DRY/KISS-optimized

---

## Guiding Principle

The product is a **control center for side projects**, not a dashboard. Every feature should answer one of two questions: "What should I work on right now?" or "Am I making progress?" If it doesn't serve either, it doesn't ship.

### Secondary Principles

- **Don't store what you can compute.** If data already exists in the DB, derive it on-the-fly rather than persisting a redundant copy.
- **Add columns before adding tables.** A column on an existing model beats a new model + relation + join.
- **Extend existing endpoints before creating new ones.** Adding a field to `GET /api/projects` beats a new `/api/actions` endpoint.

---

## Phase 0: Hono+Vite Migration (Issue #10)

**Why first:** We're about to add significant new backend and frontend code. Building on Next.js when we plan to migrate means building on a foundation we'll demolish. Better to migrate first, then add features on the new stack.

**Current state:** Next.js 16 (App Router) + React 19 + Prisma 7.4 + libSQL/SQLite + Tailwind CSS v4 + shadcn/ui

**Target state:** Hono (API) + Vite (SPA) + React 19 + Prisma 7.4 + libSQL/SQLite + Tailwind CSS v4 + shadcn/ui

### What stays identical
- All React components, hooks, shadcn/ui, Tailwind
- Prisma schema, SQLite database, all data models
- Pipeline logic (scan → derive → GitHub → LLM)
- LLM provider abstraction (5 adapters)
- CLI entry point (`bin/cli.mjs`)

### What changes
| Component | From | To |
|---|---|---|
| API server | Next.js route handlers (`app/api/.../route.ts`) | Hono routes (`src/api/...ts`) |
| Build | `next build` + standalone output | `vite build` (SPA) + Hono server |
| SSR | Next.js server components | None — pure SPA |
| `next/font/local` | Next.js font optimization | CSS `@font-face` |
| Error middleware | `withErrorHandler` wrapper (Next.js) | Hono middleware |
| Dev server | `next dev` (single process) | `vite dev` + `tsx watch` for Hono (two processes in dev) |
| SSE streaming | Next.js `ReadableStream` | Hono `streamSSE()` |
| Theme/Toaster | `layout.tsx` (root layout) | `App.tsx` (Vite root) |

### Migration sub-phases

**0a — Hono scaffold + first routes (1-2 days)**

- [x] Create `src/api/index.ts` — Hono app with CORS + logger + timeout middleware
- [x] Create `src/api/routes/projects.ts` — port `GET /api/projects`
- [x] Create `src/api/routes/projects/[id].ts` — port `GET /api/projects/:id`, PATCH override/metadata/pin, POST touch, GET activity
- [x] Create `src/api/routes/refresh.ts` — port `POST /api/refresh` (without SSE)
- [x] Create `src/api/routes/config.ts`, `src/api/routes/preflight.ts`, `src/api/routes/version.ts` — simple GET routes
- [x] Create `src/api/routes/settings.ts` — port GET/PUT settings
- [x] Refactor `src/lib/api-helpers.ts` — extract framework-agnostic `coercePatchBody`, `findProject`, `safeJsonParse`, `isMissingTableError`
- [x] Create `src/lib/next-api-helpers.ts` — Next.js-specific `withErrorHandler`, `notFound`, `patchErrorToNextResponse`
- [x] Update existing Next.js route imports to use `next-api-helpers` for NextResponse-based helpers
- [x] Write 19 Hono integration tests covering all ported routes
- [x] Verify: all 251 unit tests + 93 integration tests (incl. 19 Hono) pass

**0b — All routes + SSE** ✅

- [x] Port SSE endpoint: `GET /api/refresh/stream` → Hono `streamSSE()` with pipeline state management
- [x] Port `POST /api/refresh/stream` (cancel) → Hono route
- [x] Remove global route timeout (SSE streams can take minutes)
- [x] All integration tests passing (19 Hono + existing)

**0c — Vite SPA + production build** ✅

- [x] Create `vite.config.ts` with React plugin + `resolve.tsconfigPaths: true`
- [x] Create `src/App.tsx` — import `DashboardPage` + `Toaster` + `globals.css`
- [x] Create `src/entry.tsx` — React root mount
- [x] Create `src/index.html` — Vite HTML entry with anti-FOUC theme script
- [x] Create `src/styles/font-faces.css` — `@font-face` for Geist Sans/Mono (replaces `next/font/local`)
- [x] Create `src/server.ts` — Hono server serving Vite build as static + API routes
- [x] Install: vite, @vitejs/plugin-react, esbuild, tsx, concurrently
- [x] Remove: next, eslint-config-next, vite-tsconfig-paths
- [x] Vite build produces: `dist/` = 5.7MB total (vs 252MB `.next/`)
- [x] Production build: `vite build + esbuild` bundles server.js (5.2MB)
- [x] Dev scripts: `npm run dev` (concurrently api+spa), `npm run dev:api`, `npm run dev:spa`

**0d — CLI + deployment migration** ✅

- [x] Update `bin/cli.mjs` — start Hono server via `fork()` with env vars
- [x] Rewrite `scripts/build-npx.mjs` — vite build + esbuild server + copy native bindings
- [x] Delete `.next/`, `next.config.mjs`, `src/app/api/`, `src/app/layout.tsx`, `src/lib/next-api-helpers.ts`
- [x] Remove `next` and `eslint-config-next` from package.json dependencies
- [x] Remove `src/app/api/__tests__/` (old Next.js route integration tests)
- [x] Update `api-helpers.test.ts` — test only framework-agnostic functions
- [x] Change `DashboardPage` export from `export default` to named `export`
- [x] Add `"type": "module"` to package.json
- [x] Update `package.json` scripts and files array for Vite+Hono
- [x] Clean `public/` — remove Vite template SVG files
- [x] All 245 unit tests + 50 integration tests pass
- [x] Build output: 5.7MB dist/ (was 252MB .next/)

### Size impact
| | Before | After |
|---|---|---|
| Framework | 255MB (Next + @next/swc) | ~3MB (Hono) |
| Build output | 252MB (`.next/`) | 5.7MB (`dist/`)* |
| Installed via npx | ~620MB | ~170MB (target) |

*`dist/` includes: 420KB JS bundle, 66KB CSS, 5.2MB server.js, fonts. Production npx build adds node_modules for native bindings.

---

## Phase 1: Data Model Extensions

### Design rationale

The original plan proposed 5 new tables. This revision cuts it to 4, with 3 being trivial (3-4 columns each). The key design decisions:

1. **No PriorityAction table.** Priority actions are computed on-the-fly from existing data (git state, LLM nextAction, GitHub issues, stale thresholds). Persisting them creates a stale-data problem and a DRY violation. Instead, compute `actions[]` in the API response from existing tables. Dismissals are tracked with a lightweight `DismissedAlert` table (2 columns + unique constraint).

2. **No LifecycleAction table.** Snooze/archive/revive are project-level state changes. Adding `snoozedUntil` and `archivedNote` columns to Project eliminates an entire table + relation, and lets snooze/archive/revive flow through the existing `PUT /api/projects/:id/override` endpoint.

3. **No ScanDelta table.** "Since last visit" deltas are computed by comparing current project state to a stored snapshot from the user's last visit. A single `UserVisit` row (one row, not many) replaces what would be many ScanDelta rows per scan.

4. **Commit counts belong in Derived, not Project.** `weekCommits`/`monthCommits`/`quarterCommits` are scan-derived metrics — they belong alongside the other derived scores. The scan module needs a small enhancement to count commits by date range.

### Schema changes to existing tables

```
Project
  + snoozedUntil    DateTime?    // When snooze expires (null = not snoozed)
  + archivedNote    String?      // "What did you learn?" retirement note

Derived
  + weekCommits     Int  @default(0)   // Commits in last 7 days
  + monthCommits    Int  @default(0)   // Commits in last 30 days
  + quarterCommits  Int  @default(0)   // Commits in last 90 days
```

### New tables

```
WeeklyFocus
  id           String    @id @default(cuid())
  projectId    String
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  goal         String    // What you want to accomplish this week
  completed    Boolean   @default(false)
  weekStart    DateTime  // Monday 00:00 of the week
  createdAt    DateTime  @default(now())

DismissedAlert
  id           String    @id @default(cuid())
  projectId    String
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  alertType    String    // "git-urgent" | "git-warning" | "issue" | "stale-decision"
  dismissedAt  DateTime  @default(now())
  @@unique([projectId, alertType])  // one dismissal per alert type per project

UserPreference
  id           String    @id @default(cuid())
  key          String    @unique // e.g. "notification.quietHours" | "staleness.threshold"
  value        String    // JSON string
  updatedAt    DateTime  @updatedAt

UserVisit
  id           String    @id @default(cuid())
  key          String    @unique // "lastVisit"
  snapshotJson String    // Serialized MergedProject[] at last visit
  updatedAt    DateTime  @updatedAt
```

### Checklist

- [x] Add `snoozedUntil` and `archivedNote` columns to `Project` model in Prisma schema
- [x] Add `weekCommits`, `monthCommits`, `quarterCommits` columns to `Derived` model
- [x] Create `WeeklyFocus` model
- [x] Create `DismissedAlert` model with unique constraint on `[projectId, alertType]`
- [x] Create `UserPreference` model (gradually replaces `settings.json` file)
- [x] Create `UserVisit` model (single-row table for last-visit snapshot)
- [x] Update `bootstrap-db.mjs` with new SCHEMA_SQL and MIGRATIONS array
- [x] Update `bootstrap-db.test.ts` EXPECTED_COLUMNS fixture
- [x] Update `scanProject()` in `pipeline-native/scan.ts` to compute commit counts by date range
- [x] Update `pipeline.ts` to store `weekCommits`/`monthCommits`/`quarterCommits` in Derived

---

## Phase 2: API Routes

### Design rationale

The original plan proposed 8 new route groups. After review, the actual net-new surface area is much smaller:

- **Priority actions** are computed on-the-fly and included in the existing `GET /api/projects` response. No new table, no new endpoints.
- **Snooze/archive/revive** flow through the existing `PUT /api/projects/:id/override` endpoint with new fields. No new `/api/lifecycle/` routes.
- **"Since last visit" delta** uses `UserVisit` snapshot comparison. Two endpoints: load snapshot and save snapshot.
- **Shipped history** is an aggregate query on Derived. Single endpoint or just a field in the projects response.

### Extended existing routes

```
GET /api/projects
  → Add computed `actions[]` array per project:
    - git-urgent: isDirty && daysInactive > 7, or ahead > 0 && daysInactive > 7
    - git-warning: no remote, dirty tree < 7 days
    - issue: GitHub issues with bug labels (highest priority), features, chores
    - llm-suggestion: from Llm.nextAction
    - stale-decision: statusAuto crossed threshold (30/60/90 days)
  → Add `weekCommits`, `monthCommits`, `quarterCommits` per project
  → Filter out actions where DismissedAlert exists for (projectId, alertType)
  → Filter out projects where Project.snoozedUntil > now

PUT /api/projects/:id/override
  → Extend to handle snooze/archive/revive:
    - { statusOverride: "archived", archivedNote: "learned X" } → archive
    - { snoozedUntil: "2026-06-01T00:00:00Z" } → snooze
    - { statusOverride: null, snoozedUntil: null } → revive
```

### New routes

```
POST /api/projects/:id/dismiss-alert
  Body: { alertType: string }
  → Create DismissedAlert row, silencing that alert type for that project
  DELETE variant: clear dismissal to re-show the alert

GET  /api/focus
  → Weekly focus goals for current week

POST /api/focus
  Body: { projectId, goal }
  → Create new weekly focus goal

PUT  /api/focus/:id
  Body: { goal?, completed? }
  → Update goal text or toggle completion

GET  /api/visit
  → Returns delta between current project state and last-visit snapshot
  → Frontend calls this on dashboard load

POST /api/visit
  → Saves current merged project state as snapshot (UserVisit row with key "lastVisit")
  → Frontend calls this on dashboard close/unload

GET  /api/shipped
  → Aggregate commit counts across portfolio: { weekTotal, monthTotal, quarterTotal, projects: [...] }
```

### Checklist

- [x] Extend `mergeAllProjects()` and `buildMergedView()` to include `actions[]`, `weekCommits`/`monthCommits`/`quarterCommits`, and `snoozedUntil`/`archivedNote`
- [x] Create `src/lib/actions.ts` — pure function that computes priority actions from a MergedProject + GitHub data
- [x] Extend `PUT /api/projects/:id/override` handler to accept `snoozedUntil` and `archivedNote`
- [x] Create `POST /api/projects/:id/dismiss-alert` route
- [x] Create `GET/POST /api/focus` routes
- [x] Create `GET/POST /api/visit` routes (snapshot save + diff)
- [x] Create `GET /api/shipped` route (aggregate commit counts)
- [x] Add tests for action computation, dismissal, snooze/archive/revive, and visit snapshot

---

## Phase 3: Frontend Architecture

### Two-view structure

**View: What Now (default)**
- Delta strip: "Since last visit (2 days ago)" — what changed
- Priority action cards: full-width, ranked, with copy-paste commands and source badges
- Weekly Focus section: goals per project with checkboxes
- Shipped section: 7d / 30d / 90d commit counts with week-over-week delta
- No "insights" section in v1 — portfolio insights can be computed client-side from project data when needed

**View: Projects**
- Project list with all current columns (status, momentum, issues, git state)
- Click a project → side drawer opens with:
  - Full project detail (LLM summary, next action, insights, GitHub issues)
  - Shipped history for that project (7d/30d/90d commit counts)
  - Lifecycle actions (snooze, archive, revive buttons)
  - All project metadata (override status, tags, notes)

### New components

- [x] `DeltaStrip` — "Since last visit" banner with delta items
- [x] `ActionCard` — ranked priority action with source badge + copy-paste command
- [x] `FocusSection` — weekly goals with checkboxes per project
- [x] `ShippedSection` — portfolio-level commit counts (7d/30d/90d)
- [x] `LifecycleActions` — snooze/archive/revive buttons in project detail pane

### Modified components

- [x] `ProjectDetailPane` — add LifecycleActions in slide-over panel
- [ ] `ProjectList` — add ShippedSection or ShippedCard (v2 — per-project shipped in detail pane)
- [x] `page.tsx` — tab-based layout (What Now / Projects)
- [x] `use-whatnow-data.ts` — hooks for focus goals, shipped data, visit delta, dismiss alerts
- [x] `types.ts` — added PriorityAction, FocusGoal, ShippedData, VisitDelta; extended Project with actions[], isSnoozed, weekCommits/monthCommits/quarterCommits, snoozedUntil, archivedNote

### No hidden sections
Everything visible. No accordions, no "click to expand." If content is secondary, it goes below the fold, but it's always visible.

---

## Phase 4: Notifications

### Backend: node-notifier
- Uses `node-notifier` npm package — sends native macOS/Windows/Linux notifications
- No app install required
- Triggered by pipeline after scan/derive/LLM cycle completes

### Notification types (v1)
- CI failure (project had CI passing, now failing)
- Stale threshold crossed (project went from active → paused, or crossed 30/60/90 day thresholds)
- Unpushed commits aging (commits ahead > 0 and days inactive > 7)

### Not in v1 (deferred)
- Time-based notifications ("Monday 9am focus reminder") — requires a scheduler
- New GitHub issue notifications — requires webhook or polling separate from scan cycle
- Notification center UI — Activity log + toasts suffice for v1

### Notification deduplication
- Each notification type per project is tracked in `Activity` table (`type: "notification"`)
- Only send once per state transition (don't re-notify about same CI failure)
- Quiet hours configurable via `UserPreference`

### Checklist
- [ ] Install `node-notifier` dependency
- [ ] Create `src/lib/notifications.ts` — notification rules + deduplication logic
- [ ] Hook into pipeline: after scan completes, evaluate notification rules
- [ ] Track sent notifications in `Activity` table
- [ ] Quiet hours check via `UserPreference`

---

## Phase 5: Menu Bar Companion (Future)

**Architecture:** Thin Swift + AppKit menu bar app (~800 lines)
- Polls `localhost:PORT/api/projects` every 5 minutes, extracts top actions
- Shows badge count on menu bar icon
- Dropdown shows top 3-5 priority actions
- Click action → opens browser to `localhost:PORT` with project pre-selected
- Click "Open Dashboard" → opens full web UI
- Snooze/Archive/Revive send PUT to existing override API

**Distribution:** Homebrew cask or DMG download
**Not in scope for initial build** — ships after the web UI and notifications are working.

---

## Phase 6: CLI & Shell Integration (Future)

### `sq` CLI commands
```
sq status          → One-line summary: "3 active, 2 stalling, 1 needs attention"
sq next            → Top 3 priority actions with commands
sq focus           → This week's focus goals
sq archive <name>   → Archive a stale project with retirement note
sq snooze <name>   → Snooze a project for 2 weeks
sq revive <name>    → Revive a stale project
```

### `cd` hook
- `sq hook` installs a shell function in `.zshrc`/`.bashrc`
- After every `cd`, if the directory is a tracked project:
  - Prints one line: "sidequests: 1 modified, 3 ahead. Next: fix auth bug (#42)"

---

## Implementation Order

```
Phase 0: Hono+Vite migration              ← Foundation — must be first
    │
Phase 1: Data model extensions            ← Add columns + new tables
    │
Phase 2: API routes (extend + new)         ← Compute actions in-project, add new endpoints
    │
Phase 3: Frontend (What Now + Projects)    ← New views using new data
    │
Phase 4: Notifications (node-notifier)     ← Push, don't pull
    │
Phase 5: Menu bar companion               ← Future
Phase 6: CLI + Shell integration          ← Future
```

Phases 0-4 are the initial build. Phases 5-6 are follow-ups.

---

## What We're Not Building (YAGNI)

Explicitly out of scope for v1:

- **Per-project detail pages** — the side drawer is enough
- **Charts/graphs** — sparklines and commit counts tell the story, no chart libraries
- **Lifecycle kanban board** — the lifecycle actions in the project detail pane are enough
- **PriorityAction table** — computed on-the-fly from existing data, not stored
- **ScanDelta table** — replaced by UserVisit snapshot comparison
- **LifecycleAction table** — replaced by 2 columns on Project + existing override API
- **`/api/actions` endpoint family** — actions are a field in the projects response
- **`/api/lifecycle/:id/*` routes** — uses existing override endpoint
- **`/api/insights` endpoint** — portfolio insights are computed client-side from project data
- **`/api/notifications` read/dismiss endpoint** — notifications fire from pipeline, Activity log + toasts suffice for v1
- **Settings panels for notification thresholds** — config file / UserPreference is fine for v1
- **Onboarding wizard for new features** — existing wizard stays, new features are self-explanatory
- **MCP server** — table-stakes for AI workflows, but not blocking for v1
- **User accounts / cloud sync** — local-first, single user
- **Time-based notification scheduler** — requires cron/scheduler infrastructure, defer to v2

---

## Success Criteria for v1

1. Open the app → immediately see ranked actions with copy-paste commands
2. See what changed since last visit (delta strip)
3. See GitHub issues merged into the priority queue with issue numbers
4. See shipped history (commits this week/month/quarter)
5. Weekly focus goals persist across sessions
6. Stale project decisions (snooze/archive/revive) persist and re-surface after snooze expires
7. Native macOS notifications fire on CI failures and stale thresholds
8. Package size reduced by ~75% after Hono+Vite migration