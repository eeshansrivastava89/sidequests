"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppConfig } from "@/hooks/use-config";
import { toast } from "sonner";
import { Field, SwitchRow, ProviderFields } from "@/components/settings-fields";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AppConfig;
  onSaved: () => void;
}

interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
}

export function SettingsModal({ open, onOpenChange, config, onSaved }: Props) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [saving, setSaving] = useState(false);
  const [preflight, setPreflight] = useState<PreflightCheck[] | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // Sync draft when config changes or modal opens
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  // Fetch preflight checks when modal opens
  useEffect(() => {
    if (!open) return;
    setPreflightLoading(true);
    fetch("/api/preflight")
      .then((res) => res.json())
      .then((data) => setPreflight(data.checks))
      .catch(() => setPreflight(null))
      .finally(() => setPreflightLoading(false));
  }, [open]);

  const set = useCallback(<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isDesktop = typeof window !== "undefined" && !!window.electron?.secrets;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Handle secret keys separately from regular settings
      const { openrouterApiKey, ...nonSecretDraft } = draft;
      const keyChanged = openrouterApiKey !== config.openrouterApiKey;

      if (keyChanged && openrouterApiKey !== "***") {
        if (isDesktop) {
          // Desktop: persist via encrypted IPC
          if (openrouterApiKey) {
            await window.electron!.secrets.set("openrouterApiKey", openrouterApiKey);
          } else {
            await window.electron!.secrets.delete("openrouterApiKey");
          }
          toast.info("API key saved securely. Restart app for changes to take effect.");
        } else {
          // Non-desktop: env vars only — warn user
          toast.warning("API key cannot be saved in web mode. Set OPENROUTER_API_KEY in .env.local instead.");
        }
      }

      // Save non-secret settings via API
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nonSecretDraft),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Settings saved");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-6 space-y-6 max-h-[calc(80vh-8rem)]">
          {/* ── General ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              General
            </h3>

            <Field label="Dev Root" description="Root directory to scan for projects">
              <Input
                value={draft.devRoot}
                onChange={(e) => set("devRoot", e.target.value)}
                placeholder="~/dev"
              />
            </Field>

            <Field label="Exclude Dirs" description="Comma-separated directories to skip">
              <Input
                value={draft.excludeDirs}
                onChange={(e) => set("excludeDirs", e.target.value)}
                placeholder="node_modules,.venv,__pycache__,.git"
              />
            </Field>

            <SwitchRow
              label="Sanitize Paths"
              description="Hide absolute paths (OSS mode)"
              checked={draft.sanitizePaths}
              onCheckedChange={(v) => set("sanitizePaths", v)}
            />
          </section>

          {/* ── AI Enrichment ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              AI Enrichment
            </h3>

            <SwitchRow
              label="Enable LLM"
              description="Show Enrich button in toolbar"
              checked={draft.featureLlm}
              onCheckedChange={(v) => set("featureLlm", v)}
            />

            {draft.featureLlm && (
              <>
                <SwitchRow
                  label="Enable O-1 Fields"
                  description="Extended metadata in project drawer"
                  checked={draft.featureO1}
                  onCheckedChange={(v) => set("featureO1", v)}
                />

                <ProviderFields draft={draft} set={set} isDesktop={isDesktop} />

                <Field label="Concurrency" description="Parallel LLM tasks (1-10)">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={draft.llmConcurrency}
                    onChange={(e) => set("llmConcurrency", Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  />
                </Field>

                <SwitchRow
                  label="Overwrite Metadata"
                  description="Force overwrite existing metadata on enrich"
                  checked={draft.llmOverwriteMetadata}
                  onCheckedChange={(v) => set("llmOverwriteMetadata", v)}
                />

                <SwitchRow
                  label="Allow Unsafe"
                  description="Enable agentic providers (codex-cli)"
                  checked={draft.llmAllowUnsafe}
                  onCheckedChange={(v) => set("llmAllowUnsafe", v)}
                />

                <SwitchRow
                  label="Debug Mode"
                  description="Log raw LLM output to console"
                  checked={draft.llmDebug}
                  onCheckedChange={(v) => set("llmDebug", v)}
                />
              </>
            )}
          </section>

          {/* ── System Status ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              System Status
            </h3>
            {preflightLoading ? (
              <p className="text-sm text-muted-foreground">Checking...</p>
            ) : preflight ? (
              <div className="space-y-1.5">
                {preflight.map((check) => (
                  <div key={check.name} className="flex items-center gap-2">
                    <span className={check.ok ? "text-emerald-500" : "text-red-500"}>
                      {check.ok ? "\u2713" : "\u2717"}
                    </span>
                    <span className="text-sm font-medium">{check.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{check.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to check system status.</p>
            )}
          </section>

        </div>

        {/* ── Save — sticky outside scroll area ── */}
        <div className="flex justify-end px-6 py-4 border-t border-border">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
