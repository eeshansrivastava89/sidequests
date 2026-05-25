import { useMemo } from "react";
import type { Project } from "@/lib/types";

interface TreemapProps {
  projects: Project[];
  onSelect: (id: string) => void;
}

interface TreemapNode {
  id: string;
  name: string;
  size: number;
  healthScore: number;
  status: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SquarifyItem {
  id: string;
  name: string;
  size: number;
  healthScore: number;
  status: string;
  area: number; // normalized area (size * scale)
}

/**
 * Squarified treemap layout.
 * Each item's `area` is its proportional share of the total rect area.
 */
function squarify(items: SquarifyItem[], rect: { x: number; y: number; w: number; h: number }): TreemapNode[] {
  if (items.length === 0) return [];

  const totalSize = items.reduce((s, i) => s + i.size, 0);
  if (totalSize === 0) return [];

  const totalArea = rect.w * rect.h;
  const scaled = items.map((i) => ({ ...i, area: (i.size / totalSize) * totalArea }));

  return layoutItems(scaled, rect);
}

function layoutItems(items: SquarifyItem[], rect: { x: number; y: number; w: number; h: number }): TreemapNode[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x: rect.x, y: rect.y, w: rect.w, h: rect.h }];
  }

  const { x, y, w, h } = rect;
  const isHorizontal = w >= h;
  const side = isHorizontal ? h : w;
  const totalArea = items.reduce((s, i) => s + i.area, 0);

  // Build the best row by adding items while aspect ratio improves
  let rowEnd = 1;
  let bestWorst = worstRatio(items.slice(0, 1), side);

  while (rowEnd < items.length) {
    const candidateWorst = worstRatio(items.slice(0, rowEnd + 1), side);
    if (candidateWorst <= bestWorst) {
      bestWorst = candidateWorst;
      rowEnd++;
    } else {
      break;
    }
  }

  const row = items.slice(0, rowEnd);
  const rest = items.slice(rowEnd);
  const rowArea = row.reduce((s, i) => s + i.area, 0);
  const rowThickness = rowArea / side;

  // Lay out the row
  const nodes: TreemapNode[] = [];
  let offset = 0;
  for (const item of row) {
    const itemThickness = item.area / rowThickness;
    nodes.push({
      id: item.id,
      name: item.name,
      size: item.size,
      healthScore: item.healthScore,
      status: item.status,
      ...(isHorizontal
        ? { x, y: y + offset, w: rowThickness, h: itemThickness }
        : { x: x + offset, y, w: itemThickness, h: rowThickness }),
    });
    offset += itemThickness;
  }

  // Remaining rect
  const nextRect = isHorizontal
    ? { x: x + rowThickness, y, w: w - rowThickness, h }
    : { x, y: y + rowThickness, w, h: h - rowThickness };

  return [...nodes, ...layoutItems(rest, nextRect)];
}

function worstRatio(row: SquarifyItem[], side: number): number {
  if (row.length === 0 || side === 0) return Infinity;
  const areas = row.map((i) => i.area);
  const maxA = Math.max(...areas);
  const minA = Math.min(...areas);
  const totalA = areas.reduce((s, a) => s + a, 0);
  const s2 = side * side;
  return Math.max((s2 * maxA) / (totalA * totalA), (totalA * totalA) / (s2 * maxA));
}

function healthColor(healthScore: number): string {
  if (healthScore >= 80) return "oklch(0.72 0.19 155)";
  if (healthScore >= 60) return "oklch(0.75 0.15 142)";
  if (healthScore >= 40) return "oklch(0.75 0.13 85)";
  if (healthScore >= 20) return "oklch(0.7 0.15 60)";
  return "oklch(0.55 0.2 25)";
}

export function TreemapChart({ projects, onSelect }: TreemapProps) {
  const nodes = useMemo(() => {
    const items = projects
      .filter((p) => p.quarterCommits > 0 && p.status !== "archived")
      .sort((a, b) => b.quarterCommits - a.quarterCommits)
      .slice(20);

    if (items.length === 0) return [];

    return squarify(
      items.map((p) => ({
        id: p.id,
        name: p.name,
        size: p.quarterCommits,
        healthScore: p.healthScore,
        status: p.llmStatus ?? p.status,
        area: 0, // will be set by squarify
      })),
      { x: 0, y: 0, w: 1000, h: 600 }
    );
  }, [projects]);

  if (nodes.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No commit data yet. Run a scan to see portfolio allocation.</p>;
  }

  return (
    <div className="w-full" style={{ aspectRatio: "5 / 3" }}>
      <svg viewBox="0 0 1000 600" className="w-full h-full" role="img" aria-label="Portfolio allocation treemap">
        {nodes.map((node) => {
          const shortName = node.name.length > 12 && node.w < 150 ? node.name.slice(0, 10) + "…" : node.name;
          const showLabel = node.w > 40 && node.h > 25;
          const showCommits = node.w > 60 && node.h > 45;
          return (
            <g key={node.id}>
              <rect
                x={node.x + 1}
                y={node.y + 1}
                width={Math.max(0, node.w - 2)}
                height={Math.max(0, node.h - 2)}
                rx={4}
                fill={healthColor(node.healthScore)}
                opacity={0.85}
                className="cursor-pointer hover:opacity-100 hover:stroke-2 hover:stroke-white/40 transition-all"
                onClick={() => onSelect(node.id)}
              >
                <title>{node.name}: {node.size} commits (90d), health {node.healthScore}</title>
              </rect>
              {showLabel && (
                <text
                  x={node.x + node.w / 2}
                  y={node.y + (showCommits ? node.h / 2 - 8 : node.h / 2 + 2)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={node.w > 120 ? 13 : 11}
                  fontWeight={600}
                  className="pointer-events-none select-none"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                >
                  {shortName}
                </text>
              )}
              {showCommits && (
                <text
                  x={node.x + node.w / 2}
                  y={node.y + node.h / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={10}
                  opacity={0.85}
                  className="pointer-events-none select-none"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                >
                  {node.size} commits
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="font-medium">Health:</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: healthColor(90) }} /> 80+</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: healthColor(70) }} /> 60-79</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: healthColor(45) }} /> 40-59</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: healthColor(25) }} /> 20-39</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: healthColor(10) }} /> &lt;20</span>
        <span className="ml-2">Size = 90-day commits</span>
      </div>
    </div>
  );
}