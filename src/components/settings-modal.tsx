"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppConfig } from "@/hooks/use-config";
import type { PreflightCheck } from "@/lib/types";
import { toast } from "sonner";
import { Field, SwitchRow, ProviderFields } from "@/components/settings-fields";
import { TriangleAlert } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AppConfig;
  onSaved: () => void;
}

export function SettingsModal({ open, onOpenChange, config, onSaved }: Props) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [saving, setSaving] = useState(false);
  const [devRootWarning, setDevRootWarning] = useState("");
  const [preflight, setPreflight] = useState<PreflightCheck[] | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // Sync draft when config changes or modal opens
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const fetchPreflight = useCallback(() => {
    setPreflightLoading(true);
    fetch("/api/preflight")
      .then((res) => res.json())
      .then((data) => setPreflight(data.checks))
      .catch(() => setPreflight(null))
      .finally(() => setPreflightLoading(false));
  }, []);

  // Fetch preflight checks when modal opens
  useEffect(() => {
    if (open) fetchPreflight();
  }, [open, fetchPreflight]);

  const set = useCallback(<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
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

        <div className="flex items-start gap-2 px-6 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md mx-6">
          <TriangleAlert className="size-3.5 shrink-0 mt-0.5" />
          <span>Alpha software — LLM provider settings affect token usage. Ensure dev root points only at directories you intend to scan.</span>
        </div>

        <div className="overflow-y-auto scrollbar-hide px-6 space-y-8 max-h-[calc(80vh-8rem)]">
          {/* ── General ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                General
              </h3>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Field label="Dev Root" description="Root directory to scan for projects">
              <Input
                value={draft.devRoot}
                onChange={(e) => { set("devRoot", e.target.value); setDevRootWarning(""); }}
                placeholder="~/dev"
              />
              {devRootWarning && (
                <p className="text-sm text-destructive mt-1">{devRootWarning}</p>
              )}
            </Field>

            <Field label="Exclude Dirs" description="Comma-separated directories to skip">
              <Input
                value={draft.excludeDirs}
                onChange={(e) => set("excludeDirs", e.target.value)}
                placeholder="node_modules,.venv,__pycache__,.git"
              />
            </Field>

          </section>

          {/* ── LLM Provider ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                LLM Provider
              </h3>
              <div className="flex-1 h-px bg-border" />
            </div>

            <ProviderFields draft={draft} set={set} />

            <Field label="Timeout" description="Seconds per project before LLM call is killed">
              <Input
                type="number"
                min={30}
                max={300}
                value={draft.llmTimeout}
                onChange={(e) => set("llmTimeout", Math.max(30, Math.min(300, parseInt(e.target.value) || 90)))}
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
          </section>

          {/* ── System Status ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                System Status
              </h3>
              <div className="flex-1 h-px bg-border" />
            </div>
            {preflightLoading ? (
              <p className="text-sm text-muted-foreground">Checking...</p>
            ) : preflight ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {preflight.map((check) => {
                    const comingSoon = ["openrouter", "ollama", "mlx"].includes(check.name);
                    // Green = ok, red = required & failed, grey = optional & not active
                    const dotColor = comingSoon
                      ? "bg-amber-500/50"
                      : check.ok
                        ? "bg-emerald-500"
                        : (check as { tier?: string }).tier === "required"
                          ? "bg-red-500"
                          : "bg-muted-foreground/30";
                    return (
                      <div key={check.name} className={`flex items-center justify-between px-4 py-3 ${comingSoon ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                          <span className="text-sm">{check.name}</span>
                          {comingSoon && (
                            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                              Coming soon
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate ml-4">{check.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to check system status.</p>
            )}
            {!preflightLoading && (
              <Button size="sm" variant="ghost" onClick={fetchPreflight} className="text-xs text-blue-600 dark:text-blue-400">
                Re-check
              </Button>
            )}
          </section>

        </div>

        {/* ── Footer — sticky outside scroll area ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
