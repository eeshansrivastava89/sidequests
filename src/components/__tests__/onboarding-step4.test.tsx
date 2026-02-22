// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScanStep } from "@/components/onboarding-wizard";
import type { RefreshState } from "@/hooks/use-refresh";

afterEach(cleanup);

const noop = vi.fn();

function makeState(overrides: Partial<RefreshState> = {}): RefreshState {
  return {
    active: false,
    phase: "",
    deterministicReady: false,
    projects: new Map(),
    summary: null,
    error: null,
    ...overrides,
  };
}

describe("ScanStep — rendered DOM (Step 4 CTA)", () => {
  it("shows 'Start Scan' button before scan starts", () => {
    render(
      <ScanStep
        devRoot="~/dev"
        scanStarted={false}
        scanState={makeState()}
        onStartScan={noop}
        onComplete={noop}
        onBack={noop}
      />
    );
    expect(screen.getByText("Start Scan")).toBeDefined();
    expect(screen.queryByText("Open Dashboard Now")).toBeNull();
    expect(screen.queryByText("Open Dashboard")).toBeNull();
  });

  it("shows spinner but NOT 'Open Dashboard Now' when scan is active but deterministicReady=false", () => {
    render(
      <ScanStep
        devRoot="~/dev"
        scanStarted={true}
        scanState={makeState({ active: true, deterministicReady: false, phase: "Scanning filesystem..." })}
        onStartScan={noop}
        onComplete={noop}
        onBack={noop}
      />
    );
    expect(screen.getByText("Scanning filesystem...")).toBeDefined();
    expect(screen.queryByText("Open Dashboard Now")).toBeNull();
    expect(screen.queryByText("Start Scan")).toBeNull();
  });

  it("shows 'Open Dashboard Now' when deterministicReady=true and scan is active", () => {
    render(
      <ScanStep
        devRoot="~/dev"
        scanStarted={true}
        scanState={makeState({
          active: true,
          deterministicReady: true,
          phase: "Enriching project-a (1/5)",
        })}
        onStartScan={noop}
        onComplete={noop}
        onBack={noop}
      />
    );
    expect(screen.getByText("Open Dashboard Now")).toBeDefined();
    expect(screen.getByText("Core scan complete. You can open the dashboard now while LLM enrichment continues in the background.")).toBeDefined();
    expect(screen.getByText("Enriching project-a (1/5)")).toBeDefined();
  });

  it("shows 'Open Dashboard' (without 'Now') when scan is fully done", () => {
    render(
      <ScanStep
        devRoot="~/dev"
        scanStarted={true}
        scanState={makeState({
          active: false,
          deterministicReady: true,
          summary: { type: "done", projectCount: 12 },
        })}
        onStartScan={noop}
        onComplete={noop}
        onBack={noop}
      />
    );
    expect(screen.getByText("Open Dashboard")).toBeDefined();
    expect(screen.getByText("Found 12 projects")).toBeDefined();
    expect(screen.queryByText("Open Dashboard Now")).toBeNull();
  });

  it("shows error state with Retry button on scan failure", () => {
    render(
      <ScanStep
        devRoot="~/dev"
        scanStarted={true}
        scanState={makeState({
          active: false,
          error: "ENOENT: no such file or directory",
        })}
        onStartScan={noop}
        onComplete={noop}
        onBack={noop}
      />
    );
    expect(screen.getByText("Dev root directory does not exist. Check the path in Settings.")).toBeDefined();
    expect(screen.getByText("Retry")).toBeDefined();
    expect(screen.getByText("Skip")).toBeDefined();
  });
});
