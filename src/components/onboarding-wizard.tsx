"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppConfig } from "@/hooks/use-config";
import type { RefreshState } from "@/hooks/use-refresh";
import type { PreflightCheck } from "@/lib/types";
export type { PreflightCheck };
import { Field, ProviderFields } from "@/components/settings-fields";
import { toast } from "sonner";

/** Sort preflight checks: required first, then optional. */
export function sortPreflightChecks(checks: PreflightCheck[]): PreflightCheck[] {
  return [...checks].sort((a, b) => {
    const tierOrder = (t?: string) => t === "required" ? 0 : 1;
    return tierOrder(a.tier) - tierOrder(b.tier);
  });
}

/** Compute the diagnostics banner state from preflight checks. */
export function computeDiagnosticsBanner(checks: PreflightCheck[]): "all_pass" | "required_pass" | "required_fail" {
  const allPass = checks.every((c) => c.ok);
  if (allPass) return "all_pass";
  const requiredPass = checks.filter((c) => c.tier === "required").every((c) => c.ok);
  return requiredPass ? "required_pass" : "required_fail";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AppConfig;
  onSaved: () => void;
  onStartScan: () => void;
  scanState: RefreshState;
}

const STEPS = ["Welcome", "Configure", "Diagnostics", "First Scan"] as const;
const DEFAULT_EXCLUDE_DIRS = "node_modules,.venv,__pycache__,.git";

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("enoent") || lower.includes("no such file") || lower.includes("does not exist"))
    return "Dev root directory does not exist. Check the path in Settings.";
  if (lower.includes("eacces") || lower.includes("permission denied"))
    return "Permission denied. Check that you have read access to the dev root.";
  if (lower.includes("no projects") || lower.includes("0 projects"))
    return "No projects found. Make sure your dev root contains git repositories.";
  return "Scan failed. See details below.";
}

function buildDraft(config: AppConfig): AppConfig {
  return {
    ...config,
    devRoot: config.devRoot || "~/dev",
    excludeDirs: config.excludeDirs || DEFAULT_EXCLUDE_DIRS,
  };
}

export interface ScanStepProps {
  devRoot: string;
  scanStarted: boolean;
  scanState: RefreshState;
  onStartScan: () => void;
  onComplete: () => void;
  onBack: () => void;
}

