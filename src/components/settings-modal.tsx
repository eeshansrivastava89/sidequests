"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AppConfig } from "@/hooks/use-config";
import { toast } from "sonner";

const PROVIDERS = ["claude-cli", "openrouter", "ollama", "mlx", "codex-cli"] as const;

const CLAUDE_CLI_MODELS = [
  { value: "", label: "Default" },
  { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { value: "claude-opus-4-6", label: "Opus 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const;

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
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

                <Field label="Provider">
                  <select
                    value={draft.llmProvider}
                    onChange={(e) => set("llmProvider", e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>

                {draft.llmProvider === "claude-cli" && (
                  <Field label="Model" description="Claude CLI model override">
                    <select
                      value={draft.claudeCliModel}
                      onChange={(e) => set("claudeCliModel", e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {CLAUDE_CLI_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </Field>
                )}

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

          {/* ── Provider Settings ── */}
          {draft.featureLlm && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Provider Settings ({draft.llmProvider})
              </h3>

              {draft.llmProvider === "claude-cli" && (
                <p className="text-sm text-muted-foreground">
                  No additional settings needed for claude-cli.
                </p>
              )}

              {draft.llmProvider === "openrouter" && (
                <>
                  <Field label="API Key">
                    <Input
                      type="password"
                      value={draft.openrouterApiKey}
                      onChange={(e) => set("openrouterApiKey", e.target.value)}
                      placeholder="sk-or-..."
                    />
                  </Field>
                  <Field label="Model">
                    <Input
                      value={draft.openrouterModel}
                      onChange={(e) => set("openrouterModel", e.target.value)}
                      placeholder="anthropic/claude-sonnet-4"
                    />
                  </Field>
                </>
              )}

              {draft.llmProvider === "ollama" && (
                <>
                  <Field label="URL">
                    <Input
                      value={draft.ollamaUrl}
                      onChange={(e) => set("ollamaUrl", e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </Field>
                  <Field label="Model">
                    <Input
                      value={draft.ollamaModel}
                      onChange={(e) => set("ollamaModel", e.target.value)}
                      placeholder="llama3"
                    />
                  </Field>
                </>
              )}

              {draft.llmProvider === "mlx" && (
                <>
                  <Field label="URL">
                    <Input
                      value={draft.mlxUrl}
                      onChange={(e) => set("mlxUrl", e.target.value)}
                      placeholder="http://localhost:8080"
                    />
                  </Field>
                  <Field label="Model">
                    <Input
                      value={draft.mlxModel}
                      onChange={(e) => set("mlxModel", e.target.value)}
                      placeholder="default"
                    />
                  </Field>
                </>
              )}

              {draft.llmProvider === "codex-cli" && (
                <p className="text-sm text-muted-foreground">
                  No additional settings needed for codex-cli.
                </p>
              )}
            </section>
          )}

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

/* ── Sub-components ── */

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
