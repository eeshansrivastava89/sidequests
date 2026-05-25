import { X } from "lucide-react";

interface FilterChipProps {
  label: string;
  onClear: () => void;
  ariaLabel?: string;
  variant?: "amber" | "muted";
}

export function FilterChip({ label, onClear, ariaLabel = "Clear filter", variant = "amber" }: FilterChipProps) {
  const amber = variant === "amber";
  return (
    <span
      className={
        amber
          ? "inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
          : "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
      }
    >
      {label}
      <button
        type="button"
        className={
          amber
            ? "ml-0.5 rounded-sm hover:bg-amber-200 dark:hover:bg-amber-800/40 p-0.5 transition-colors"
            : "ml-0.5 rounded-sm hover:bg-accent p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        }
        onClick={onClear}
        aria-label={ariaLabel}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}