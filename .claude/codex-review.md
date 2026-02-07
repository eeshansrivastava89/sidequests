# Codex Review for Claude

## Task 1
Claude Task Message (What / Why / How / Deliverables / Notes)

What:
Close the path-sanitization bypass so keyboard shortcuts cannot trigger path-based quick actions when `SANITIZE_PATHS=true`.

Why:
Current UI hides quick-action buttons in sanitized mode, but global shortcuts (`v/c/x/t`) can still operate via `pathDisplay`, which defeats the privacy intent.

How:
- Trace shortcut handlers in `src/app/page.tsx` and align their guard logic with button-visibility logic.
- Add a single helper predicate for “path actions allowed” and use it for both keyboard and button paths.
- Add tests (or at minimum robust manual checks) for sanitized vs unsanitized behavior.

Deliverables:
- With `SANITIZE_PATHS=true`, `v/c/x/t` do nothing and show no path-derived output.
- With `SANITIZE_PATHS=false`, shortcuts keep working exactly as before.
- Verification checklist: toggle flag, refresh page, validate both keyboard and UI button parity.

Notes / Scope (optional):
- In scope: `src/app/page.tsx`, related quick-action utilities/components.
- Out of scope: redesigning quick-action UX.
- Dependencies: `SANITIZE_PATHS` config from `src/lib/config.ts` and `/api/config`.

---

## Task 2
Claude Task Message (What / Why / How / Deliverables / Notes)

What:
Harden refresh SSE lifecycle handling to prevent stale connections and improve failure behavior.

Why:
`useRefresh` currently risks connection leaks/ungraceful states on unmount or abrupt failures, which can leave the UI stuck or inconsistent.

How:
- Add deterministic cleanup of `EventSource` on unmount and on all terminal states.
- Ensure state transitions are explicit for connect/start/error/cancel/complete.
- Add minimal retry/clear error messaging policy (or explicit no-retry with clear terminal state).

Deliverables:
- No lingering SSE connection after route change/unmount/cancel.
- Refresh panel always exits “active” state on error/abort/completion.
- Verification checklist: start refresh, cancel midway, navigate away during refresh, simulate error.

Notes / Scope (optional):
- In scope: `src/hooks/use-refresh.ts`, `src/components/refresh-panel.tsx`.
- Out of scope: backend pipeline protocol changes.
- Dependencies: SSE events from `src/app/api/refresh/stream/route.ts`.

---

## Task 3
Claude Task Message (What / Why / How / Deliverables / Notes)

What:
Add strict request validation for override/metadata API payloads before persistence.

Why:
Current routes accept flexible JSON/string shapes and can store malformed data, increasing merge/runtime inconsistency risk.

How:
- Define explicit schemas for `override` and `metadata` payloads (allowed keys, types, nullability).
- Reject invalid payloads with clear 400 responses and stable error bodies.
- Keep existing valid payload behavior backward-compatible.

Deliverables:
- Invalid payloads are rejected consistently with 400.
- Valid existing UI payloads still save without regression.
- Verification checklist: unit/integration tests for valid/invalid permutations.

Notes / Scope (optional):
- In scope: `src/app/api/projects/[id]/override/route.ts`, `src/app/api/projects/[id]/metadata/route.ts`.
- Out of scope: redesigning DB schema.
- Dependencies: merged model expectations in `src/lib/merge.ts`.

---

## Task 4
Claude Task Message (What / Why / How / Deliverables / Notes)

What:
Introduce a validation boundary between Python pipeline outputs and TS persistence writes.

Why:
`scan.py`/`derive.py` output is trusted directly; schema drift or malformed output can propagate into DB writes and hard-to-debug runtime issues.

How:
- Define TS runtime schemas for scan and derive payload contracts.
- Validate parsed JSON before processing; fail fast with actionable errors.
- Add lightweight logging that points to failing contract fields.

Deliverables:
- Pipeline aborts safely with clear contract errors when payload shape is invalid.
- Happy path behavior remains unchanged for valid scan/derive outputs.
- Verification checklist: run with valid data; inject malformed JSON fields and confirm controlled failure.

Notes / Scope (optional):
- In scope: `src/lib/pipeline.ts` (+ validation module).
- Out of scope: rewriting Python scanners/derivers.
- Dependencies: expected payload fields from `pipeline/scan.py` and `pipeline/derive.py`.

---

## Task 5
Claude Task Message (What / Why / How / Deliverables / Notes)

What:
Resolve documentation drift so plan status, checklists, and config docs are internally consistent.

Why:
`IMPLEMENTATION_PLAN.md` says phases complete while some phase sections still show unchecked tasks; this creates confusion for future implementation audits.

How:
- Update phase checklist states to match current completion status.
- Align config docs (`README.md`, `config.example.json`, `.env.local.example`) around source-of-truth env vars.
- Add a short “current status date” note for audit clarity.

Deliverables:
- No contradictory “complete vs unchecked” items in `IMPLEMENTATION_PLAN.md`.
- Config docs reflect actual runtime knobs and required env vars.
- Verification checklist: one pass comparing docs against `src/lib/config.ts`.

Notes / Scope (optional):
- In scope: docs only (`IMPLEMENTATION_PLAN.md`, `README.md`, config examples).
- Out of scope: code behavior changes.
- Dependencies: current config contract in `src/lib/config.ts`.
