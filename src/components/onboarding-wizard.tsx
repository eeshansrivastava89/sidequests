"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppConfig } from "@/hooks/use-config";
import type { RefreshState } from "@/hooks/use-refresh";
import { Field, ProviderFields } from "@/components/settings-fields";
import { toast } from "sonner";

interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
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

export function OnboardingWizard({ open, onOpenChange, config, onSaved, onStartScan, scanState }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    devRoot: config.devRoot || "~/dev",
    excludeDirs: config.excludeDirs || "node_modules,.venv,__pycache__,.git",
    llmProvider: config.llmProvider,
    openrouterApiKey: config.openrouterApiKey,
    openrouterModel: config.openrouterModel,
    ollamaUrl: config.ollamaUrl,
    ollamaModel: config.ollamaModel,
    mlxUrl: config.mlxUrl,
    mlxModel: config.mlxModel,
    claudeCliModel: config.claudeCliModel,
  });
  const [saving, setSaving] = useState(false);
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
      setDraft({
        devRoot: config.devRoot || "~/dev",
        excludeDirs: config.excludeDirs || "node_modules,.venv,__pycache__,.git",
        llmProvider: config.llmProvider,
        openrouterApiKey: config.openrouterApiKey,
        openrouterModel: config.openrouterModel,
        ollamaUrl: config.ollamaUrl,
        ollamaModel: config.ollamaModel,
        mlxUrl: config.mlxUrl,
        mlxModel: config.mlxModel,
        claudeCliModel: config.claudeCliModel,
      });
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

  const setAsConfig = useCallback(<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { openrouterApiKey, ...nonSecretDraft } = draft;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nonSecretDraft),
      });
      if (!res.ok) throw new Error("Save failed");
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

  const allChecksPassed = preflight?.every((c) => c.ok) ?? false;
  const scanDone = scanStarted && !scanState.active && scanState.summary;
  const scanError = scanStarted && !scanState.active && scanState.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby="onboarding-wizard-description">
        <p id="onboarding-wizard-description" className="sr-only">
          Setup wizard to configure Sidequests
        </p>
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center size-7 rounded-full text-xs font-semibold transition-colors ${
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? "\u2713" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px ${i < step ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="px-6 pb-2 space-y-4 max-h-[calc(80vh-10rem)] overflow-y-auto">
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
                  onChange={(e) => set("devRoot", e.target.value)}
                  placeholder="~/dev"
                />
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
                    draft={{ ...config, ...draft } as AppConfig}
                    set={setAsConfig}
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
                  {preflight.map((check) => (
                    <div key={check.name} className="flex items-start gap-2">
                      <span className={`mt-0.5 ${check.ok ? "text-emerald-500" : "text-red-500"}`}>
                        {check.ok ? "\u2713" : "\u2717"}
                      </span>
                      <div>
                        <span className="text-sm font-medium">{check.name}</span>
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

                  {allChecksPassed ? (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 mt-2">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        All checks passed
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 mt-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Some checks failed. You can continue, but some features may not work.
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
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">First Scan</h2>
                <p className="text-sm text-muted-foreground">
                  Ready to scan <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{draft.devRoot}</code>
                </p>
              </div>

              {!scanStarted && (
                <div className="text-center py-4">
                  <Button onClick={handleStartScan}>
                    Start Scan
                  </Button>
                </div>
              )}

              {scanStarted && scanState.active && (
                <div className="flex items-center gap-3 py-4">
                  <div className="size-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">{scanState.phase}</span>
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
                    <Button onClick={handleComplete}>
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
                    <Button variant="outline" onClick={handleComplete}>
                      Skip
                    </Button>
                    <Button onClick={handleStartScan}>
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {!scanStarted && (
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                  <Button variant="ghost" onClick={handleComplete}>
                    Skip
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
