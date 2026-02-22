// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ProjectList } from "@/components/project-list";
import type { Project } from "@/lib/types";

afterEach(cleanup);

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    pathDisplay: `/${name}`,
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
  } as Project;
}

const projects = [
  makeProject("1", "alpha"),
  makeProject("2", "bravo"),
  makeProject("3", "charlie"),
];

describe("ProjectList — keyboard navigation", () => {
  it("ArrowDown moves focus to next row", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ProjectList
        projects={projects}
        selectedId={null}
        onSelect={onSelect}
        onTogglePin={vi.fn()}
        onTouch={vi.fn()}
        sanitizePaths={true}
      />
    );

    const rows = container.querySelectorAll("[data-project-id]");
    expect(rows).toHaveLength(3);

    // Focus first row and press ArrowDown
    (rows[0] as HTMLElement).focus();
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });

    expect(document.activeElement).toBe(rows[1]);
  });

  it("ArrowUp moves focus to previous row", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ProjectList
        projects={projects}
        selectedId={null}
        onSelect={onSelect}
        onTogglePin={vi.fn()}
        onTouch={vi.fn()}
        sanitizePaths={true}
      />
    );

    const rows = container.querySelectorAll("[data-project-id]");

    // Focus second row and press ArrowUp
    (rows[1] as HTMLElement).focus();
    fireEvent.keyDown(rows[1], { key: "ArrowUp" });

    expect(document.activeElement).toBe(rows[0]);
  });

  it("Enter triggers onSelect with correct project", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ProjectList
        projects={projects}
        selectedId={null}
        onSelect={onSelect}
        onTogglePin={vi.fn()}
        onTouch={vi.fn()}
        sanitizePaths={true}
      />
    );

    const rows = container.querySelectorAll("[data-project-id]");

    // Focus second row and press Enter
    (rows[1] as HTMLElement).focus();
    fireEvent.keyDown(rows[1], { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(projects[1]);
  });

  it("ArrowDown on last row does not crash", () => {
    const { container } = render(
      <ProjectList
        projects={projects}
        selectedId={null}
        onSelect={vi.fn()}
        onTogglePin={vi.fn()}
        onTouch={vi.fn()}
        sanitizePaths={true}
      />
    );

    const rows = container.querySelectorAll("[data-project-id]");
    (rows[2] as HTMLElement).focus();
    // Should not throw
    fireEvent.keyDown(rows[2], { key: "ArrowDown" });
    // Focus stays on last row
    expect(document.activeElement).toBe(rows[2]);
  });
});
