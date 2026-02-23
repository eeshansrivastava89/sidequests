Sequential per-project pipeline, GitHub in fast scan, and alpha disclaimers.

## Sequential Per-Project Pipeline
- Each project now flows through scan → derive → store → GitHub → (LLM) before the next starts
- Replaces bulk batch phases — projects appear in the dashboard as they complete, not all at once
- Projects sorted by most-recently-active first (using DB `lastTouchedAt` from prior scans)

## GitHub Data in Fast Scan
- GitHub fetch (issues, PRs, CI status, visibility) is now part of the fast scan path
- Previously gated behind LLM — fast scan now delivers on its tooltip promise
- GitHub data still feeds into LLM prompt when running AI scan

## Activity Log Improvements
- All projects pre-populated immediately from directory enumeration
- Per-project LLM timing shown in activity log ("Done 12.3s")
- Stagger animation restored for project list rows (150ms delay per project)

## Alpha Disclaimers
- Dashboard: amber banner above footer warning about token usage and dev root targeting
- Settings modal: matching disclaimer about LLM provider and scan scope

## Toast Fix
- Fast scan toast now says "Scanned N projects." instead of incorrectly saying "Running AI scan..."

## Config Cleanup
- Removed `llmConcurrency` from entire config chain (settings, API, UI, types)
- Sequential pipeline makes concurrency setting obsolete

## Internal
- 238 unit tests across 23 files
- New `listProjectDirs()` lightweight enumeration in scan.ts
- SSE protocol change: `enumerate_complete` now carries `names[]` array
- `skipLlm` tracked in RefreshState for conditional UI behavior
