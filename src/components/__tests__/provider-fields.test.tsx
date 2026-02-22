// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProviderFields, PROVIDERS } from "@/components/settings-fields";
import type { AppConfig } from "@/hooks/use-config";

afterEach(cleanup);

function makeDraft(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    sanitizePaths: true,
    devRoot: "~/dev",
    excludeDirs: "",
    llmProvider: "claude-cli",
    llmConcurrency: 3,
    llmOverwriteMetadata: false,
    llmAllowUnsafe: false,
    llmDebug: false,
    claudeCliModel: "",
    openrouterApiKey: "",
    openrouterModel: "",
    ollamaUrl: "",
    ollamaModel: "",
    mlxUrl: "",
    mlxModel: "",
    codexCliModel: "",
    hasCompletedOnboarding: false,
    ...overrides,
  };
}

const noop = () => {};

function renderProvider(provider: string) {
  return render(<ProviderFields draft={makeDraft({ llmProvider: provider })} set={noop as never} />);
}

describe("ProviderFields — rendered DOM", () => {
  it("shows provider select with all PROVIDERS options", () => {
    renderProvider("claude-cli");
    const select = screen.getByDisplayValue("claude-cli");
    expect(select).toBeDefined();
    for (const p of PROVIDERS) {
      expect(select.querySelector(`option[value="${p}"]`)).toBeTruthy();
    }
  });

  it("renders model selector for claude-cli", () => {
    renderProvider("claude-cli");
    const modelLabels = screen.getAllByText("Model");
    expect(modelLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Default")).toBeDefined();
    expect(screen.getByText("Opus 4.6")).toBeDefined();
  });

  it("falls back to claude-cli when llmProvider is empty string", () => {
    renderProvider("");
    expect(screen.getByDisplayValue("claude-cli")).toBeDefined();
    const modelLabels = screen.getAllByText("Model");
    expect(modelLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Default")).toBeDefined();
  });

  it('falls back to claude-cli when llmProvider is "none"', () => {
    renderProvider("none");
    expect(screen.getByDisplayValue("claude-cli")).toBeDefined();
    const modelLabels = screen.getAllByText("Model");
    expect(modelLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Default")).toBeDefined();
  });

  it("renders model selector for codex-cli", () => {
    renderProvider("codex-cli");
    expect(screen.getByDisplayValue("codex-cli")).toBeDefined();
    const modelLabels = screen.getAllByText("Model");
    expect(modelLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("o3")).toBeDefined();
  });
});
