Major update — this release rethinks Sidequests from an observation dashboard into an LLM-first action recommender with GitHub awareness.

## LLM Enrichment (core)
- LLM enrichment is now the core product — summaries, next actions, and insights for every project
- New output: `nextAction`, `status` (building/shipping/maintaining/blocked/stale/idea), `statusReason`, `insights`
- LLM now detects framework and primary language from project context (removed hardcoded detection maps)
- Consolidated risks + recommendations into unified insights — each bullet states the concern and action together
- 5 LLM provider adapters: Claude Code, Codex CLI, OpenRouter, Ollama, MLX

## GitHub Integration (new)
- Open issues, PRs, and CI status pulled from `gh` CLI per project
- Top issue/PR titles shown in detail pane with clickable GitHub links
- Preflight check for `gh` auth status
- Graceful fallback when `gh` is not installed or repo has no remote

## Unified Refresh
- Single "Refresh" button replaces separate Scan + Enrich actions
- SSE-based streaming: scan results appear immediately, LLM enrichment streams per-project in background
- Per-row progress indicators (shimmer during scan, sparkle during enrichment)
- Cancel/restart handshake is robust (no stuck progress states)

## UI Redesign
- Split workspace layout: project list rail on left, persistent detail pane on right
- Project rows: status dot, name, git state, summary, last active, language badge
- Stats cards: Projects, Uncommitted, Open Issues, CI Failing, Not on GitHub — all clickable as filters
- Detail pane: summary, next action, insights, GitHub block, git details, timeline
- Mobile: detail pane becomes full-screen sheet
- Catppuccin Mocha dark mode with orange/gold accents

## Onboarding & Reliability
- Onboarding wizard guides first-run setup (dev root, LLM provider, first scan)
- First scan is two-stage: fast scan + GitHub sync immediately, LLM enrichment continues in background
- Provider/model selection is deterministic (no missing dropdown states)
- Preflight tiers: required checks (Node, git) vs optional (gh, LLM provider)

## Internal
- 240 unit tests across 23 test files
- Prisma CLI aligned to v7 (matches @prisma/client)
- Draft GitHub Releases auto-created on tag push
