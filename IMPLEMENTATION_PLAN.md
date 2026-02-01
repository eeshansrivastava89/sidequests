# Projects Dashboard v2 - Implementation Plan

This is the step-by-step plan for Claude to implement. Codex will review each phase.

## Status (2026-01-31)
- ✅ Phase 0: Completed
- ✅ Phase 1: Completed
- ✅ Phase 2: Completed
- ✅ Phase 3: Completed
- ✅ Phase 4: Completed
- ✅ Phase 5: Completed
- ✅ Phase 6: Completed
- ✅ Phase 7: Completed
- ✅ Phase 8: Completed

Notes:
- ✅ README setup line fixed (no no-op copy).
- ✅ Pipeline runner spawn timeout handled with manual kill/timeout.

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

## Acceptance Criteria
- Status auto-computed but editable; edits persist across refresh
- Refresh never overwrites overrides
- O-1 features only appear if FEATURE_O1 is true
- OSS mode does not leak absolute paths
- API supports refresh, read, edit, and export (when enabled)

## Checkpoint Reviews (with Codex)
- After Phase 1: data model and merge logic review
- After Phase 2: deterministic pipeline review
- After Phase 4: API surface review
- After Phase 5: UI behavior review
- After Phase 6: O-1 gating review
