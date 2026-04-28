/**
 * G6 renders to Canvas and cannot resolve CSS custom properties directly.
 * These utilities read computed values once at init time after PrimeVue has injected them.
 */

// Color semantic roles:
// - idea=amber, insight=violet (mirrors ThoughtTypeBadge)
// - Fills use -200 tint for visible color identity without being garish
// - Strokes use -500 for a crisp, defined ring
// - Selection: primary color ring (consistent with ThoughtCard's border-l-primary)
// - Labels: muted-color (secondary information, retreats behind the node)
// - Edges: surface-400 (structure layer — visible but clearly subordinate to nodes)
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

export function resolveColors(): GraphColors {
  return {
    ideaFill: getCSSVar("--p-amber-100"),
    ideaStroke: getCSSVar("--p-amber-500"),
    insightFill: getCSSVar("--p-violet-100"),
    insightStroke: getCSSVar("--p-violet-500"),
    selStroke: getCSSVar("--p-primary-500"),
    selHalo: getCSSVar("--p-primary-100"),
    labelColor: getCSSVar("--p-text-muted-color"),
    activeLabelColor: getCSSVar("--p-text-color"),
    edgeStroke: getCSSVar("--p-surface-400"),
    canvasBg: getCSSVar("--p-surface-50"),
    dimNodeColor: getCSSVar("--p-surface-300"),
    dimEdgeColor: getCSSVar("--p-surface-200"),
  };
}
