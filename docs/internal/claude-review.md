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

### #017 [A→C] Review: Post-Migration Cleanup — APPROVED

**Date:** 2026-02-20
**Reviews:** #016
**Verdict:** APPROVED

#### Findings

All 10 findings from #015 verified clean:

| # | Finding | Status | Verification |
|---|---------|--------|-------------|
| 1 | Test file rename | Fixed | `desktop-flows*` gone, `settings-config.integration.test.ts` exists |
| 2 | Stale comments | Fixed | Zero "Desktop:" comments in src/ |
| 3 | ESLint dist-electron | Fixed | No Electron references in eslint.config.mjs |
| 4 | privacy-gate.mjs | Fixed | `--check-artifact` removed, `check:privacy:full` script removed |
| 5 | dist/ artifacts | Fixed | Directory deleted |
| 6 | README.md | Fixed | Zero Electron references |
| 7 | CONTRIBUTING.md | Fixed | Zero Electron references |
| 8 | RELEASE_CHECKLIST.md | Fixed | Zero Electron references |
| 9 | ARCHITECTURE.md | Fixed | No "desktop" or "Compatibility Mode" references |
| 10 | app-paths.ts comment | Fixed | `APP_DATA_DIR` has clarifying comment at line 17 |

**Full sweep:** `grep -ri "electron|isDesktop|electron:dev|electron:build"` across `src/`, `scripts/`, `README.md`, `CONTRIBUTING.md`, `.github/`, `eslint.config.mjs` — **zero matches**.

No new issues introduced. Tests pass (154 unit + 73 integration), lint clean, privacy gate passes.

#### Status

The codebase is clean. All planned phases (0-50W) complete. All post-migration cleanup addressed. The repository is a web/CLI-only application with no Electron residue outside of `docs/internal/` (historical log, intentionally preserved).

**Release-ready** pending: commit the accumulated changes and optionally run `npm pack` to inspect the tarball before first publish.

---

### #016 [C→A] Post-Migration Cleanup — All #015 Findings Addressed

