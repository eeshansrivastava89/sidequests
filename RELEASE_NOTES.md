# Release Notes

## v0.3.23

- **Fix project row background contrast** — rows now use `bg-card` (white) as their base background instead of inheriting the warm cream page background, matching the table header and giving the list proper contrast against the page

## v0.3.22

- **Fix database migration regression (critical)** — `bootstrap-db.mjs` was missing `locCode`, `locDocs`, and `locGenerated` columns added to the `Derived` table in v0.3.13. Both the `SCHEMA_SQL` initial-creation block and the `MIGRATIONS` additive-alter array were incomplete, causing `prisma.derived.upsert()` to fail with "column does not exist" for all users — new installs and existing databases alike. Columns are now added on next launch for all existing databases. Updated schema parity test to cover the three columns.

## v0.3.21

- **Fix `--muted` surface token** — `tokens.css` defines `--muted` as a mid-weight text tone; shadcn/Tailwind expect it to be a subtle background. Added `--muted: #ede6de` (light) / `--muted: #2e261f` (dark) overrides in `globals.css`, restoring correct tab strip, row hover, panel header, and inline-code backgrounds (26 `bg-muted` usages were broken)
- **Fix `--radius-sm`/`--radius-lg` name collision** — `tokens.css` defines these at 8px/14px in `:root`, conflicting with Tailwind's `@theme inline` values. Re-asserted the full Tailwind radius scale explicitly in `:root` so `rounded-sm`/`rounded-lg` always resolve to the correct derived values
- **Replace Catppuccin hardcodes in scan animations** — `globals.css` shimmer/scan/progress bar animations now use `var(--blue)`, `var(--green)`, `var(--red)`, `var(--primary)` from `tokens.css`, with `color-mix()` for opacity gradients; no more Catppuccin hex values in animation code
- **Fix stats bar accent colors** — replaced hardcoded `#fab387`/`#f38ba8` Catppuccin hex values in `stats-bar.tsx` with `text-amber-500 dark:text-amber-400` and `text-red-500 dark:text-red-400`
- **Fix dark mode FOUC** — added anti-FOUC inline script to `layout.tsx` that reads `localStorage` and sets `data-theme` synchronously before first paint; added `suppressHydrationWarning` to `<html>`; dark-mode users no longer see a flash of the light theme on load

## v0.3.14

- Restore concurrent AI scan with a new Settings slider for `llmConcurrency` (2-5)
- Run LLM enrichment through a bounded worker pool while keeping the deterministic fast-scan pass unchanged
- Fix cancel behavior: reset in-flight UI state immediately, but preserve completed AI scan activity already finished before cancel
- Compact concurrent progress text in the header to avoid truncation beside the Cancel button
- Re-enable Prisma smoke coverage in automation via `prisma validate` and `prisma generate`
- Stabilize integration tests by building the test SQLite database from checked-in migration SQL
- Align Prisma packages to `7.4.1`

## v0.3.11

- **Rewrite Codex CLI backend**: use `spawn` + stdin piping, `--sandbox read-only`, `-o` for clean output capture, prepend system prompt, wire abort signal, strip env vars
- **Rewrite Qwen CLI backend**: add `--system-prompt`, use positional arg (not deprecated `-p`), `--approval-mode plan` (was `auto_edit` — security fix), wire `qwenCliModel` via `-m`
- **Extract shared `runCli()` helper**: deduplicates spawn/timeout/abort/env-cleanup across all CLI providers (claude, codex, qwen)
- **Fix settings System Status panel**: remove stale "COMING SOON" labels from OpenRouter/Ollama, remove MLX check, add Qwen CLI check, show green "Active" badge on selected provider
- **Fix `llmAllowUnsafe` default**: changed from `true` to `false` — safety gate was previously disabled by default
- **Structured pipeline logging**: server logs now show `[pipeline] [provider] project — enriching/done/FAILED` with timing for every LLM call
- **Provider name in UI**: SSE events carry provider name; status bar shows e.g. "qwen-cli: enriching my-app (3/23)" instead of generic "AI scanning"
- **Remove MLX**: removed from provider registry, preflight checks, and settings UI
- **Add Qwen model field**: settings UI now shows model input when qwen-cli is selected
- **Fix stale test**: provider-fields test expected removed `o3` model; add new cli-utils test suite (9 tests)

## v0.3.10

- Enable OpenRouter, Ollama, and Qwen CLI providers in settings UI
- Remove MLX from provider list (per user request)
- Add Qwen CLI provider with headless mode (JSON output, auto-approve)
- Update default models: claude-sonnet-4-6, gpt-5.4
- Codex CLI model simplified to GPT-5.4 only

## v0.3.9

- Activity log now sorts by last commit (most recent first) — matches LLM scan ordering
- Enhanced scan animation: slower (1.2s), thicker line, gradient fade from blue to green
- Fix lint ERR_MODULE_NOT_FOUND — updated eslint-config-next and eslint for compatibility
- Default Claude CLI model is now `claude-sonnet-4-6` (was undefined)

## v0.3.8

- Replace "stale" status with "completed" — for finished projects that work and run occasionally
- New status thresholds: active (0-14d), completed (15-60d), paused (61-180d), archived (180d+)
- Remove "Needs Attention" workflow tab — redundant with uncommitted/open-issues signal filters
- Updated status colors: completed is sky-blue, paused moves to amber

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
