# Sidequests — Architecture & Implementation Plan

**Updated:** 2026-05-25
**Status:** Phase 7 (polish) complete. Phase 8 (What Now rebuild + Analytics) in progress.

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

## Phase 8: What Now Rebuild + Analytics

Replaces the flat Priority Actions feed with an AI-powered recommendation card and adds a dedicated Analytics tab.

### What Now Tab — AI-Powered Recommendation

The current What Now tab just regurgitates git hygiene data ("3 uncommitted files", "no remote"). That's sorted data, not a recommendation. The rebuild focuses on answering one question: **"What should I work on right now and why?"**

- [ ] **Top recommendation card** — One card with the single most important thing to do, synthesized from `nextAction` + `status` + `statusReason` + open issues + git state + momentum. Secondary suggestions as "while you're at it" items.
- [ ] **Why this?** — Short reasoning drawing from actual signals: open bugs, stale git state, LLM-identified purpose, activity drop-off. Trust comes from transparency.
- [ ] **Quick actions** — "Open in terminal", "Open on GitHub", "Snooze 7d", "Mark done" — directly actionable, not just "copy cd path".
- [ ] **Remove flat Priority Actions feed** — the severity-sorted list of git warnings is redundant with the Projects tab filters. Replace with the recommendation card.

### Analytics Tab — Development Activity

New tab replacing the current What Now's numbers-without-insight role. Gives detailed insight into development activity and momentum.

- [ ] **Activity bars for all projects** — Per-project commit counts (7d/30d/90d), visualized as proportional bars (generalize the ShippedSection pattern)
- [ ] **Health distribution** — Active/paused/stale/archived counts with average health scores
- [ ] **Momentum signals** — Projects accelerating (week >> quarter/12), decelerating, or stalled. Compare week vs month vs quarter commit rates.
- [ ] **Shipped card** — Move existing ShippedSection here (already good)
- [ ] **Visit delta detail** — Move existing delta chips here with more detail (which projects changed, what changed)

### Tab Structure

**What Now → Projects → Analytics** (three tabs)

- What Now: AI recommendation + quick actions
- Projects: Current project list (unchanged)
- Analytics: Activity metrics, momentum, health distribution

### What Gets Removed

- Flat Priority Actions feed (ActionFeed component)
- Overview strip moves insights to Analytics, keeps signal chips on What Now
- Focus goals stay on What Now (they're intent, not analytics)

---

## Phase 9: Menu Bar Companion

Swift `MenuBarExtra` app that talks to the Sidequests localhost API.

- [ ] Create Xcode project: SwiftUI `MenuBarExtra` app
- [ ] Poll `GET /api/health` for server status, show badge count
- [ ] Dropdown: top recommendation from What Now
- [ ] "Open Dashboard" → opens `localhost:PORT` in browser
- [ ] "Refresh" → `POST /api/refresh/stream` to trigger scan
- [ ] Auto-launch on login (`SMAppService`)
- [ ] If server not running, start it via `Process` (`npx @eeshans/sidequests`)
- [ ] Distribution: Homebrew cask or DMG

---

## Phase 10: Ship

Packaging, CI, distribution.

- [ ] End-to-end npx validation — fresh install, scan, verify all features
- [ ] GitHub Actions — update from deprecated Node 20
- [ ] Prisma hash fragility — investigate and fix standalone Prisma hash mismatch

---

## Implementation Order

```
Phases 0–5: Complete ✅
Phase 7: Polish ✅
Phase 8: What Now + Analytics  ← Current
Phase 9: Menu bar companion    ← After
Phase 10: Ship                ← Last
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