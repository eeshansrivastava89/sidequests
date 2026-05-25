# Sidequests — Architecture & Implementation Plan

**Updated:** 2026-05-25
**Status:** Phase 9 (What Now v2 + Analytics v2) complete. Phase 10 (Ship) next.

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

## Phase 8: What Now Rebuild + Analytics ✅

Replaces the flat Priority Actions feed with an AI-powered recommendation card and adds a dedicated Analytics tab.

### What Now Tab — AI-Powered Recommendation

The current What Now tab just regurgitates git hygiene data ("3 uncommitted files", "no remote"). That's sorted data, not a recommendation. The rebuild focuses on answering one question: **"What should I work on right now and why?"**

- [x] **Top recommendation card** — One card with the single most important thing to do, synthesized from `nextAction` + `status` + `statusReason` + open issues + git state + momentum. Secondary suggestions as "while you're at it" items.
- [x] **Why this?** — Short reasoning drawing from actual signals: open bugs, stale git state, LLM-identified purpose, activity drop-off. Trust comes from transparency.
- [x] **Quick actions** — "Open in terminal", "Open on GitHub", "Snooze 7d", "Mark done" — directly actionable, not just "copy cd path".
- [x] **Remove flat Priority Actions feed** — the severity-sorted list of git warnings is redundant with the Projects tab filters. Replaced with the recommendation card. Removed `aggregateActions()` dead code.

### Analytics Tab — Development Activity

New tab replacing the current What Now's numbers-without-insight role. Gives detailed insight into development activity and momentum.

- [x] **Activity bars for all projects** — Per-project commit counts (7d/30d/90d), visualized as proportional stacked bars (scrollable list, clickable to project detail)
- [x] **Health distribution** — Active/paused/stale/archived counts with average health scores per status group
- [x] **Momentum signals** — Projects accelerating (week >> quarter/12), decelerating, or stalled. Compare week vs month vs quarter commit rates.
- [x] **Shipped card** — Move existing ShippedSection here (already good)
- [x] **Visit delta detail** — Move existing delta chips here with more detail (which projects changed, what changed)

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

## Phase 9: What Now v2 + Analytics v2

Redesign both tabs for schema flexibility, richer data, and professional charting.

### What Now v2

- [x] **Schema-flexible AI response** — Parse portfolio AI response generically. Unknown fields in the AI response flow into `extras` catch-all (same pattern as `Llm.extrasJson`), rendered as a "More from AI" section.
- [x] **Ambient context on What Now** — Focus goals (with progress), shipped this week, and visit deltas shown in a 3-column strip on the What Now page. No tab-switching needed.
- [x] **Urgency from AI** — `urgency` field (now/this-week/soon) added to portfolio prompt output. Rendered with colored border glow (red/amber/blue) + badge on recommendation card.
- [x] **Update `PortfolioAnalysis` TypeScript type** — Added `extras`, `Urgency`, `PortfolioSecondaryPick` types. Backward compat with old shape.

### Analytics v2

- [x] **Install shadcn chart component** — `pnpm dlx shadcn@latest add chart`. Replaces raw Recharts usage with `ChartContainer`, `ChartTooltip`, `ChartConfig`, CSS variable theming.
- [x] **Contribution heatmap** — Weekly heatmap across all projects with intensity-based opacity and legend.
- [x] **Commit velocity + trend** — Stacked bar chart for top projects (via shadcn chart) + area chart showing 12-week commit trend.
- [x] **Health distribution histogram** — Bar histogram of health scores in 10-point buckets. Replaces old pie chart.
- [x] **Stale tracker** — Sorted list by days inactive with thresholds: Active (<14d), Cooling (14-30d), Stale (30-60d), Dead (>60d).
- [x] **Language/framework breakdown** — Horizontal bar charts for language and framework distribution by 7d commits.
- [x] **Remove old chart code** — Stripped raw Recharts Tooltip, hand-rolled ProjectActivityRow, old pie chart. All replaced with shadcn chart + ChartContainer.
- [x] **Portfolio allocation treemap** — Squarified treemap: rectangle size proportional to commit count, color by health score implemented with SVG (no D3 dependency).
- [x] **Project lifecycle timeline** — Horizontal bars showing project age, activity windows (week/month/quarter), status indicators.
- [x] **GitHub signal dashboard** — CI status breakdown, failing projects, top issues, open PRs, visibility. Only shows when GitHub-connected projects exist.

### Data Layer Extensions

- [x] **Weekly commit history** — Scanner now captures `weeklyCommitHistory` (12 weeks of per-ISO-week commit counts). Stored in `Scan.metaJson`. Consumed by `/api/portfolio/stats`.
- [x] **Language/framework counts** — `computePortfolioStats` now returns `languages[]` and `frameworks[]` with project counts and week commit totals.
- [x] **Stale projects** — `computePortfolioStats` now returns `staleProjects[]` with `daysInactive` per project.
- [x] **Health distribution** — `computePortfolioStats` now returns `healthDistribution[]` with 10-point bucket counts.
- [x] **Weekly commit trend** — `computePortfolioStats` now returns `weeklyCommitHistory[]` with per-week total commits and per-project breakdown.

### Dependencies

- shadcn chart component (wraps Recharts v3 — already a dependency) ✅
- `computePortfolioStats` extended with all new fields ✅
- D3 may still be needed for treemap/lifecycle timeline (future)

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
Phase 8: What Now + Analytics ✅
Phase 9: What Now v2 + Analytics v2 ✅
Phase 10: Ship                       ← Current
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
- **System notifications via node-notifier** — deprecated, replaced by in-app signals
- **Menu bar companion** — deprecated. Native macOS app requires separate distribution (Homebrew cask, code signing, Sparkle), adds complexity without improving the core dashboard. The web SPA is the control center.
- **User accounts / cloud sync** — local-first, single user
- **Time-based notification scheduler** — requires cron infrastructure
- **Tauri/Electron desktop wrapper** — localhost web server + menu bar client, not a desktop app
- **Hono web framework** — removed. Sidequests needs direct HTTP stream control
- **Charts/graphs** — ~~sparklines and commit counts tell the story~~ Phase 9 adds professional charting via shadcn chart

---

## Success Criteria

1. Open the app → immediately see ranked actions with copy-paste commands ✅
2. See what changed since last visit (delta strip) ✅
3. See GitHub issues merged into the priority queue with issue numbers ✅
4. See shipped history (commits this week/month/quarter) ✅
5. Weekly focus goals persist across sessions ✅
6. Stale project decisions (snooze/archive/revive) persist and re-surface ✅
7. Fast scan progress arrives one project at a time ✅
8. Web dashboard is the sole control center — no native companion app ✅
9. Package size ≤ 170MB installed via npx ✅