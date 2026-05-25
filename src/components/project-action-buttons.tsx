import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon } from "@/components/project-icons";
import { copyToClipboard } from "@/lib/project-helpers";

interface ProjectActionButtonsProps {
  /** The raw project path (project.pathDisplay) used in commands */
  projectPath: string;
  /** The project id passed to onTouch */
  projectId: string;
  /** Callback fired when a button is used */
  onTouch: (id: string, tool: string) => void;
  /** Show the Codex button (default: true) */
  showCodex?: boolean;
  /** Show the Copy-path button (default: false) */
  showCopyPath?: boolean;
}

export function ProjectActionButtons({
  projectPath,
  projectId,
  onTouch,
  showCodex = true,
  showCopyPath = false,
}: ProjectActionButtonsProps) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-[#007ACC] hover:bg-[#007ACC]/10"
        title="Open in VS Code"
        asChild
      >
        <a href={`vscode://file${encodeURI(projectPath)}`} onClick={() => onTouch(projectId, "vscode")}>
          <VsCodeIcon className="size-4" />
        </a>
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-[#D97757] hover:bg-[#D97757]/10"
        title="Copy Claude command"
        onClick={() => { copyToClipboard(`cd "${projectPath}" && claude`, "Claude"); onTouch(projectId, "claude"); }}
      >
        <ClaudeIcon className="size-4" />
      </Button>
      {showCodex && (
        <Button
          size="icon-xs"
          variant="ghost"
          title="Copy Codex command"
          onClick={() => { copyToClipboard(`cd "${projectPath}" && codex`, "Codex"); onTouch(projectId, "codex"); }}
        >
          <CodexIcon className="size-4" />
        </Button>
      )}
      <Button
        size="icon-xs"
        variant="ghost"
        title="Copy terminal cd command"
        onClick={() => { copyToClipboard(`cd "${projectPath}"`, "Terminal"); onTouch(projectId, "terminal"); }}
      >
        <TerminalIcon className="size-4" />
      </Button>
      {showCopyPath && (
        <Button
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground"
          title="Copy path"
          onClick={() => copyToClipboard(projectPath, "path")}
        >
          <span className="text-[10px]">Copy</span>
        </Button>
      )}
    </div>
  );
}