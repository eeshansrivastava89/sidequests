import type { Project, WorkflowView, SortKey } from "@/lib/types";
import type { StatsBarSignalFilter as SignalFilter } from "@/components/overview-strip";

/* ── Sort ───────────────────────────────────────────────── */

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "lastCommit", label: "Last Commit" },
  { key: "name", label: "Name" },
  { key: "health", label: "Health" },
  { key: "status", label: "Status" },
  { key: "daysInactive", label: "Days Inactive" },
];

function sortProjects(projects: Project[], sortKey: SortKey): Project[] {
  const sorted = [...projects];
  switch (sortKey) {
    case "lastCommit":
      return sorted.sort((a, b) => {
        const da = a.scan?.lastCommitDate ?? "";
        const db = b.scan?.lastCommitDate ?? "";
        return db.localeCompare(da); // desc
      });
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name)); // asc
    case "health":
      return sorted.sort((a, b) => a.healthScore - b.healthScore); // asc (worst first)
    case "status": {
      const order: Record<string, number> = { active: 0, paused: 1, stale: 2, archived: 3 };
      return sorted.sort(
        (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99)
      );
    }
    case "daysInactive":
      return sorted.sort((a, b) => {
        const da = a.scan?.daysInactive ?? Infinity;
        const db = b.scan?.daysInactive ?? Infinity;
        return da - db; // asc (least inactive first)
      });
    default:
      return sorted;
  }
}

/* ── Filter ─────────────────────────────────────────────── */

function filterByView(projects: Project[], view: WorkflowView): Project[] {
  switch (view) {
    case "active":
      return projects.filter((p) => p.status === "active");
    case "completed":
      return projects.filter((p) => p.status === "completed");
    case "paused":
      return projects.filter((p) => p.status === "paused");
    case "archived":
      return projects.filter((p) => p.status === "archived");
    default:
      return projects;
  }
}

function filterBySearch(projects: Project[], query: string): Project[] {
  if (!query) return projects;
  const q = query.toLowerCase();
  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.summary?.toLowerCase().includes(q) ||
      p.scan?.languages?.primary?.toLowerCase().includes(q)
  );
}

function filterBySignal(projects: Project[], signal: SignalFilter): Project[] {
  if (!signal) return projects;
  switch (signal) {
    case "uncommitted":
      return projects.filter((p) => p.isDirty);
    case "open-issues":
      return projects.filter((p) => p.openIssues > 0);
    case "ci-failing":
      return projects.filter((p) => p.ciStatus === "failure");
    case "not-on-github":
      return projects.filter((p) => p.repoVisibility === "not-on-github");
    default:
      return projects;
  }
}

const SIGNAL_LABELS: Record<string, string> = {
  uncommitted: "Uncommitted",
  "open-issues": "Open Issues",
  "ci-failing": "CI Failing",
  "not-on-github": "Not on GitHub",
};

/* ── LocalStorage helpers ───────────────────────────────── */

function loadSortKey(): SortKey {
  if (typeof window === "undefined") return "lastCommit";
  return (localStorage.getItem("dashboard-sort") as SortKey) ?? "lastCommit";
}

function saveSortKey(key: SortKey) {
  localStorage.setItem("dashboard-sort", key);
}

/* ── Last Refreshed ─────────────────────────────────────── */

function getLastRefreshed(projects: Project[]): string | null {
  let latest: string | null = null;
  for (const p of projects) {
    if (p.lastScanned && (!latest || p.lastScanned > latest)) {
      latest = p.lastScanned;
    }
  }
  return latest;
}

export {
  SORT_OPTIONS,
  sortProjects,
  filterByView,
  filterBySearch,
  filterBySignal,
  SIGNAL_LABELS,
  loadSortKey,
  saveSortKey,
  getLastRefreshed,
};