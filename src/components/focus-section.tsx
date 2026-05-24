import type { FocusGoal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CARD, SECTION_LABEL } from "@/lib/status-colors";
import { Check, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import React from "react";

interface FocusSectionProps {
  goals: FocusGoal[];
  loading: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onAdd: (projectId: string, goal: string) => Promise<unknown>;
  onDelete?: (id: string) => void;
  projects: Array<{ id: string; name: string }>;
}

export function FocusSection({ goals, loading, onToggle, onAdd, projects, onDelete }: FocusSectionProps) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [newGoal, setNewGoal] = React.useState("");
  const [selectedProject, setSelectedProject] = React.useState(projects[0]?.id ?? "");

  const completedCount = goals.filter((g) => g.completed).length;

  if (loading) {
    return (
      <div className={`${CARD} px-4 py-3`}>
        <div className="animate-pulse space-y-2">
          <div className="h-3.5 w-20 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Target className="size-3.5 text-amber-500" />
          <h3 className={SECTION_LABEL}>
            Weekly Focus
          </h3>
          {goals.length > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {completedCount}/{goals.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-6 gap-1 px-2"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="size-3" />
          Add
        </Button>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        {showAdd && (
          <div className="flex items-center gap-2 pb-2 mb-1.5 border-b border-border">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs min-w-[120px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="What do you want to accomplish?"
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGoal.trim() && selectedProject) {
                  onAdd(selectedProject, newGoal.trim()).then((result) => {
                    if (!result) toast.error("Failed to add goal");
                  });
                  setNewGoal("");
                  setShowAdd(false);
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newGoal.trim() || !selectedProject}
              onClick={async () => {
                if (newGoal.trim() && selectedProject) {
                  const result = await onAdd(selectedProject, newGoal.trim());
                  if (!result) toast.error("Failed to add goal");
                  setNewGoal("");
                  setShowAdd(false);
                }
              }}
              className="text-xs h-7"
            >
              Add
            </Button>
          </div>
        )}

        {goals.length === 0 && !showAdd ? (
          <div className="py-4 text-center">
            <Target className="size-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No focus goals this week.</p>
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                goal.completed
                  ? "bg-emerald-50 dark:bg-emerald-950/20"
                  : "hover:bg-muted/50"
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center size-4 rounded border shrink-0 transition-colors",
                  goal.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-muted-foreground/30 hover:border-foreground"
                )}
                onClick={() => onToggle(goal.id, !goal.completed)}
              >
                {goal.completed && <Check className="size-2.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs leading-snug", goal.completed && "line-through text-muted-foreground")}>
                  {goal.goal}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{goal.projectName}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}