# Codex Review: Open-Source Readiness (Full Analysis + Implementation Plan)

Date: 2026-02-08  
Scope: onboarding readiness for new external users: clone -> minimal setup -> configure -> scan -> enrich

---

## Executive Summary
Readiness status: **Partial / close, but not release-ready for OSS onboarding**.

What is working:
- Settings-first configuration is implemented and functional (`settings.json` + Settings modal + `/api/settings`).
- Core scan/enrich pipeline is integrated end-to-end.
- Path sanitization defaults are OSS-safe.

What blocks a clean OSS experience today:
- Docs are materially out of sync with current behavior/features.
- OSS governance files are missing (`LICENSE`, `CONTRIBUTING`, etc.).
- No single bootstrap command for first run.
- First-run guidance and dependency preflight checks are weak.
- Lint baseline is currently failing.

Current readiness score: **6.5 / 10** -> **Resolved (2026-02-07)**

---

## Findings (Prioritized)

## High

1) Documentation is stale/inaccurate vs current product behavior
- Evidence:
  - README says env-only config (`README.md:50`) while app uses settings API and modal (`src/hooks/use-config.ts:49`, `src/app/api/settings/route.ts:5`).
  - README documents `/api/o1/export` (`README.md:153`) but no such route exists under `src/app/api`.
  - README still documents old single-score model (`README.md:106`) while UI uses `HYGIENE`/`MOMENTUM` columns (`src/components/project-list.tsx`).
- Impact: new users follow wrong setup mental model and hit avoidable confusion.

2) Missing OSS legal/community baseline files
- Evidence: no root `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- Impact: repo is not ready for proper public collaboration and contribution policy.

3) Setup is not yet “clone + 1-2 commands”
- Evidence:
  - Setup path is multi-step (`README.md:31-35`).
  - `prisma.config.ts` requires `DATABASE_URL` from env (`prisma.config.ts:12`), adding bootstrap dependency.
  - No `setup` script in `package.json` (`package.json:5`).
- Impact: onboarding friction and higher drop-off.

---

## Medium

4) Prerequisites are outdated
- Evidence:
  - README says Node `18+` (`README.md:24`).
  - Installed Next requires `>=20.9.0` (package engines).
- Impact: users on Node 18 may fail unexpectedly.

5) First-run UX does not proactively guide onboarding
- Evidence:
  - Empty state is generic (`src/app/page.tsx:404`) and does not guide users to open Settings + set `Dev Root` + run Scan.
- Impact: first-time users may not discover required initial configuration quickly.

6) Missing dependency/tool preflight checks (python/git/LLM provider)
- Evidence:
  - Refresh path executes pipeline directly (`src/lib/pipeline.ts:166` onward), with no preflight status endpoint.
  - Errors surface in refresh panel (`src/components/refresh-panel.tsx:240`) only after failure.
- Impact: avoidable failure loops and opaque “why enrich failed” moments.

7) LLM safety copy mismatch
- Evidence:
  - UI says unsafe applies to `(claude-cli, codex-cli)` (`src/components/settings-modal.tsx:165`).
  - Code marks only `codex-cli` as unsafe (`src/lib/llm/index.ts:19`).
- Impact: user confusion and trust erosion around security semantics.

8) Local quality gate is red
- Evidence: `npm run lint` currently reports errors in:
  - `src/app/page.tsx`
  - `src/components/project-drawer.tsx`
  - `src/hooks/use-refresh-deltas.ts`
- Impact: contributors hit failing baseline before making any changes.

---

## Low

9) Offline/corporate-network build fragility
- Evidence: layout imports Google-hosted fonts via `next/font/google` (`src/app/layout.tsx:2`).
- Impact: `npm run build` can fail in restricted networks.

10) settings example is too thin for quick provider onboarding
- Evidence: `settings.example.json` only includes a few fields (`settings.example.json:1`).
- Impact: users trying OpenRouter/Ollama/MLX need extra discovery steps.

---

## Target OSS Experience (North Star)
User should be able to:
1. clone repo
2. run one bootstrap command
3. start app
4. open Settings, set Dev Root and provider
5. click Scan, then Enrich (if enabled)

Goal: **no hidden setup assumptions**, clear error guidance, and docs that match product reality.

---

## Implementation Plan for Claude

## Phase 1: Critical OSS Baseline (Must-have)

### Claude Task Message (What / Why / How / Deliverables / Notes)
What:
Bring repo to minimum public OSS baseline with accurate setup and governance files.

Why:
Without this, onboarding and contribution trust are materially compromised.

How:
- Add root files:
  - `LICENSE` (MIT unless user chooses otherwise)
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md` (Contributor Covenant)
  - `SECURITY.md`
- Update README prerequisites and setup:
  - Node version to match actual engine (`>=20.9.0`)
  - reflect settings-based config flow
  - remove/replace any stale API/features docs (e.g. missing `/api/o1/export` route)

Deliverables:
- Governance files present and linked from README.
- README setup is factually correct for current codebase.

Notes / Scope:
- In scope: docs + governance only.
- Out of scope: feature refactors.

