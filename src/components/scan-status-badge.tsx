import { AlertCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/project-helpers";

type Variant = "badge" | "span";

interface ScanStatusBadgeProps {
  llmError: string | null;
  llmGeneratedAt: string | null;
  variant?: Variant;
}

/**
 * Shared scan-status indicator.
 * - "badge" variant uses the project Badge component (for detail pane)
 * - "span" variant uses raw spans with inline styles (for list rows)
 */
export function ScanStatusBadge({
  llmError,
  llmGeneratedAt,
  variant = "badge",
}: ScanStatusBadgeProps) {
  if (llmError) {
    const title = llmError;
    if (variant === "badge") {
      return (
        <Badge
          variant="secondary"
          className="text-[10px] inline-flex items-center gap-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          title={title}
        >
          <AlertCircle className="size-3" />
          AI scan failed
        </Badge>
      );
    }
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded px-1.5 py-0.5 leading-none"
        title={title}
      >
        <AlertCircle className="size-3" />
        AI scan failed
      </span>
    );
  }

  if (llmGeneratedAt) {
    const title = `AI scanned ${new Date(llmGeneratedAt).toLocaleString()}`;
    if (variant === "badge") {
      return (
        <Badge
          variant="secondary"
          className="text-[10px] inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          title={title}
        >
          <Sparkles className="size-3" />
          AI scanned {formatRelativeTime(llmGeneratedAt)}
        </Badge>
      );
    }
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded px-1.5 py-0.5 leading-none"
        title={title}
      >
        <Sparkles className="size-3" />
        AI scanned {formatRelativeTime(llmGeneratedAt)}
      </span>
    );
  }

  if (variant === "badge") {
    return (
      <Badge variant="secondary" className="text-[10px] text-muted-foreground">
        No AI scan
      </Badge>
    );
  }
  return (
    <span className="shrink-0 text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 leading-none">
      No AI scan
    </span>
  );
}