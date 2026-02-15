# Phase 42.5 — Pipeline Runtime Decision Gate

## Decision: Path A (TypeScript-native rewrite)

**Date:** 2026-02-14
**Status:** Approved — Selected Path A (aligned CP-003 Review, 2026-02-14)

---

## Analysis Summary

### scan.py (~570 LOC)
| Capability | Node.js equivalent | Complexity |
|---|---|---|
| Filesystem walking (`os.walk`) | `fs.readdirSync` / `readdirSync` recursive | Trivial |
| Git commands (`subprocess.run`) | `child_process.execFileSync` | Direct port — already used in pipeline.ts |
| JSON file reading | `fs.readFileSync` + `JSON.parse` | Trivial |
| SHA-256 hashing | `crypto.createHash` | Already used in pipeline.ts |
| TOML parsing (pyproject.toml, Cargo.toml) | String matching only (no full parse) — same as Python impl | Trivial |
| .env key scanning | Line-by-line string ops | Trivial |

**External dependencies:** None. Python impl uses only stdlib.

### derive.py (~185 LOC)
| Capability | Node.js equivalent | Complexity |
|---|---|---|
| Status thresholds | Pure math/conditionals | Trivial |
| Score calculation | Arithmetic + normalization | Trivial |
| Tag derivation | Array/set operations | Trivial |

**External dependencies:** None. Pure functions, stdin→stdout.

---

## Parity Fixture Set

Location: `pipeline/fixtures/`

### Synthetic fixture (`scan-input-synthetic.json`)
3 projects covering edge cases:
1. **Active TS project** — all flags set, perfect hygiene/momentum, multiple services
2. **Stale Python project** — dirty tree, high TODOs, no tests/CI/deployment, ahead of remote
3. **Archived non-git project** — no repo, no commits, minimal metadata

### Golden baseline (`derive-expected-synthetic.json`)
Expected derive.py output — generated deterministically from the synthetic input.

### Live baseline
Captured from real `~/dev` scan (15 projects). Stored in `/tmp/` during testing, not committed (contains real paths).

---

## Output-Shape Acceptance Criteria

### scan output shape
Every project object MUST contain exactly these fields with these types:

```typescript
interface ScanProject {
  name: string;
  path: string;
  pathHash: string;               // 16-char hex
  isRepo: boolean;
  lastCommitDate: string | null;  // ISO 8601
  lastCommitMessage: string | null;
  branch: string | null;
  remoteUrl: string | null;
  commitCount: number;
  daysInactive: number | null;
  isDirty: boolean;
  untrackedCount: number;
  modifiedCount: number;
  stagedCount: number;
  ahead: number;
  behind: number;
  recentCommits: Array<{ hash: string; date: string; message: string }>;
  branchCount: number;
  stashCount: number;
  languages: { primary: string | null; detected: string[] };
  files: {
    readme: boolean;
    tests: boolean;
    env: boolean;
    envExample: boolean;
    dockerfile: boolean;
    dockerCompose: boolean;
    linterConfig: boolean;
    license: boolean;
    lockfile: boolean;
  };
  cicd: {
    githubActions: boolean;
    circleci: boolean;
    travis: boolean;
    gitlabCi: boolean;
  };
  deployment: { fly: boolean; vercel: boolean; netlify: boolean };
  todoCount: number;
  fixmeCount: number;
  description: string | null;
  framework: string | null;
  liveUrl: string | null;
  scripts: string[];
  services: string[];
  locEstimate: number;
  packageManager: string | null;
  license: boolean;
}

interface ScanOutput {
  scannedAt: string;       // ISO 8601
  projectCount: number;
  projects: ScanProject[];
}
```

### derive output shape

```typescript
interface DeriveProject {
  pathHash: string;
  statusAuto: "active" | "paused" | "stale" | "archived";
  healthScoreAuto: number;    // 0-100
  hygieneScoreAuto: number;   // 0-100
  momentumScoreAuto: number;  // 0-100
  scoreBreakdownJson: {
    hygiene: Record<string, number>;
    momentum: Record<string, number>;
  };
  tags: string[];             // sorted, unique
}

interface DeriveOutput {
  derivedAt: string;
  projects: DeriveProject[];
}
```

