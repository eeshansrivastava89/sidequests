# Codex Review: Remaining Usability Fixes Only (Post-v2 Screenshot Pass)

## Context
This is an updated review after Claude’s latest adjustments (`v2-01-table.png`, `v2-02-header-closeup.png`).

Items already improved and removed from scope:
- Score columns are now clearer (`HYGIENE`, `MOMENTUM`) in table header.
- General table alignment/density is in good shape.
- Keyboard hint panel and enrich dropdown baseline usability are acceptable.

Remaining scope below is only what still appears unresolved in latest screenshots.

---

## Claude Task Message 1 (Highest): Stats Scope Consistency
What:
Make top stat cards use one consistent scope model (global or filtered), and label that scope explicitly.

Why:
In current state, `Total` appears filtered (`0/13`) while other cards remain global (`Dirty 8`, `Needs Attention 7`) in filtered/search views, which creates trust/interpretation issues.

How:
- Choose one model:
  - All stats global, or
  - All stats filtered.
- Implement that model across all stat cards using one shared source.
- Add visible scope label near stat row (`Global` / `Filtered`).
- Verify with tab+search no-results state.

Deliverables:
- No mixed stat scopes in any state.
- Users can tell what stat scope they are seeing at a glance.

Notes / Scope:
- In scope: stat computation + label + regressions.
- Out of scope: redesign of stat card visuals.

---

## Claude Task Message 2 (High): Needs Attention Actionability
What:
Expose deterministic reason codes in list and drawer for projects flagged as `Needs Attention`.

Why:
Counts are visible, but users still can’t quickly see *why* a project is flagged and what to do next from list view.

How:
- In `Needs Attention` tab, show compact reason chips per row (or row hover in all tabs).
- In drawer top section, show primary reason + one deterministic suggested action.
- Reuse existing rules engine/conditions if present; do not introduce verbose LLM-only reasons.

Deliverables:
- `Needs Attention` tab becomes directly actionable without opening every drawer.
- Drawer explains the flag immediately.

Notes / Scope:
- In scope: reason display from deterministic rules.
- Out of scope: new AI reasoning system.

---

## Claude Task Message 3 (Medium): Filter/Search State Visibility
What:
Add explicit active filter state indicator and one-click `Clear All`.

Why:
Empty states are clear, but current UI still lacks a direct summary of active constraints and a fast reset control.

How:
- Add chips near controls for active tab + search term.
- Add `Clear All` to reset tab/search/sort.
- Keep keyboard behavior/help consistent with this flow.

Deliverables:
- User can always explain current result set from visible UI state.
- One-click return to default list state.

Notes / Scope:
- In scope: state indicators + reset.
- Out of scope: advanced query builder.

---

## Claude Task Message 4 (Medium): Drawer Long-Scroll Optimization
What:
Reduce default scroll burden in data-heavy drawers without removing information.

Why:
Long O-1 evidence/outcomes sections still push common workflow content too far down for quick triage.

How:
- Keep high-frequency sections open by default (`top summary`, `details`, `timeline`).
- Default low-frequency heavy sections collapsed (`O-1 Evidence`, long recommendations).
- Add lightweight expand/collapse with per-session persistence.

Deliverables:
- Faster open->decide->act flow in drawer.
- All detail remains accessible.

Notes / Scope:
- In scope: section default state and toggles.
- Out of scope: content deletion.

---

## Optional Micro-Polish (Only if Fast)
- Align top card label `Avg Health` with split score model wording (e.g., clarify as composite in tooltip).
- Keep this optional; do not block merge.

---

## Validation Checklist (PR Notes Required)
- Confirm stat scope consistency in:
  - default all view
  - paused tab
  - paused + search no-results
- Confirm `Needs Attention` rows expose deterministic reasons.
- Confirm drawer shows primary reason and suggested action.
- Confirm active filter chips + `Clear All` behavior.
- Confirm drawer collapsible heavy sections reduce default scrolling.
