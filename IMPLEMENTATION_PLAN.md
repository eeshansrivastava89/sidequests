# Projects Dashboard v2 - Implementation Plan

This is the step-by-step plan for Claude to implement. Codex will review each phase.

## Status (2026-02-07)
- ✅ Phase 0: Completed
- ✅ Phase 1: Completed
- ✅ Phase 2: Completed
- ✅ Phase 3: Completed
- ✅ Phase 4: Completed
- ✅ Phase 5: Completed
- ✅ Phase 6: Completed
- ✅ Phase 7: Completed
- ✅ Phase 8: Completed
- ✅ Phase 9: Completed
- ✅ Phase 10: Completed
- ✅ Phase 11: Enhanced Scan Pipeline
- ✅ Phase 12: Schema Evolution & Derive v2
- ✅ Phase 13: Compact List View
- ✅ Phase 14: Sort, Filter & Recently Active
- ✅ Phase 15: Drawer Redesign
- ✅ Phase 16: API & Merge Updates
- ✅ Phase 17: Enhanced Quick Actions
- ✅ Phase 18: Project Pinning & Favorites
- ✅ Phase 19: Pipeline Optimizations
- ✅ Phase 20: Session Memory & Activity Timeline
- ✅ Phase 21: Docs & Architecture Update
- ✅ Phase 22: Code Review Fixes (Codex Review)
- ✅ Phase 23: UX Polish (PM Review)
- ✅ Phase 24: Deterministic List Alignment
- ✅ Phase 25: Reliable Language/Framework Context
- ✅ Phase 26: Drawer IA Refactor (Single-Column, Action-First)
- ✅ Phase 27: Functional Polish & Interaction Consistency
- ✅ Phase 28: Modal Layout Refinement
- ⬜ Phase 29: Drawer UX Overhaul (Full-Stack) — in progress
- ⬜ Phase 30: Scan Deltas & Change Indicators

Notes:
- ✅ README setup line fixed (no no-op copy).
- ✅ Pipeline runner spawn timeout handled with manual kill/timeout.
- Phases 0-10 built the foundation (portfolio tracker). Phases 11-21 transform it into a "daily starting point" tool.
- Phase 22 addressed Codex code review findings. Phase 23 addressed PM agent review findings.
- Phases 24-27 are Codex-planned functional UI polish, shipped as 4 independently verifiable chunks. See `.claude/codex-review.md` for original plan.
- Agent teams will be used for implementation. Backend and frontend phases can run in parallel where noted.
- Phase 29 is a philosophy shift: dashboard becomes read-only (except status). Two parallel agents: data-layer (backend) + drawer-rewrite (frontend).

## Agent Team Strategy
Phases 11-21 are designed for parallel execution using Claude Code agent teams:

| Wave | Backend Agent | Frontend Agent | Notes |
|------|--------------|----------------|-------|
| **A** | Phase 11 (scan.py) | Phase 13 (list view) | Independent — new data collection vs UI refactor |
| **B** | Phase 12 (schema + derive) | Phase 14 (sort/filter) | Frontend uses existing data; schema migration runs separately |
| **C** | Phase 16 (API + merge) | Phase 15 (drawer) | Drawer can use existing fields first, wire new data after Phase 16 |
| **D** | Phase 19 (pipeline opts) | Phase 17 (quick actions) + Phase 18 (pinning) | Mostly independent |
| **E** | Phase 20 (session memory) | — | Full-stack, single agent |
| **F** | Phase 21 (docs) | — | Post-implementation |

## ✅ Phase 0 - Setup (Completed)
- Create fresh Next.js App Router project with TypeScript
- Install Tailwind CSS and shadcn/ui
- Install Prisma and SQLite
- Add config loader and .env.local support

Deliverables:
- Next.js app boots locally
- Prisma schema created
- Config system documented

## ✅ Phase 1 - Data Layer (Completed)
- Define Prisma schema (Project, Scan, Derived, LLM, Override, Metadata, Activity)
- Add merge logic module mergeProjectView(projectId)

Deliverables:
- Database tables migrate cleanly
- Merge logic uses priority order

## ✅ Phase 2 - Deterministic Pipeline (Completed)
- Port scan.py from v1 with pathHash and filtering
- Add derive.py with status and health rules
- Add Node runner to execute Python and store results

Deliverables:
- POST /api/refresh writes Scan and Derived tables
- Deterministic status and health are visible

## ✅ Phase 3 - LLM Integration (Optional, Completed)
- Implement provider interface
- Add Claude CLI adapter
- Gate behind FEATURE_LLM

Deliverables:
- LLM fields appear only when enabled
- No overrides are overwritten

## ✅ Phase 4 - API Endpoints (Completed)
- GET /api/projects
- GET /api/projects/:id
- PATCH /api/projects/:id/override
- PATCH /api/projects/:id/metadata
- POST /api/refresh
- POST /api/o1/export (gated by FEATURE_O1)

Deliverables:
- End-to-end refresh and edit workflow
- O-1 endpoints return 404 or gated response when disabled

## ✅ Phase 5 - UI (Completed)
- Dashboard layout and filters
- Project detail drawer with editable fields
- Workflow views: Next Actions, Publish Queue, Stalled
- O-1 Evidence tab gated by FEATURE_O1

Deliverables:
- Manual edits persist across refresh
- Filter and search work

## ✅ Phase 6 - O-1 Export (Gated, Completed)
- Markdown + JSON export generator
- UI action to export

Deliverables:
- Export works only when FEATURE_O1 is true

## ✅ Phase 7 - Docs and OSS (Completed)
- README with setup and flags
- config.example.json
- Sample data instructions

Deliverables:
- Clear OSS setup instructions
- No private paths in sample data

## ✅ Phase 8 - Refresh Observability (Completed)
- Stream refresh progress to the UI (SSE or equivalent)
- Per-project step tracking (scan/derive/llm) with success/failure
- Live progress panel in the UI
- End-of-run summary (projects scanned, LLM success/fail, duration)
- Persist last run metadata for audit/debug (optional table or Activity aggregation)

Deliverables:
- Refresh button shows live progress with per-project status
- LLM failures are visible without checking server logs
- UI updates incrementally (no “black box” refresh)

