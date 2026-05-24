export interface Insight {
  text: string;
  severity: "green" | "amber" | "red";
}

/** Priority action from the API (computed per project). */
export type ActionSource = "git" | "issue" | "ai" | "stale";
export type ActionSeverity = "high" | "med" | "low";

export interface PriorityAction {
  type: string;
  label: string;
  source: ActionSource;
  severity: ActionSeverity;
  projectId: string;
  projectName: string;
}

/** Focus goal from GET /api/focus. */
export interface FocusGoal {
  id: string;
  projectId: string;
  projectName: string;
  goal: string;
  completed: boolean;
  weekStart: string;
  createdAt: string;
}

/** Shipped history from GET /api/shipped. */
export interface ShippedData {
  weekTotal: number;
  monthTotal: number;
  quarterTotal: number;
  projects: Array<{
    id: string;
    name: string;
    weekCommits: number;
    monthCommits: number;
    quarterCommits: number;
  }>;
}

/** Visit delta from GET /api/visit. */
export interface VisitDelta {
  ok: boolean;
  firstVisit: boolean;
  current: Array<{ id: string; name: string; status: string; healthScore: number; weekCommits: number; monthCommits: number }>;
  delta: {
    added: string[];
    removed: string[];
    changed: Array<{ id: string; name: string; field: string; from: unknown; to: unknown }>;
  } | null;
  lastVisitAt: string | null;
}

/** Client-side mirror of MergedProject from the API. */
export interface Project {
  id: string;
  name: string;
  pathHash: string;
  pathDisplay: string;
  status: string;
  healthScore: number;
  hygieneScore: number;
  momentumScore: number;
  scoreBreakdown: Record<string, Record<string, number>>;
  summary: string | null;
  tags: string[];
  insights: Insight[];
  notes: string | null;

  // Phase 53W: LLM actionable fields
  nextAction: string | null;
  llmStatus: string | null;
  statusReason: string | null;

  // Promoted derived columns
  isDirty: boolean;
  dirtyFileCount: number;
  ahead: number;
  behind: number;
  framework: string | null;
  primaryLanguage: string | null;
  branchName: string | null;
  lastCommitDate: string | null;
  locEstimate: number;
  locCode: number;
  locDocs: number;
  locGenerated: number;

  scan: RawScan | null;

  // Scan-derived fields surfaced at top level
  recentCommits: Array<{ hash: string; message: string; date: string }>;
  scripts: string[];
  services: string[];
  packageManager: string | null;
  branchCount: number;
  stashCount: number;
  license: boolean;

  // Project-level fields
  pinned: boolean;
  lastTouchedAt: string | null;

  goal: string | null;
  audience: string | null;
  successMetrics: string | null;
  publishTarget: string | null;
  lastScanned: string | null;
  updatedAt: string;

  llmError: string | null;
  liveUrl: string | null;
  llmGeneratedAt: string | null;

  // Phase 52W: GitHub data
  openIssues: number;
  openPrs: number;
  ciStatus: string;
  issuesTopJson: string | null;
  prsTopJson: string | null;
  repoVisibility: string;
  githubFetchedAt: string | null;

  // Phase 2: Computed actions + lifecycle fields
  actions: PriorityAction[];
  isSnoozed: boolean;
  weekCommits: number;
  monthCommits: number;
  quarterCommits: number;
  snoozedUntil: string | null;
  archivedNote: string | null;
}

export interface RawScan {
  isRepo: boolean;
  lastCommitDate: string | null;
  lastCommitMessage: string | null;
  branch: string | null;
  remoteUrl: string | null;
  commitCount: number;
  daysInactive: number | null;
  isDirty: boolean;
  languages: { primary: string | null; detected: string[] };
  files: Record<string, boolean>;
  cicd: Record<string, boolean>;
  deployment: Record<string, boolean>;
  todoCount: number;
  fixmeCount: number;
  description: string | null;
  recentCommits: Array<{ hash: string; message: string; date: string }>;
  scripts: string[];
  services: string[];
  packageManager: string | null;
  branchCount: number;
  stashCount: number;
  locEstimate: number;
  license: boolean;
  ahead: number;
  behind: number;
  framework: string | null;
  liveUrl: string | null;
}

export type WorkflowView = "all" | "active" | "completed" | "paused" | "archived";

export type SortKey = "lastCommit" | "name" | "health" | "status" | "daysInactive";

export interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
  tier?: "required" | "optional";
  /** True when this check corresponds to the currently selected provider. */
  active?: boolean;
}
