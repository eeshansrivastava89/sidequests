# Release Notes

## v0.3.7

- Insight bullets are now color-coded by severity: green (strength), amber (at-risk), red (critical)
- LLM prompt returns `{text, severity}` objects instead of plain strings — old data gracefully defaults to amber
- Markdown files (`.md`) now count toward LOC, TODO, and FIXME totals — fixes blank stats for docs-only projects

## v0.3.6

- Scan all subdirectories of devRoot by default, not just git repos or recognized projects
- New "Include Non-Git Directories" toggle in Settings to restore old filtered behavior
- Previously hidden folders (e.g. `mcp-servers`, `family-medical-portal`, `tts-es`) now appear automatically

## v0.3.5

- Version update check on CLI startup (non-blocking npm registry query)
- New `/api/version` endpoint with 1-hour cache
- Dashboard header shows amber "vX.Y.Z available" pill when a newer version exists

## v0.3.4

- Fix `gh auth` detection when multiple GitHub accounts are configured
- Switch from `gh auth status` (fails if any account has invalid token) to `gh auth token` (checks active account only)
- Add info banner on dashboard when GitHub CLI features are unavailable

## v0.3.3

- Reconcile all project docs for v0.3.x
- Publish updated README to npm

## v0.3.2

- Remove blue `row-scan-complete` border artifact (every row got it simultaneously with two-pass pipeline)
- LLM pass now sorts by `lastCommitDate` from scan data instead of alphabetically
- Works correctly for first-time users with no prior DB data

## v0.3.1

- Two-pass pipeline: fast scan all projects first (scan/derive/store/GitHub), then LLM one-by-one
- Dashboard populates immediately during pass 1 instead of blocking on per-project LLM
- AI Scan and new-user "Scan Now" no longer wait for LLM before showing results

## v0.3.0

- Pipeline rewritten from bulk batch phases to per-project sequential flow (scan -> derive -> store -> GitHub -> LLM)
- GitHub fetch (issues, PRs, CI status, visibility) moved to fast scan path — no longer gated behind LLM
- Activity log pre-populates all projects immediately from directory enumeration
- Per-project LLM timing shown in activity log
- Alpha disclaimers added to dashboard footer and settings modal
- Fast scan toast now says "Scanned N projects" instead of incorrectly saying "Running AI scan..."
- Removed `llmConcurrency` from entire config chain
- New `listProjectDirs()` lightweight enumeration for pass 1
- SSE protocol: `enumerate_complete` now carries `names[]` array

## v0.2.1

- Split single Refresh button into Fast Scan (deterministic) + AI Scan (fast + LLM) with tooltips
- New floating Activity Log panel with real-time per-project status, provider/model info, progress counter
- Add `dirtyFileCount` end-to-end (schema, pipeline, merge, types, UI badges)
- Scan status badges on project rows and detail pane (Scanned/AI scanned timestamps)
- Simplify terminology: "LLM enrichment" -> "AI scan" everywhere
- Enhanced progress bar (4px, glow, slower animation) and row shimmer (purple inset glow)
- Per-project LLM error tracking (`llmError` column)
- Remove GitHub link from table rows (stays in detail pane)
- Replace language column with Issues, PRs, CI, Visibility columns (clickable links to repo)
- Action buttons (VS Code, Claude, Terminal) always visible in table rows
- Deprecate `sanitizePaths` — default to false, remove toggle, remove conditional guards
- Remove dead code: `sanitizePaths`, `notableFeatures`, `pitch`, duplicate helpers
- Single config source: `settings.json` only (remove env var fallback chain)
- Disable openrouter/ollama/mlx in UI pending observability (backend intact)
- Tighten gitignore: `.claude/`, `.codex/`, `.npm-cache/`, `*.tgz`

## v0.2.0

- GitHub data collection via `gh` CLI — issues, PRs, CI status, repo visibility per project
- LLM prompt redesign: actionable outputs (summary, nextAction, status, risks) instead of abstract analysis
- GitHub data fed into LLM context for richer enrichment
- Collapse Scan + Enrich into single Refresh button with auto-detected LLM availability
- Pipeline mutex with staleness guard prevents duplicate runs
- Per-row inline progress indicators (spinner/sparkle/error)
- Two-line project rows (name+badges / nextAction+GitHub)
- Five signal cards with clickable filters
- Drawer reorganized around summary, next action, risks, and GitHub
- Split workspace layout: scrollable project list + 420px detail pane on desktop, full-screen dialog on mobile
- Preflight tiers (required/optional) with color-coded badges and 3-state banner
- Provider "none" fallback: both "" and "none" resolve to claude-cli
- `/api/projects` returns 200 with empty results on fresh DB instead of 503
- CI status enum normalized to success/failure/pending/none
- LLM-sourced framework and primary language detection
- 240 unit tests across 23 files
- Prisma 7 alignment, draft GitHub Releases on tag push

## v0.1.7

- Scrub build-machine paths from `server.js` to prevent local path leakage
- Add path gate to block serving if paths are detected

## v0.1.6

- Strip all `*.db` files from standalone bundle, not just `dev.db`

## v0.1.5

- Strip private data from npm tarball: `dev.db`, `settings.json`, `prisma/*.db`, `docs/internal/`
- Add privacy gate that fails build on forbidden files in tarball
- Merge CI and publish into single workflow (publish only on `v*` tags)
- Fixes data leak in v0.1.0-v0.1.4 where local DB and settings were included in package

## v0.1.4

- Redesign README with screenshots, badges, and user-friendly layout

## v0.1.3

- Add repository URL and license to `package.json` for npm provenance

## v0.1.2

- Fix `NODE_AUTH_TOKEN` in publish workflow
- Remove duplicate tests

## v0.1.1

- Initial public release as `@eeshans/sidequests` on npm
- CLI launcher via `npx @eeshans/sidequests` with NPX bootstrap
- Remove Electron — web/CLI-only distribution
- Platform-aware build script with OIDC trusted publishing
- Data directory at `~/.sidequests` on all platforms
- LLM always-on with model selection and toast system
- Dark mode with Catppuccin Mocha theme
- Onboarding wizard for first-run setup
- Preflight checks for system dependencies
- Settings UI with score re-architecture
- Project drawer with detail pane, quick actions (VS Code, Claude, Codex)
- Sort/filter controls, project pinning, soft-prune on refresh
- Scan pipeline with derive scoring (health, hygiene, momentum)
- LLM enrichment via Claude CLI / Codex CLI
- Activity timeline and session memory
- 188 unit + integration tests
