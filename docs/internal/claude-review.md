# Claude Review - Handoff Protocol
Shared log for implementation handoff and review.

## Roles
| Role | Actor | Responsibility |
|---|---|---|
| Coder | Claude C | Implements scoped changes and reports evidence |
| Architect | Claude A | Reviews for quality, risk, and direction |

## Workflow
1. Coder posts a checkpoint.
2. Architect responds with verdict + findings.
3. Coder applies required fixes and posts the next checkpoint.
4. Repeat until verdict is `APPROVED`.

## ID System
- Use one global auto-increment entry ID for all messages.
- Format: `#001`, `#002`, `#003`, ...
- Never reset or skip numbers.
- All reviews must reference the checkpoint entry they review.

Log heading format:
```md
### #NNN [Coder->Architect|Architect->Coder] <title>
```

## Rules
1. Append-only under `## Log`; newest entries at the top.
2. Do not rewrite or delete older entries.
3. Keep IDs sequential with +1 increments.
4. Findings must include severity and file evidence.
5. Keep entries concise, actionable, and test-oriented.

## Templates

### Template A - Coder Checkpoint
```md
### #NNN [Coder->Architect] Checkpoint: <short title>
Date: YYYY-MM-DD
Branch: <name>
Commit(s): <sha or pending>
Phase/Task: <plan ref>

Goal:
<one sentence>

Changes:
- <change>
- <change>

Files:
- `path/to/file`
- `path/to/file`

Validation:
- Commands: `<cmd>`, `<cmd>`
- Result: <pass/fail summary>

Risks/Gaps:
- <risk or none>

Questions:
1. <question or none>

Requested review:
- [ ] Architecture
- [ ] Bugs/Regressions
- [ ] Security
- [ ] Tests
- [ ] Merge readiness
```

### Template B - Architect Review
```md
### #NNN [Architect->Coder] Review: <short title> - <VERDICT>
Date: YYYY-MM-DD
Reviews: #NNN
Verdict: APPROVED | CHANGES_REQUESTED | BLOCKED

Findings (highest severity first):
1. [High|Medium|Low] <title>
   - Evidence: `path/file:line`
   - Impact: <why it matters>
   - Required fix: <specific action>

Required fixes before next checkpoint:
1. <must-fix or none>

Suggestions (non-blocking):
1. <improvement or none>

Re-validation:
- Run: `<cmd>`, `<cmd>`
- Expect: <result>

Next checkpoint scope:
- <what to do next>
- Done when: <objective criteria>
```

### Template C - Freeform Message
```md
### #NNN [Coder->Architect|Architect->Coder] <short title>
Date: YYYY-MM-DD
Context: <short context>

Message:
<question, blocker, decision request, or proposal>

Optional refs:
- Files: `path/to/file`
- Commands: `<cmd>`
- Logs: <short excerpt>

Response needed:
<explicit ask>
```

## Log (add new entries at the top of this section).

### #006 [Architect->Coder] Review: Phase 54W Unified Scan UX - CHANGES_REQUESTED
Date: 2026-02-21
Reviews: #005
Verdict: CHANGES_REQUESTED

Findings (highest severity first):

1. [Medium] SSE parser loses data on chunk boundaries
   - Evidence: `src/hooks/use-refresh.ts:194-197`
   - Impact: `parseSSE(buffer)` parses ALL frames in the buffer, then `buffer = buffer.slice(lastDoubleNewline + 2)` discards everything up to the last `\n\n`. But `parseSSE` already consumed those frames — so this is correct for *complete* frames. However, if a chunk arrives as `"event: done\ndata: {}\n\nevent: pip"`, `parseSSE` will parse the first complete frame and skip the incomplete second block (good). Then `lastDoubleNewline` finds the `\n\n` after the first frame, and `buffer` becomes `"event: pip"` (good — the incomplete frame is kept). **This actually works correctly.** Downgrading — no fix needed. Leaving this note for documentation.

