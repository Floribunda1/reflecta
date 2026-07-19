import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { getUnderstandingTitle } from "../understanding-title";

export type KnowledgeGraphNode = {
  id: string;
  data: { title: string };
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type KnowledgeGraphData = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

export function buildKnowledgeGraphData(
  understandings: UnderstandingSummaryDTO[],
): KnowledgeGraphData {
  const visibleIds = new Set(understandings.map((understanding) => understanding.id));
  const edgeKeys = new Set<string>();
  const edges: KnowledgeGraphEdge[] = [];

  for (const understanding of understandings) {
    for (const targetId of understanding.connectionIds) {
      if (!visibleIds.has(targetId) || targetId === understanding.id) continue;

      const edgeKey = `${understanding.id}->${targetId}`;
      if (edgeKeys.has(edgeKey)) continue;

      edgeKeys.add(edgeKey);
      edges.push({
        id: `connection:${edgeKey}`,
        source: understanding.id,
        target: targetId,
      });
    }
  }

  return {
    nodes: understandings
      .map((understanding) => ({
        id: understanding.id,
        data: { title: getUnderstandingTitle(understanding) },
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function buildGraphSelectionStates(
  data: KnowledgeGraphData,
  selectedId: string | null,
): Record<string, string[]> {
  const states: Record<string, string[]> = Object.fromEntries(
    [...data.nodes, ...data.edges].map((element) => [element.id, []]),
  );
  if (!selectedId || !states[selectedId]) return states;

  states[selectedId] = ["selected"];
  for (const edge of data.edges) {
    if (edge.source === selectedId || edge.target === selectedId) {
      states[edge.id] = ["selected"];
    }
  }
  return states;
}
