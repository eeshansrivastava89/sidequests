# Sidequests — Architecture & Implementation Plan

**Updated:** 2026-05-25
**Status:** Phase 7 (polish) complete. Phase 8 (menu bar) and Phase 9 (ship) remain.

---

## Guiding Principles

The product is a **control center for side projects**, not a dashboard. Every feature should answer one of two questions: "What should I work on right now?" or "Am I making progress?" If it doesn't serve either, it doesn't ship.

- **Don't store what you can compute.** If data already exists in the DB, derive it on-the-fly.
- **Add columns before adding tables.** A column on an existing model beats a new model + relation + join.
- **Extend existing endpoints before creating new ones.** Adding a field to `GET /api/projects` beats a new `/api/actions` endpoint.
- **Prefer battle-tested tools over novel abstractions.** Express has 15 years of production precedent. Use it.
- **Yield to the event loop.** `await setImmediate(resolve)` between I/O writes so Node.js can flush TCP buffers. Synchronous work (`execFileSync`, CPU loops) blocks the event loop and starves network I/O.

---

## Phase 0–5: Complete ✅

| Phase | What | Status |
|---|---|---|
| 0 | Next.js → Vite migration | ✅ |
| 1 | Data model extensions (snooze, archive, focus, visit, dismissed alerts) | ✅ |
| 2 | API routes (actions, lifecycle, focus, visit, shipped) | ✅ |
| 3 | Frontend (What Now, action cards, focus, shipped, lifecycle) | ✅ |
| 4 | Notifications (removed — replaced by in-app signals) | ✅ |
| 5 | Express migration + SSE streaming fix | ✅ |

### Phase 5 Key Details

- **SSE root cause:** Event loop starvation from `execFileSync`, not framework buffering
- **Fix:** `emit()` changed from sync to async with `await setImmediate()` yield after each `res.write()`
- **Express migration:** All 12 routes, integration tests, build scripts converted from Hono

---

## Phase 7: Polish ✅

- [x] **Split `page.tsx`** — extracted `dashboard-filters.ts`, `dashboard-header.tsx` (877 → 669 lines)
- [x] **Lifecycle actions modal** — replaced `prompt()` with Dialog component
- [x] **`beforeunload` visit save** — switched from sync fetch to `navigator.sendBeacon()`
- [x] **Pre-existing test failures** — rewrote EventSource tests with MockEventSource (7 tests, all passing)
- [x] **Fast scan vs AI scan labels** — phase text now says "Fast scanning" during deterministic step

---

## Phase 8: Menu Bar Companion

Swift `MenuBarExtra` app that talks to the Sidequests localhost API.

- [ ] Create Xcode project: SwiftUI `MenuBarExtra` app
- [ ] Poll `GET /api/health` for server status, show badge count
- [ ] Dropdown: top 3 "What Now" priority actions from `GET /api/projects`
- [ ] "Open Dashboard" → opens `localhost:PORT` in browser
- [ ] "Refresh" → `POST /api/refresh/stream` to trigger scan
- [ ] Auto-launch on login (`SMAppService`)
- [ ] If server not running, start it via `Process` (`npx @eeshans/sidequests`)
- [ ] Distribution: Homebrew cask or DMG

---

## Phase 9: Ship

Packaging, CI, distribution.

- [ ] End-to-end npx validation — fresh install, scan, verify all features
- [ ] GitHub Actions — update from deprecated Node 20
- [ ] Prisma hash fragility — investigate and fix standalone Prisma hash mismatch

---

## Implementation Order

```
Phases 0–5: Complete ✅
Phase 7: Polish ✅
Phase 8: Menu bar companion  ← Next
Phase 9: Ship                ← After menu bar
```

---

## Not Building

These were considered and deliberately excluded. They won't be added later unless the product need changes.

- **Per-project detail pages** — the side drawer is enough
- **Lifecycle kanban board** — lifecycle actions in the detail pane are enough
- **PriorityAction table** — computed on-the-fly, not stored
- **ScanDelta table** — replaced by UserVisit snapshot comparison
- **LifecycleAction table** — replaced by 2 columns on Project + existing override API
- **`/api/actions` endpoint family** — actions are a field in the projects response
- **`/api/lifecycle/:id/*` routes** — uses existing override endpoint
- **`/api/insights` endpoint** — portfolio insights computed client-side
- **`/api/notifications` read/dismiss endpoint** — notifications deprecated
- **Settings panels for notification thresholds** — config file is enough
- **Onboarding wizard for new features** — existing wizard stays
- **System notifications via node-notifier** — deprecated, replaced by in-app signals + menu bar badge
- **User accounts / cloud sync** — local-first, single user
- **Time-based notification scheduler** — requires cron infrastructure
- **Tauri/Electron desktop wrapper** — localhost web server + menu bar client, not a desktop app
- **Hono web framework** — removed. Sidequests needs direct HTTP stream control
- **Charts/graphs** — sparklines and commit counts tell the story (if we add sparklines later, that's a UI enhancement, not a charting library)

---

## Success Criteria

1. Open the app → immediately see ranked actions with copy-paste commands ✅
2. See what changed since last visit (delta strip) ✅
3. See GitHub issues merged into the priority queue with issue numbers ✅
4. See shipped history (commits this week/month/quarter) ✅
5. Weekly focus goals persist across sessions ✅
6. Stale project decisions (snooze/archive/revive) persist and re-surface ✅
7. Fast scan progress arrives one project at a time ✅
8. Menu bar companion shows badge count and top actions — **Phase 8**
9. Package size ≤ 170MB installed via npx ✅