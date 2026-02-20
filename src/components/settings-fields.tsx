"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AppConfig } from "@/hooks/use-config";

export const PROVIDERS = ["claude-cli", "openrouter", "ollama", "mlx", "codex-cli"] as const;

export const CLAUDE_CLI_MODELS = [
  { value: "", label: "Default" },
  { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { value: "claude-opus-4-6", label: "Opus 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const;

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

export function ProviderFields({
  draft,
  set,
}: {
  draft: AppConfig;
  set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}) {
  return (
    <>
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

      {draft.llmProvider === "openrouter" && (
        <>
          <Field label="API Key" description="Set OPENROUTER_API_KEY in .env.local">
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
    </>
  );
}
