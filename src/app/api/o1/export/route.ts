import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { mergeProjectView, mergeAllProjects } from "@/lib/merge";

export async function POST(request: NextRequest) {
  if (!config.featureO1) {
    return NextResponse.json(
      { ok: false, error: "O-1 export is disabled. Set FEATURE_O1=true to enable." },
      { status: 404 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body.projectId as string | undefined;

    // Export single project or all
    const projects = projectId
      ? [await mergeProjectView(projectId)].filter(Boolean)
      : await mergeAllProjects();

    if (projects.length === 0) {
      return NextResponse.json({ ok: false, error: "No projects found" }, { status: 404 });
    }

    // Build export in both markdown and JSON
    const markdown = projects.map((p) => {
      const lines = [
        `# ${p!.name}`,
        "",
        `**Status:** ${p!.status}`,
        `**Health Score:** ${p!.healthScore}/100`,
      ];
      if (p!.purpose) lines.push(`**Purpose:** ${p!.purpose}`);
      if (p!.tags.length) lines.push(`**Tags:** ${p!.tags.join(", ")}`);
      if (p!.goal) lines.push(`**Goal:** ${p!.goal}`);
      if (p!.audience) lines.push(`**Audience:** ${p!.audience}`);
      if (p!.successMetrics) lines.push(`**Success Metrics:** ${p!.successMetrics}`);
      if (p!.nextAction) lines.push(`**Next Action:** ${p!.nextAction}`);
      if (p!.evidence) {
        lines.push("", "## Evidence", "", "```json", JSON.stringify(p!.evidence, null, 2), "```");
      }
      if (p!.outcomes) {
        lines.push("", "## Outcomes", "", "```json", JSON.stringify(p!.outcomes, null, 2), "```");
      }
      return lines.join("\n");
    }).join("\n\n---\n\n");

    return NextResponse.json({
      ok: true,
      export: {
        format: "o1-evidence",
        projectCount: projects.length,
        markdown,
        json: projects,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
