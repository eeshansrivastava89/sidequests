"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AppConfig } from "@/hooks/use-config";

/** Active providers shown in UI. See GitHub issue #2 for re-enabling openrouter/ollama/mlx. */
export const PROVIDERS = ["claude-cli", "codex-cli", "none"] as const;

export const CLAUDE_CLI_MODELS = [
  { value: "", label: "Default" },
  { value: "claude-opus-4-6", label: "Opus 4.6" },
  { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const;

export const CODEX_CLI_MODELS = [
  { value: "", label: "Default" },
  { value: "o3", label: "o3" },
  { value: "o4-mini", label: "o4-mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
] as const;

const CUSTOM_SENTINEL = "__custom__";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function Field({
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

export function SwitchRow({
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

function ModelSelect({
  value,
  onChange,
  models,
  description,
}: {
  value: string;
  onChange: (v: string) => void;
  models: ReadonlyArray<{ value: string; label: string }>;
  description?: string;
}) {
  const isCurated = models.some((m) => m.value === value);
  const [customMode, setCustomMode] = useState(value !== "" && !isCurated);
  const showCustomInput = customMode || (value !== "" && !isCurated);

  return (
    <Field label="Model" description={description}>
      <select
        value={showCustomInput ? CUSTOM_SENTINEL : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_SENTINEL) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className={selectClass}
      >
        {models.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
        <option value={CUSTOM_SENTINEL}>Custom...</option>
      </select>
      {showCustomInput && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter model ID"
          className="mt-1.5"
          autoFocus
        />
      )}
    </Field>
  );
}

export function ProviderFields({
  draft,
  set,
}: {
  draft: AppConfig;
  set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}) {
  const provider = !draft.llmProvider || draft.llmProvider === "none" ? "claude-cli" : draft.llmProvider;

  return (
    <>
      <Field label="Provider">
        <select
          value={provider}
          onChange={(e) => set("llmProvider", e.target.value)}
          className={selectClass}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </Field>

      {provider === "claude-cli" && (
        <ModelSelect
          value={draft.claudeCliModel}
          onChange={(v) => set("claudeCliModel", v)}
          models={CLAUDE_CLI_MODELS}
        />
      )}

      {provider === "openrouter" && (
        <>
          <Field label="API Key" description="Saved to settings.json">
            <Input
              type="password"
              value={draft.openrouterApiKey}
              onChange={(e) => set("openrouterApiKey", e.target.value)}
              placeholder="sk-or-..."
              disabled={draft.openrouterApiKey === "***"}
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

      {provider === "ollama" && (
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

      {provider === "mlx" && (
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

      {provider === "codex-cli" && (
        <ModelSelect
          value={draft.codexCliModel}
          onChange={(v) => set("codexCliModel", v)}
          models={CODEX_CLI_MODELS}
        />
      )}
    </>
  );
}