---

## Phase 2: 1-Command Bootstrap

### Claude Task Message
What:
Add a reliable bootstrap command to collapse first-run setup into one step.

Why:
Current onboarding requires too many manual steps and env assumptions.

How:
- Add npm script(s), e.g.:
  - `npm run setup` -> create `.env.local` from example if missing, run `prisma generate`, run `prisma migrate dev`.
  - optionally `npm run setup:quick` for non-interactive defaults.
- Ensure bootstrap does not overwrite existing user config files silently.
- Add friendly output messages for each step.

Deliverables:
- New user can run:
  - `npm install`
  - `npm run setup`
  - `npm run dev`
- README updated accordingly.

Notes / Scope:
- In scope: scripts + docs.
- Out of scope: CI pipeline changes unless required.

---

## Phase 3: First-Run Onboarding UX

### Claude Task Message
What:
Add explicit in-app first-run guidance for zero-data and misconfigured states.

Why:
Generic empty states do not teach required setup actions.

How:
- On zero projects or known config mismatch:
  - show contextual CTA banner:
    - “Open Settings”
    - “Set Dev Root”
    - “Run Scan”
- Add quick inline checklist in UI for first run.
- Keep it dismissible once a successful scan completes.

Deliverables:
- User can discover setup path from UI alone.
- Empty state has actionable onboarding steps.

Notes / Scope:
- In scope: UI guidance only.
- Out of scope: tutorial framework.

---

## Phase 4: Preflight Diagnostics + Better Failure UX

### Claude Task Message
What:
Add preflight checks and dependency diagnostics before scan/enrich.

Why:
Users currently discover missing tools only after refresh fails.

How:
- Add endpoint/service that checks:
  - `python3` availability
  - `git` availability
  - provider-specific readiness:
    - `claude` binary for `claude-cli`
    - API key present for `openrouter`
    - URL reachable for `ollama`/`mlx` (best-effort)
    - `codex` binary and `LLM_ALLOW_UNSAFE` for `codex-cli`
- Display status in settings modal and/or refresh panel pre-run.
- Provide direct remediation text per failure.

Deliverables:
- Before running enrich, user sees readiness status.
- Failures become actionable, not opaque.

Notes / Scope:
- In scope: checks + UX copy.
- Out of scope: auto-installing external binaries.

---

## Phase 5: Consistency + Quality Gate

### Claude Task Message
What:
Align safety/provider messaging and restore passing lint baseline.

Why:
Inconsistent copy and failing lint create immediate trust issues for external contributors.

How:
- Fix `Allow Unsafe` wording in settings to match real behavior (`codex-cli` only, unless behavior is intentionally expanded).
- Resolve current lint errors in:
  - `src/app/page.tsx`
  - `src/components/project-drawer.tsx`
  - `src/hooks/use-refresh-deltas.ts`
- Confirm `npm run lint` passes on clean checkout.

Deliverables:
- Accurate safety messaging.
- Lint passes without local patching.

Notes / Scope:
- In scope: copy + lint fixes.
- Out of scope: large architectural refactors.

---

## Phase 6 (Optional): Offline-Friendly Build

### Claude Task Message
What:
Provide fallback strategy for environments that cannot reach Google Fonts.

Why:
Build currently fails in restricted/offline networks due to font fetching.

How:
- Either:
  - move to local font files (`next/font/local`), or
  - document fallback strategy and add env-based switch.

Deliverables:
- `npm run build` succeeds in restricted-network dev scenarios (or documented fallback with clear instructions).

Notes / Scope:
- Optional; do not block OSS launch if documented.

---

## Recommended Execution Order
1. Phase 1 (docs + governance)
2. Phase 2 (bootstrap command)
3. Phase 5 (lint + messaging consistency)
4. Phase 3 (first-run onboarding UI)
5. Phase 4 (preflight diagnostics)
6. Phase 6 (optional offline robustness)

This gets you to an acceptable public onboarding baseline quickly, then improves UX polish.

---

## Acceptance Criteria (OSS Readiness)
- Fresh user path succeeds with:
  - `npm install`
  - `npm run setup`
  - `npm run dev`
- In-app first-run path to successful scan is obvious without reading code.
- AI enrich prerequisites are visible and actionable.
- README is fully aligned with shipped behavior and endpoints.
- Governance/legal baseline files exist.
- `npm run lint` passes.

---

## Implementation Status (2026-02-07)

All 6 phases implemented:

- [x] Phase 1: Lint + copy consistency — 11 errors fixed, unsafe messaging aligned
- [x] Phase 2: Docs + governance — README rewritten, LICENSE/CONTRIBUTING/CODE_OF_CONDUCT/SECURITY added, settings.example.json expanded
- [x] Phase 3: 1-command bootstrap — `npm run setup` via scripts/setup.mjs, engines field added
- [x] Phase 4: First-run onboarding UX — welcome card with 3-step setup guide
- [x] Phase 5: Preflight diagnostics — `/api/preflight` endpoint, System Status in Settings modal
- [x] Phase 6: Offline fonts — Geist fonts served locally via next/font/local
