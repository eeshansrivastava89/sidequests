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

Notes:
- ✅ README setup line fixed (no no-op copy).
- ✅ Pipeline runner spawn timeout handled with manual kill/timeout.
- Phases 0-10 built the foundation (portfolio tracker). Phases 11-21 transform it into a "daily starting point" tool.
- Agent teams will be used for implementation. Backend and frontend phases can run in parallel where noted.

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

## ⬜ Phase 11 - Enhanced Scan Pipeline (Backend)
Expand scan.py to collect the data developers actually need for daily work.

- [ ] **Git working tree status**: Run `git status --porcelain` to detect dirty/clean state
  - New fields: `isDirty: bool`, `untrackedCount: int`, `modifiedCount: int`, `stagedCount: int`
- [ ] **Git remote sync**: Run `git rev-list --count` to detect ahead/behind origin
  - New fields: `ahead: int`, `behind: int` (0/0 if no remote or fetch fails)
- [ ] **Recent commit history**: Run `git log -10 --format="%H|%aI|%s"`
  - New field: `recentCommits: [{hash, date, message}]`
- [ ] **Branch count**: Run `git branch --list | wc -l`
  - New field: `branchCount: int`
- [ ] **Stash count**: Run `git stash list | wc -l`
  - New field: `stashCount: int`
- [ ] **Framework detection**: Parse package.json dependencies, Cargo.toml deps, pyproject.toml deps
  - New field: `framework: string | null` (e.g., "nextjs", "fastapi", "axum", "express", "django")
  - Detection map: next→nextjs, react→react, vue→vue, express→express, fastapi→fastapi, axum→axum, actix→actix, django→django, flask→flask, etc.
- [ ] **Package.json scripts**: Extract available npm/pnpm scripts
  - New field: `scripts: string[]` (e.g., ["dev", "build", "test", "lint"])
