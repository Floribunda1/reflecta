/**
 * G6 renders to Canvas and cannot resolve CSS custom properties directly.
 * These utilities read computed values once at init time after app styles are loaded.
 */

export interface GraphColors {
  nodeFill: string;
  nodeStroke: string;
  noContextFill: string;
  noContextStroke: string;
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
    nodeFill: getCSSVar("--background"),
    nodeStroke: getCSSVar("--border"),
    noContextFill: dark ? "hsl(38 45% 18%)" : "hsl(48 96% 91%)",
    noContextStroke: dark ? "hsl(38 92% 58%)" : "hsl(38 92% 48%)",
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
