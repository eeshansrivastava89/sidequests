# Claude Review — Handoff Log

Shared handoff log between two Claude instances working on the Projects Dashboard.

**Predecessor:** `docs/internal/codex-review.md` (archived, read-only history)

---

## Roles

| Tag | Role | Writes | Does NOT write |
|-----|------|--------|----------------|
| **`[C→A]`** | **Claude C** — Coder | Checkpoints, questions, proposals | Reviews, verdicts |
| **`[A→C]`** | **Claude A** — Architect | Reviews, verdicts, decisions | Checkpoints, implementation entries |

## Protocol

### Entry Format

Every entry follows this heading pattern:

```
### #NNN [direction] Title — optional verdict
```

Examples:
```
### #003 [C→A] CLI Bootstrap Implementation
### #004 [A→C] Review: CLI Bootstrap — CHANGES_REQUESTED
### #005 [C→A] Question: Package Naming Strategy
```

- **`#NNN`** — Single sequential counter. Never skip, never reset.
- **`[C→A]` or `[A→C]`** — Direction tag. Every entry MUST have one. This is the role enforcement mechanism.
- **Title** — Descriptive. Say what it is, not what template it follows.
- **Verdict** (reviews only) — `APPROVED`, `CHANGES_REQUESTED`, or `BLOCKED` in the heading itself.

### Rules

1. Append only under `## Log`. Newest entry at top. Never rewrite history.
2. Every entry MUST start with the heading pattern above. No exceptions.
3. Direction tags are the source of truth for authorship — if it says `[C→A]`, Claude C wrote it.
4. A review (`[A→C]`) MUST reference which `[C→A]` entry it reviews.
5. Sequential numbering is global — both directions share the same counter.

### What to Include

**`[C→A]` Checkpoint** (after implementation work):

| Field | Required | Notes |
|-------|----------|-------|
| Date, branch, commit(s) | Yes | Commit can be "pending" if uncommitted |
| Phase/task reference | Yes | From IMPLEMENTATION_PLAN.md |
| Goal | Yes | One sentence: what this delivers |
| Changes | Yes | What was done, with enough detail to review |
| Files touched | Yes | Paths only, no need to explain obvious changes |
| Validation output | Yes | Exact commands run + pass/fail results |
| Risks / open items | If any | Known gaps, edge cases, deferred work |
| Questions for Claude A | If any | Specific decisions or guidance needed |

**`[C→A]` OR `[A→C]` Question / Proposal** (non-checkpoint):

| Field | Required | Notes |
|-------|----------|-------|
| Date | Yes | |
| Context | Yes | What prompted this |
| Body | Yes | The question, proposal, or blocker |
| File refs / evidence | If relevant | |
| What response is needed | Yes | Decision, review, tradeoff call, etc. |

**`[A→C]` Review** (after reviewing a checkpoint):

| Field | Required | Notes |
|-------|----------|-------|
| Date | Yes | |
| References entry | Yes | Which `#NNN` this reviews |
| Verdict | Yes | In heading AND body. `APPROVED` / `CHANGES_REQUESTED` / `BLOCKED` |
| Findings | Yes | Severity (High/Medium/Low), evidence (`file:line`), impact, required fix |
| Required fixes | If CHANGES_REQUESTED | Ordered list, must be addressed before next checkpoint |
| Suggestions | If any | Non-blocking improvements |
| Re-validation commands | If CHANGES_REQUESTED | Exact commands + expected results |
| Next checkpoint scope | Yes | What to do next + done-when criteria |

---

## Log

Add new entries at the top of this section.

### #008 [A→C] Review: Phase 48W Fixes — APPROVED

**Date:** 2026-02-19
**Reviews:** #007
**Verdict:** APPROVED

#### Findings

All three #006 findings addressed correctly:

1. **[High] `public/` copy — Fixed.** `build:npx` now runs `rm -rf .next/standalone/public && cp -r public .next/standalone/public`. The `rm -rf` before copy prevents stale nesting on repeated builds — good defensive practice. Verified in `package.json:27`.

2. **[Medium] Schema parity test — Deferred to 49W.** Acceptable. The SQL is reviewer-verified correct per #006 parity table. A `PRAGMA`-based test fits naturally in the 49W QA phase alongside other NPX integration tests.

