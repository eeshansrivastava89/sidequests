
import type { FocusGoal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-2/3 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-amber-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Weekly Focus
          </h3>
          {goals.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{goals.length} done
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 gap-1"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="size-3.5" />
          Add Goal
        </Button>
      </div>

      <div className="px-5 py-4 space-y-2">
        {showAdd && (
          <div className="flex items-center gap-2 pb-3 border-b border-border mb-2">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[140px]"
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
              className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm"
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
            >
              Add
            </Button>
          </div>
        )}

        {goals.length === 0 && !showAdd ? (
          <div className="py-6 text-center">
            <Target className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No focus goals this week.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Set a goal to stay on track.</p>
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className={cn(
                "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                goal.completed
                  ? "bg-emerald-50 dark:bg-emerald-950/20"
                  : "hover:bg-muted/50"
              )}
            >
              <button
                type="button"
                className={cn(
                  "mt-0.5 flex items-center justify-center size-5 rounded-md border shrink-0 transition-colors",
                  goal.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-muted-foreground/30 hover:border-foreground"
                )}
                onClick={() => onToggle(goal.id, !goal.completed)}
              >
                {goal.completed && <Check className="size-3.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", goal.completed && "line-through text-muted-foreground")}>
                  {goal.goal}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{goal.projectName}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}