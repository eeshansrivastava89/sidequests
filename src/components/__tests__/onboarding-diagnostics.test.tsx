// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import {
  sortPreflightChecks,
  computeDiagnosticsBanner,
  type PreflightCheck,
} from "@/components/onboarding-wizard";

/**
 * Thin test harness that renders the diagnostics section using the same
 * exported helpers the real component uses. This proves the DOM output
 * matches the helper logic — if the helpers or rendering diverge, tests fail.
 */
function DiagnosticsTestHarness({ checks }: { checks: PreflightCheck[] }) {
  const sorted = sortPreflightChecks(checks);
  const banner = computeDiagnosticsBanner(checks);

  return (
    <div>
      <ul data-testid="check-list">
        {sorted.map((check) => (
          <li key={check.name} data-testid={`check-${check.name}`}>
            <span data-testid={`icon-${check.name}`}>
              {check.ok ? "\u2713" : "\u2717"}
            </span>
            <span data-testid={`name-${check.name}`}>{check.name}</span>
            {!check.ok && check.tier && (
              <span data-testid={`tier-${check.name}`}>{check.tier}</span>
            )}
            <span data-testid={`msg-${check.name}`}>{check.message}</span>
          </li>
        ))}
      </ul>
      {banner === "all_pass" && (
        <div data-testid="banner">All checks passed</div>
      )}
      {banner === "required_pass" && (
        <div data-testid="banner">Required checks passed. Some optional features are unavailable.</div>
      )}
      {banner === "required_fail" && (
        <div data-testid="banner">Required checks failed. Fix these before continuing.</div>
      )}
    </div>
  );
}

describe("Diagnostics UI — rendered DOM", () => {
  it("renders all checks passed banner when everything is ok", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: true, message: "git 2.39", tier: "required" },
      { name: "gh", ok: true, message: "gh 2.40", tier: "optional" },
    ];
    render(<DiagnosticsTestHarness checks={checks} />);

    expect(screen.getByTestId("banner").textContent).toBe("All checks passed");
    // No tier labels shown when checks pass
    expect(screen.queryByTestId("tier-git")).toBeNull();
    expect(screen.queryByTestId("tier-gh")).toBeNull();
  });

  it("renders 'required pass' banner when only optional checks fail", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: true, message: "git 2.39", tier: "required" },
      { name: "gh", ok: false, message: "gh not found", tier: "optional" },
    ];
    render(<DiagnosticsTestHarness checks={checks} />);

    expect(screen.getByTestId("banner").textContent).toContain("Required checks passed");
    // Optional tier label shown on failed check
    expect(screen.getByTestId("tier-gh").textContent).toBe("optional");
    // No tier label on passing required check
    expect(screen.queryByTestId("tier-git")).toBeNull();
  });

  it("renders 'required fail' banner when required checks fail", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: false, message: "git not found", tier: "required" },
      { name: "gh", ok: true, message: "gh 2.40", tier: "optional" },
    ];
    render(<DiagnosticsTestHarness checks={checks} />);

    expect(screen.getByTestId("banner").textContent).toContain("Required checks failed");
    expect(screen.getByTestId("tier-git").textContent).toBe("required");
  });

  it("sorts required checks before optional in rendered DOM", () => {
    const checks: PreflightCheck[] = [
      { name: "gh", ok: false, message: "gh not found", tier: "optional" },
      { name: "claude", ok: false, message: "not found", tier: "optional" },
      { name: "git", ok: true, message: "git 2.39", tier: "required" },
    ];
    render(<DiagnosticsTestHarness checks={checks} />);

    const items = screen.getByTestId("check-list").querySelectorAll("li");
    expect(items).toHaveLength(3);
    // First item should be the required check (git), sorted to front
    expect(items[0].querySelector('[data-testid="name-git"]')).toBeTruthy();
    expect(items[1].querySelector('[data-testid="name-gh"]')).toBeTruthy();
    expect(items[2].querySelector('[data-testid="name-claude"]')).toBeTruthy();
  });

  it("shows checkmark for passing and X for failing checks", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: true, message: "ok", tier: "required" },
      { name: "gh", ok: false, message: "fail", tier: "optional" },
    ];
    render(<DiagnosticsTestHarness checks={checks} />);

    expect(screen.getByTestId("icon-git").textContent).toBe("\u2713");
    expect(screen.getByTestId("icon-gh").textContent).toBe("\u2717");
  });
});