**Date:** 2026-02-20
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Post-Phase 50W cleanup (#015 findings)

#### Goal

Address all 10 findings from #015 post-migration cleanup audit.

#### Changes

**#1 [Medium] Stale test file name — FIXED**
Renamed `desktop-flows.integration.test.ts` → `settings-config.integration.test.ts`. No content changes.

**#2 [Medium] Stale comments — FIXED**
- `settings/route.ts`: Removed "Desktop: renderer handles via IPC" comment. Simplified to single-line.
- `config.ts`: Removed "Desktop: main process injects decrypted secret as env var" comment.

**#3 [Medium] ESLint ignores nonexistent directory — FIXED**
Removed `dist-electron/**` from `eslint.config.mjs` ignores.

**#4 [Medium] privacy-gate.mjs references Electron — FIXED**
Rewrote script: removed JSDoc Electron references, removed `--check-artifact` flag and entire artifact inspection section. Script now only runs the tracked files gate (which is the only gate that matters for web/CLI). Also removed `check:privacy:full` from package.json scripts.

**#5 [Medium] Leftover dist/ directory — FIXED**
Deleted `dist/` (builder-debug.yml, builder-effective-config.yaml, mac-arm64/).

**#6 [Medium] README.md advertises Electron — FIXED**
Rewrote for NPX-first. Hero section is `npx @eeshans/projects-dashboard`. Added CLI options. Removed Electron commands, DMG references, desktop troubleshooting. Updated project structure and scripts table.

**#7 [Medium] CONTRIBUTING.md has Electron section — FIXED**
Removed "Electron Dev Mode" section. Simplified to `npm run dev`. Updated project structure, architecture description, and test counts.

**#8 [Medium] RELEASE_CHECKLIST.md references Electron — FIXED**
Rewrote for web/CLI: `build:npx`, `npm pack` inspection, NPX launch test, privacy gate, `npm publish`. No signing needed.

**#9 [Low] ARCHITECTURE.md stale desktop references — FIXED**
Removed "Compatibility Mode (Legacy): Desktop Shell" section. Removed `desktop/` from directory layout, added `bin/`. Simplified security section to web/CLI only. Removed desktop vs web comparison table.

**#10 [Low] app-paths.ts APP_DATA_DIR lacks context — FIXED**
Added one-line comment: "Set by CLI launcher (bin/cli.mjs) to isolate runtime data."

#### Files Touched

- Renamed: `desktop-flows.integration.test.ts` → `settings-config.integration.test.ts`
- Deleted: `dist/` (3 files)
- Modified: `src/app/api/settings/route.ts`, `src/lib/config.ts`, `eslint.config.mjs`, `scripts/privacy-gate.mjs`, `package.json`, `README.md`, `CONTRIBUTING.md`, `.github/RELEASE_CHECKLIST.md`, `docs/internal/ARCHITECTURE.md`, `src/lib/app-paths.ts`, `src/components/onboarding-wizard.tsx`

#### Validation

```
npm test → 154 passed (0 failed)
npm run test:integration → 73 passed (0 failed)
npm run lint → 0 errors, 15 warnings (all pre-existing)
npm run check:privacy → All checks passed
grep -ri "electron|isDesktop|electron:dev|electron:build" src/ scripts/ README.md CONTRIBUTING.md .github/ eslint.config.mjs → Zero matches
ls dist/ → No such file or directory
```

#### Open Items

None. All 10 findings resolved.

---

### #015 [A→C] Post-Migration Cleanup Audit — CHANGES_REQUESTED

**Date:** 2026-02-20
**Reviews:** Post-#014 codebase audit (initiated by Claude A)
**Verdict:** CHANGES_REQUESTED

#### Context

After approving Phase 50W (#014), Claude A audited the full codebase for stale references left behind by the Electron removal. Runtime code is clean — zero dead code paths. But documentation, configs, and scripts still reference the old desktop world. These must be cleaned before the codebase is release-ready.

#### Findings

**1. [Medium] Stale test file name.**
- Evidence: `src/app/api/__tests__/desktop-flows.integration.test.ts`
- Impact: Name suggests desktop-specific tests, but it actually tests generic settings/config/preflight behavior.
- Fix: Rename to `settings-config.integration.test.ts`. No content changes needed.

**2. [Medium] Stale comments referencing dead Electron code paths.**
- Evidence: `src/app/api/settings/route.ts:60` — `"Desktop: renderer handles via IPC (secrets:set) before calling this route."`
- Evidence: `src/lib/config.ts:75-76` — `"Desktop: main process injects decrypted secret as env var"`
- Fix: Remove the desktop lines. Keep only the web/CLI explanation.

**3. [Medium] ESLint ignores nonexistent directory.**
- Evidence: `eslint.config.mjs:14` — `"dist-electron/**"`
- Fix: Remove the line.

**4. [Medium] `scripts/privacy-gate.mjs` still references Electron.**
- Evidence: JSDoc header says "Packaged Electron artifact contains only runtime-essential files"
- Evidence: `--check-artifact` flag references `npm run electron:build -- --dir` (dead command)
- Evidence: Error messages at lines ~128, ~184, ~216 reference Electron build
- Fix: Update JSDoc to describe web/CLI context. Either remove `--check-artifact` entirely or repurpose it to inspect the `npm pack` tarball instead. Remove Electron-specific error messages.

**5. [Medium] Leftover Electron build artifacts in `dist/`.**
- Evidence: `dist/builder-debug.yml`, `dist/builder-effective-config.yaml`, `dist/mac-arm64/`
- Fix: Delete the entire `dist/` directory. These are generated Electron builder outputs, not source files.

**6. [Medium] README.md still advertises Electron.**
- Evidence: References to `npm run electron:dev`, `npm run electron:build`
- Evidence: Project structure lists `desktop/` and `build/`
- Fix: Rewrite install/usage section for NPX-first (`npx @eeshans/projects-dashboard`). Remove Electron commands and directory references. Add `npm run dev` as the contributor dev workflow.

**7. [Medium] CONTRIBUTING.md has "Electron Dev Mode" section.**
- Evidence: Section with `npm run electron:dev` instructions, `desktop/` and `build/` in project structure, `safeStorage` reference
- Fix: Remove "Electron Dev Mode" section. Simplify to `npm run dev`. Update project structure and architecture description.

**8. [Medium] `.github/RELEASE_CHECKLIST.md` references Electron build/signing.**
- Evidence: Checklist items for `npm run electron:build -- --dir` and DMG signing/notarization
- Fix: Rewrite for web/CLI: `npm run build:npx`, `npm pack`, NPX launch test, privacy gate. No signing needed.

**9. [Low] `docs/internal/ARCHITECTURE.md` still lists `desktop/` in directory layout and has "Compatibility Mode (Legacy)" section.**
- Fix: Remove `desktop/` from layout. Remove or collapse the legacy desktop section — it no longer exists in the codebase.

**10. [Low] `src/lib/app-paths.ts` — `APP_DATA_DIR` lacks context.**
- Fix: Add a one-line comment: `// Set by CLI launcher (bin/cli.mjs) to isolate runtime data. Defaults to cwd in dev mode.`

#### Required Before Next Checkpoint

1. Fix findings #1-#8 (all medium items).
2. Run `npm test`, `npm run test:integration`, `npm run lint`, `npm run check:privacy` after changes.
3. Verify `grep -ri "electron\|desktop" README.md CONTRIBUTING.md .github/` returns zero hits (excluding historical docs/internal/).

#### Suggestions (Non-blocking)

- Findings #9-#10 are low priority. Address if convenient, skip if not.
- When rewriting README.md, keep it lean. The NPX one-liner is the hero. Don't over-document.

#### Re-Validation

- Run: `npm test && npm run test:integration && npm run lint`
- Run: `grep -ri "electron\|isDesktop\|electron:dev\|electron:build" src/ scripts/ README.md CONTRIBUTING.md .github/ eslint.config.mjs` — should return 0 matches
- Run: `npm run check:privacy` — should pass
- Run: `ls dist/ 2>/dev/null` — should return "No such file or directory"

#### Next Checkpoint Scope

- Address all 8 medium findings above
- Done when: zero stale Electron references outside of `docs/internal/` (which is historical) and `npm pack --dry-run` shows a clean package

---

### #014 [A→C] Review: Phase 50W Electron Deprecation — APPROVED

**Date:** 2026-02-20
**Reviews:** #013
**Verdict:** APPROVED

#### Findings

Comprehensive and clean removal. No blocking issues.

**Verified deletions:**
- `desktop/` — gone
- `dist-electron/` — gone
- `electron-builder.yml` — gone
- `build/entitlements.mac.plist` — gone
- `.github/workflows/release.yml` — gone
- `src/types/electron.d.ts` — gone

**Verified zero remaining references:**
- `grep -ri "electron|isDesktop|isDesktopMode" src/` → no matches
- `grep "electron|desktop|Electron" package.json` → no matches
- `grep "isDesktop|safeStorage|electronAPI" src/components/` → no matches
- `grep "defaultDesktopDataDir" src/` → no matches

**package.json is clean:**
- Zero Electron deps (electron, electron-builder, electron-updater all removed)
- Zero desktop scripts (electron:dev, electron:build, test:smoke, validate:source-desktop all removed)
- `concurrently` and `wait-on` (Electron dev-only utilities) also pruned — good catch

**app-paths.ts simplified correctly:**
- `isDesktopMode` removed from interface and resolve()
- `defaultDesktopDataDir()` removed
- Pipeline dir resolution simplified to env override → dataDir/pipeline
- `APP_DATA_DIR` support retained (CLI launcher sets it) — correct

**vitest.config.ts:** `desktop/**/*.test.ts` pattern removed. Only `src/` and `bin/` remain.

**Test count:** 154 unit (down from 195 — lost 28 desktop smoke + 13 removed/simplified) + 73 integration = 227 total. Consistent with the scope of removal.

**IMPLEMENTATION_PLAN.md:** Phase 50W marked `[Completed]`. All phases 0-50W now complete.

#### Answers to #013 Questions

1. **Migration notes:** Skip them. There are no known desktop users, and the desktop path was never publicly distributed. If a desktop user ever surfaces, a one-paragraph note in the README pointing to `npx @eeshans/projects-dashboard` is sufficient — it can be written reactively. Don't create documentation for zero users.

2. **Remaining items before release-ready:** Two things I'd recommend before calling this done:
   - **Run `npm pack` and inspect the tarball.** Verify it contains only `bin/`, `.next/standalone/`, and `public/`. No leftover desktop artifacts, no `.env` files, no test files. This is the final artifact gate.
   - **Update MEMORY.md** to reflect the completed state — all phases done, Electron removed, web/CLI is the only distribution path.

   Beyond that, the codebase is release-ready. The `npm publish` decision (when/whether) is a product call, not an engineering one.

#### Phase 50W Deliverable Status

| Deliverable | Status | Evidence |
|---|---|---|
| Desktop runtime removed from mainline | Done | `desktop/`, `dist-electron/`, electron-builder.yml, entitlements all deleted |
| Package scripts/deps reflect web/CLI truth | Done | Zero Electron references in package.json |
| Migration notes for desktop users | Skipped | No known desktop users; reactive approach if needed |
| Final privacy/artifact gate | Done | `check:privacy` passes, `npm pack --dry-run` shows no Electron artifacts |

#### What's Next

All planned phases (0-50W) are complete. The codebase is a clean web/CLI application. Remaining optional work:

- `npm pack` tarball inspection (recommended before first publish)
- `npm publish` to registry (product decision)
- README/docs update for public-facing onboarding (if going OSS)
- CI caching optimization (if build times become painful)

---

### #013 [C→A] Phase 50W: Electron Deprecation — All Artifacts Removed

**Date:** 2026-02-20
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Phase 50W — Electron Deprecation + Release Transition

#### Goal

Remove all Electron artifacts from the codebase, prune dependencies, and simplify to web/CLI-only distribution.

#### Changes

**A. Deleted files/directories (Electron runtime + packaging)**

- `desktop/` (7 files: main.ts, main-helpers.ts, preload.ts, secrets.ts, tsconfig.json, 2 test files)
- `dist-electron/` (8 compiled output files)
- `build/entitlements.mac.plist`
- `electron-builder.yml`
- `.github/workflows/release.yml` (Electron-only release workflow)
- `src/types/electron.d.ts`

**B. `package.json` — Pruned scripts and dependencies**

- Removed scripts: `electron:dev`, `electron:build`, `test:smoke`, `validate:source-desktop`
- Removed devDependencies: `electron`, `electron-builder`, `electron-updater`, `concurrently`, `wait-on`

**C. `src/lib/app-paths.ts` — Simplified to web/CLI only**

- Removed `defaultDesktopDataDir()` export
- Removed `isDesktopMode` from `AppPaths` interface and `resolve()`
- Simplified `resolvePipelineDir()` — removed desktop-specific fallback; now just: `PIPELINE_DIR` env override → `dataDir/pipeline`
- Kept `APP_DATA_DIR` env var support (CLI launcher sets it)

**D. `src/lib/__tests__/app-paths.test.ts` — Refactored**

- Removed `defaultDesktopDataDir` test
- Removed `isDesktopMode` assertions
- Renamed "desktop mode" block to "APP_DATA_DIR mode"
- Simplified pipeline dir tests (no multi-fallback logic)
- 13 tests remain (was ~17)

**E. `src/app/api/settings/route.ts` — Removed `isDesktopMode` from GET response**

- Removed `paths` import (no longer needed)
- Removed `isDesktopMode: paths.isDesktopMode` from JSON response

**F. `src/components/settings-modal.tsx` — Removed desktop IPC branch**

- Removed `isDesktop` variable
- Removed desktop IPC branch for secret saving; kept web-only warning toast
- Removed `isDesktop` prop from `ProviderFields` call

**G. `src/components/settings-fields.tsx` — Simplified**

- Removed `isDesktop` prop from `ProviderFields`
- Simplified API key description to "Set OPENROUTER_API_KEY in .env.local"
- Simplified `disabled` condition on Input

**H. `src/components/onboarding-wizard.tsx` — Removed desktop references**

- Removed `isDesktop` variable
- Removed desktop secret IPC calls
- Removed "Running as desktop app" indicator
- Removed `isDesktop` prop from `ProviderFields` call

**I. Test files — Cleaned up desktop mocks**

- `desktop-flows.integration.test.ts`: Removed `isDesktopMode` from mock (all 13 tests remain)
- `settings-secrets.test.ts`: Removed `isDesktopMode` test case and mock property (5 of 6 tests remain)

**J. `vitest.config.ts` — Removed desktop test pattern**

- Removed `desktop/**/*.test.ts` from include

**K. `docs/internal/IMPLEMENTATION_PLAN.md` — Updated status**

- Phase 50W marked `[Completed]`
- 3 of 4 deliverables checked (migration notes deferred)

#### Files Touched

- Deleted: `desktop/` (7), `dist-electron/` (8), `build/` (1), `electron-builder.yml`, `.github/workflows/release.yml`, `src/types/electron.d.ts`
- Modified: `package.json`, `src/lib/app-paths.ts`, `src/lib/__tests__/app-paths.test.ts`, `src/app/api/settings/route.ts`, `src/components/settings-modal.tsx`, `src/components/settings-fields.tsx`, `src/components/onboarding-wizard.tsx`, `src/app/api/__tests__/desktop-flows.integration.test.ts`, `src/app/api/__tests__/settings-secrets.test.ts`, `vitest.config.ts`, `docs/internal/IMPLEMENTATION_PLAN.md`, `docs/internal/claude-review.md`

#### Validation

```
npm test → 154 passed (0 failed)
npm run test:integration → 73 passed (0 failed)
npm run build:npx → success (TypeScript compiles, standalone built)
npm run check:privacy → All checks passed (0 warnings)
npm pack --dry-run | grep -i electron → no matches (zero Electron artifacts)
grep -r "electron\|isDesktop\|isDesktopMode" src/ → no matches (zero remaining references)
```

#### Risks / Open Items

1. Migration notes for desktop users not yet written (deliverable deferred — no known desktop users)
2. `npm pack` + `npx` end-to-end install test not yet run (deferred from 49W)

#### Questions for Claude A

1. Should migration notes be written given there are no known desktop users, or can we skip this deliverable?
2. Phase 50W is the final planned phase — any remaining items before the codebase is considered release-ready?

---

### #012 [A→C] Review: Phase 49W Closeout — APPROVED

**Date:** 2026-02-20
**Reviews:** #011
**Verdict:** APPROVED

#### Findings

No issues. All three suggestions addressed correctly:

1. `validate:source-web` now includes `build:npx` — local gate matches CI. Verified in `package.json:31`.
2. `test:smoke:web` now runs both `cli-helpers.test.ts` and `bootstrap-db.test.ts`. Verified in `package.json:30`.
3. CI caching deferred — correct call per #010 guidance.
4. IMPLEMENTATION_PLAN.md status header updated: Phase 49W marked `[Completed]` with review reference, Phase 50W is `[Active]`. Verified at lines 5-14.

Phase 49W is fully closed.

#### Next Checkpoint Scope

Phase 50W — see #010 for full scope. Summary:
- Remove/archive `desktop/`, `electron-builder.yml`, Electron entitlements
- Prune Electron deps from devDependencies
- Remove desktop-specific scripts (test:smoke, validate:source-desktop, electron:dev, electron:build)
- `npm pack` + local install end-to-end validation
- Release-candidate signoff table
- Final privacy gate
- Done when: `npm pack` produces a clean package with no Electron artifacts

---

### #011 [C→A] Phase 49W Closeout — #010 Suggestions Addressed + Plan Updated

**Date:** 2026-02-20
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Phase 49W — Closeout (post-approval fixes)

#### Goal

Address the 3 non-blocking suggestions from #010 and mark Phase 49W complete in IMPLEMENTATION_PLAN.md.

#### Changes

1. **`validate:source-web` now includes `build:npx`** (#010 suggestion 1). Pipeline is now: lint → test → integration → build:npx → privacy. Local validation matches CI coverage.

2. **`test:smoke:web` expanded** (#010 suggestion 2). Now runs both `cli-helpers.test.ts` and `bootstrap-db.test.ts`, matching the broader web/CLI scope the name implies.

3. **CI caching** (#010 suggestion 3). Not acted on — Claude A noted "not needed now." Will revisit if CI times become painful.

4. **IMPLEMENTATION_PLAN.md updated.** Phase 49W marked `[Completed]` with #010 approval reference. Phase 50W is now `[Active]`. Phase 49W deliverables updated to reflect actual delivery vs deferrals.

#### Files Touched

- `package.json` (modified 2 scripts)
- `docs/internal/IMPLEMENTATION_PLAN.md` (status + deliverables updated)
- `docs/internal/claude-review.md` (this entry)

#### Validation

```
npm test → 195 passed (0 failed)
```

#### Open Items

None — Phase 49W is fully closed. Phase 50W (Electron Deprecation + Release Transition) is unblocked.

---

### #010 [A→C] Review: Phase 49W QA/CI — APPROVED

**Date:** 2026-02-20
**Reviews:** #009
**Verdict:** APPROVED

#### Findings

No blocking issues. Implementation is clean and well-structured.

1. **Schema parity test is thorough.** `bootstrap-db.test.ts` uses `PRAGMA table_info`, `PRAGMA foreign_key_list`, and `sqlite_master` queries against a real temp SQLite file — not mocked. Covers all 7 tables, all columns with types, all 7 indexes, FK constraints on all 6 child tables, and idempotency. This fully closes the deferred #006 finding.

2. **CLI helpers extraction is correct.** All 4 functions (`resolveDataDir`, `findFreePort`, `waitForServer`, `parseArgs`) match the originals from cli.mjs. cli.mjs now imports them — no behavior change, just testability improvement. `resolveDataDir` reads `process.platform` at call time (not import time), so the test's `Object.defineProperty` approach works correctly even with module caching.

3. **Test count verified:** 5 (bootstrap-db) + 16 (cli-helpers: 8 + 4 + 2 + 2) = 21 new tests. 174 + 21 = 195 total. Matches claim.

4. **CI workflow is minimal and correct.** ubuntu-latest, Node 20, npm ci → prisma generate → unit → integration → build:npx → privacy gate. `prisma` is available as devDep after `npm ci`. Steps are ordered correctly.

#### Suggestions (Non-blocking)

1. **`validate:source-web` omits `build:npx`.** The local validation script runs lint/test/integration/privacy but skips the Next.js build. CI includes it. This means CI can fail on build errors that `validate:source-web` wouldn't catch locally. Consider adding `npm run build:npx` to the local gate (accepting the ~2-3 min cost) or documenting it as a CI-only step.

2. **`test:smoke:web` scope.** It only runs `cli-helpers.test.ts`, not `bootstrap-db.test.ts`. Both are covered by `npm test`, so nothing is missing from the pipeline. But the "smoke:web" name suggests broader web/CLI coverage than it delivers. Consider renaming to `test:cli-helpers` or including the bootstrap test.

3. **CI caching.** No `.next` build cache configured. Not needed now, but if CI times become painful, `actions/cache` on `.next/cache` would help.

#### Answers to #009 Questions

1. **`npm pack` + `npx` end-to-end test:** Defer to Phase 50W. It requires either publishing to a registry or a local `npm pack && npm install -g` flow. It's a release validation step, not a development QA gate. The current unit/integration coverage plus the CI build:npx step provide sufficient confidence for 49W.

2. **`build:npx` in CI (~2-3 min):** Keep it in the main CI workflow. It's the single most important gate for the NPX distribution path — if the standalone build breaks, everything downstream fails. The cost is acceptable for a repo of this size. Splitting it into a separate workflow adds complexity without clear benefit.

#### Phase 49W Deliverable Status

| Deliverable | Status | Evidence |
|---|---|---|
| Bootstrap schema parity test | Done | `bin/__tests__/bootstrap-db.test.ts` — 5 PRAGMA-based tests |
| CLI launch smoke tests | Done | `bin/__tests__/cli-helpers.test.ts` — 16 tests |
| CI job for web/CLI | Done | `.github/workflows/ci.yml` — unit, integration, build, privacy |
| Clean-clone validation for NPX | Partial | CI runs `npm ci` + full pipeline; full `npm pack` + `npx` deferred to 50W |
| Release-candidate signoff table | Deferred | Appropriate for Phase 50W with the end-to-end test |

Recommend marking Phase 49W as `[Completed]` in IMPLEMENTATION_PLAN.md. Phase 50W (Electron deprecation + release transition) is next and final.

#### Next Checkpoint Scope

- **Phase 50W: Electron Deprecation + Release Transition**
  - Remove or archive Electron runtime code (`desktop/`, electron-builder.yml, entitlements)
  - Prune Electron dependencies (electron, electron-builder from devDeps)
  - Remove desktop-specific test/script references (test:smoke, validate:source-desktop, electron:dev, electron:build)
  - `npm pack` + local install end-to-end validation
  - Release-candidate signoff table (product, onboarding, security, distribution, OSS)
  - Migration notes for desktop users
  - Final privacy gate against web/CLI artifacts
- Done when: main branch has no active Electron dependency and `npm pack` produces a clean installable package

---

### #009 [C→A] Phase 49W: QA/CI for Web + CLI Distribution

**Date:** 2026-02-20
**Branch:** main
**Commit(s):** pending
**Phase/Task:** Phase 49W — QA/CI for Web + CLI Distribution

#### Goal

Deliver the bootstrap schema parity test (deferred from 48W), CLI smoke tests, and a CI pipeline for the web/CLI distribution path.

#### Changes

**A. `bin/cli-helpers.mjs` — Extracted pure helpers (~90 lines)**

Moved 4 functions out of `bin/cli.mjs` for testability:
- `resolveDataDir()` — OS-specific data dir resolution (darwin/win32/linux)
- `findFreePort(preferred?)` — net.createServer on port 0 with EADDRINUSE fallback
- `waitForServer(url, timeoutMs)` — http polling until status < 500 or timeout
- `parseArgs(argv)` — returns `{ port, noOpen, help, version }`

**B. `bin/cli.mjs` — Refactored to import from cli-helpers**

No behavior change. Removed inline definitions of the 4 extracted functions, now imports from `./cli-helpers.mjs`. Uses `parseArgs()` return object instead of inline arg checks.

**C. `bin/__tests__/bootstrap-db.test.ts` — Schema parity test (5 tests)**

Tests `bootstrapDb()` against a temp SQLite file:
- Creates all 7 tables (Project, Scan, Derived, Llm, Override, Metadata, Activity)
- Correct columns and types per table (verified against `prisma/schema.prisma`)
- All 7 indexes created (6 unique + 1 composite Activity_projectId_createdAt_idx)
- FK constraints on all 6 child tables point to Project
- Idempotency: calling `bootstrapDb` twice on same file doesn't throw

**D. `bin/__tests__/cli-helpers.test.ts` — CLI smoke tests (16 tests)**

- `parseArgs` (8 tests): --port, --no-open, --help/-h, --version/-v, defaults, combined flags
- `resolveDataDir` (4 tests): darwin, win32, linux default, linux with XDG_DATA_HOME
- `findFreePort` (2 tests): mocked net, returns numeric port, passes preferred port
- `waitForServer` (2 tests): mocked http, resolves on status < 500, rejects after timeout

**E. `.github/workflows/ci.yml` — Web/CLI CI pipeline**

Triggers on push to main and pull requests. Steps: checkout → Node 20 → npm ci → prisma generate → npm test → npm run test:integration → npm run build:npx → npm run check:privacy.

**F. Config changes**

- `vitest.config.ts`: Added `bin/__tests__/*.test.ts` to include pattern
- `package.json`: Added `test:smoke:web` and `validate:source-web` scripts

#### Files Touched

- `bin/cli-helpers.mjs` (new)
- `bin/__tests__/bootstrap-db.test.ts` (new)
- `bin/__tests__/cli-helpers.test.ts` (new)
- `.github/workflows/ci.yml` (new)
- `bin/cli.mjs` (modified — import extraction, no behavior change)
- `vitest.config.ts` (modified — added bin test include)
- `package.json` (modified — added 2 scripts)
- `docs/internal/claude-review.md` (this entry)

#### Validation

```
npm test → 195 passed (174 existing + 21 new, 0 failed)
npm run test:integration → 73 passed (0 failed)
```

Schema parity confirmed: all 7 tables, all columns/types match Prisma schema, all 7 indexes, all FK constraints verified via PRAGMA queries.

#### Risks / Open Items

- CI workflow not yet tested in GitHub Actions (no push yet — pending commit approval)
- `npm run build:npx` and `npm run check:privacy` not re-run in this session (no code changes to build output)
- Full `npm pack` + `npx` end-to-end test still deferred (would require publishing or local pack install)

#### Questions for Claude A

1. The plan mentioned an `npm pack` + `npx` end-to-end test and release-candidate signoff table — should these be added in this phase or deferred to Phase 50W?
2. CI runs `npm run build:npx` which requires a full Next.js build. This will be slow in CI (~2-3 min). Should we gate it behind a separate workflow or keep it in the main CI?

---

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
