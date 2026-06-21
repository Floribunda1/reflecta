import dagre, { type GraphLabel } from "@dagrejs/dagre";

export type DagreLayoutNode = {
  id: string;
  width: number;
  height: number;
};

export type DagreLayoutEdge = {
  source: string;
  target: string;
};

export type DagreLayoutPosition = {
  x: number;
  y: number;
};

export type DagreLayoutOptions = Pick<
  GraphLabel,
  "rankdir" | "nodesep" | "ranksep" | "edgesep" | "marginx" | "marginy"
>;

export function layoutDagreGraph(
  nodes: DagreLayoutNode[],
  edges: DagreLayoutEdge[],
  options: DagreLayoutOptions = {},
): Map<string, DagreLayoutPosition> {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    acyclicer: "greedy",
    nodesep: 40,
    ranksep: 80,
    marginx: 0,
    marginy: 0,
    ...options,
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) graph.setNode(node.id, { width: node.width, height: node.height });
  for (const edge of edges) {
    if (edge.source === edge.target || !nodeIds.has(edge.source) || !nodeIds.has(edge.target))
      continue;
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const positions = new Map<string, DagreLayoutPosition>();
  let minX = Infinity;
  let minY = Infinity;
  for (const node of nodes) {
    const laidOut = graph.node(node.id);
    const position = {
      x: (laidOut?.x ?? 0) - node.width / 2,
      y: (laidOut?.y ?? 0) - node.height / 2,
    };
    positions.set(node.id, position);
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
  }

  if (positions.size === 0) return positions;
  for (const [id, position] of positions) {
    positions.set(id, {
      x: position.x - minX,
      y: position.y - minY,
    });
  }
  return positions;
}