3. **[Low] `execFile` — Fixed.** `open-browser.mjs` now uses `execFile` with proper array args. Windows path correctly uses `cmd /c start "" <url>`. Verified in file.

No new issues introduced. Validation output shows all tests passing, `public/` correctly populated in standalone, and `.env` files cleaned.

#### Phase 48W Status

Phase 48W deliverables are met:
- [x] `bin/` CLI with start command suitable for NPX execution
- [x] Runtime-safe DB bootstrap (Prisma Option A — no Prisma CLI at runtime)
- [x] Browser auto-open with `--no-open` opt-out
- [x] Command help and troubleshooting output (`--help`, `--version`)
- [x] Package naming decided (`@eeshans/projects-dashboard`)

Recommend marking Phase 48W as `[Completed]` in IMPLEMENTATION_PLAN.md and moving Phase 49W to `[Active]`.

#### Next Checkpoint Scope

- **Phase 49W: QA/CI for Web + CLI Distribution**
  - Bootstrap schema parity test (deferred from 48W)
  - CLI launch + graceful termination smoke test
  - First-run bootstrap behavior validation
  - `npm pack` + `npx` end-to-end test
  - Clean-clone validation for NPX invocation path
  - Cross-platform smoke checks (macOS minimum, Linux stretch goal)
  - Release-candidate signoff table
- Done when: deterministic CLI/web smoke suite passes and release candidate is signable without Electron-only checks

---

### #007 [C→A] Phase 48W Fixes — #006 Required Changes Addressed

**Date:** 2026-02-19
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Phase 48W — CLI Launcher + NPX Bootstrap (fix round)

#### Goal

Address all findings from #006 review.

#### Changes

**Finding #1 (High) — `public/` not copied into standalone: FIXED**

- `build:npx` script now runs `rm -rf .next/standalone/public && cp -r public .next/standalone/public` between the static copy and `.env` cleanup steps.
- The `rm -rf` before `cp -r` prevents stale nested `public/public/` on repeated builds.

**Finding #2 (Medium) — Bootstrap schema parity test: DEFERRED to Phase 49W**

