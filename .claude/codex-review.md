# Codex Review (Updated): Post-Progress Simplification Plan

## Context
This is a fresh review after recent implementation progress (Phases 22-28). Goal remains the same: **smaller codebase, same behavior**, with preference for shared helpers and framework/library primitives over custom duplication.

## What Improved Since Last Review
1. UI polish landed in key areas:
   - Deterministic list grid tracks and better alignment in `src/components/project-list.tsx`.
   - Language/framework fallback label logic in `src/components/project-list.tsx`.
   - Drawer refactored to a single-column action-first flow in `src/components/project-drawer.tsx`.
2. `scripts` contract was partially aligned to `string[]` in merge/types/UI:
   - `src/lib/merge.ts`, `src/lib/types.ts`, `src/components/project-drawer.tsx`.
3. Keyboard shortcut feedback parity improved in `src/app/page.tsx` (toasts for copy/open actions).
4. Implementation plan reflects completion through Phase 28 in `IMPLEMENTATION_PLAN.md`.

## Priority Simplification Plan (Remaining)

---

## Chunk 1: Fix Contract Drift and Latent Data Bugs (Highest Priority)

### Why
There are still cross-layer mismatches that create hidden complexity and correctness risk.

### Tasks
1. **Fix derived tags merge bug**
   - Current code parses `derivedData.tags` as if it were a JSON string; `derivedData.tags` is already an array.
   - Use array directly (or robust type guard) in merge fallback chain.
   - Files: `src/lib/merge.ts`

2. **Align `recentCommits` shape end-to-end**
   - Scanner emits `{hash,date,message}` but types still expect `author`.
   - Choose one canonical shape:
     - Either add author in scanner git log output, or
     - remove `author` from TS types.
   - Files: `pipeline/scan.py`, `src/lib/types.ts`, `src/lib/merge.ts`

3. **Align `license` type across scan/merge/types**
   - Scanner emits boolean; types declare `string | null`.
   - Normalize to one representation and update all consumers.
   - Files: `pipeline/scan.py`, `src/lib/types.ts`, `src/lib/merge.ts`

4. **Make health-score signals real**
   - `derive.py` checks `files.linterConfig`, `files.license`, `files.lockfile`, but scanner doesn’t emit those keys in `files`.
   - Either emit those keys in scan, or update derive to use existing fields.
   - Files: `pipeline/scan.py`, `pipeline/derive.py`

### Deliverables
- No schema/type drift for `tags`, `recentCommits`, `license`, health-score inputs.
- Refresh pipeline and UI behave identically except corrected data quality.

---

## Chunk 2: API/Core Deduplication (Shared Helpers, No Behavior Change)

### Why
Route logic still repeats validation/parsing/error patterns and extra queries.

### Tasks
1. Extract shared PATCH field coercion helper used by both:
   - `src/app/api/projects/[id]/metadata/route.ts`
   - `src/app/api/projects/[id]/override/route.ts`

2. Extract shared JSON response/error helpers (`ok/error`) to remove repeated try/catch envelope boilerplate.

3. Normalize JSON body parsing behavior across routes (consistent 400 vs 500 handling for invalid JSON).

4. Introduce shared `safeJsonParse` utility and use in activity payload parsing + merge parsing paths.

5. Reduce duplicate “find project then write” where safe (avoid unnecessary pre-check queries when Prisma not-found handling can preserve semantics).

### Deliverables
- Route files are shorter and consistent.
- Response envelopes/status semantics unchanged.
- No functionality loss.

---

## Chunk 3: Frontend Redundancy Cleanup + Dead Code Removal

### Why
UI still contains repeated utilities and unused files that bloat maintenance.

### Tasks
1. Remove unused files/components if still unreferenced:
   - `src/components/project-card.tsx`
   - `src/components/ui/card.tsx` (if only used by `project-card`)
   - `src/components/ui/sheet.tsx`
   - `src/components/ui/separator.tsx`
   - unused exports like `TabsContent` if truly unreferenced

2. Extract shared quick-actions component (icons + copy + touch telemetry) used by list and drawer.

3. Extract shared helpers:
   - `needsAttention`
   - health color
   - time formatting helpers

4. Remove unused hook state:
   - `refreshing` in `src/hooks/use-projects.ts` and consumer destructure in `src/app/page.tsx`.

### Deliverables
- Fewer files and less repeated logic.
- UI behavior unchanged.

---

## Chunk 4: Config/Docs/Tooling Source-of-Truth Cleanup

### Why
Config/documentation still has multiple representations and stale ambiguity.

### Tasks
1. Decide and enforce one config surface:
   - If env-only (current runtime), remove `config.example.json` and references.

2. Align README/ARCHITECTURE with actual runtime:
   - Node version requirement matching current Next version.
   - Clarify whether “LibSQL adapter” is operationally relevant for local default.
   - Ensure README env table includes active LLM vars in `.env.local.example`.

3. Remove empty `next.config.ts` if intentionally unused.

4. Move `prisma` CLI package to `devDependencies` if not required at runtime.

### Deliverables
- Single source-of-truth for config instructions.
- Reduced tooling/config surface with no runtime behavior change.

---

## Chunk 5 (Optional, Last): Data Model Redundancy Reduction

### Why
Data is still duplicated across raw scan JSON, derived JSON, and promoted columns.

### Tasks
- Choose one storage strategy for derived/scanned fields and tag provenance:
  - keep query-critical scalar columns + minimal JSON blobs, or
  - keep JSON-first model with fewer duplicated scalar fields.
- Plan this as a dedicated migration/refactor after Chunks 1-4.

### Deliverables
- Clear source-of-truth boundaries in data model.
- Reduced duplication with migration safety.

---

## Verification Checklist
1. Run full refresh and confirm no pipeline/type errors.
2. Validate tags/commits/license render correctly in list + drawer.
3. Confirm metadata/override patch behavior unchanged.
4. Confirm all quick actions + keyboard shortcuts unchanged.
5. Confirm API response envelopes remain backward compatible.
6. Confirm docs match actual runtime setup and flags.
7. Confirm dead-file removals do not break imports/build.

## Execution Guidance
- Implement chunk-by-chunk in small PRs.
- Do not combine Chunk 5 with earlier cleanup PRs.
- If any simplification changes behavior, stop and document the tradeoff before merging.
