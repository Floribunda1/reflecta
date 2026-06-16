/**
 * G6 renders to Canvas and cannot resolve CSS custom properties directly.
 * These utilities read computed values once at init time after app styles are loaded.
 */

export interface GraphColors {
  nodeFill: string;
  nodeStroke: string;
  domainFill: string;
  domainStroke: string;
  noContextFill: string;
  noContextStroke: string;
  selStroke: string;
  selHalo: string;
  labelColor: string;
  activeLabelColor: string;
  edgeStroke: string;
  activeEdgeStroke: string;
  canvasBg: string;
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
    nodeFill: dark ? "hsl(40 8% 24%)" : "hsl(0 0% 100%)",
    nodeStroke: dark ? "hsl(38 18% 70%)" : "hsl(38 18% 42%)",
    domainFill: dark ? "hsla(38, 64%, 34%, 0.10)" : "hsla(38, 72%, 66%, 0.16)",
    domainStroke: dark ? "hsl(38 54% 42%)" : "hsl(38 42% 58%)",
    noContextFill: dark ? "hsl(40 8% 18%)" : "hsl(0 0% 100%)",
    noContextStroke: dark ? "hsl(38 38% 58%)" : "hsl(38 42% 64%)",
    selStroke: getCSSVar("--primary"),
    selHalo: dark ? "hsl(166 45% 18%)" : "hsl(226 91% 92%)",
    labelColor: getCSSVar("--foreground"),
    activeLabelColor: getCSSVar("--foreground"),
    edgeStroke: dark ? "hsl(38 10% 68%)" : "hsl(38 8% 46%)",
    activeEdgeStroke: getCSSVar("--primary"),
    canvasBg: getCSSVar("--muted"),
  };
}
