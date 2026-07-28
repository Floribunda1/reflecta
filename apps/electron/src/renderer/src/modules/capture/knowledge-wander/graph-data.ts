import type { KnowledgeGraphData } from "@reflecta/ui/knowledge";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { getUnderstandingTitle } from "../understanding-title";

export function buildKnowledgeGraphData(
  understandings: UnderstandingSummaryDTO[],
): KnowledgeGraphData {
  const visibleIds = new Set(understandings.map(({ id }) => id));
  const degree = new Map(understandings.map(({ id }) => [id, 0]));
  const edgeKeys = new Set<string>();
  const edges: KnowledgeGraphData["edges"] = [];

  for (const understanding of understandings) {
    for (const targetId of understanding.connectionIds) {
      if (targetId === understanding.id || !visibleIds.has(targetId)) continue;

      const [source, target] = [understanding.id, targetId].sort();
      const key = `${source}--${target}`;
      if (edgeKeys.has(key)) continue;

      edgeKeys.add(key);
      degree.set(source, (degree.get(source) ?? 0) + 1);
      degree.set(target, (degree.get(target) ?? 0) + 1);
      edges.push({ id: `connection:${key}`, source, target });
    }
  }

  return {
    nodes: understandings
      .map((understanding) => ({
        id: understanding.id,
        data: {
          title: getUnderstandingTitle(understanding),
          degree: degree.get(understanding.id) ?? 0,
        },
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.sort((left, right) => left.id.localeCompare(right.id)),
  };
}
