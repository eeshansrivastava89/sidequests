# Projects Dashboard v2 - Implementation Plan

This is the step-by-step plan for Claude to implement. Codex will review each phase.

## Status (2026-01-31)
- ✅ Phase 0: Completed
- ✅ Phase 1: Completed
- ⏳ Phase 2: Pending
- ⏳ Phase 3: Pending
- ⏳ Phase 4: Pending
- ⏳ Phase 5: Pending
- ⏳ Phase 6: Pending
- ⏳ Phase 7: Pending

Notes:
- ⚠️ README has a minor follow-up: remove or fix the no-op `cp config.example.json config.example.json` line.

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

## ⏳ Phase 2 - Deterministic Pipeline (Pending)
- Port scan.py from v1 with pathHash and filtering
- Add derive.py with status and health rules
- Add Node runner to execute Python and store results

Deliverables:
- POST /api/refresh writes Scan and Derived tables
- Deterministic status and health are visible

## ⏳ Phase 3 - LLM Integration (Optional, Pending)
- Implement provider interface
- Add Claude CLI adapter
- Gate behind FEATURE_LLM

Deliverables:
- LLM fields appear only when enabled
- No overrides are overwritten

## ⏳ Phase 4 - API Endpoints (Pending)
- GET /api/projects
- GET /api/projects/:id
- PATCH /api/projects/:id/override
- PATCH /api/projects/:id/metadata
- POST /api/refresh
- POST /api/o1/export (gated by FEATURE_O1)

Deliverables:
- End-to-end refresh and edit workflow
- O-1 endpoints return 404 or gated response when disabled

## ⏳ Phase 5 - UI (Pending)
- Dashboard layout and filters
- Project detail drawer with editable fields
- Workflow views: Next Actions, Publish Queue, Stalled
- O-1 Evidence tab gated by FEATURE_O1

Deliverables:
- Manual edits persist across refresh
- Filter and search work

## ⏳ Phase 6 - O-1 Export (Gated, Pending)
- Markdown + JSON export generator
- UI action to export

Deliverables:
- Export works only when FEATURE_O1 is true

## ⏳ Phase 7 - Docs and OSS (Pending)
- README with setup and flags
- config.example.json
- Sample data instructions

Deliverables:
- Clear OSS setup instructions
- No private paths in sample data

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
