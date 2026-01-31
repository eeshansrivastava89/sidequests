# Projects Dashboard v2 - Architecture

## Roles
- Codex: architecture, review, and planning.
- Claude: implementation and coding.

## Requirements
- Deterministic scan of DEV_ROOT with explainable rules.
- Qualitative enrichment via LLM (optional).
- Manual edits persist across refreshes.
- O-1 evidence features are fully gated by configuration and disabled by default.
- Open-source ready with path sanitization and sample data.

## Recommended Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- SQLite + Prisma
- Python 3 for scanning and deterministic derivation
- LLM providers behind an interface (Claude CLI adapter, optional OpenAI adapter)

## High-Level Flow
User UI -> Next.js API -> SQLite
  |-> Python scan (raw facts)
  |-> Deterministic derive (status, health, tags)
  |-> LLM enrichment (purpose, recs, takeaways) if enabled
  |-> Merge overrides + metadata into a single view

## Merge Priority (highest wins)
1) Overrides (manual edits)
2) Metadata (project evidence and workflow fields)
3) Deterministic derived fields
4) LLM fields
5) Raw scan

## Config and Feature Flags
Configuration must be file or env driven:
- DEV_ROOT
- EXCLUDE_DIRS
- FEATURE_LLM (true/false)
- FEATURE_O1 (true/false, default false)
- SANITIZE_PATHS (true by default for OSS)

If FEATURE_O1 is false, O-1 UI and exports are hidden and not generated.

## Data Model (Prisma)
Suggested tables:

Project
- id, name, pathHash, pathDisplay, createdAt, updatedAt

Scan
- projectId, rawJson, scannedAt

Derived
- projectId, statusAuto, healthScoreAuto, derivedJson

LLM
- projectId, purpose, tagsJson, notableFeaturesJson, recommendationsJson, takeawaysJson, generatedAt

Override
- projectId, statusOverride, purposeOverride, tagsOverride, notesOverride, manualJson, updatedAt

Metadata
- projectId, goal, audience, successMetrics, nextAction, publishTarget, evidenceJson, outcomesJson

Activity
- projectId, type, payloadJson, createdAt

Path identity rules:
- Use pathHash for stable identity and privacy.
- pathDisplay is sanitized in OSS mode.

## Deterministic Pipeline
scan.py
- Raw scan for git info, language indicators, file flags, TODO counts.
- Skip non-project folders unless they contain language indicators.
- Add pathHash.

derive.py
- Status by daysInactive thresholds.
- Health score by fixed rubric (README, tests, CI, recency, remote, TODOs, deploy).
- Deterministic tags from languages and indicators.

## LLM Enrichment
- Input: raw scan + derived summary.
- Output: purpose, recommendations, notable features, takeaways.
- LLM output must never overwrite overrides.
- Gated behind FEATURE_LLM.

## API Design (Next.js)
Read
- GET /api/projects -> merged view
- GET /api/projects/:id -> detail view

Write
- POST /api/refresh -> scan, derive, optional LLM, merge
- PATCH /api/projects/:id/override -> persist manual edits
- PATCH /api/projects/:id/metadata -> persist metadata
- POST /api/o1/export -> gated export

## UI Features
- Dashboard with stats, filters, and grid
- Project detail drawer with editable fields
- Workflow views: Next Actions, Publish Queue, Stalled
- O-1 Evidence tab visible only when FEATURE_O1 is true

## Open-Source Readiness
- Provide config.example.json
- Provide sample database or sample JSON
- Path sanitization on by default
- LLM optional and off by default
- Clear documentation for local setup

## Guardrails for Implementation
- Overrides always win
- Deterministic logic must be explainable and documented
- O-1 features must be fully gated
- Do not leak absolute paths in OSS mode
