import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/project-helpers";
import { Settings, Moon, Sun, Zap, Sparkles } from "lucide-react";

interface DashboardHeaderProps {
  lastRefreshed: string | null;
  versionInfo: { current: string; latest: string | null; updateAvailable: boolean } | null;
  refreshActive: boolean;
  refreshPhase: string;
  onCancel: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onOpenSettings: () => void;
  onFastScan: () => void;
  onAiScan: () => void;
  selectedNamesCount: number;
}

export function DashboardHeader({
  lastRefreshed,
  versionInfo,
  refreshActive,
  refreshPhase,
  onCancel,
  dark,
  onToggleDark,
  onOpenSettings,
  onFastScan,
  onAiScan,
  selectedNamesCount,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight">Sidequests</h1>
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground">
                Last refreshed {formatRelativeTime(lastRefreshed)}
              </span>
            )}
            {versionInfo?.updateAvailable && versionInfo.latest && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 cursor-default">
                      v{versionInfo.latest} available
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>Run: npx @eeshans/sidequests@latest</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <TooltipProvider delayDuration={300}>
            {refreshActive ? (
              <>
                <span className="text-xs text-muted-foreground max-w-[320px] truncate text-right shrink min-w-0">
                  {refreshPhase}
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              </>
            ) : (
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onFastScan}
                        className="gap-1.5"
                      >
                        <Zap className="size-3.5" />
                        Fast Scan{selectedNamesCount > 0 ? ` [${selectedNamesCount}]` : ""}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                      <p className="font-semibold mb-1">Deterministic scan</p>
                      <p>Folders, lines of code, git history, GitHub issues, PRs, CI status, visibility</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={onAiScan}
                        className="gap-1.5"
                      >
                        <Sparkles className="size-3.5" />
                        AI Scan{selectedNamesCount > 0 ? ` [${selectedNamesCount}]` : ""}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                      <p className="font-semibold mb-1">Fast scan + LLM analysis</p>
                      <p>Adds: summary, status reason, next action, health score, tags</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={onToggleDark}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={onOpenSettings}
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>Dev root, LLM provider, scan options</p>
              </TooltipContent>
            </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </header>
  );
}