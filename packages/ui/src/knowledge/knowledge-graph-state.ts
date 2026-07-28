export type KnowledgeGraphData = {
  nodes: Array<{
    id: string;
    data: { title: string; degree: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
};

type GraphFocus = {
  selectedId: string | null;
  hoveredId: string | null;
};

export function buildGraphElementStates(
  data: KnowledgeGraphData,
  { selectedId, hoveredId }: GraphFocus,
): Record<string, string[]> {
  const states: Record<string, string[]> = {};
  const nodeIds = new Set(data.nodes.map(({ id }) => id));
  const validSelectedId = selectedId && nodeIds.has(selectedId) ? selectedId : null;
  const validHoveredId =
    hoveredId && nodeIds.has(hoveredId) && hoveredId !== validSelectedId ? hoveredId : null;
  const selectedNeighborIds = new Set<string>();
  const selectedEdgeIds = new Set<string>();
  const hoveredNeighborIds = new Set<string>();
  const hoveredEdgeIds = new Set<string>();

  const collectNeighborhood = (
    nodeId: string | null,
    neighborIds: Set<string>,
    edgeIds: Set<string>,
  ) => {
    if (!nodeId) return;
    for (const edge of data.edges) {
      if (edge.source !== nodeId && edge.target !== nodeId) continue;
      edgeIds.add(edge.id);
      neighborIds.add(edge.source === nodeId ? edge.target : edge.source);
    }
  };

  collectNeighborhood(validSelectedId, selectedNeighborIds, selectedEdgeIds);
  collectNeighborhood(validHoveredId, hoveredNeighborIds, hoveredEdgeIds);

  for (const node of data.nodes) {
    if (node.id === validSelectedId) states[node.id] = ["selected"];
    else if (node.id === validHoveredId) states[node.id] = ["hovered"];
    else if (selectedNeighborIds.has(node.id)) states[node.id] = ["selected-neighbor"];
    else if (hoveredNeighborIds.has(node.id)) states[node.id] = ["hover-neighbor"];
    else if (validHoveredId) states[node.id] = ["hover-inactive"];
    else if (validSelectedId) states[node.id] = ["selected-inactive"];
    else states[node.id] = [];
  }

  for (const edge of data.edges) {
    if (selectedEdgeIds.has(edge.id)) states[edge.id] = ["selected-neighbor"];
    else if (hoveredEdgeIds.has(edge.id)) states[edge.id] = ["hover-neighbor"];
    else if (validHoveredId) states[edge.id] = ["hover-inactive"];
    else if (validSelectedId) states[edge.id] = ["selected-inactive"];
    else states[edge.id] = [];
  }

  return states;
}
