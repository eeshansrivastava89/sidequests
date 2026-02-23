## v0.3.2

Two-pass pipeline, LLM ordering fix, and doc reconciliation.

### Two-Pass Pipeline
- **Pass 1 (Fast Scan):** scan → derive → store → GitHub for ALL projects — dashboard populates immediately
- **Pass 2 (AI Scan):** LLM enrichment one-by-one, sorted by last commit date (most recent first)
- Fixes: AI Scan and new-user "Scan Now" no longer block on per-project LLM before showing results

### LLM Ordering
- LLM pass now sorts by `lastCommitDate` from scan data, not alphabetically
- Works correctly even for first-time users with no prior DB data

### Visual Cleanup
- Removed `row-scan-complete` blue border artifact (every row got it simultaneously with two-pass pipeline)

---

## v0.3.0

Sequential per-project pipeline, GitHub in fast scan, and alpha disclaimers.

### GitHub Data in Fast Scan
- GitHub fetch (issues, PRs, CI status, visibility) is now part of the fast scan path
- Previously gated behind LLM — fast scan now delivers on its tooltip promise
- GitHub data still feeds into LLM prompt when running AI scan

### Activity Log Improvements
- All projects pre-populated immediately from directory enumeration
- Per-project LLM timing shown in activity log ("Done 12.3s")

### Alpha Disclaimers
- Dashboard: amber banner above footer warning about token usage and dev root targeting
- Settings modal: matching disclaimer about LLM provider and scan scope

### Toast Fix
- Fast scan toast now says "Scanned N projects." instead of incorrectly saying "Running AI scan..."

### Config Cleanup
- Removed `llmConcurrency` from entire config chain (settings, API, UI, types)

### Internal
- 238 unit tests across 23 files
- New `listProjectDirs()` lightweight enumeration in scan.ts
- SSE protocol change: `enumerate_complete` now carries `names[]` array
- `skipLlm` tracked in RefreshState for conditional UI behavior
