# Pipeline Parity Fixtures

Golden test fixtures for validating TypeScript pipeline parity against the Python baseline.

## Files

- `scan-input-synthetic.json` — Synthetic scan output with 3 projects covering edge cases:
  - Active TypeScript project (perfect scores, all flags set)
  - Stale Python project (dirty, high TODOs, no tests/CI/deployment)
  - Archived non-git Rust project (no repo, minimal metadata)
- `derive-expected-synthetic.json` — Expected derive.py output for the synthetic input (golden baseline)

## Usage

### Validate Python baseline
```bash
python3 pipeline/derive.py < pipeline/fixtures/scan-input-synthetic.json | diff - pipeline/fixtures/derive-expected-synthetic.json
```

### Validate TypeScript parity (when implemented)
```bash
npx vitest run src/lib/__tests__/pipeline-parity.test.ts
```

## Acceptance Criteria

See `docs/internal/PHASE_42_5_DECISION.md` for full parity acceptance criteria.
