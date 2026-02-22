UX polish release — clearer scan controls, real-time activity tracking, and better project status visibility.

## Fast Scan vs AI Scan
- Single "Refresh" button replaced with two distinct actions: **Fast Scan** (deterministic only) and **AI Scan** (fast + LLM)
- Tooltips on each button explain what they do — Fast Scan covers folders, LOC, git history, GitHub data; AI Scan adds summary, status reason, next action, health score, tags
- API supports `?skipLlm=true` query param for programmatic fast-scan-only requests

## Activity Log Panel
- New floating panel at bottom-right showing real-time scan progress
- Lists all projects with live status icons: waiting, scanning, AI scanning, done, failed
- Shows LLM provider and model info (e.g. "Codex CLI · codex-5.3") during scan
- Progress counter and summary bar on completion
- Correctly differentiates fast-scan-only vs AI scan results
- Always visible with friendly empty state; auto-expands when scan starts

## Scan Status Badges
- Project rows now show **"Scanned X ago"** (blue) and **"AI scanned X ago"** (green) badges with relative timestamps
- Red "AI scan failed" badge with error tooltip, grey "No AI scan" for unenriched projects
- Same badges added to project detail pane header
- Removed GitHub link from table rows to reduce visual clutter (stays in detail pane)

## Dirty File Count
- New `dirtyFileCount` field tracks untracked + modified + staged files per project
- Uncommitted badge now shows file count: **"uncommitted (7)"**
- Visible in both project list rows and detail pane

## Visual Enhancements
- Progress bar: thicker (4px), slower animation (2.5s), peach/gold glow effect
- Row enriching shimmer: stronger purple inset glow with deliberate left-to-right sweep
- Settings button gets a tooltip ("Dev root, LLM provider, scan options")

## Terminology
- "LLM enrichment" simplified to "AI scan" across all UI text, toasts, and status messages

## Per-Project LLM Error Tracking
- New `llmError` column on Llm model tracks per-project enrichment failures
- Surfaced as red badge on project rows and in activity log

## Internal
- 237 unit tests across 23 files
- Bootstrap SQL updated with additive migrations for new columns
- shadcn Tooltip component added
