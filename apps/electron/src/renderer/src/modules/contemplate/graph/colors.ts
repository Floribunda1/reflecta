/**
 * G6 renders to Canvas and cannot resolve CSS custom properties directly.
 * These utilities read computed values once at init time after app styles are loaded.
 */

// Color semantic roles:
// - idea=amber, insight=violet (mirrors ThoughtTypeBadge)
// - Fills use -200 tint for visible color identity without being garish
// - Strokes use -500 for a crisp, defined ring
// - Selection: primary color ring
// - Labels: muted foreground (secondary information, retreats behind the node)
// - Edges: muted foreground (structure layer, visible but subordinate to nodes)
export interface GraphColors {
  ideaFill: string;
  ideaStroke: string;
  insightFill: string;
  insightStroke: string;
  selStroke: string;
  selHalo: string;
  labelColor: string;
  activeLabelColor: string;
  edgeStroke: string;
  canvasBg: string;
  /** Dim colors are pre-resolved opaque CSS vars — no rgba parsing needed */
  dimNodeColor: string;
  dimEdgeColor: string;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function resolveColors(): GraphColors {
  const dark = isDarkMode();

  return {
    ideaFill: dark ? "hsl(38 70% 22%)" : "hsl(48 96% 89%)",
    ideaStroke: dark ? "hsl(38 92% 58%)" : "hsl(38 92% 50%)",
    insightFill: dark ? "hsl(270 45% 24%)" : "hsl(270 100% 92%)",
    insightStroke: dark ? "hsl(262 72% 68%)" : "hsl(262 72% 58%)",
    selStroke: getCSSVar("--primary"),
    selHalo: dark ? "hsl(166 45% 18%)" : "hsl(226 91% 92%)",
    labelColor: getCSSVar("--muted-foreground"),
    activeLabelColor: getCSSVar("--foreground"),
    edgeStroke: getCSSVar("--muted-foreground"),
    canvasBg: getCSSVar("--muted"),
    dimNodeColor: getCSSVar("--muted-foreground"),
    dimEdgeColor: getCSSVar("--border"),
  };
}
