# Sidequests — Architecture & Implementation Plan

**Updated:** 2026-05-25
**Status:** Phase 5 complete. SSE streaming fixed. Ready for Phase 6 (menu bar) and Phase 7 (polish).

---

## Guiding Principle

The product is a **control center for side projects**, not a dashboard. Every feature should answer one of two questions: "What should I work on right now?" or "Am I making progress?" If it doesn't serve either, it doesn't ship.

### Secondary Principles

- **Don't store what you can compute.** If data already exists in the DB, derive it on-the-fly rather than persisting a redundant copy.
- **Add columns before adding tables.** A column on an existing model beats a new model + relation + join.
- **Extend existing endpoints before creating new ones.** Adding a field to `GET /api/projects` beats a new `/api/actions` endpoint.
- **Prefer battle-tested tools over novel abstractions.** Express has 15 years of production precedent. Use it.
- **Yield to the event loop.** If you're doing I/O (SSE, file watching, streaming), `setImmediate(resolve)` between writes so Node.js can flush the TCP buffer. Synchronous work (`execFileSync`, CPU loops) blocks the event loop and starves network I/O.

---

## Phases 0–4: Complete ✅

| Phase | What | Status |
|---|---|---|
| 0 | Next.js → Hono+Vite migration | ✅ 5.7MB build |
| 1 | Data model extensions (snooze, archive, focus, visit, dismissed alerts) | ✅ |
| 2 | API routes (actions, lifecycle, focus, visit, shipped) | ✅ |
| 3 | Frontend (What Now tab, action cards, focus, shipped, lifecycle) | ✅ |
| 4 | Notifications (removed — replaced by in-app signals) | ✅ (deprecated) |

---

## Phase 5: Express Migration + SSE Fix ✅

### What changed

| Component | From | To |
|---|---|---|
| HTTP framework | Hono (`hono`, `@hono/node-server`) | Express (`express`, `cors`, `morgan`) |
| SSE streaming | `streamSSE()` (TransformStream) → events arrived all at once | Raw `res.write()` + `await setImmediate()` → events arrive one at a time |
| Route handlers | `(c) => c.json(...)` | `(req, res) => res.json(...)` |
| Route params | `c.req.param("id")` | `req.params.id` |
| Request body | `await c.req.json()` | `req.body` (with `express.json()` middleware) |
| Static serving | `@hono/node-server/serve-static` | `express.static()` |
| Integration tests | Hono `app.request()` | `supertest` |
| Build | esbuild (no banner) | esbuild with `createRequire` banner for Express CJS requires |

### What stayed the same (0 changes)
- All React components, hooks, UI (4,800 lines)
- All library code — pipeline, LLM, merge, config, actions (6,313 lines)
- Prisma schema, SQLite database
- CLI entry point (`bin/cli.mjs`)
- Vite build pipeline and dev server
- `EventSource` client in `use-refresh.ts`

### SSE root cause and fix

**Symptom:** Fast scan events arrived all at once at the end of the scan, instead of one project at a time as they were processed.

**Initial (incorrect) diagnosis:** Hono's `streamSSE` buffered events through an internal `TransformStream`. Migrating to Express with raw `res.write()` would fix it.

**Actual root cause:** Node.js event loop starvation. The pipeline's `scanProject()` calls `execFileSync("git", ...)` which blocks the event loop for 5-50ms per project. While the event loop is blocked, Node.js cannot flush the TCP write buffer to the network — even though `res.write()` was called. All buffered writes get sent together when the event loop finally yields during `await` DB operations.

**Fix:** Changed `emit()` from synchronous `(event) => void` to async `(event) => Promise<void>`. Each emit does `res.write()` then `await new Promise(resolve => setImmediate(resolve))`, yielding one event loop tick so Node.js can flush the write buffer before the next blocking `execFileSync()` call.

**Verification:** Fast scan now sends events incrementally — each project's `project_start` + `project_complete` arrives ~2 seconds apart, matching the pipeline's processing pace.

### Key files

- `src/api/routes/refresh.ts` — Express SSE route with `res.write()` + `setImmediate()` yield
- `src/lib/pipeline.ts` — `emit` signature changed to `Promise<void> | void`, all 7 calls now `await emit()`
- `src/server.ts` — Express with cors, morgan, json, static, SPA fallback
- `src/api/index.ts` — Express Router with routes and error handler
- `src/api/routes/*.ts` — All 12 routes converted to Express handlers
- `src/api/__tests__/api-routes.integration.test.ts` — supertest integration tests
- `src/api/__tests__/helpers/create-app.ts` — test app factory
- `scripts/build-server.mjs` — esbuild with `createRequire` banner
- `AGENTS.md` — project principles for AI agents

### Deprecated

- **Hono framework** — removed from project. Hono is a good framework for simple request/response APIs, but Sidequests needs direct control over the HTTP response stream. Express provides this natively.