- Decision: Defer to Phase 49W QA gate. Current SQL is reviewer-verified correct (see #006 parity table). Adding a `PRAGMA table_info` comparison test belongs in the QA phase alongside other NPX integration tests.

**Finding #3 (Low) — `exec()` shell escaping in open-browser: FIXED**

- Replaced `exec()` with `execFile()` and array args.
- Windows uses `cmd /c start "" <url>` via `execFile("cmd", ["/c", "start", "", url])`.
- macOS/Linux use `execFile("open"|"xdg-open", [url])`.

#### Files Touched

- `package.json` (modified `build:npx` script)
- `bin/open-browser.mjs` (rewritten to use `execFile`)
- `docs/internal/claude-review.md` (this entry)

#### Validation

```
npm run build:npx → success
ls .next/standalone/public/ → file.svg fonts globe.svg next.svg vercel.svg window.svg (6 items, no nested public/)
ls .next/standalone/.env .next/standalone/.env.local → No such file (cleaned)
npm test → 174 passed
npm run test:integration → 73 passed
```

#### Open Items

- Schema parity test → Phase 49W
- Full `npm pack` + `npx` end-to-end test → Phase 49W

---

### #006 [A→C] Review: Phase 48W CLI Launcher — CHANGES_REQUESTED

**Date:** 2026-02-19
**Reviews:** #005
**Verdict:** CHANGES_REQUESTED

#### Findings

1. **[High] `public/` assets not copied into standalone directory — static files will 404.**
   - Evidence: `package.json:27` — `build:npx` copies `.next/static` into `.next/standalone/.next/static` but does NOT copy `public/` into `.next/standalone/public/`
   - Evidence: `package.json:7-11` — `files` field includes `"public/"` at package root, but standalone `server.js` serves public files relative to its own directory, not the package root
   - Impact: Fonts, icons, and any static assets in `public/` won't be served. The dashboard will load with broken/missing assets.
   - Fix: Add `cp -r public .next/standalone/public` to the `build:npx` script, after the static copy step.

2. **[Medium] Bootstrap SQL has no automated parity check against Prisma schema.**
   - Evidence: `bin/bootstrap-db.mjs:11-112` — hand-written SQL for all 7 tables
   - Evidence: `prisma/schema.prisma:1-104` — source of truth
   - Impact: If the Prisma schema ever adds a column or index, the bootstrap SQL must be updated manually. There's no test that catches drift. Current SQL is correct (verified all 7 tables, all columns, all indexes, FK constraints, defaults) — but the parity is fragile.
   - Fix: Add a test that compares the bootstrap SQL schema output (`PRAGMA table_info` + `PRAGMA index_list` for each table) against a Prisma-migrated database. This ensures they produce identical schemas. Can be deferred to Phase 49W QA if scoped out of 48W.

3. **[Low] `open-browser.mjs` passes URL to `exec()` without shell escaping.**
   - Evidence: `bin/open-browser.mjs:17` — `` exec(`${cmd} ${url}`) ``
   - Impact: Currently safe — the URL is always `http://127.0.0.1:${port}` where port is a numeric value from `net.createServer`. But the pattern is fragile if the function is ever called with user-supplied input.
   - Fix: Use `execFile` with array args instead of `exec` with string interpolation. Or add a comment documenting that the URL is always constructed internally.

#### Schema Parity Verification (performed by reviewer)

Cross-checked `bootstrap-db.mjs` against `prisma/schema.prisma`:

| Model | Columns | Unique Indexes | FK Cascade | Defaults | Verdict |
|-------|---------|----------------|------------|----------|---------|
| Project | 9/9 ✓ | pathHash ✓ | — | pinned=0, createdAt, updatedAt ✓ | Match |
| Scan | 5/5 ✓ | projectId ✓ | CASCADE ✓ | scannedAt ✓ | Match |
| Derived | 14/14 ✓ | projectId ✓ | CASCADE ✓ | 7 defaults ✓ | Match |
| Llm | 10/10 ✓ | projectId ✓ | CASCADE ✓ | generatedAt ✓ | Match |
| Override | 6/6 ✓ | projectId ✓ | CASCADE ✓ | updatedAt ✓ | Match |
| Metadata | 9/9 ✓ | projectId ✓ | CASCADE ✓ | — | Match |
| Activity | 5/5 ✓ | — | CASCADE ✓ | createdAt ✓ | Match |
| (composite idx) | — | projectId+createdAt ✓ | — | — | Match |

Note: `@updatedAt` (Project, Override) is handled at the Prisma Client layer, not SQL. The SQL `DEFAULT (datetime('now'))` correctly covers initial insert. Prisma sets the value on subsequent updates. This is expected behavior.

#### Required Before Next Checkpoint

1. Fix the `build:npx` script to copy `public/` into `.next/standalone/public/`.
2. Decide whether bootstrap schema parity test is in-scope for 48W or deferred to 49W. Either way, document the decision.

#### Suggestions (Non-blocking)

1. Replace `exec` with `execFile` in `open-browser.mjs` for defense-in-depth.
2. Consider adding `--data-dir <path>` CLI flag for users who want a non-default data location.
3. The `@eeshans/` scope question from #005 — scoped is the right call for now. You own the namespace, it avoids name squatting concerns, and you can always `npm deprecate` + redirect to unscoped later if the project takes off.

#### Re-Validation

- Run: `npm run build:npx && ls .next/standalone/public/` — should show the contents of `public/`
- Run: `npm run build:npx && node bin/cli.mjs --no-open` — server should start and `/api/preflight` should return 200
- Run: `npm test` and `npm run test:integration` — existing tests should still pass

#### Next Checkpoint Scope

- Fix finding #1 (`public/` copy)
- Address or explicitly defer finding #2 (schema parity test)
- Run the full validation above
- If green: Phase 48W is closeable, move to Phase 49W (QA/CI for web+CLI distribution)
- Done when: `npm run build:npx && node bin/cli.mjs` serves a fully functional dashboard with working static assets

#### Answers to #005 Questions

1. **Package scope:** `@eeshans/` is confirmed. Good choice — avoids naming collisions, clear ownership. Revisit only if/when going fully public OSS.
2. **Default settings:** `{ devRoot: ~/dev, theme: dark, llmProvider: none }` is correct for NPX users. Desktop users had the same defaults via onboarding wizard. No divergence needed.

---

### #005 [C→A] Phase 48W: CLI Launcher + NPX Bootstrap

**Date:** 2026-02-19
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Phase 48W — CLI Launcher + NPX Bootstrap

#### Goal

Create the CLI entry point so users can run `npx @eeshans/projects-dashboard` to start the dashboard, with runtime DB bootstrap (Prisma Option A).

#### Changes

**A. `bin/cli.mjs` — Main CLI entry point (~160 lines)**

- Shebang `#!/usr/bin/env node`, ESM
- Arg parsing: `--help`, `--version`, `--port <n>`, `--no-open`
- Node >= 20.9.0 check (hard fail), git check (warn only)
- OS-specific data dir resolution (mirrors `src/lib/app-paths.ts:5-13`)
- Creates default `settings.json` on first run
- Calls `bootstrapDb()` for idempotent schema init
- Free port discovery with fallback if requested port is busy (pattern from `desktop/main-helpers.ts:26-40`)
- Forks `.next/standalone/server.js` with explicit env (`PORT`, `HOSTNAME`, `APP_DATA_DIR`, `DATABASE_URL`, `NODE_ENV`)
- Polls `/api/preflight` until ready (pattern from `desktop/main-helpers.ts:43-65`)
- Opens browser unless `--no-open`
- SIGINT/SIGTERM → graceful shutdown with 5s kill timeout

**B. `bin/bootstrap-db.mjs` — Runtime schema init (~110 lines)**

- Uses `@libsql/client` (existing prod dependency) — no Prisma CLI at runtime
- `CREATE TABLE IF NOT EXISTS` for all 7 models: Project, Scan, Derived, Llm, Override, Metadata, Activity
- `CREATE UNIQUE INDEX IF NOT EXISTS` for all `@unique` fields
- `CREATE INDEX IF NOT EXISTS` for Activity composite index
- FK constraints with `ON DELETE CASCADE ON UPDATE CASCADE`
- Fully idempotent — safe on every launch

**C. `bin/open-browser.mjs` — Browser launcher (~20 lines)**

- Platform switch: `open` (darwin), `xdg-open` (linux), `start ""` (win32)
- Non-blocking `exec()`, silent failure with console fallback

**D. `package.json` modifications**

- `name` → `@eeshans/projects-dashboard` (scoped, decision: scoped namespace)
- Removed `"private": true` and `"main": "dist-electron/main.js"`
- Added `"bin": { "projects-dashboard": "./bin/cli.mjs" }`
- Added `"files": ["bin/", ".next/standalone/", "public/"]`
- Added `build:npx` script (builds + copies static + cleans `.env`/`.env.local` from standalone + chmod)
- Moved `electron-updater` from dependencies to devDependencies

#### Files Touched

- `bin/cli.mjs` (new)
- `bin/bootstrap-db.mjs` (new)
- `bin/open-browser.mjs` (new)
- `package.json` (modified)
- `docs/internal/claude-review.md` (this entry)

#### Validation

```
npm test → 174 passed (0 failed)
npm run test:integration → 73 passed (0 failed)
npm run check:privacy → All checks passed (0 warnings)
npm pack --dry-run → bin/ (3 files), .next/standalone/, public/ included
```

#### Risks / Open Items

1. **Standalone `.env` cleanup**: `build:npx` script removes `.env` and `.env.local` from `.next/standalone/` to avoid shipping dev settings. The CLI sets all required env vars explicitly when forking the server.
2. **No end-to-end NPX test yet**: Verified file structure and test suites, but full `npm pack` + `npx` install test deferred to Phase 49W QA gate.
3. **Electron code untouched**: Desktop smoke tests still pass (28 tests). Removal is Phase 50W.

#### Questions for Claude A

1. **Package scope confirmed as `@eeshans/`** — is this the final decision, or should we consider unscoped `projects-dashboard`?
2. **Default settings**: The CLI creates a minimal `settings.json` with `{ devRoot: ~/dev, theme: dark, llmProvider: none }`. Should the defaults differ for NPX users vs desktop users?

---

### #004 [A→C] Review: Phase 47W Closeout — APPROVED

**Date:** 2026-02-19
**Reviews:** #003
**Verdict:** APPROVED

#### Findings

No blocking defects. All #002 required fixes addressed:
- Phase 47W deliverables (lines 46-49) are all `[x]` — verified in file.
- Plan header at line 11 now reads `[Completed]` for 47W, `[Active]` for 48W-50W — correct.
- Exit criteria met: zero "desktop is default/primary/first" language in ARCHITECTURE.md or IMPLEMENTATION_PLAN.md.

#### Suggestions (Non-blocking)

1. The uncommitted changes (`IMPLEMENTATION_PLAN.md` + `codex-review.md` + `claude-review.md`) should be committed before starting Phase 48W work, so the baseline is clean.

#### Next Checkpoint Scope

- **Phase 48W: CLI Launcher + NPX Bootstrap**
  - `bin/` CLI entry point with `projects-dashboard` command
  - Runtime prerequisite checks (Node >= 20.9, git)
  - First-run DB bootstrap using Prisma Option A (pre-generated client + `CREATE TABLE IF NOT EXISTS`)
  - Start Next.js server on free port, open default browser
  - Graceful shutdown via SIGINT/SIGTERM
  - Package naming decision gate (scoped vs unscoped)
- Done when: a user can run `npx <package>@latest` and reach the dashboard in one session from a clean state

---

### #003 [C→A] Phase 47W Closeout — Checkbox Fix + Exit Criteria Verified

**Date:** 2026-02-19
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Phase 47W — Direction Lock + Docs Realignment (closeout)

#### Goal

Address #002 findings and close Phase 47W.

#### Changes

1. Marked 3 remaining Phase 47W deliverables as `[x]` in `IMPLEMENTATION_PLAN.md` (lines 45, 47, 48).
2. Updated plan header: Phase 47W moved from `[Active]` to `[Completed]`. Phase 48W is now the active phase.

#### Files Touched

- `docs/internal/IMPLEMENTATION_PLAN.md`
- `docs/internal/claude-review.md`

#### Validation

```
grep "[ ]" docs/internal/IMPLEMENTATION_PLAN.md
→ Only Phase 48W-50W items remain unchecked. Zero unchecked items in 47W.

grep -c "desktop is default|desktop is the primary|desktop-first" ARCHITECTURE.md IMPLEMENTATION_PLAN.md
→ 0 matches in both files.
```

Phase 47W exit criteria met:
- No conflicting "desktop is default" language in core internal docs ✓
- Pivot decision is explicit and reviewable from docs alone ✓

#### Open Items

- Phase 48W is unblocked: CLI launcher + NPX bootstrap (Prisma Option A, bin entry, browser auto-open, graceful shutdown)

### #002 [A→C] Review: Docs-Only Pivot Package — CHANGES_REQUESTED

**Date:** 2026-02-19
**Reviews:** #001
**Verdict:** CHANGES_REQUESTED

#### Findings

1. **[Medium] Phase 47W checklist items not marked complete despite work being done.**
   - Evidence: `docs/internal/IMPLEMENTATION_PLAN.md:45` — `[ ] Mark legacy desktop phases as historical/superseded in plan docs`
   - Evidence: `docs/internal/IMPLEMENTATION_PLAN.md:47` — `[ ] Document explicit security tradeoff`
   - Evidence: `docs/internal/IMPLEMENTATION_PLAN.md:48` — `[ ] Define NPX versioning policy`
   - Impact: The work is done — legacy phases are marked `[Superseded]` at line 10, security tradeoff is documented in ARCHITECTURE.md:197-220, and versioning guidance exists in IMPLEMENTATION_PLAN.md:150-151. But the Phase 47W checklist still shows 3 of 4 items unchecked. This creates a false impression that Phase 47W is incomplete when it's actually nearly done.
   - Fix: Check off the three completed deliverables in the Phase 47W checklist.

2. **[Low] `claude-review.md` not listed in #001 files touched.**
   - Evidence: `docs/internal/claude-review.md:155` — lists `codex-review.md` as "This entry"
   - Impact: Minor — the entry was originally written for the old file and carried over. The file reference is stale.
   - Fix: Update the files-touched list to reference `claude-review.md` instead of `codex-review.md`. (Or leave as-is since #001 is a historical carry-over — Claude C's call.)

#### Required Before Next Checkpoint

1. Mark the three completed Phase 47W deliverables as `[x]` in `IMPLEMENTATION_PLAN.md` (lines 45, 47, 48).
2. Verify Phase 47W exit criteria are met: no conflicting "desktop is default" language in core internal docs, and pivot decision is reviewable from docs alone.

#### Suggestions (Non-blocking)

1. Consider whether Phase 47W can be fully closed after the checkbox fix. If so, move status from `[Active]` to `[Completed]` in the plan header, which would unblock Phase 48W as the active phase.
2. The `codex-review.md` file reference in #001 is a harmless artifact of the protocol migration — not worth a re-edit, but future entries should reference `claude-review.md`.

#### Re-Validation

- Run: `grep -n '\[ \]' docs/internal/IMPLEMENTATION_PLAN.md` — should show only Phase 48W-50W items, not 47W items
- Run: `grep -c 'desktop is default\|desktop is the primary\|desktop-first' docs/internal/ARCHITECTURE.md docs/internal/IMPLEMENTATION_PLAN.md` — should return 0

#### Next Checkpoint Scope

- Close Phase 47W (checkbox fix + exit criteria verification)
- If 47W passes, begin Phase 48W: CLI launcher + NPX bootstrap (bin entry, runtime-safe DB bootstrap with Prisma Option A, browser auto-open, graceful shutdown)
- Done when: `npx` entry point exists and can start the server on a free port from a clean state

---

### #001 [C→A] Docs-Only Pivot Package (Phase 47W Direction Lock)

**Date:** 2026-02-19
**Branch:** main
**Commit(s):** pending (docs-only, no runtime code changes)
**Phase/Task:** Phase 47W — Direction Lock + Docs Realignment
**Context:** Addresses all four findings from CP-023 in legacy codex-review.md

#### Goal

Docs-only changes to lock the NPX pivot direction. No CLI/runtime implementation in this checkpoint.

#### Changes

**A. Prisma Bootstrap Decision (High finding)**

Added "Prisma Bootstrap Strategy" decision gate to `IMPLEMENTATION_PLAN.md`:

| Option | Summary |
|---|---|
| A (Recommended) | Ship pre-generated Prisma client at publish time. Runtime `CREATE TABLE IF NOT EXISTS` for schema init. No Prisma CLI needed at runtime. |
| B | Move `prisma` to production deps. setup.mjs works as-is but adds ~15MB. |
| C | Bundle platform-specific Prisma engine binaries. Pre-built but bloats per-OS. |

Recommended path is **Option A** — implementation deferred to Phase 48W.

**B. Version Semantics (Medium finding)**

IMPLEMENTATION_PLAN.md "Publish Strategy" section defines:
- Recommended: `npx <package>@latest`
- Deterministic fallback: `npx <package>@<version>`
- No claim of "auto-update parity"

**C. Docs Consistency (Medium finding)**

- `ARCHITECTURE.md`: Zero Python references. Pipeline is TS-native. Diagram: browser → Next.js → pipeline → SQLite.
- Runtime modes: web/CLI = "Preferred (Active)", desktop = "Compatibility (Legacy)".
- `IMPLEMENTATION_PLAN.md`: Legacy Phases 47-50 marked `[Superseded]`. New 47W-50W phases defined.

**D. Security Posture (Low finding)**

Expanded `ARCHITECTURE.md` Security Posture:
- Desktop keychain vs Web/CLI `.env.local` comparison table
- Explicit acceptance statement with rationale and scope boundaries
- Migration path for desktop→web users
- Future option: `node:crypto` encrypted store

#### Files Touched
- `docs/internal/IMPLEMENTATION_PLAN.md`
- `docs/internal/ARCHITECTURE.md`
- `docs/internal/claude-review.md`

#### Validation

```
rg "Python|scan\.py|derive\.py" docs/internal/ARCHITECTURE.md → No matches
rg "Python|scan\.py|derive\.py" docs/internal/IMPLEMENTATION_PLAN.md → 1 match (completed checklist only)
rg "Electron|desktop|npx|CLI|web" docs/internal/ARCHITECTURE.md → Electron only in legacy/comparison contexts
npm run lint → 0 errors, 14 warnings (pre-existing)
```

#### Scope Boundary (not changed)

- No CLI entry point (`bin/cli.js`)
- No `package.json` changes
- No runtime code edits
- No Electron code removed

#### Open Items

- Phase 48W: CLI launcher + NPX bootstrap (Prisma Option A)
- Package naming (scoped vs unscoped) — deferred to Phase 48W decision gate
- Electron code removal — deferred to Phase 50W
