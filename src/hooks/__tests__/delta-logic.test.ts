import { describe, it, expect } from "vitest";
import {
  computeCauses,
  isNeedsAttention,
  type ProjectSnapshot,
} from "@/hooks/use-refresh-deltas";

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    healthScore: 70,
    hygieneScore: 60,
    momentumScore: 50,
    locEstimate: 5000,
    status: "active",
    isDirty: false,
    ahead: 0,
    llmGeneratedAt: null,
    nextAction: null,
    purpose: null,
    daysInactive: 0,
    ...overrides,
  };
}

describe("computeCauses", () => {
  it("returns health_up when health increased", () => {
    const old = makeSnapshot({ healthScore: 50 });
    const cur = makeSnapshot({ healthScore: 70 });
    expect(computeCauses(old, cur, false)).toContain("health_up");
  });

  it("returns health_down when health decreased", () => {
    const old = makeSnapshot({ healthScore: 70 });
    const cur = makeSnapshot({ healthScore: 50 });
    expect(computeCauses(old, cur, false)).toContain("health_down");
  });

  it("returns hygiene_up when hygiene increased", () => {
    const old = makeSnapshot({ hygieneScore: 40 });
    const cur = makeSnapshot({ hygieneScore: 60 });
    expect(computeCauses(old, cur, false)).toContain("hygiene_up");
  });

  it("returns hygiene_down when hygiene decreased", () => {
    const old = makeSnapshot({ hygieneScore: 60 });
    const cur = makeSnapshot({ hygieneScore: 40 });
    expect(computeCauses(old, cur, false)).toContain("hygiene_down");
  });

  it("returns momentum_up when momentum increased", () => {
    const old = makeSnapshot({ momentumScore: 30 });
    const cur = makeSnapshot({ momentumScore: 50 });
    expect(computeCauses(old, cur, false)).toContain("momentum_up");
  });

  it("returns momentum_down when momentum decreased", () => {
    const old = makeSnapshot({ momentumScore: 50 });
    const cur = makeSnapshot({ momentumScore: 30 });
    expect(computeCauses(old, cur, false)).toContain("momentum_down");
  });

  it("returns status_changed when status differs", () => {
    const old = makeSnapshot({ status: "active" });
    const cur = makeSnapshot({ status: "paused" });
    expect(computeCauses(old, cur, false)).toContain("status_changed");
  });

  it("returns scan_changed when isDirty changes", () => {
    const old = makeSnapshot({ isDirty: false });
    const cur = makeSnapshot({ isDirty: true });
    expect(computeCauses(old, cur, false)).toContain("scan_changed");
  });

  it("returns scan_changed when locEstimate changes", () => {
    const old = makeSnapshot({ locEstimate: 1000 });
    const cur = makeSnapshot({ locEstimate: 2000 });
    expect(computeCauses(old, cur, false)).toContain("scan_changed");
  });

  it("returns scan_changed when daysInactive changes", () => {
    const old = makeSnapshot({ daysInactive: 5 });
    const cur = makeSnapshot({ daysInactive: 10 });
    expect(computeCauses(old, cur, false)).toContain("scan_changed");
  });

  it("returns newly_enriched when flag is true", () => {
    const snap = makeSnapshot();
    expect(computeCauses(snap, snap, true)).toContain("newly_enriched");
  });

  it("returns unchanged when nothing differs and not enriched", () => {
    const snap = makeSnapshot();
    const causes = computeCauses(snap, snap, false);
    expect(causes).toEqual(["unchanged"]);
  });

  it("returns multiple causes when multiple things change", () => {
    const old = makeSnapshot({ healthScore: 50, hygieneScore: 40, status: "active" });
    const cur = makeSnapshot({ healthScore: 70, hygieneScore: 60, status: "paused" });
    const causes = computeCauses(old, cur, false);
    expect(causes).toContain("health_up");
    expect(causes).toContain("hygiene_up");
    expect(causes).toContain("status_changed");
    expect(causes).not.toContain("unchanged");
  });
});

describe("isNeedsAttention", () => {
  it("returns true when healthScore < 40", () => {
    expect(
      isNeedsAttention({ healthScore: 30, isDirty: false, daysInactive: 0, nextAction: null }),
    ).toBe(true);
  });

  it("returns true when dirty and inactive > 7 days", () => {
    expect(
      isNeedsAttention({ healthScore: 80, isDirty: true, daysInactive: 10, nextAction: null }),
    ).toBe(true);
  });

  it("returns true when inactive > 30 days with no nextAction", () => {
    expect(
      isNeedsAttention({ healthScore: 80, isDirty: false, daysInactive: 35, nextAction: null }),
    ).toBe(true);
  });

  it("returns false when inactive > 30 days but has nextAction", () => {
    expect(
      isNeedsAttention({
        healthScore: 80,
        isDirty: false,
        daysInactive: 35,
        nextAction: "Ship it",
      }),
    ).toBe(false);
  });

  it("returns false for a healthy active project", () => {
    expect(
      isNeedsAttention({ healthScore: 80, isDirty: false, daysInactive: 5, nextAction: null }),
    ).toBe(false);
  });
});