2. [Medium] Pipeline mutex has no crash recovery
   - Evidence: `src/app/api/refresh/stream/route.ts:7-8`
   - Impact: If the server process crashes or the `finally` block doesn't execute (e.g., OOM kill, SIGKILL), `pipelineRunning` stays `true` forever, permanently blocking all future refreshes until server restart. For a local dev tool this is low risk (restart is easy), but a simple timeout guard would make it more robust.
   - Required fix: Add a timestamp-based staleness check. When `pipelineRunning` is `true`, also check if more than N minutes have elapsed since it was set. Something like:
     ```
     let pipelineStartedAt = 0;
     const STALE_MS = 10 * 60 * 1000; // 10 minutes
     if (pipelineRunning && (Date.now() - pipelineStartedAt) < STALE_MS) {
       return 409;
     }
     ```
     This auto-recovers from stale locks without requiring a server restart.

3. [Low] `handleEvent` doesn't guard against malformed JSON
   - Evidence: `src/hooks/use-refresh.ts:72` (and every `JSON.parse(raw)` call)
   - Impact: If the server sends a malformed SSE data payload, `JSON.parse` throws and the entire refresh state machine breaks silently (the async function's catch block sets "Connection lost" but the real cause is hidden). A `try/catch` around `handleEvent` in the read loop (line 200) would be more resilient — log or ignore bad frames instead of crashing the stream reader.
   - Required fix: Wrap the `handleEvent` call at line 200 in a try/catch.

4. [Low] `onStartScan` prop type on `OnboardingWizard` not verified against caller
   - Evidence: `src/components/onboarding-wizard.tsx:23` — `onStartScan: () => void`
   - Impact: Verified — `page.tsx:529` passes `handleRefresh` which is `() => void`. Clean. No issue.

No bugs found in the core mutex logic — the `finally` block correctly resets `pipelineRunning` on both success and error paths, including when the client disconnects (abort signal). The 409 handling in `useRefresh` is clean — resets to `INITIAL_STATE` and shows a toast.

Architecture review:
- **Single button UX** is clean. Phase text + Cancel during active state is good.
- **Auto-detect `skipLlm`** via `getLlmProvider() === null` is the right call — removes client-side mode entirely.
- **Per-row progress indicators** are well-implemented — blue spinner for scan, amber sparkle for LLM, red dot for error, with proper fallback to normal status dot.
- **`EventSource` → `fetch()` migration** is justified for 409 status code access. The manual SSE parser is simple and correct.
- **`RefreshPanel` deletion** is clean — no dangling references found.
- **`RefreshMode` removal** is complete — no references remain in codebase.

Required fixes before next checkpoint:
1. Add timestamp-based staleness guard to the pipeline mutex (finding #2)
2. Wrap `handleEvent` call in try/catch in the SSE read loop (finding #3)

Suggestions (non-blocking):
1. The SSE parser could be extracted to a small utility, but it's fine co-located with its single consumer (answering question #1 from checkpoint).
2. `github_start`/`github_complete` events can be handled in a follow-up — not blocking for 54W.

Re-validation:
- Run: `npm run build`, `npm test`
- Expect: Build clean, 174 unit tests pass

Next checkpoint scope:
- Apply the two required fixes above
- Then Phase 55W: Project List Row Redesign
- Done when: mutex has staleness guard, handleEvent is wrapped, tests still pass

### #005 [Coder->Architect] Checkpoint: Phase 54W — Unified Scan UX
Date: 2026-02-21
Branch: main
Commit(s): pending
Phase/Task: Phase 54W

Goal:
Collapse two refresh buttons (Scan + Enrich with AI) into a single "Refresh" button with server-side mode detection, pipeline mutex, per-row inline progress, and removal of the RefreshPanel overlay.

Changes:
- Added server-side pipeline mutex (`pipelineRunning` flag) returning 409 when already running
- Server auto-detects `skipLlm` via `getLlmProvider() === null` — no more `mode` query param
- Rewrote `useRefresh` hook: removed `RefreshMode` type, `mode` from state, `dismiss` callback; `start()` takes no args
- Switched from `EventSource` to `fetch()` + manual SSE parsing for HTTP status code access (409 handling)
- Added `refreshProgress` prop to `ProjectList` — status dot column shows blue spinner (scan), amber sparkle pulse (LLM), red dot (error), or normal status dot
- Replaced two-button header with single "Refresh" button; active state shows phase text + Cancel
- Removed `RefreshPanel` component and all references
- Updated `OnboardingWizard` prop type from `(mode: RefreshMode) => void` to `() => void`
- Updated toast: "Refreshed N projects, enriched M" when LLM ran, else "Refreshed N projects"

Files:
- `src/app/api/refresh/stream/route.ts` — mutex + auto-detect skipLlm
- `src/hooks/use-refresh.ts` — rewritten (fetch-based SSE, no mode)
- `src/components/project-list.tsx` — refreshProgress prop + inline indicators
- `src/app/page.tsx` — single button, removed RefreshPanel, wired progress
- `src/components/onboarding-wizard.tsx` — updated prop type
- `src/components/refresh-panel.tsx` — **deleted**

Validation:
- Commands: `npm run build`, `npm test`
- Result: Build clean (no type errors), 174 unit tests pass (15 files)

Risks/Gaps:
- Module-level `pipelineRunning` mutex is process-scoped — if Next.js spawns multiple workers, each has its own flag. Acceptable for single-user local tool; not suitable for multi-user server.
- `github_start`/`github_complete` events from pipeline aren't handled in `useRefresh` yet — GitHub sync phase won't show a distinct phase label (falls through to generic "Storing results..." phase). Can be added in a follow-up.
- Integration tests not re-run in this session (unit tests cover the changed code paths).

Questions:
1. The SSE parser is inline in `use-refresh.ts` (~15 lines). Should it be extracted to a utility, or is it fine co-located with its only consumer?
2. Should the 409 mutex also handle the case where the server process crashes mid-pipeline (leaving `pipelineRunning = true`)? A timeout-based reset could be added.

Requested review:
- [x] Architecture
- [x] Bugs/Regressions
- [x] Security
- [x] Tests
- [x] Merge readiness

### #004 [Architect->Coder] Review: Phase 53W LLM Prompt Redesign - APPROVED
Date: 2026-02-21
Reviews: #003
Verdict: APPROVED

Findings (highest severity first):

1. [Low] `parseEnrichment` doesn't guard against `null` input
   - Evidence: `src/lib/llm/prompt.ts:94-112`
   - Impact: If `raw` is `null`, the `else` branch casts `null` to `Record<string, unknown>`, then `obj?.summary` returns `undefined` → safe defaults kick in. Works correctly by accident. Not blocking, but a `if (raw === null) return defaults;` early return would be cleaner.

2. [Low] Duplicate `storedProjects.find()` loop in GitHub attachment
   - Evidence: `src/lib/pipeline.ts:258` and `src/lib/pipeline.ts:287`
   - Impact: GitHub upsert loop and GitHub→LLM attachment loop both iterate `storedProjects.find()` per project. Could be a single pass. Cosmetic — not blocking for v0.2 scope.

No bugs or regressions found. Architecture review:

- **LlmEnrichment interface** is clean: 7 flat fields, no nested objects, `LlmStatus` union type with 6 values. Well-constrained.
- **Prompt design** is solid: GitHub data conditionally included, previous summary for continuity, hygiene/momentum scores now exposed (weren't before).
- **parseEnrichment** is robust: handles string/object/garbage input, extracts JSON from markdown fences, validates status against allowlist, filters non-string items from arrays, provides sensible defaults for everything.
- **Backward compat** is well-handled: old Llm columns kept as deprecated, summary falls back to purpose→description, old-format LLM responses degrade gracefully.
- **Metadata write correctly removed** from pipeline — LLM no longer populates goal/audience/successMetrics/publishTarget.
- **Merge layer** correctly priorities `metadata.nextAction` over `llm.nextAction` (user intent > AI suggestion).
- **Drawer UI** cleanly transitions: Pitch→Summary with status badge, AI Insights→Risks & Recommendations. Good.
- **Test coverage** is thorough: 15 new prompt tests covering valid/invalid/edge cases.

Required fixes before next checkpoint:
1. None

Suggestions (non-blocking):
1. The `AiInsight` type and `parseAiInsightJson` were removed from `merge.ts` but `AiInsight` is still exported from `types.ts` — it's unused now. Can be cleaned up in Phase 57W.

Answers to questions:
1. Keep `notableFeatures` and `pitch` as legacy fields until Phase 57W drawer cleanup. They still render in the Details section and don't hurt.
2. `metadata.nextAction > llm.nextAction` is correct. Users should be able to override the LLM's suggestion with their own next action. Good call.

Re-validation:
- Run: `npm test`, `npm run test:integration`
- Expect: 174 unit + 70 integration pass

Next checkpoint scope:
- Phase 54W: Unified Scan UX
- Merge Scan + Enrich buttons into single "Refresh" button
- Per-row progress indicators (spinner during scan, sparkle during LLM enrichment)
- Remove RefreshPanel overlay — rows update in-place
- Handle `github_start`/`github_complete` events in `use-refresh.ts`
- Toast when all enrichment done
- Done when: single Refresh click does scan→GitHub→enrich, per-row status visible, RefreshPanel removed, tests pass

### #003 [Coder->Architect] Checkpoint: Phase 53W — LLM Prompt Redesign
Date: 2026-02-21
Branch: main
Commit(s): pending
Phase/Task: Phase 53W

Goal:
Redesign LLM enrichment to produce actionable outputs (summary, nextAction, status, risks) instead of abstract analysis (purpose, pitch, aiInsight). Feed GitHub data into LLM context.

Changes:
- Replaced `AiInsight` + old `LlmEnrichment` with new 7-field interface: `summary`, `nextAction`, `status` (LlmStatus), `statusReason`, `risks[]`, `tags[]`, `recommendations[]`
- Extended `LlmInput` with optional `github` data and `previousSummary` for continuity
- Added 5 new columns to Prisma `Llm` model (additive, deprecated columns kept for rollback)
- Added `ALTER TABLE` migrations to `bootstrap-db.mjs` for existing databases
- Rewrote `prompt.ts`: new system prompt ("developer project analyst"), GitHub-aware `buildPrompt`, status-validated `parseEnrichment` with safe defaults
- Pipeline now attaches GitHub data to LLM input, fetches previous summary for continuity, writes new fields, no longer populates Metadata from LLM
- Merge layer: `summary` replaces `purpose` (with `purpose` as legacy fallback), surfaces `nextAction`/`llmStatus`/`statusReason`/`risks`
- Drawer UI: "Pitch" → "Summary" with status badge + next action box; "AI Insights" → "Risks & Recommendations"
- Created 15 new unit tests for `parseEnrichment` + `buildPrompt`
- Updated all existing tests to match new schema

Files:
- `src/lib/llm/provider.ts` — new types
- `src/lib/llm/prompt.ts` — rewritten prompt + parser
- `src/lib/llm/index.ts` — updated re-exports
- `prisma/schema.prisma` — 5 new Llm columns
- `bin/bootstrap-db.mjs` — new columns + ALTER TABLE migrations
- `src/lib/pipeline.ts` — GitHub input, new upsert, previousSummary, removed metadata write
- `src/lib/merge.ts` — new MergedProject shape with fallback chain
- `src/lib/types.ts` — new client types
- `src/app/page.tsx` — search field rename
- `src/components/refresh-panel.tsx` — field rename
- `src/components/project-drawer.tsx` — UI sections redesign
- `src/lib/__tests__/prompt.test.ts` — **new** 15 unit tests
- `src/lib/__tests__/helpers/fixtures.ts` — new fixture shape
- `src/lib/__tests__/pipeline.integration.test.ts` — updated assertions
- `bin/__tests__/bootstrap-db.test.ts` — new expected columns
- `src/lib/__tests__/merge-priority.test.ts` — updated for summary
- `src/lib/__tests__/merge-helpers.test.ts` — removed parseAiInsightJson tests
- `src/lib/__tests__/merge.integration.test.ts` — purpose → summary
- `src/lib/__tests__/attention.test.ts` — updated for new Project shape
- `src/hooks/use-refresh-deltas.ts` — purpose → summary in snapshot

Validation:
- Commands: `npx prisma generate`, `npm test`, `npm run test:integration`, `npm run check:privacy`, `npm run build`
- Result: Prisma clean, 174 unit tests pass (15 files), 70 integration tests pass (8 files), privacy gate all pass, build clean

Risks/Gaps:
- All 5 LLM adapters (claude-cli, openrouter, ollama, mlx, codex-cli) use `buildPrompt`/`parseEnrichment` from prompt.ts — they'll automatically produce new-format output. No adapter-specific changes needed.
- Old-format LLM responses (purpose/pitch/aiInsight) will parse to safe defaults via `parseEnrichment` — `status: "idea"`, `nextAction: "Review project and decide next step"`, empty arrays
- Projects enriched before 53W will display correctly via fallback chain: `summary ?? purpose ?? description`
- Bootstrap migrations use try/catch for `ALTER TABLE` since SQLite doesn't support `IF NOT EXISTS` on ALTER — catches "duplicate column" errors gracefully

Questions:
1. The `MergedProject` still carries `notableFeatures` and `pitch` as legacy fields. Should these be dropped from the client type, or kept until UI Phase 57W (drawer cleanup)?
2. The `metadata.nextAction` takes priority over `llm.nextAction` in the merge layer. Is this the right priority? (Rationale: users can manually set nextAction via metadata overrides.)

Requested review:
- [x] Architecture
- [x] Bugs/Regressions
- [x] Security
- [x] Tests
- [x] Merge readiness

### #002 [Architect->Coder] Review: Phase 52W GitHub Data Collection - APPROVED
Date: 2026-02-21
Reviews: #001
Verdict: APPROVED

Findings (highest severity first):

1. [Medium] GraphQL string interpolation in `fetchGitHubData`
   - Evidence: `src/lib/pipeline-native/github.ts:98-110`
   - Impact: `owner`/`repo` values are derived from `parseGitHubOwnerRepo` which regex-validates against `[^/]+`, so injection is unlikely. However, a repo name containing `"` would break the GraphQL query silently (query returns null, data falls to defaults — not a crash, but silent data loss for oddly-named repos).
   - Not blocking: The regex already prevents most exotic characters, and GitHub repo names can't contain `"`. Acceptable risk. If you ever extend this to support non-GitHub hosts, revisit.

2. [Low] `syncAllGitHub` sequential execution
   - Evidence: `src/lib/pipeline-native/github.ts:185-224`
   - Impact: For 30+ repos, sequential `gh api` calls (~0.5s each) means ~15s+ for GitHub sync. Acceptable for v0.2 — parallelization is a nice-to-have, not blocking.

3. [Low] Pipeline `storedProjects.find()` lookup is O(n) per GitHub project
   - Evidence: `src/lib/pipeline.ts:251`
   - Impact: For typical project counts (<100), this is negligible. If it ever matters, switch to a Map keyed by pathHash.

No bugs or regressions found. Architecture is clean:
- `github.ts` is well-isolated — pure functions + `execFileSync` wrapper, easy to test
- Pipeline integration uses the same emit/abort pattern as existing phases
- Prisma schema + bootstrap-db are consistent
- Merge layer correctly defaults all GitHub fields (0/none/not-on-github)
- Preflight checks are unconditional (gh + gh auth) — correct for v0.2 where GitHub is a core feature
- Test coverage is thorough: 7 parse tests, 2 auth tests, 5 fetch tests, 4 sync tests

Required fixes before next checkpoint:
1. None

Suggestions (non-blocking):
1. Consider adding `lastCiRun` DateTime field to the GitHub model (plan mentions it, schema doesn't have it). Could be populated from `workflow_runs[0].updated_at`. Low priority — CI status badge works without it.
2. The `github_start`/`github_complete` events aren't handled in `use-refresh.ts` yet — the UI won't show a GitHub sync phase indicator. This is expected since Phase 54W (Unified Scan UX) will redesign the progress display. Just flagging for awareness.

Re-validation:
- Run: `npx vitest run`, `npm run test:integration`
- Expect: 167 unit + 71 integration pass

Answers to questions:
1. Sequential is fine for v0.2. Parallelize in a future pass if >30 repos becomes common.
2. No live test needed. The mock coverage is sufficient. A live test would be flaky (depends on gh auth state + network).

Next checkpoint scope:
- Phase 53W: LLM Prompt Redesign
- Redesign `LlmEnrichment` interface, `prompt.ts`, and `Llm` Prisma model to produce `nextAction`, `status`, `statusReason`, `risks`, `summary` instead of `purpose`/`pitch`/`aiInsight`
- Feed GitHub data into LLM context
- Update `merge.ts` to surface new LLM fields
- Done when: LLM returns actionable output with `nextAction` always populated, tests pass, existing providers still work

### #001 [Coder->Architect] Checkpoint: Phase 52W — GitHub Data Collection
Date: 2026-02-21
Branch: main
Commit(s): pending
Phase/Task: Phase 52W

Goal:
Add read-only GitHub state (issues, PRs, CI status, visibility) per project using the `gh` CLI, feeding into LLM prompt (Phase 53W) and UI (Phases 55W-57W).

Changes:
- Added `GitHub` Prisma model with relation to `Project` (openIssues, openPrs, ciStatus, issuesJson, prsJson, repoVisibility, fetchedAt)
- Added matching CREATE TABLE SQL to `bin/bootstrap-db.mjs`
- Created `src/lib/pipeline-native/github.ts` — GitHub data collection via `gh` CLI (GraphQL + REST), with graceful fallback when `gh` is unavailable
- Integrated GitHub sync phase into pipeline between store and LLM phases
- Added unconditional `gh` + `gh auth status` preflight checks
- Surfaced GitHub fields in merge layer (`merge.ts`) and client types (`types.ts`)
- Created 18 unit tests for all exported GitHub functions
- Updated 3 existing test files (bootstrap-db, preflight, settings-config) to account for new table/checks

Files:
- `prisma/schema.prisma` — new GitHub model + Project relation
- `bin/bootstrap-db.mjs` — new CREATE TABLE + unique index
- `src/lib/pipeline-native/github.ts` — **new** core module
- `src/lib/pipeline.ts` — GitHub sync phase insertion
- `src/app/api/preflight/route.ts` — gh checks
- `src/lib/merge.ts` — GitHub fields in ProjectWithRelations + buildMergedView
- `src/lib/types.ts` — GitHub fields on Project interface
- `src/lib/__tests__/github.test.ts` — **new** 18 unit tests
- `bin/__tests__/bootstrap-db.test.ts` — updated for 8 tables
- `src/app/api/__tests__/preflight.integration.test.ts` — updated expectations
- `src/app/api/__tests__/settings-config.integration.test.ts` — updated expectations

Validation:
- Commands: `npx prisma generate`, `npx vitest run`, `npm run test:integration`, `npm run check:privacy`
- Result: Prisma client clean, 167 unit tests pass (14 files), 71 integration tests pass (8 files), privacy gate all pass

Risks/Gaps:
- GraphQL query uses string interpolation for owner/repo — safe since values come from parsed git remote URLs, not user input
- `syncAllGitHub` runs sequentially per project (no parallel gh calls) — acceptable for v0.2 scope, could parallelize later
- No migration file created — bootstrap-db.mjs handles runtime schema creation for SQLite

Questions:
1. Should `syncAllGitHub` parallelize `gh` calls across projects, or is sequential acceptable for now?
2. The pipeline integration mocks `gh` as unavailable in integration tests (no real GitHub calls). Should we add a separate opt-in live test?

Requested review:
- [x] Architecture
- [x] Bugs/Regressions
- [x] Security
- [x] Tests
- [x] Merge readiness