/** Step 4: First Scan — exported for direct render testing. */
export function ScanStep({ devRoot, scanStarted, scanState, onStartScan, onComplete, onBack }: ScanStepProps) {
  const scanCoreReady = scanStarted && scanState.deterministicReady;
  const scanDone = scanStarted && !scanState.active && scanState.summary;
  const scanError = scanStarted && !scanState.active && scanState.error;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">First Scan</h2>
        <p className="text-sm text-muted-foreground">
          Ready to scan <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{devRoot}</code>
        </p>
      </div>

      {!scanStarted && (
        <div className="text-center py-4">
          <Button onClick={onStartScan}>
            Start Scan
          </Button>
        </div>
      )}

      {scanStarted && scanState.active && (
        <div className="space-y-3 py-3">
          <div className="flex items-center gap-3">
            <div className="size-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{scanState.phase}</span>
          </div>
          {scanCoreReady && (
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Core scan complete. You can open the dashboard now while LLM enrichment continues in the background.
              </p>
              <div className="pt-2">
                <Button onClick={onComplete}>
                  Open Dashboard Now
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {scanDone && (
        <div className="space-y-3 py-2">
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Found {scanState.summary?.projectCount ?? 0} projects
            </p>
          </div>
          <div className="text-center">
            <Button onClick={onComplete}>
              Open Dashboard
            </Button>
          </div>
        </div>
      )}

      {scanError && (
        <div className="space-y-3 py-2">
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 space-y-2">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {friendlyError(scanState.error!)}
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">Details</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all">{scanState.error}</pre>
            </details>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={onComplete}>
              Skip
            </Button>
            <Button onClick={onStartScan}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {!scanStarted && (
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button variant="ghost" onClick={onComplete}>
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}

export function OnboardingWizard({ open, onOpenChange, config, onSaved, onStartScan, scanState }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AppConfig>(() => buildDraft(config));
  const [saving, setSaving] = useState(false);
  const [devRootWarning, setDevRootWarning] = useState("");
  const [preflight, setPreflight] = useState<PreflightCheck[] | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [scanStarted, setScanStarted] = useState(false);

  // Reset wizard state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(0);
      setScanStarted(false);
    }
  }, [open]);

  // Sync draft from config (on open or when config updates)
  useEffect(() => {
    if (open) {
      setDraft(buildDraft(config));
    }
  }, [open, config]);

  // Fetch preflight when reaching diagnostics step
  useEffect(() => {
    if (step !== 2) return;
    setPreflightLoading(true);
    fetch("/api/preflight")
      .then((res) => res.json())
      .then((data) => setPreflight(data.checks))
      .catch(() => setPreflight(null))
      .finally(() => setPreflightLoading(false));
  }, [step]);

  const set = useCallback(<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveAndContinue = async () => {
    setSaving(true);
    setDevRootWarning("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      if (!data.devRootExists) {
        setDevRootWarning(`Directory not found: ${draft.devRoot}`);
        setSaving(false);
        return;
      }
      toast.success("Settings saved");
      onSaved();
      setStep(2);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleStartScan = () => {
    setScanStarted(true);
    onStartScan();
  };

  const handleComplete = async () => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasCompletedOnboarding: true }),
      });
      onSaved();
    } catch {
      // Non-critical — wizard won't re-show if projects exist
    }
    onOpenChange(false);
  };

  const bannerState = preflight ? computeDiagnosticsBanner(preflight) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby="onboarding-wizard-description">
        <DialogTitle className="sr-only">Setup Wizard</DialogTitle>
        <p id="onboarding-wizard-description" className="sr-only">
          Setup wizard to configure Sidequests
        </p>
        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 pt-2 pb-5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-8 rounded-full text-xs font-semibold transition-colors ${
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? "\u2713" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-10 h-px ${i < step ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="px-8 pb-4 space-y-5 max-h-[calc(82vh-10rem)] overflow-y-auto">
          {/* Step 1: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4 py-4">
              <h2 className="text-xl font-semibold">Welcome to Sidequests</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Sidequests scans your dev directory and gives you a bird&apos;s-eye view of all your projects.
              </p>
              <Button onClick={() => setStep(1)} className="mt-4">
                Get Started
              </Button>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Configure</h2>
                <p className="text-sm text-muted-foreground">Set up your development environment</p>
              </div>

              <Field label="Dev Root" description="Root directory containing your projects">
                <Input
                  value={draft.devRoot}
                  onChange={(e) => { set("devRoot", e.target.value); setDevRootWarning(""); }}
                  placeholder="~/dev"
                />
                {devRootWarning && (
                  <p className="text-sm text-destructive mt-1">{devRootWarning}</p>
                )}
              </Field>

              <Field label="Exclude Dirs" description="Comma-separated directories to skip during scan">
                <Input
                  value={draft.excludeDirs}
                  onChange={(e) => set("excludeDirs", e.target.value)}
                  placeholder="node_modules,.venv,__pycache__,.git"
                />
              </Field>

              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-medium mb-2">LLM Provider</h3>
                <p className="text-xs text-muted-foreground mb-3">Configure an LLM provider to generate project summaries and metadata</p>
                <div className="space-y-4 pl-1">
                  <ProviderFields
                    draft={draft}
                    set={set}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={handleSaveAndContinue} disabled={saving}>
                  {saving ? "Saving..." : "Save & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Diagnostics */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">System Diagnostics</h2>
                <p className="text-sm text-muted-foreground">Checking your environment</p>
              </div>

              {preflightLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="size-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Running checks...</span>
                </div>
              ) : preflight ? (
                <div className="space-y-2">
                  {sortPreflightChecks(preflight).map((check) => (
                    <div key={check.name} className="flex items-start gap-2">
                      <span className={`mt-0.5 ${check.ok ? "text-emerald-500" : check.tier === "required" ? "text-red-500" : "text-amber-500"}`}>
                        {check.ok ? "\u2713" : "\u2717"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{check.name}</span>
                          {!check.ok && check.tier && (
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              check.tier === "required"
                                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            }`}>
                              {check.tier}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{check.message}</p>
                        {!check.ok && check.name.toLowerCase().includes("git") && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Install git: <code className="bg-muted px-1 rounded">brew install git</code>
                          </p>
                        )}
                        {!check.ok && check.name.toLowerCase().includes("node") && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Install Node.js from <code className="bg-muted px-1 rounded">nodejs.org</code>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {bannerState === "all_pass" ? (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 mt-2">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        All checks passed
                      </p>
                    </div>
                  ) : bannerState === "required_pass" ? (
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 mt-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Required checks passed. Some optional features are unavailable.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 mt-2">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Required checks failed. Fix these before continuing.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to check system status.</p>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: First Scan */}
          {step === 3 && (
            <ScanStep
              devRoot={draft.devRoot}
              scanStarted={scanStarted}
              scanState={scanState}
              onStartScan={handleStartScan}
              onComplete={handleComplete}
              onBack={() => setStep(2)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
