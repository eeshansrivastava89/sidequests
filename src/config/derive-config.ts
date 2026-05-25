/**
 * Derive configuration — thresholds and weights for status, hygiene, momentum, and health scores.
 *
 * These control how the deterministic "fast scan" derives project health from raw scan data.
 * Edit this file to tune scoring without changing code.
 */

export const deriveConfig = {
  /** Days inactive thresholds for status classification. */
  status: {
    active: 14,      // ≤ 14 days → active
    completed: 60,   // 15-60 days → completed
    paused: 180,     // 61-180 days → paused
    // > 180 days → archived
  },

  /** Hygiene score weights (raw max = sum of all values). Normalized to 0-100. */
  hygiene: {
    readme: 15,
    tests: 20,
    cicd: 15,
    remote: 10,
    lowTodos: 10,   // awarded when TODO count < lowTodosThreshold
    deployment: 10,
    linter: 5,
    license: 5,
    lockfile: 5,
    // rawMax = 95  (normalized to 100)
  },

  /** Threshold for "low TODOs" hygiene bonus. */
  lowTodosThreshold: 10,

  /** Momentum score weights (raw max = sum of all values). Normalized to 0-100. */
  momentum: {
    recency7d: 25,    // last commit ≤ 7 days ago
    recency14d: 20,  // ≤ 14 days
    recency30d: 15,  // ≤ 30 days
    recency60d: 5,   // ≤ 60 days
    cleanTree: 20,   // not dirty
    pushedUp: 15,    // ahead === 0
    lowBranches: 10, // branch count ≤ lowBranchesThreshold
    // rawMax = 70  (normalized to 100)
  },

  /** Threshold for "low branches" momentum bonus. */
  lowBranchesThreshold: 3,

  /** Health score = hygieneWeight * hygiene + momentumWeight * momentum. */
  healthWeights: {
    hygiene: 0.65,
    momentum: 0.35,
  },
} as const;

/** Compute the raw max for hygiene (sum of all weights — all can be earned simultaneously). */
export const hygieneRawMax = Object.values(deriveConfig.hygiene).reduce((a, b) => a + b, 0);

/** Compute the raw max for momentum (max achievable — only one recency tier can be earned). */
export const momentumRawMax = (() => {
  const m = deriveConfig.momentum;
  const maxRecency = Math.max(m.recency7d, m.recency14d, m.recency30d, m.recency60d);
  return maxRecency + m.cleanTree + m.pushedUp + m.lowBranches;
})();
