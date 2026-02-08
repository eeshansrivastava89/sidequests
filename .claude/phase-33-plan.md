# Phase 33: Scoring + Delta Re-Architecture

## Implementation Plan

### Phase A (Blocking Foundation)
**Task 1: Score Split + Prisma Migration**
- `pipeline/derive.py` — add `hygieneScoreAuto`, `momentumScoreAuto`; keep `healthScoreAuto = round(0.65*hygiene + 0.35*momentum)`
- `prisma/schema.prisma` — add `hygieneScoreAuto Int`, `momentumScoreAuto Int`, `scoreBreakdownJson String` to Derived model
- `src/lib/pipeline.ts` — store new fields during derive upsert
- `src/lib/merge.ts` + types — expose `hygieneScore`, `momentumScore`, `scoreBreakdown`
- Run migration, verify backward compat (healthScore still works everywhere)

### Phase B (Parallel — after Task 1)

**Task 2: Delta Provenance** (owns: pipeline events, use-refresh-deltas.ts, refresh-panel)
- Pipeline emits per-project provenance: `scanHashChanged`, `deriveFieldsChanged[]`, `llmStatus`
- `use-refresh-deltas.ts` — consume provenance, emit `deltaCause[]`, `semanticChanged`
- Refresh panel / badges show "why" not just "what"

**Task 3: AI Structured Insight** (owns: llm/prompt.ts, llm/provider.ts, new aiInsight storage, drawer AI section)
- New LLM response contract: `aiInsight: { score, confidence, reasons[], risks[], nextBestAction }`
- Runtime schema validation, graceful fallback on malformed
- Persist `aiInsightJson`, `aiInsightGeneratedAt` in Llm model
- Drawer shows insight with reasons + confidence badge

**Task 4: Attention Rule Engine** (owns: new attention.ts, page.tsx filters, stats-bar counts)
- New `src/lib/attention.ts` — shared evaluator returning `{ needsAttention, reasons[], severity }`
- Reason codes: `LOW_HYGIENE`, `DIRTY_AGE_GT_7`, `NO_NEXT_ACTION_GT_30`, `STALE_MOMENTUM`, etc.
- Replace hardcoded `needsAttention()` in page.tsx + stats-bar with shared module
- Drawer shows top reasons + severity

### Phase C (After B)
**Task 5: Calibration + Backfill**
- Add `scoreFormulaVersion` tracking
- Backfill existing records
- Calibration script for distribution analysis

## File Ownership (Conflict Avoidance)
| Agent | Exclusive Files |
|-------|----------------|
| Task 1 | derive.py, schema.prisma, merge.ts, types |
| Task 2 | use-refresh-deltas.ts, refresh-panel.tsx |
| Task 3 | llm/prompt.ts, llm/provider.ts |
| Task 4 | attention.ts (new), stats-bar.tsx |
| Lead | pipeline.ts, page.tsx, drawer (integration of all) |

## Scoring Formulas

### Hygiene (0-100, deterministic, slow-moving)
- README: +15, Tests: +20, CI/CD: +15, Remote: +10
- Low TODOs (<10): +10, Deployment: +10, Linter: +5, License: +5, Lockfile: +5
- Same as current healthScore minus recency component
- Normalized from 95 max to 0-100

### Momentum (0-100, operational, fast-moving)
- Commit recency: +25 (<=7d), +20 (<=14d), +15 (<=30d), +5 (<=60d)
- Clean working tree (!isDirty): +20
- Pushed up (ahead==0): +15
- Has next action: +15
- Recently opened (lastTouchedAt <= 7d): +15
- Low stale branches (<=3): +10
- Normalized from 100 max to 0-100

### Legacy healthScore
- `round(0.65 * hygiene + 0.35 * momentum)` — backward compatible