## ✅ Phase 9 - Quick Actions (Completed)
- Add header buttons for quick actions:
  - Open in VS Code (uses vscode://file/<path>)
  - Copy "claude" command for project folder
  - Copy "codex" command for project folder
- Only show quick actions when SANITIZE_PATHS=false (avoid leaking paths in OSS mode)
- Add tooltip text: VS Code button behavior depends on user VS Code window settings

Deliverables:
- One-click VS Code link for the selected project
- Copy-to-clipboard buttons for Claude/Codex commands
- Buttons are hidden/disabled when paths are sanitized

## ✅ Phase 10 - Soft Prune Missing Projects (Completed)
- On refresh, mark projects missing from the latest scan as pruned (soft delete)
- Add `prunedAt` timestamp on Project (nullable) and hide pruned projects by default
- If a pruned project reappears in a future scan, auto-restore (clear prunedAt)
- Behavior should be safe and deterministic (only mark absent pathHash values after a successful scan)

Deliverables:
- Deleted/renamed/missing repos disappear from the UI after refresh
- Manual overrides/metadata are preserved (no data loss on temporary removal)
- Projects auto-restore when the pathHash returns

---

## ✅ Phase 11 - Enhanced Scan Pipeline (Backend)
Expand scan.py to collect the data developers actually need for daily work.

- [x] **Git working tree status**: Run `git status --porcelain` to detect dirty/clean state
  - New fields: `isDirty: bool`, `untrackedCount: int`, `modifiedCount: int`, `stagedCount: int`
- [x] **Git remote sync**: Run `git rev-list --count` to detect ahead/behind origin
  - New fields: `ahead: int`, `behind: int` (0/0 if no remote or fetch fails)
- [x] **Recent commit history**: Run `git log -10 --format="%H|%aI|%s"`
  - New field: `recentCommits: [{hash, date, message}]`
- [x] **Branch count**: Run `git branch --list | wc -l`
  - New field: `branchCount: int`
- [x] **Stash count**: Run `git stash list | wc -l`
  - New field: `stashCount: int`
- [x] **Framework detection**: Parse package.json dependencies, Cargo.toml deps, pyproject.toml deps
  - New field: `framework: string | null` (e.g., "nextjs", "fastapi", "axum", "express", "django")
  - Detection map: next→nextjs, react→react, vue→vue, express→express, fastapi→fastapi, axum→axum, actix→actix, django→django, flask→flask, etc.
- [x] **Package.json scripts**: Extract available npm/pnpm scripts
  - New field: `scripts: string[]` (e.g., ["dev", "build", "test", "lint"])
- [x] **External service detection**: Scan dependency lists + .env key names (keys only, never values)
  - New field: `services: string[]` (e.g., ["supabase", "posthog", "stripe", "firebase", "aws"])
  - Check deps for: @supabase/supabase-js, posthog-js, stripe, firebase, @aws-sdk/*
  - Check .env keys for: SUPABASE_, POSTHOG_, STRIPE_, FIREBASE_, AWS_
- [x] **LOC estimation**: Piggyback on existing TODO/FIXME file walk
  - New field: `locEstimate: int` (total lines across source files)
- [x] **Lockfile / package manager detection**: Check for lockfiles
  - New field: `packageManager: string | null` ("npm", "pnpm", "yarn", "bun", "cargo", "uv", "poetry")
- [x] **License detection**: Check for LICENSE/LICENSE.md
  - New field: `license: bool`

Deliverables:
- scan.py outputs 11 new fields per project
- Existing fields unchanged (backward compatible)
- Total scan time increase: < 0.5s per project
- No secrets leaked (only .env key prefixes, never values)

## ✅ Phase 12 - Schema Evolution & Derive v2 (Backend)
Update the data model and derivation rules to support the new data and fix existing issues.

**Schema changes (prisma/schema.prisma):**
- [x] Add to Project: `pinned Boolean @default(false)`, `lastTouchedAt DateTime?`
- [x] Add to Derived: promote frequently-queried fields from rawJson to real columns:
  - `isDirty Boolean @default(false)`
  - `ahead Int @default(0)`
  - `behind Int @default(0)`
  - `framework String?`
  - `branchName String?`
  - `lastCommitDate DateTime?`
  - `locEstimate Int @default(0)`
- [x] Add index on Activity: `@@index([projectId, createdAt])`
- [x] Remove dead fields: `Override.manualJson`, `Llm.takeawaysJson` (verify unused first)
- [x] Run Prisma migration

**Derive v2 (derive.py):**
- [x] Rename status "in-progress" → "paused" (15-60 days inactive is not "in progress")
  - Update STATUS_COLORS in types.ts to match
- [x] Gradient health scoring instead of binary:
  - Recent commits: +20 if ≤7d, +15 if ≤14d, +10 if ≤30d, +5 if ≤60d, +0 otherwise
  - Tests: +20 base, consider weighting by test directory depth
  - Add: linter config (+5 for .eslintrc, ruff.toml, rustfmt.toml, etc.)
  - Add: license present (+5)
  - Add: lockfile present (+5) — signals reproducible builds
  - New max: 110 → normalize to 100
- [x] Framework-based tags: "nextjs", "fastapi", "axum", etc. (from scan's new `framework` field)
- [x] Service-based tags: "supabase", "posthog", "stripe", etc. (from scan's new `services` field)
- [x] Remove fragile name-based type inference (my-app → "web" is unreliable)

Deliverables:
- Migration runs cleanly on existing dev.db
- Existing data preserved (no destructive changes)
- "paused" status label replaces "in-progress" everywhere
- Health scores may shift slightly — expected and documented

## ✅ Phase 13 - Compact List View (Frontend)
Replace the card grid with a dense, scannable list inspired by Linear/Raycast.

- [x] New component: `project-list.tsx` — single-column list, ~40px per row
  - Row layout: `[status dot] [name] [framework badge] [health] [days inactive] [last commit msg] [quick actions]`
  - Status: colored dot (emerald/blue/amber/zinc) — not a full badge
  - Name: bold, primary text, truncated
  - Framework: small muted badge (e.g., "Next.js") or primary language if no framework
  - Health: colored number (green ≥70, amber ≥40, red <40)
  - Days inactive: relative ("0d", "3d", "142d") — the key temporal signal
  - Last commit: truncated message, muted text
  - Quick actions: icon-only buttons (VS Code, Claude, Codex) — compact
- [x] Row click opens the project drawer (same as card click)
- [x] Row hover: subtle highlight, show full project path as tooltip
- [x] Selected row: highlighted background, drawer open
- [x] Responsive: on narrow screens, collapse framework + last commit columns
- [x] Remove `project-card.tsx` or keep as optional view toggle (stretch goal)
- [x] Update `page.tsx`: replace grid with list, preserve search bar and filter tabs
- [x] Stats bar remains above the list (unchanged)

Deliverables:
- 25+ projects visible without scrolling (vs ~6-9 with cards)
- Every row shows temporal context (days inactive + last commit)
- Click-to-drawer still works
- Quick actions still accessible on each row

## ✅ Phase 14 - Sort, Filter & Recently Active (Frontend)
Make the dashboard answer "what was I working on?" instantly.

- [x] **Sort dropdown** next to search input:
  - Options: "Last Commit" (default, desc), "Name" (asc), "Health" (asc), "Status", "Days Inactive" (asc)
  - Implement as `useMemo` sort over filtered projects array
  - Persist selection in localStorage
- [x] **"Recently Active" section** above the main list:
  - Show top 3-5 projects sorted by `lastCommitDate` desc, filtered to `status !== "archived"`
  - Visually distinct: slightly larger rows, subtle background, "Recently Active" header
  - Collapsed/hidden when 0 qualifying projects
- [x] **Improved filter tabs** — replace current workflow views:
  - "All" — all projects (keep)
  - "Active" — status === "active" or "paused" (renamed from in-progress)
  - "Needs Attention" — health < 40, or daysInactive > 30 with no nextAction, or isDirty with daysInactive > 7
  - "Stale" — status === "stale" (not conflated with archived)
  - "Archived" — status === "archived" (separate tab)
- [x] **"Last refreshed" timestamp** in the header area (from last scan metadata)
- [x] Update `WorkflowView` type to match new tabs

Deliverables:
- Default view sorted by last commit (most recent first)
- "Recently Active" section immediately answers "what was I working on?"
- "Needs Attention" surfaces projects that need work without manual tagging
- Sort preference persists across page reloads

## ✅ Phase 15 - Drawer Redesign (Frontend)
Flatten the drawer so developers get immediate clarity without tab-switching.

- [x] **Remove the 4-tab structure** (Overview / Edit / Scan / Evidence)
- [x] **Section 1: "At a Glance"** (always visible, top of drawer)
  - Status badge + Health score (large, prominent)
  - Branch name + Days inactive + Last commit date (temporal row)
  - Last commit message (monospace, full width)
  - Git status indicators: isDirty badge, ahead/behind counts (from Phase 11 data)
  - Next Action (if set, highlighted — this is the most actionable field)
  - Notes (inline editable, for quick session notes)
  - Quick actions row (VS Code, Claude, Codex, Terminal)
- [x] **Section 2: "Recent Activity"** (collapsible, default open)
  - Recent commits timeline (last 10): date + message, compact list
  - Activity log from Activity model (last 10 events): "scanned 2d ago", "override updated 5d ago"
- [x] **Section 3: "Details"** (collapsible, default collapsed)
  - Purpose + Tags (inline editable)
  - Framework + Languages (all detected)
  - Available scripts (from package.json)
  - External services detected
  - Files / CI-CD / Deploy badges
  - LOC estimate
  - LLM recommendations + notable features
- [x] **Section 4: "Workflow"** (collapsible, default collapsed)
  - Goal, Audience, Success Metrics, Publish Target (all inline editable)
  - Evidence + Outcomes (if FEATURE_O1 enabled)
  - Export Evidence button
- [x] **All fields inline-editable** — remove the separate Edit tab entirely
  - Click field → edit mode → blur/Enter to save → PATCH API → refetch
  - Use existing EditableField pattern from current drawer

Deliverables:
- Zero tab clicks to see the most important information
- Last commit + branch + git status visible immediately
- Notes editable without navigating to a different tab
- Recent commits provide context for "what was I doing?"

## ✅ Phase 16 - API & Merge Updates (Backend)
Wire the new scan data through the merge layer and API responses.

- [x] **Update merge.ts**: Surface new fields from Scan and Derived
  - `isDirty`, `ahead`, `behind` from Derived (promoted columns)
  - `recentCommits`, `scripts`, `services`, `framework`, `packageManager`, `locEstimate`, `branchCount`, `stashCount` from Scan.rawJson
  - `pinned`, `lastTouchedAt` from Project
- [x] **Update types.ts**: Add new fields to Project and RawScan interfaces
- [x] **Update GET /api/projects**: Accept optional query params
  - `sort`: "lastCommit" | "name" | "health" | "status" | "daysInactive"
  - `order`: "asc" | "desc"
  - `filter`: "all" | "active" | "needsAttention" | "stale" | "archived"
  - (Frontend can also sort/filter client-side; server-side is optional optimization)
- [x] **Update pipeline.ts**: Populate promoted Derived columns during store phase
  - Extract isDirty, ahead, behind, framework, branchName, lastCommitDate, locEstimate from scan JSON
  - Write to Derived model alongside existing statusAuto/healthScoreAuto
- [x] **Update pipeline.ts**: Set `Project.lastTouchedAt` on each scan
- [x] **Add response metadata**: Include `lastRefreshedAt` timestamp in GET /api/projects response

Deliverables:
- All new scan fields accessible via the API
- Frontend can render new data without additional API calls
- Sort/filter available server-side for future scalability
- lastRefreshedAt available for the header display

## ✅ Phase 17 - Enhanced Quick Actions (Frontend)
Make it effortless to go from dashboard to working on a project.

- [x] **Terminal action**: Open Terminal.app / iTerm2 at project path
  - macOS: `open -a Terminal <path>` or `osascript` for iTerm2
  - Add as 4th quick action button (terminal icon)
- [x] **"Open in browser" action**: When deployment config detected (fly.toml, vercel.json, netlify.toml)
  - Attempt to derive URL from config or scan data
  - Show globe icon, only when applicable
- [x] **Keyboard shortcuts** when a project row is selected/focused:
  - `v` — Open in VS Code
  - `c` — Open Claude CLI
  - `x` — Open Codex CLI
  - `t` — Open Terminal
  - `Enter` — Toggle drawer
  - `j/k` or arrow keys — Navigate list
  - `Esc` — Close drawer
- [x] **Direct launch for Claude/Codex** instead of clipboard:
  - macOS: Use `osascript` to open Terminal and run command
  - Fallback: clipboard copy with toast (current behavior)
- [x] Add keyboard shortcut hints to quick action tooltips

Deliverables:
- 4+ quick action buttons per project
- Keyboard-driven navigation for power users
- Direct terminal launch instead of clipboard copy
- Shortcuts discoverable via tooltips

## ✅ Phase 18 - Project Pinning & Favorites (Full-Stack)
Let developers mark their focus projects explicitly.

- [x] **Backend**: `pinned` field already added in Phase 12 schema
  - New endpoint: `PATCH /api/projects/:id/pin` — toggles pinned boolean
  - Or: add `pinned` to existing override PATCH endpoint
  - Log Activity event on pin/unpin
- [x] **Frontend**: Pin/unpin toggle
  - Pin icon on each list row (star or pin icon, filled when pinned)
  - Click to toggle, immediate PATCH + refetch
- [x] **Pinned section** at the top of the dashboard:
  - Above "Recently Active" section
  - "Pinned" header, same row format as main list
  - Pinned projects excluded from the main list to avoid duplication
  - Empty state: no section shown (zero friction for non-users)
- [x] **Pinned sort**: Within the pinned section, sort by last commit date

Deliverables:
- One-click pin/unpin from any project row
- Pinned projects always visible at the top
- Pinned state persists across refreshes (stored in DB)

## ✅ Phase 19 - Pipeline Optimizations (Backend)
Make refresh fast enough for daily use without skipping LLM.

- [x] **Skip LLM for unchanged projects**:
  - Hash the rawJson on each scan
  - Store hash in Scan model (new field: `rawJsonHash String?`)
  - On refresh: compare new hash to stored hash. If same AND Llm record exists, skip LLM call
  - Emit SSE event: `project_complete { name, step: "llm", detail: "skipped (unchanged)" }`
- [x] **Parallel LLM calls**:
  - Process 3-5 projects concurrently (configurable via `LLM_CONCURRENCY` env var)
  - Use `Promise.allSettled` in batches within pipeline.ts
  - Respect AbortSignal across all concurrent calls
- [x] **Incremental refresh** (stretch):
  - On scan, detect projects with unchanged `mtime` on `.git/index` or `package.json`
  - Skip full git command suite for unchanged projects
  - Still include in output (use cached scan data)
- [x] **Activity model cleanup**:
  - Add TTL: delete Activity records older than 90 days on each refresh
  - Or: keep max 50 records per project, prune oldest on insert

Deliverables:
- LLM refresh for 30 projects: ~1-2 min (vs ~3-6 min currently) for typical runs
- Unchanged projects skip LLM in < 100ms
- Activity table bounded, no unbounded growth

## ✅ Phase 20 - Session Memory & Activity Timeline (Full-Stack)
Help developers remember what they were doing on each project.

- [x] **Track quick action usage**: When a user clicks VS Code / Claude / Codex / Terminal:
  - Log an Activity event: `{ type: "opened", payloadJson: { tool: "vscode" | "claude" | "codex" | "terminal" } }`
  - Update `Project.lastTouchedAt` to now
- [x] **"Last opened" on list rows**: Show "Opened 2h ago" or "Opened 3d ago" next to days inactive
  - Uses `lastTouchedAt` from Project model
  - Only show if lastTouchedAt exists (no noise for never-opened projects)
- [x] **Activity timeline in drawer** (Section 2 from Phase 15):
  - Query last 20 Activity records for the project
  - Render as compact timeline: icon + type + relative date
  - Types: "Scanned", "LLM enriched", "Override updated", "Metadata updated", "Opened in VS Code", etc.
- [x] **Session notes with timestamps** (stretch):
  - Add timestamped notes model or use Activity with type "note"
  - Show in timeline alongside other activities
  - Quick-add note from the drawer's notes field

Deliverables:
- Dashboard shows which projects you've been actively using (not just git activity)
- Drawer shows a full activity timeline
- lastTouchedAt provides a signal distinct from lastCommitDate

## ✅ Phase 21 - Docs & Architecture Update
Update project documentation to reflect the new architecture and features.

- [x] Update ARCHITECTURE.md:
  - New scan fields and data flow
  - Updated derive rules (status labels, gradient health)
  - New merge priority with promoted columns
  - Agent team development workflow
  - Compact list view architecture
- [x] Update README.md:
  - New features section (list view, sort, filter, pinning, quick actions)
  - New env vars (LLM_CONCURRENCY, etc.)
  - Updated screenshots
  - Keyboard shortcuts reference
- [x] Update PITCH.md:
  - Reposition as "daily starting point" tool
  - Update feature list
- [x] Clean up .env.local.example with new config options

Deliverables:
- All three project documents (PITCH, IMPLEMENTATION_PLAN, ARCHITECTURE) reflect current state
- README has accurate setup and feature docs

## ✅ Phase 22 - Code Review Fixes (Codex Review)
Address findings from Codex code review. See `.claude/codex-review.md` for original review.

**Fixes applied:**
- [x] **Keyboard shortcut sanitization guard**: `v/c/x/t` shortcuts in `page.tsx` now check `config.sanitizePaths` — matching button visibility logic. Prevents path-based actions when `SANITIZE_PATHS=true`.
- [x] **SSE unmount cleanup**: `useRefresh` hook now aborts the EventSource on component unmount via `useEffect` cleanup, preventing connection leaks.
- [x] **Pipeline validation boundary**: Added `validateScanOutput` and `validateDeriveOutput` runtime validators in `pipeline.ts` at the Python→TS boundary. Malformed scan/derive JSON now fails fast with actionable errors instead of silently writing nulls to the DB.
- [x] **Documentation drift**: All phase checklists in phases 11-21 updated from unchecked to checked, matching the top-level status section.

**Deferred (intentionally skipped):**
- Override/metadata API request validation (Codex Task 3): Skipped as low-value for a local-only tool with a co-located UI client. The merge layer already handles missing/null data gracefully.

## ✅ Phase 23 - UX Polish (PM Review)
Address findings from a product manager agent review against PITCH.md. Focused on P0 usability issues.

**Changes applied:**
- [x] **Drawer → centered modal**: Replaced `Sheet` (side panel) with `Dialog` (centered, 90vw, blurred backdrop, two-column layout). Better use of viewport for information density.
- [x] **Next Action inline editing**: Replaced `window.prompt()` with inline `EditableField` inside a highlighted blue card. No browser chrome interrupting the flow.
- [x] **Dirty + ahead indicators in list rows**: Amber dot for uncommitted changes, green `↑N` for unpushed commits — visible in the project list without opening the drawer.
- [x] **Actionable stats bar**: Replaced vanity metrics (Active/Paused/Stale counts) with actionable metrics: Dirty, Unpushed, Needs Attention. Amber highlight when non-zero.
- [x] **Tab counts**: All filter tabs show `(N)` counts so you can triage at a glance.
- [x] **`/` to focus search**: Keyboard shortcut with `(/)` hint in the search placeholder.
- [x] **Scroll-into-view on j/k navigation**: Selected row auto-scrolls into viewport via `scrollIntoView({ block: "nearest" })`.
- [x] **Health display fix**: Changed `%` suffix to `/100` for clarity.

**Deferred (from PM backlog):**
- First-run empty state, keyboard nav focus handling (P1)
- "Recently Active" tab, auto-collapse refresh panel, persist tab to localStorage, pinned section styling (P2)
- Dark mode toggle, delete dead project-card.tsx, extract shared icons/healthColor (P3)

---

## Phases 24-27: Functional UI Polish (Codex Plan)

North star alignment: the product is a **daily starting point**. The UI must optimize for:
1. "What was I working on?"
2. "What needs my attention?"
3. "Open project / set next action in one interaction"

Source: `.claude/codex-review.md`. Ship as 4 independently verifiable chunks.

### Agent Team Strategy (Phases 24-27)

Phase 24 touches only `project-list.tsx`. Phase 26 touches only `project-drawer.tsx`. These are fully independent and can run in parallel — the biggest pieces of work in this batch.

| Wave | Agent 1 | Agent 2 | Notes |
|------|---------|---------|-------|
| **A** | Phase 24 (list alignment — `project-list.tsx`) | Phase 26 (drawer refactor — `project-drawer.tsx`) | Independent files, parallel safe |
| **B** | Phase 25 (lang fallback + scripts fix) | — | Touches both files from Wave A, must follow |
| **C** | Phase 27 (functional polish) | — | Validation pass across all files, always last |

---

## ✅ Phase 24 - Deterministic List Alignment (Frontend)
Fix column drift in the project list so all rows share identical geometry.

**Problem:** List columns are visually misaligned because `auto`-sized grid tracks compute widths per-row. Columns at positions 4 (Lang), 7 (Opened), and 9 (Actions) are the offenders in the current template:
```
grid-cols-[auto_auto_1fr_auto_3rem_3rem_auto_1fr_auto]
```

**Tasks:**
- [x] Refactor `src/components/project-list.tsx` so header and rows use one deterministic layout model with fixed-width columns where content varies
- [x] Replace `auto` tracks with explicit widths for Lang, Opened, and Actions columns
- [x] Ensure alignment invariants:
  - `Health`, `Inactive`, `Opened` right-aligned and tabular-nums
  - `Last Commit` truncates consistently (1fr)
  - Action icons remain fixed-width
- [x] Preserve current density and keyboard/mouse behavior
- [x] Verify alignment in both pinned and unpinned sections
- [x] Verify alignment with `sanitizePaths=true` (no Actions column) and `sanitizePaths=false`

**Files touched:**
- `src/components/project-list.tsx`

**Deliverables:**
- No visible column drift across rows
- Header labels align directly over row values
- Works for both sanitize modes
- No regressions in row selection, pinning, or quick actions

---

## ✅ Phase 25 - Reliable Language/Framework Context (Frontend + Pipeline)
Make the Lang column useful for nearly every project using a deterministic fallback chain.

**Problem:** Lang column only checks `project.scan?.languages?.primary`, which is often `null`. Many rows show `—`.

**Tasks:**
- [x] In `src/components/project-list.tsx`, compute display label with fallback order:
  1. `project.framework`
  2. `project.scan?.languages?.primary`
  3. `project.packageManager`
  4. First item from `project.scan?.languages?.detected`
  5. `—`
- [x] Keep label compact and human-friendly
- [x] Optional: normalize display labels (e.g., `nextjs` → `Next.js`, `pnpm` → `pnpm`)
- [x] **Fix scripts shape mismatch:**
  - Scanner (`pipeline/scan.py:detect_scripts`) emits `scripts` as `list[str]` (script names only)
  - TypeScript types (`src/lib/types.ts`, `src/lib/merge.ts`) updated from `Record<string, string>` to `string[]`
  - Drawer rendering updated to use `scripts.map()` directly instead of `Object.keys(scripts).map()`

**Files touched:**
- `src/components/project-list.tsx`
- `src/lib/types.ts` (scripts type fix)
- `src/lib/merge.ts` (scripts type fix)
- `src/components/project-drawer.tsx` (scripts rendering if type changes)

**Deliverables:**
- Rows that previously showed `—` now usually show useful context
- No type inconsistencies for scripts across scan → merge → UI
- No crashes or odd rendering for projects with sparse scan data

---

## ✅ Phase 26 - Drawer IA Refactor (Single-Column, Action-First) (Frontend)
Restructure the project modal for fast triage, fast launch, fast next-step editing.

**Problem:** Current two-column layout hides workflow/details behind collapsed sections and over-weights activity. The right column starts with "Recent Activity" (default open), pushing Details and Workflow into collapsed sections below the fold.

**Tasks:**
- [x] Refactor `src/components/project-drawer.tsx` from two-column (`grid-cols-1 md:grid-cols-2`) to single-column long-form layout
- [x] Keep top summary block always visible:
  - Status control, health score, dirty/ahead/behind badges, branch/framework, quick actions
- [x] Reorder sections:
  1. **Now** (default open): Next Action + Notes — the most actionable fields
  2. **Recent Work** (default open): commits + activity timeline
  3. **Details** (default closed): purpose, tags, framework, languages, scripts, services, files, CI/CD, deploy, LOC, recommendations
  4. **Workflow/O-1** (default closed): goal, audience, success metrics, publish target, evidence, export
- [x] Preserve all existing editable fields and API calls (`onUpdateOverride`, `onUpdateMetadata`)
- [x] Maintain compact visual density — avoid excessive whitespace
- [x] Ensure modal scroll works correctly with the longer single-column layout (header + close affordance always accessible)

**Files touched:**
- `src/components/project-drawer.tsx`

**Deliverables:**
- User can see and edit Next Action without opening additional sections
- High-value context visible on first open without scrolling far
- No data loss or regression for metadata/override editing
- All existing fields and APIs preserved

---

## ✅ Phase 27 - Functional Polish & Interaction Consistency (Frontend)
Eliminate friction in day-to-day usage while keeping current behavior intact.

**Tasks:**
- [x] Ensure quick-action feedback parity: keyboard shortcuts (`v/c/x/t`) and click paths both provide clear success/failure cues (toast notifications)
  - Added `toast` import to `page.tsx`, keyboard shortcuts now show success/error toasts matching click behavior
- [x] Validate drawer/modal scroll behavior after Phase 26 layout change:
  - Header and close affordance remain reliable (DialogHeader `shrink-0`, body `flex-1 overflow-y-auto`)
  - Long content scrolls within the modal body (`max-h-[85vh]`)
- [x] Verify keyboard navigation works correctly with pinned + unpinned sections:
  - `j/k` traverses across pinned → unpinned seamlessly via `[...pinnedProjects, ...unpinnedProjects]`
  - Selection highlighting consistent in both sections
- [x] Keep sanitize-path behavior consistent across list + drawer quick actions:
  - Added `sanitizePaths` prop to `ProjectDrawerProps`, passed from `page.tsx`
  - Drawer quick actions now hidden when `sanitizePaths=true`, matching list behavior
- [x] Verify no hidden or ambiguous state after user actions (status change, pin toggle, notes edit, etc.)
  - All five handler paths intact after Phase 26 refactor

**Files touched:**
- `src/app/page.tsx` (keyboard handling)
- `src/components/project-list.tsx` (feedback parity)
- `src/components/project-drawer.tsx` (scroll, sanitize consistency)

**Deliverables:**
- No hidden/ambiguous state after user actions
- Keyboard-first workflow remains fast and predictable
- All existing acceptance criteria from Phases 11-21 still pass

---

## ✅ Phase 28 - Modal Layout Refinement (Frontend)
Polish the project modal for scannability and visual rhythm.

**Motivation:** After Phases 24-27, the drawer content is correct but the interaction model (collapsible sections) adds friction for a daily-use tool. Scrolling is faster than clicking to reveal. Sections need visual delineation without heaviness.

**Tasks:**
- [x] **Remove collapsible sections**: Replaced `Section` component with `SectionBox` — always-visible, no expand/collapse. Removed `ChevronIcon` and `Separator` import (no longer needed).
- [x] **Bordered section containers**: Each section wrapped in `border border-border rounded-lg p-4` with uppercase title header. Clean bordered boxes for visual rhythm.
- [x] **5 sections** (all always-visible, stacked vertically):
  1. **Now**: Next Action + Notes
  2. **Recent Work**: commits + activity timeline
  3. **Details**: purpose, tags, framework, languages, scripts, services, files, CI/CD, deploy, LOC, code markers, notable features, recommendations, scan timestamp
  4. **Workflow**: goal, audience, success metrics, publish target
  5. **O-1 Evidence** (gated by `featureO1`): evidence data + outcomes data
- [x] **Font size nudge**: Promoted `text-xs` → `text-sm` for: last commit message (top summary), commit entries, activity entries, fallback commit text, evidence/outcomes "no data" text. Labels and metadata kept at smaller sizes.
- [x] **Remove Export Evidence button** from the drawer: Removed `onExport` prop from `ProjectDrawerProps` and drawer destructuring. Removed `onExport={handleExport}` from `<ProjectDrawer>` in `page.tsx`. "Export All" header button unaffected.
- [x] All existing editable fields and API calls preserved
- [x] Modal scroll works with all sections always visible (`space-y-4` gap between bordered sections)

**Files touched:**
- `src/components/project-drawer.tsx` (layout, Section component, font sizes, remove export button)
- `src/app/page.tsx` (can remove `onExport` prop from `<ProjectDrawer>` if no longer needed)

**Deliverables:**
- All 5 sections always visible — no expand/collapse interaction
- Each section visually delineated with clean borders
- Font sizes slightly larger for improved readability
- No Export Evidence button in the drawer
- No data loss or regression for editable fields
- Modal scrolls smoothly with all content visible

---

## ⬜ Phase 29 - Drawer UX Overhaul (Full-Stack)

Major restructure of the project modal: remove human-input fields, add LLM intelligence tracing, consolidate sections, and add new data fields. Philosophy shift: the dashboard requires no human text input except status selection — it's either deterministic Python scan or LLM-generated intelligence.

### Agent Team Strategy (Phase 29)

**Pre-step (leader):** Quick edit to `src/lib/types.ts` — add 3 new fields (`pitch`, `liveUrl`, `llmGeneratedAt`) to the `Project` interface. This establishes the contract both agents work against.

| Wave | Agent 1 (data-layer) | Agent 2 (drawer-rewrite) | Notes |
|------|---------------------|--------------------------|-------|
| **A** | Schema, scan.py, merge.ts, LLM prompt, pipeline.ts | project-drawer.tsx (full rewrite) | Parallel — completely different files |
| **B** | — | — | Leader: page.tsx cleanup, hooks cleanup, migration, QA |

**Parallelization rationale:** The data-layer agent touches backend files (`prisma/`, `pipeline/`, `src/lib/`). The drawer agent touches only `src/components/project-drawer.tsx`. Zero file overlap = safe parallel execution.

---

### Step 1: Data Layer Changes (data-layer agent)

**1a. Prisma Schema** (`prisma/schema.prisma`):
- [ ] Add `pitch String?` to the `Llm` model (alongside existing `purpose`, `tagsJson`, etc.)

**1b. Scan Pipeline** (`pipeline/scan.py`):
- [ ] Extract `homepage` from `package.json` (the `homepage` field) as `liveUrl: string | null`
- [ ] Fallback: check for `CNAME` file in project root

**1c. LLM Prompt & Provider** (`src/lib/llm/prompt.ts`, `src/lib/llm/provider.ts`):
- [ ] Add `pitch` to `LlmEnrichment` interface: `pitch?: string` — "1-2 sentence product pitch as if selling to the world"
- [ ] Add `"pitch"` field to `SYSTEM_PROMPT` and `buildPrompt()` output schema
- [ ] Add `pitch` parsing to `parseEnrichment()` with safe fallback
- [ ] Keep `pitch` in the always-generated section (not gated by FEATURE_O1)

**1d. Pipeline Storage** (`src/lib/pipeline.ts`):
- [ ] Store `enrichment.pitch` in `db.llm.upsert()` (both create and update paths)

**1e. Merge Layer** (`src/lib/merge.ts`):
- [ ] Add `pitch: string | null` to `MergedProject` — sourced from `llm.pitch`
- [ ] Add `liveUrl: string | null` to `MergedProject` — sourced from `rawScan.liveUrl`
- [ ] Add `llmGeneratedAt: string | null` to `MergedProject` — sourced from `llm.generatedAt`
- [ ] Surface `scanTimestamp` (already exists as `lastScanned` — no change needed)
- [ ] Add `llm.pitch` and `llm.generatedAt` to the `ProjectWithRelations` type

**1f. Client Types** (`src/lib/types.ts`):
- [ ] Add `pitch: string | null`, `liveUrl: string | null`, `llmGeneratedAt: string | null` to `Project` interface
- [ ] Add `liveUrl: string | null` to `RawScan` interface

---

### Step 2: Drawer Component Rewrite (drawer-rewrite agent)

Full rewrite of `src/components/project-drawer.tsx`. Target ~350-400 LOC (down from current ~720).

**2a. Header Consolidation:**
- [ ] Single-line layout: `[StatusSelect] [Score/100] [dirty] [↑ahead] [↓behind] [branch] [framework]` LEFT — `[VSCode] [Claude] [Codex] [Terminal] Copy path` RIGHT
- [ ] Name + pin icon in DialogTitle (keep current)
- [ ] Path subtitle (keep current)
- [ ] Last commit message block below the header row (keep current `bg-muted/50` style)
- [ ] Remove the separate temporal row ("0d inactive", "Last commit today", status badge) — this info is redundant with the header badges

**2b. Remove All Human-Input UI:**
- [ ] Delete `EditableField` component entirely (~70 LOC)
- [ ] Delete all EditableField usages: Notes, Purpose, Tags, Goal, Audience, Success Metrics, Publish Target, Next Action
- [ ] Keep `StatusSelect` — the only user-editable control
- [ ] Remove `onUpdateMetadata` from `ProjectDrawerProps`
- [ ] Simplify `onUpdateOverride` to only handle status changes (remove notes, purpose, tags override capabilities from the drawer)

**2c. Section 1 — RECOMMENDATIONS (replaces "Now"):**
- [ ] Show `project.recommendations` as a bulleted read-only list
- [ ] Source trace label: `llm · {relative timestamp from llmGeneratedAt}`
- [ ] Fallback: "Run LLM enrichment to generate recommendations." (muted italic)

**2d. Section 2 — TIMELINE (replaces "Recent Work"):**
- [ ] Merge git commits and activity log into a single chronological feed
- [ ] Each entry gets a type label: `git`, `scan`, `llm`, `user`, `pin`
  - Git commits: type="git", description=commit message, date=commit date
  - Activity entries: type derived from entry.type ("scan"→"scan", "llm"→"llm", "opened"→"user", "pin"→"pin", etc.)
- [ ] Sort all entries by date descending
- [ ] Cap at 15-20 entries total
- [ ] Remove the separate "Activity Log" sub-section (it's now unified)
- [ ] Each row: `[type label badge] [description] [relative date]`

**2e. Section 3 — DETAILS (restructured):**
- [ ] **Remove:** tags, purpose (editable), scripts, files grid, code markers (TODOs/FIXMEs)
- [ ] **Keep/restructure as key-value pairs:**
  - Frameworks (from `project.framework`, can be list if multiple detected)
  - Languages (from `scan.languages.detected`, badges)
  - Services (from `project.services`, badges)
  - CI/CD (from `scan.cicd`, list active entries)
  - Deploy (from `scan.deployment`, list active entries)
  - Live URL (from `project.liveUrl`, clickable link if available)
  - Lines of Code (from `project.locEstimate`, formatted number)
  - Features (from `project.notableFeatures`, bulleted list)
- [ ] Source trace label: `scan · {relative timestamp from lastScanned}`
- [ ] Keep "N commits" footer stat

**2f. Section 4 — PITCH (replaces "Workflow"):**
- [ ] Display `project.pitch` as a single paragraph of LLM-generated text
- [ ] Source trace label: `llm · {relative timestamp from llmGeneratedAt}`
- [ ] Fallback: "Run LLM enrichment to generate pitch." (muted italic)
- [ ] Remove all Workflow fields: Goal, Audience, Success Metrics, Publish Target

**2g. Section 5 — O-1 EVIDENCE (unchanged):**
- [ ] Keep existing O-1 Evidence section as-is, gated by `featureO1`
- [ ] No structural changes

**2h. Source Trace Labels:**
- [ ] Each `SectionBox` gains an optional `source` prop: `{ type: "scan" | "llm"; timestamp: string | null }`
- [ ] Renders as right-aligned `text-[10px] text-muted-foreground` in the section header: e.g., `scan · 2h ago`
- [ ] Recommendations, Pitch: `llm` source
- [ ] Details: `scan` source
- [ ] Timeline, O-1 Evidence: no source label (mixed sources / self-evident)

---

### Step 3: Parent Cleanup (leader, Wave B)

**3a. Page cleanup** (`src/app/page.tsx`):
- [ ] Remove `onUpdateMetadata` prop from `<ProjectDrawer>` usage
- [ ] Keep `onUpdateOverride` (still needed for StatusSelect)
- [ ] Remove `updateMetadata` from destructured `useProjects()` if unused elsewhere
- [ ] Verify `needsAttention` filter still works (it referenced `nextAction` — update if needed)

**3b. Hook cleanup** (`src/hooks/use-projects.ts`):
- [ ] Keep `updateMetadata` function (API routes still exist, may be used by pipeline)
- [ ] No functional changes needed

**3c. Migration:**
- [ ] Run `npx prisma migrate dev --name add-llm-pitch` after schema change
- [ ] Verify migration applies cleanly on existing dev.db

**3d. Visual QA:**
- [ ] Build succeeds with no TypeScript errors
- [ ] Modal opens with consolidated header (single line, actions right-aligned)
- [ ] No EditableField visible anywhere in the modal
- [ ] Recommendations section shows LLM data (or fallback if no LLM run)
- [ ] Timeline shows merged git + activity entries with type labels
- [ ] Details shows correct fields (no tags, scripts, TODOs)
- [ ] Pitch section shows LLM text (or fallback)
- [ ] O-1 Evidence renders correctly when `featureO1=true`
- [ ] Source trace labels appear on Recommendations, Details, Pitch sections
- [ ] StatusSelect still works (only remaining user input)
- [ ] Quick actions still work in header
- [ ] Keyboard shortcuts unaffected
- [ ] No console errors

---

### Files Touched (Complete)

| File | Agent | Change |
|------|-------|--------|
| `prisma/schema.prisma` | data-layer | Add `pitch` to Llm model |
| `pipeline/scan.py` | data-layer | Extract `liveUrl` from package.json homepage |
| `src/lib/llm/provider.ts` | data-layer | Add `pitch` to LlmEnrichment |
| `src/lib/llm/prompt.ts` | data-layer | Add `pitch` to prompt + parseEnrichment |
| `src/lib/pipeline.ts` | data-layer | Store `pitch` in LLM upsert |
| `src/lib/merge.ts` | data-layer | Surface `pitch`, `liveUrl`, `llmGeneratedAt` |
| `src/lib/types.ts` | leader (pre-step) + data-layer | Add new fields to Project/RawScan |
| `src/components/project-drawer.tsx` | drawer-rewrite | Full rewrite (~350-400 LOC target) |
| `src/app/page.tsx` | leader (Wave B) | Remove unused drawer props |
| `src/hooks/use-projects.ts` | leader (Wave B) | Minor cleanup if needed |

### What Gets Removed

| Removed | Reason |
|---------|--------|
| `EditableField` component (~70 LOC) | No human text input in the dashboard |
| Notes field (override.notesOverride display) | Human input deprecated |
| "Now" section (NextAction + Notes) | Replaced by Recommendations |
| "Workflow" section (Goal, Audience, SuccessMetrics, PublishTarget) | Replaced by Pitch |
| Tags display + editing | Cluttered, not useful for daily use |
| Purpose editing | Purpose still computed by LLM, just not editable |
| Scripts display | Low-value detail |
| Files grid (readme, tests, env, etc.) | Low-value detail |
| Code markers (TODOs/FIXMEs) | Low-value detail |
| Separate "Activity Log" sub-section | Merged into unified Timeline |
| `onUpdateMetadata` drawer prop | No metadata editing from UI |
| Temporal row (days inactive, last commit date, status badge) | Redundant with header badges |

### What Gets Added

| Added | Source |
|-------|--------|
| `pitch` LLM field | New Prisma column + LLM prompt |
| `liveUrl` scan field | package.json `homepage` extraction |
| `llmGeneratedAt` timestamp | Existing Llm.generatedAt, now surfaced |
| Source trace labels on sections | UI only — `scan · 2h ago` / `llm · 3h ago` |
| Unified Timeline (git + activity) | Merge two existing data sources client-side |
| Consolidated header (actions right-aligned) | UI restructure |

### Deliverables
- Modal is purely read-only except for StatusSelect dropdown
- Every section shows its data source (scan or llm) with freshness timestamp
- Unified timeline replaces two separate sections
- LLM-generated pitch replaces manual workflow fields
- Net LOC reduction: ~200-300 lines removed from drawer
- No regressions in list view, keyboard shortcuts, or quick actions

---

## ⬜ Phase 30 - Scan Deltas & Change Indicators (Frontend)

Show what changed after each scan/enrich — deltas on stats, highlights on enriched fields. Entirely client-side, no backend changes.

**Motivation:** After running a scan or enrich, users have no visual feedback about what actually changed. Showing deltas turns the refresh from a "black box reload" into an informative event.

### Approach: Client-Side Diffing

Store a pre-refresh snapshot of the projects array in a `useRef`. After refresh completes and data is refetched, diff the new array against the snapshot. Deltas are ephemeral — they persist until the next refresh or page reload.

### Step 1: Snapshot & Diff Infrastructure

**1a. Snapshot hook** (`src/hooks/use-refresh-deltas.ts` — new file):
- [ ] `useRefreshDeltas(projects: Project[])` hook
- [ ] Exposes `snapshot()` — called before refresh starts, saves current projects to a ref
- [ ] Exposes `deltas` — computed after projects change, comparing new vs snapshot
- [ ] Returns `null` when no snapshot exists (no refresh has happened yet)

**1b. Delta shape:**
```typescript
interface DashboardDeltas {
  // Aggregate stat deltas (for stats bar)
  totalCount: number;       // change in total project count
  dirtyCount: number;       // change in dirty project count
  unpushedCount: number;    // change in unpushed project count
  needsAttention: number;   // change in needs-attention count
  avgHealth: number;        // change in average health score

  // Per-project deltas (for list rows and drawer)
  projects: Map<string, ProjectDelta>;
}

interface ProjectDelta {
  healthScore: number;      // numeric change (e.g., +4, -2, 0)
  statusChanged: boolean;   // status flipped
  newlyEnriched: boolean;   // llmGeneratedAt is newer than snapshot
  fieldsChanged: string[];  // list of changed field names for drawer highlights
}
```

### Step 2: Stats Bar Deltas

- [ ] Update `src/components/stats-bar.tsx` to accept optional `deltas: DashboardDeltas | null`
- [ ] For each stat, show a delta indicator when non-zero:
  - Green `↑N` or `↓N` when the change is an improvement (fewer dirty = green, higher health = green)
  - Red `↑N` or `↓N` when the change is a regression
  - No indicator when unchanged
- [ ] Style: `text-[10px] font-medium` inline next to the stat value
- [ ] Deltas disappear when `deltas` is null (before first refresh)

### Step 3: Drawer "Just Enriched" Glow

- [ ] In `src/components/project-drawer.tsx`, accept optional `delta: ProjectDelta | null`
- [ ] **Health score delta**: Show `↑4` or `↓2` next to the score in the header, colored green/red
- [ ] **Section highlights**: When `newlyEnriched` is true, add a subtle left-border accent to sections with LLM-sourced data:
  - Recommendations: `border-l-2 border-amber-400` (or similar warm accent)
  - Pitch: same treatment
  - These indicate "this content was just updated by AI"
- [ ] Highlight clears on next refresh (ephemeral by design)

### Step 4: Wire Into Page

- [ ] In `src/app/page.tsx`:
  - Call `snapshot()` before starting either refresh mode
  - Pass `deltas` to `<StatsBar>`
  - Pass per-project delta to `<ProjectDrawer>`
- [ ] Ensure deltas reset correctly when a new refresh starts

---

### Files Touched

| File | Change |
|------|--------|
| `src/hooks/use-refresh-deltas.ts` | **New** — snapshot + diff hook |
| `src/components/stats-bar.tsx` | Accept and display aggregate deltas |
| `src/components/project-drawer.tsx` | Accept delta, show health delta + enrichment glow |
| `src/app/page.tsx` | Wire snapshot/deltas through to components |

### Deliverables
- After scan/enrich, stats bar shows ↑/↓ indicators on all aggregate metrics
- Drawer shows health score delta and highlights freshly AI-enriched sections
- All indicators are ephemeral (client-side only, no persistence)
- Zero backend changes, zero migrations
- No visual noise when no refresh has happened (deltas = null)

---

## Acceptance Criteria (Current)

**Core invariants:**
- Status auto-computed but overridable via StatusSelect; overrides persist across refresh
- Refresh never overwrites overrides
- O-1 Evidence section only appears when `FEATURE_O1=true`
- OSS mode (`SANITIZE_PATHS=true`) does not leak absolute paths — gated in list, drawer, and keyboard shortcuts
- No human text input in the dashboard except status dropdown — all content from scan or LLM

**Dashboard UX:**
- Dashboard answers "what was I working on?" within 5 seconds of opening
- Compact list view shows 25+ projects without scrolling
- Sort by last commit is the default view
- List columns do not drift across rows — deterministic geometry
- Lang column shows useful context for ≥80% of projects (fallback chain)
- Pinned projects always appear at the top
- Git dirty/clean status visible for every project (list rows + drawer badges)
- Keyboard-first workflow: `j/k/v/c/x/t/p/Enter/Esc/` all work as documented

**Drawer (modal):**
- Modal is read-only except for StatusSelect
- Each section displays a source trace label (`scan · Xh ago` or `llm · Xh ago`)
- Drawer sections: Recommendations → Timeline → Details → Pitch → O-1 Evidence
- Timeline merges git commits and app activity into one chronological feed with type labels
- Details shows: frameworks, languages, services, CI/CD, deploy, live URL, LOC, features
- `pitch` field generated by LLM and stored in Llm model
- Header consolidated: status + score + badges LEFT, action icons RIGHT

**Refresh pipeline:**
- Two refresh modes: "Scan" (fast, filesystem-only) and "Enrich with AI" (scan + LLM)
- "Enrich with AI" button only visible when `FEATURE_LLM=true`
- Full enrich completes in < 2 minutes for 30 projects (with skip-unchanged)
- `LLM_FORCE=true` bypasses hash-unchanged skip logic
- Refresh panel is dismissible after completion
- `liveUrl` extracted from package.json `homepage` by scan.py

**Build health:**
- No TypeScript errors, no console errors
- All new fields backward-compatible with existing data

## Checkpoint Reviews
- After Phase 1: data model and merge logic review
- After Phase 2: deterministic pipeline review
- After Phase 4: API surface review
- After Phase 5: UI behavior review
- After Phase 6: O-1 gating review
- After Phase 12: schema migration + derive v2 review
- After Phase 13 + 14: new UI (list view + sort) review
- After Phase 15 + 16: drawer + API integration review
- After Phase 19: pipeline performance review
- After Phase 21: full documentation review
- After Phase 22: Codex code review fixes
- After Phase 24 + 25: list alignment + context column review
- After Phase 26 + 27: drawer IA refactor + functional polish review
- After Phase 29: drawer UX overhaul + data layer review
- After Phase 30: scan deltas + change indicators review
