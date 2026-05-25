import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionCardProps {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  /** Set false for sections that manage their own padding (charts, SVG). Default: true. */
  padded?: boolean;
}

export function SectionCard({ icon, title, children, className, action, padded = true }: SectionCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className={padded ? "p-4" : ""}>
        {children}
      </div>
    </div>
  );
}