---

## Phase 6: SwiftUI Menu Bar Companion (Future)

**Architecture:** Thin Swift `MenuBarExtra` app (~500–1000 lines) that talks to the Sidequests localhost API.

**What it does:**
- Shows project count / attention-needed count as badge on menu bar icon
- Dropdown: top 3 "What Now" priority actions
- "Open Dashboard" → opens `http://localhost:PORT` in default browser
- "Refresh" → `POST /api/refresh/stream` to trigger scan
- Polls `GET /api/health` to detect if server is running; launches it if not

**What it does NOT do:**
- No database, no git scanning, no LLM calls — all that stays in the Node.js server
- No bundled WebView — opens the browser for the full dashboard
- No OAuth, no GitHub API calls — the server handles all data

**Distribution:** Homebrew cask or DMG. Separate Xcode project, not bundled with the npm package.

### Checklist

- [ ] Create Xcode project: SwiftUI `MenuBarExtra` app
- [ ] ServerMonitor class — polls `localhost:PORT/api/health`, stores project count
- [ ] Menu bar popover UI — project count, top actions, Open Dashboard, Refresh
- [ ] Auto-launch on login (via `SMAppService` or `LaunchAtLogin` helper)
- [ ] If server not running, start it via `Process` (`npx @eeshans/sidequests`)
- [ ] Icon in menu bar (SF Symbol or custom)

---

## Phase 7: Polish & Ship

### Before shipping v1

- [ ] **Split `page.tsx`** — currently 877 lines, needs modularization
- [ ] **Lifecycle actions modal** — replace `prompt()` with proper dialog
- [ ] **`beforeunload` visit save** — use `navigator.sendBeacon()` instead of sync fetch
- [ ] **End-to-end npx validation** — fresh install, scan, verify all features work
- [ ] **GitHub Actions** — update from deprecated Node 20
- [ ] **Prisma hash fragility** — investigate and fix standalone Prisma hash mismatch
- [ ] **Pre-existing test failures** — `use-refresh-cancel.test.tsx` and `use-refresh-restart.test.tsx` need `EventSource` mock in jsdom

### Future (v2+)

- [ ] Per-project shipped history in detail pane
- [ ] Health timeline / sparklines per project (commit history over 12 weeks)
- [ ] Shell integration (`sq status`, `sq next`, `cd` hook)
- [ ] MCP server for AI tool integration
- [ ] GitHub Issues as work queue (bugs → features → chores, merged into priority actions)

---

## Implementation Order

```
Phases 0–4: Complete ✅
Phase 5: Express migration + SSE fix  ✅
    │
Phase 6: Menu bar companion           ← Next (separate Swift project)
Phase 7: Polish & ship v1             ← After or in parallel
```

---

## What We're Not Building (YAGNI)

Explicitly out of scope for v1:

- **Per-project detail pages** — the side drawer is enough
- **Charts/graphs** — sparklines and commit counts tell the story
- **Lifecycle kanban board** — the lifecycle actions in the project detail pane are enough
- **PriorityAction table** — computed on-the-fly, not stored
- **ScanDelta table** — replaced by UserVisit snapshot comparison
- **LifecycleAction table** — replaced by 2 columns on Project + existing override API
- **`/api/actions` endpoint family** — actions are a field in the projects response
- **`/api/lifecycle/:id/*` routes** — uses existing override endpoint
- **`/api/insights` endpoint** — portfolio insights are computed client-side
- **`/api/notifications` read/dismiss endpoint** — notifications deprecated
- **Settings panels for notification thresholds** — config file is fine for v1
- **Onboarding wizard for new features** — existing wizard stays
- **System notifications via node-notifier** — deprecated, replaced by in-app signals + future menu bar badge
- **MCP server** — table-stakes for AI workflows, but not blocking for v1
- **User accounts / cloud sync** — local-first, single user
- **Time-based notification scheduler** — requires cron infrastructure, defer to v2
- **Tauri/Electron desktop wrapper** — localhost web server + menu bar client, not a desktop app
- **Hono web framework** — removed. Not a reflection on Hono's quality; Sidequests needs direct HTTP stream control.

---

## Success Criteria for v1

1. Open the app → immediately see ranked actions with copy-paste commands ✅
2. See what changed since last visit (delta strip) ✅
3. See GitHub issues merged into the priority queue with issue numbers ✅
4. See shipped history (commits this week/month/quarter) ✅
5. Weekly focus goals persist across sessions ✅
6. Stale project decisions (snooze/archive/revive) persist and re-surface ✅
7. Fast scan progress arrives one project at a time ✅ (fixed: `await setImmediate()` yield after each SSE write)
8. Menu bar companion shows badge count and top actions — **Phase 6**
9. Package size ≤ 170MB installed via npx ✅ (was 620MB)