### Functional parity test
- TS derive function fed `scan-input-synthetic.json` MUST produce byte-identical JSON to `derive-expected-synthetic.json`
- TS scan function on a test project directory MUST produce structurally identical output (same keys, same types, same `pathHash`)

---

## Performance Thresholds

### Baseline measurements (Python, 15 projects in ~/dev)
| Script | Wall time | CPU | Notes |
|---|---|---|---|
| scan.py | 1.76s | 0.60s user, 0.64s system | Dominated by git subprocess calls |
| derive.py | 0.02s | 0.01s user | Pure computation |

### TS parity thresholds
| Metric | Threshold | Rationale |
|---|---|---|
| scan (same project set) | ≤ 3.0s | 1.7x headroom over Python; git calls dominate regardless of language |
| derive (same input) | ≤ 0.1s | 5x headroom; pure computation should be comparable |
| scan (cold start, incl. Node bootstrap) | ≤ 5.0s | Accounts for V8 startup overhead in Electron |

### Measurement method
```bash
# Python baseline
time python3 pipeline/scan.py ~/dev "node_modules,.venv,__pycache__"
time python3 pipeline/derive.py < /tmp/scan-output.json

# TypeScript candidate (when implemented)
time npx tsx src/lib/pipeline-native/scan.ts ~/dev "node_modules,.venv,__pycache__"
time npx tsx src/lib/pipeline-native/derive.ts < /tmp/scan-output.json

# Or as in-process benchmark in Vitest
# (preferred — eliminates process spawn overhead from Electron context)
```

---

## Decision Rationale

### Path A: TypeScript-native rewrite (RECOMMENDED)

**Pros:**
1. **Zero additional runtime** — Electron already bundles Node.js; no Python to package
2. **Eliminates ~50MB bundle size** — no embedded Python runtime
3. **No architecture-specific builds** — no arm64/x86 Python binary matrix
4. **Simpler packaging** — Phases 43-44 collapse significantly; no sidecar process management
5. **No PyInstaller fragility** — no frozen-module bugs, no venv compatibility issues
6. **In-process execution** — no subprocess spawn overhead; scan/derive can be called as functions
7. **Shared types** — scan/derive output types are already defined in TypeScript (pipeline.ts validators)
8. **Both scripts are stdlib-only** — no Python dependencies to bundle
9. **derive.py is pure functions** — direct port, testable line-by-line
10. **scan.py uses only `subprocess`, `os`, `pathlib`, `hashlib`, `json`** — all have Node.js equivalents

**Cons:**
1. **Rewrite effort** — estimated 2-3 days for scan (~570 LOC), 0.5 day for derive (~185 LOC)
2. **Subtle behavior differences** — filesystem edge cases, git output parsing could differ slightly
3. **Must maintain parity** — any future scan/derive changes need single-language updates only (but this is actually a pro once TS is the sole implementation)

**Risk mitigations:**
- Synthetic fixture set catches scoring/tagging regressions
- Live baseline comparison catches structural differences
- Existing Python tests (42 tests in `test_derive.py`) provide behavior spec to port

### Path B: Python sidecar fallback (NOT RECOMMENDED)

**Pros:**
1. No rewrite effort — ship existing code
2. Proven behavior — no risk of subtle porting bugs

**Cons:**
1. ~50MB bundle overhead (embedded Python or PyInstaller binary)
2. Architecture-specific builds required (arm64/x86_64)
3. Sidecar process management complexity (lifecycle, error handling, resource cleanup)
4. PyInstaller/frozen runtime fragility
5. Two language runtimes to maintain long-term
6. Subprocess spawn overhead per refresh (~200ms on macOS)
7. Makes the app harder to contribute to (requires Python toolchain for development)

---

## Conclusion

Path A is clearly preferred. The scripts are small, stdlib-only, and have well-defined input/output contracts with existing fixtures. The rewrite eliminates significant packaging complexity and is net-negative in long-term maintenance cost.

**Next steps after team alignment:**
1. Implement `src/lib/pipeline-native/derive.ts` (pure functions, easiest first)
2. Implement `src/lib/pipeline-native/scan.ts` (filesystem + git ops)
3. Run parity tests against fixtures
4. Run performance benchmarks
5. Swap `pipeline.ts` to call TS functions instead of Python subprocess
6. Mark Phase 42.5 complete, proceed to Phase 43