- [ ] **External service detection**: Scan dependency lists + .env key names (keys only, never values)
  - New field: `services: string[]` (e.g., ["supabase", "posthog", "stripe", "firebase", "aws"])
  - Check deps for: @supabase/supabase-js, posthog-js, stripe, firebase, @aws-sdk/*
  - Check .env keys for: SUPABASE_, POSTHOG_, STRIPE_, FIREBASE_, AWS_
- [ ] **LOC estimation**: Piggyback on existing TODO/FIXME file walk
  - New field: `locEstimate: int` (total lines across source files)
- [ ] **Lockfile / package manager detection**: Check for lockfiles
  - New field: `packageManager: string | null` ("npm", "pnpm", "yarn", "bun", "cargo", "uv", "poetry")
- [ ] **License detection**: Check for LICENSE/LICENSE.md
  - New field: `license: bool`

Deliverables:
- scan.py outputs 11 new fields per project
- Existing fields unchanged (backward compatible)
- Total scan time increase: < 0.5s per project
- No secrets leaked (only .env key prefixes, never values)

## ⬜ Phase 12 - Schema Evolution & Derive v2 (Backend)
Update the data model and derivation rules to support the new data and fix existing issues.

**Schema changes (prisma/schema.prisma):**
- [ ] Add to Project: `pinned Boolean @default(false)`, `lastTouchedAt DateTime?`
- [ ] Add to Derived: promote frequently-queried fields from rawJson to real columns:
  - `isDirty Boolean @default(false)`
  - `ahead Int @default(0)`
  - `behind Int @default(0)`
  - `framework String?`
  - `branchName String?`
  - `lastCommitDate DateTime?`
  - `locEstimate Int @default(0)`
- [ ] Add index on Activity: `@@index([projectId, createdAt])`
- [ ] Remove dead fields: `Override.manualJson`, `Llm.takeawaysJson` (verify unused first)
- [ ] Run Prisma migration

**Derive v2 (derive.py):**
- [ ] Rename status "in-progress" → "paused" (15-60 days inactive is not "in progress")
  - Update STATUS_COLORS in types.ts to match
- [ ] Gradient health scoring instead of binary:
  - Recent commits: +20 if ≤7d, +15 if ≤14d, +10 if ≤30d, +5 if ≤60d, +0 otherwise
  - Tests: +20 base, consider weighting by test directory depth
  - Add: linter config (+5 for .eslintrc, ruff.toml, rustfmt.toml, etc.)
  - Add: license present (+5)
  - Add: lockfile present (+5) — signals reproducible builds
  - New max: 110 → normalize to 100
- [ ] Framework-based tags: "nextjs", "fastapi", "axum", etc. (from scan's new `framework` field)
- [ ] Service-based tags: "supabase", "posthog", "stripe", etc. (from scan's new `services` field)
- [ ] Remove fragile name-based type inference (my-app → "web" is unreliable)

Deliverables:
- Migration runs cleanly on existing dev.db
- Existing data preserved (no destructive changes)
- "paused" status label replaces "in-progress" everywhere
- Health scores may shift slightly — expected and documented

## ⬜ Phase 13 - Compact List View (Frontend)
Replace the card grid with a dense, scannable list inspired by Linear/Raycast.

- [ ] New component: `project-list.tsx` — single-column list, ~40px per row
  - Row layout: `[status dot] [name] [framework badge] [health] [days inactive] [last commit msg] [quick actions]`
  - Status: colored dot (emerald/blue/amber/zinc) — not a full badge
  - Name: bold, primary text, truncated
  - Framework: small muted badge (e.g., "Next.js") or primary language if no framework
  - Health: colored number (green ≥70, amber ≥40, red <40)
  - Days inactive: relative ("0d", "3d", "142d") — the key temporal signal
  - Last commit: truncated message, muted text
  - Quick actions: icon-only buttons (VS Code, Claude, Codex) — compact
- [ ] Row click opens the project drawer (same as card click)
- [ ] Row hover: subtle highlight, show full project path as tooltip
- [ ] Selected row: highlighted background, drawer open
- [ ] Responsive: on narrow screens, collapse framework + last commit columns
- [ ] Remove `project-card.tsx` or keep as optional view toggle (stretch goal)
- [ ] Update `page.tsx`: replace grid with list, preserve search bar and filter tabs
- [ ] Stats bar remains above the list (unchanged)

Deliverables:
- 25+ projects visible without scrolling (vs ~6-9 with cards)
- Every row shows temporal context (days inactive + last commit)
- Click-to-drawer still works
- Quick actions still accessible on each row

## ⬜ Phase 14 - Sort, Filter & Recently Active (Frontend)
Make the dashboard answer "what was I working on?" instantly.

- [ ] **Sort dropdown** next to search input:
  - Options: "Last Commit" (default, desc), "Name" (asc), "Health" (asc), "Status", "Days Inactive" (asc)
  - Implement as `useMemo` sort over filtered projects array
  - Persist selection in localStorage
- [ ] **"Recently Active" section** above the main list:
  - Show top 3-5 projects sorted by `lastCommitDate` desc, filtered to `status !== "archived"`
  - Visually distinct: slightly larger rows, subtle background, "Recently Active" header
  - Collapsed/hidden when 0 qualifying projects
- [ ] **Improved filter tabs** — replace current workflow views:
  - "All" — all projects (keep)
  - "Active" — status === "active" or "paused" (renamed from in-progress)
  - "Needs Attention" — health < 40, or daysInactive > 30 with no nextAction, or isDirty with daysInactive > 7
  - "Stale" — status === "stale" (not conflated with archived)
  - "Archived" — status === "archived" (separate tab)
- [ ] **"Last refreshed" timestamp** in the header area (from last scan metadata)
- [ ] Update `WorkflowView` type to match new tabs

Deliverables:
- Default view sorted by last commit (most recent first)
- "Recently Active" section immediately answers "what was I working on?"
- "Needs Attention" surfaces projects that need work without manual tagging
- Sort preference persists across page reloads

## ⬜ Phase 15 - Drawer Redesign (Frontend)
Flatten the drawer so developers get immediate clarity without tab-switching.

- [ ] **Remove the 4-tab structure** (Overview / Edit / Scan / Evidence)
- [ ] **Section 1: "At a Glance"** (always visible, top of drawer)
  - Status badge + Health score (large, prominent)
  - Branch name + Days inactive + Last commit date (temporal row)
  - Last commit message (monospace, full width)
  - Git status indicators: isDirty badge, ahead/behind counts (from Phase 11 data)
  - Next Action (if set, highlighted — this is the most actionable field)
  - Notes (inline editable, for quick session notes)
  - Quick actions row (VS Code, Claude, Codex, Terminal)
- [ ] **Section 2: "Recent Activity"** (collapsible, default open)
  - Recent commits timeline (last 10): date + message, compact list
  - Activity log from Activity model (last 10 events): "scanned 2d ago", "override updated 5d ago"
- [ ] **Section 3: "Details"** (collapsible, default collapsed)
  - Purpose + Tags (inline editable)
  - Framework + Languages (all detected)
  - Available scripts (from package.json)
  - External services detected
  - Files / CI-CD / Deploy badges
  - LOC estimate
  - LLM recommendations + notable features
- [ ] **Section 4: "Workflow"** (collapsible, default collapsed)
  - Goal, Audience, Success Metrics, Publish Target (all inline editable)
  - Evidence + Outcomes (if FEATURE_O1 enabled)
  - Export Evidence button
- [ ] **All fields inline-editable** — remove the separate Edit tab entirely
  - Click field → edit mode → blur/Enter to save → PATCH API → refetch
  - Use existing EditableField pattern from current drawer

Deliverables:
- Zero tab clicks to see the most important information
- Last commit + branch + git status visible immediately
- Notes editable without navigating to a different tab
- Recent commits provide context for "what was I doing?"

## ⬜ Phase 16 - API & Merge Updates (Backend)
Wire the new scan data through the merge layer and API responses.

- [ ] **Update merge.ts**: Surface new fields from Scan and Derived
  - `isDirty`, `ahead`, `behind` from Derived (promoted columns)
  - `recentCommits`, `scripts`, `services`, `framework`, `packageManager`, `locEstimate`, `branchCount`, `stashCount` from Scan.rawJson
  - `pinned`, `lastTouchedAt` from Project
- [ ] **Update types.ts**: Add new fields to Project and RawScan interfaces
- [ ] **Update GET /api/projects**: Accept optional query params
  - `sort`: "lastCommit" | "name" | "health" | "status" | "daysInactive"
  - `order`: "asc" | "desc"
  - `filter`: "all" | "active" | "needsAttention" | "stale" | "archived"
  - (Frontend can also sort/filter client-side; server-side is optional optimization)
- [ ] **Update pipeline.ts**: Populate promoted Derived columns during store phase
  - Extract isDirty, ahead, behind, framework, branchName, lastCommitDate, locEstimate from scan JSON
  - Write to Derived model alongside existing statusAuto/healthScoreAuto
- [ ] **Update pipeline.ts**: Set `Project.lastTouchedAt` on each scan
- [ ] **Add response metadata**: Include `lastRefreshedAt` timestamp in GET /api/projects response

Deliverables:
- All new scan fields accessible via the API
- Frontend can render new data without additional API calls
- Sort/filter available server-side for future scalability
- lastRefreshedAt available for the header display

## ⬜ Phase 17 - Enhanced Quick Actions (Frontend)
Make it effortless to go from dashboard to working on a project.

- [ ] **Terminal action**: Open Terminal.app / iTerm2 at project path
  - macOS: `open -a Terminal <path>` or `osascript` for iTerm2
  - Add as 4th quick action button (terminal icon)
- [ ] **"Open in browser" action**: When deployment config detected (fly.toml, vercel.json, netlify.toml)
  - Attempt to derive URL from config or scan data
  - Show globe icon, only when applicable
- [ ] **Keyboard shortcuts** when a project row is selected/focused:
  - `v` — Open in VS Code
  - `c` — Open Claude CLI
  - `x` — Open Codex CLI
  - `t` — Open Terminal
  - `Enter` — Toggle drawer
  - `j/k` or arrow keys — Navigate list
  - `Esc` — Close drawer
- [ ] **Direct launch for Claude/Codex** instead of clipboard:
  - macOS: Use `osascript` to open Terminal and run command
  - Fallback: clipboard copy with toast (current behavior)
- [ ] Add keyboard shortcut hints to quick action tooltips

Deliverables:
- 4+ quick action buttons per project
- Keyboard-driven navigation for power users
- Direct terminal launch instead of clipboard copy
- Shortcuts discoverable via tooltips

## ⬜ Phase 18 - Project Pinning & Favorites (Full-Stack)
Let developers mark their focus projects explicitly.

- [ ] **Backend**: `pinned` field already added in Phase 12 schema
  - New endpoint: `PATCH /api/projects/:id/pin` — toggles pinned boolean
  - Or: add `pinned` to existing override PATCH endpoint
  - Log Activity event on pin/unpin
- [ ] **Frontend**: Pin/unpin toggle
  - Pin icon on each list row (star or pin icon, filled when pinned)
  - Click to toggle, immediate PATCH + refetch
- [ ] **Pinned section** at the top of the dashboard:
  - Above "Recently Active" section
  - "Pinned" header, same row format as main list
  - Pinned projects excluded from the main list to avoid duplication
  - Empty state: no section shown (zero friction for non-users)
- [ ] **Pinned sort**: Within the pinned section, sort by last commit date

Deliverables:
- One-click pin/unpin from any project row
- Pinned projects always visible at the top
- Pinned state persists across refreshes (stored in DB)

## ⬜ Phase 19 - Pipeline Optimizations (Backend)
Make refresh fast enough for daily use without skipping LLM.

- [ ] **Skip LLM for unchanged projects**:
  - Hash the rawJson on each scan
  - Store hash in Scan model (new field: `rawJsonHash String?`)
  - On refresh: compare new hash to stored hash. If same AND Llm record exists, skip LLM call
  - Emit SSE event: `project_complete { name, step: "llm", detail: "skipped (unchanged)" }`
- [ ] **Parallel LLM calls**:
  - Process 3-5 projects concurrently (configurable via `LLM_CONCURRENCY` env var)
  - Use `Promise.allSettled` in batches within pipeline.ts
  - Respect AbortSignal across all concurrent calls
- [ ] **Incremental refresh** (stretch):
  - On scan, detect projects with unchanged `mtime` on `.git/index` or `package.json`
  - Skip full git command suite for unchanged projects
  - Still include in output (use cached scan data)
- [ ] **Activity model cleanup**:
  - Add TTL: delete Activity records older than 90 days on each refresh
  - Or: keep max 50 records per project, prune oldest on insert

Deliverables:
- LLM refresh for 30 projects: ~1-2 min (vs ~3-6 min currently) for typical runs
- Unchanged projects skip LLM in < 100ms
- Activity table bounded, no unbounded growth

## ⬜ Phase 20 - Session Memory & Activity Timeline (Full-Stack)
Help developers remember what they were doing on each project.

- [ ] **Track quick action usage**: When a user clicks VS Code / Claude / Codex / Terminal:
  - Log an Activity event: `{ type: "opened", payloadJson: { tool: "vscode" | "claude" | "codex" | "terminal" } }`
  - Update `Project.lastTouchedAt` to now
- [ ] **"Last opened" on list rows**: Show "Opened 2h ago" or "Opened 3d ago" next to days inactive
  - Uses `lastTouchedAt` from Project model
  - Only show if lastTouchedAt exists (no noise for never-opened projects)
- [ ] **Activity timeline in drawer** (Section 2 from Phase 15):
  - Query last 20 Activity records for the project
  - Render as compact timeline: icon + type + relative date
  - Types: "Scanned", "LLM enriched", "Override updated", "Metadata updated", "Opened in VS Code", etc.
- [ ] **Session notes with timestamps** (stretch):
  - Add timestamped notes model or use Activity with type "note"
  - Show in timeline alongside other activities
  - Quick-add note from the drawer's notes field

Deliverables:
- Dashboard shows which projects you've been actively using (not just git activity)
- Drawer shows a full activity timeline
- lastTouchedAt provides a signal distinct from lastCommitDate

## ⬜ Phase 21 - Docs & Architecture Update
Update project documentation to reflect the new architecture and features.

- [ ] Update ARCHITECTURE.md:
  - New scan fields and data flow
  - Updated derive rules (status labels, gradient health)
  - New merge priority with promoted columns
  - Agent team development workflow
  - Compact list view architecture
- [ ] Update README.md:
  - New features section (list view, sort, filter, pinning, quick actions)
  - New env vars (LLM_CONCURRENCY, etc.)
  - Updated screenshots
  - Keyboard shortcuts reference
- [ ] Update PITCH.md:
  - Reposition as "daily starting point" tool
  - Update feature list
- [ ] Clean up .env.local.example with new config options

Deliverables:
- All three project documents (PITCH, IMPLEMENTATION_PLAN, ARCHITECTURE) reflect current state
- README has accurate setup and feature docs

---

## Acceptance Criteria (Original, still applies)
- Status auto-computed but editable; edits persist across refresh
- Refresh never overwrites overrides
- O-1 features only appear if FEATURE_O1 is true
- OSS mode does not leak absolute paths
- API supports refresh, read, edit, and export (when enabled)

## Acceptance Criteria (New, Phases 11-21)
- Dashboard answers "what was I working on?" within 5 seconds of opening
- Compact list view shows 25+ projects without scrolling
- Sort by last commit is the default view
- Drawer shows status, branch, last commit, and next action without tab-switching
- Git dirty/clean status visible for every project
- Pinned projects always appear at the top
- Full refresh with LLM completes in < 2 minutes for 30 projects (with skip-unchanged)
- Quick actions open tools directly (not clipboard) where possible
- Keyboard shortcuts work for navigation and actions
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
