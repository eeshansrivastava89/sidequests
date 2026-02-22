// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StatsBar } from "@/components/stats-bar";
import type { Project } from "@/lib/types";

afterEach(cleanup);

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "1",
    name: "test",
    pathDisplay: "/test",
    status: "active",
    healthScore: 80,
    hygieneScore: 80,
    momentumScore: 80,
    scoreBreakdown: {},
    summary: null,
    tags: [],
    insights: [],
    notes: null,
    nextAction: null,
    llmStatus: null,
    statusReason: null,
    isDirty: false,
    ahead: 0,
    behind: 0,
    framework: null,
    branchName: "main",
    lastCommitDate: null,
    locEstimate: 0,
    scan: null,
    recentCommits: [],
    scripts: [],
    services: [],
    packageManager: null,
    branchCount: 1,
    stashCount: 0,
    license: false,
    pinned: false,
    lastTouchedAt: null,
    goal: null,
    audience: null,
    successMetrics: null,
    publishTarget: null,
    lastScanned: null,
    updatedAt: "2026-01-01",
    notableFeatures: [],
    pitch: null,
    liveUrl: null,
    llmGeneratedAt: null,
    openIssues: 0,
    openPrs: 0,
    ciStatus: "none",
    issuesTopJson: null,
    prsTopJson: null,
    repoVisibility: "not-on-github",
    githubFetchedAt: null,
    ...overrides,
  } as Project;
}

describe("StatsBar — filter interactions", () => {
  it("clicking Uncommitted card calls onFilter with 'uncommitted'", () => {
    const onFilter = vi.fn();
    const projects = [
      makeProject({ id: "1", isDirty: true }),
      makeProject({ id: "2", isDirty: false }),
    ];
    render(<StatsBar projects={projects} onFilter={onFilter} />);

    fireEvent.click(screen.getByText("Uncommitted").closest("button")!);
    expect(onFilter).toHaveBeenCalledWith("uncommitted");
  });

  it("clicking active Uncommitted card toggles off (calls onFilter(null))", () => {
    const onFilter = vi.fn();
    const projects = [makeProject({ id: "1", isDirty: true })];
    render(<StatsBar projects={projects} activeFilter="uncommitted" onFilter={onFilter} />);

    fireEvent.click(screen.getByText("Uncommitted").closest("button")!);
    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it("clicking Projects card calls onClearAll when provided", () => {
    const onFilter = vi.fn();
    const onClearAll = vi.fn();
    const projects = [makeProject()];
    render(<StatsBar projects={projects} onFilter={onFilter} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByText("Projects").closest("button")!);
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(onFilter).not.toHaveBeenCalled();
  });

  it("clicking Projects card falls back to onFilter(null) when onClearAll absent", () => {
    const onFilter = vi.fn();
    const projects = [makeProject()];
    render(<StatsBar projects={projects} onFilter={onFilter} />);

    fireEvent.click(screen.getByText("Projects").closest("button")!);
    expect(onFilter).toHaveBeenCalledWith(null);
  });
});
