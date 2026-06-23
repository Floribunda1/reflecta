import { and, eq, inArray, isNull } from "drizzle-orm";
import { contexts, understandingConnections, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextDetail, ContextMedium } from "../context/types";
import { toUnderstandingSummaries } from "../understanding/core";
import type { UnderstandingNode, UnderstandingSummary } from "../understanding/types";
import type { GraphEdge, GraphOptions, GraphResult } from "./types";

export class GraphCliBff {
  constructor(private db: ReflectaDb) {}

  async graph(seedId: string, options?: GraphOptions): Promise<GraphResult> {
    const seedRows = await this.db
      .select()
      .from(understandings)
      .where(and(eq(understandings.id, seedId), isNull(understandings.deletedAt)))
      .limit(1);

    if (seedRows.length === 0) {
      throw new Error(`Understanding not found: ${seedId}`);
    }

    const depth = Math.max(0, Math.min(options?.depth ?? 1, 6));
    let currentLayer = new Set<string>([seedId]);
    const visited = new Set<string>([seedId]);
    const edges: GraphEdge[] = [];

    for (let d = 0; d < depth; d++) {
      const ids = [...currentLayer];
      if (ids.length === 0) break;

      const [outRows, inRows] = await Promise.all([
        this.db
          .select()
          .from(understandingConnections)
          .where(inArray(understandingConnections.sourceId, ids)),
        this.db
          .select()
          .from(understandingConnections)
          .where(inArray(understandingConnections.targetId, ids)),
      ]);

      currentLayer = new Set<string>();
      for (const edge of [...outRows, ...inRows]) {
        edges.push({ from: edge.sourceId, to: edge.targetId });
        for (const id of [edge.sourceId, edge.targetId]) {
          if (visited.has(id)) continue;
          visited.add(id);
          currentLayer.add(id);
        }
      }
    }

    const nodeIds = [...visited];
    const understandingRows = await this.db
      .select()
      .from(understandings)
      .where(and(inArray(understandings.id, nodeIds), isNull(understandings.deletedAt)));
    const summaries = await toUnderstandingSummaries(this.db, understandingRows);
    const summaryMap = new Map(summaries.map((summary) => [summary.id, summary]));
    const nodes: UnderstandingNode[] = nodeIds
      .map((id) => summaryMap.get(id))
      .filter((summary): summary is UnderstandingSummary => summary !== undefined)
      .map((summary) => ({ ...summary }));
    const activeNodeIds = new Set(nodes.map((node) => node.id));

    let resultContexts: ContextDetail[] | undefined;
    if (options?.includeContext) {
      const contextRows = await this.db
        .select()
        .from(contexts)
        .where(
          and(inArray(contexts.understandingId, [...activeNodeIds]), isNull(contexts.deletedAt)),
        );
      const contextIdsByUnderstandingId = new Map<string, string[]>();
      for (const context of contextRows) {
        const ids = contextIdsByUnderstandingId.get(context.understandingId) ?? [];
        ids.push(context.id);
        contextIdsByUnderstandingId.set(context.understandingId, ids);
      }
      for (const node of nodes) {
        node.contextIds = contextIdsByUnderstandingId.get(node.id) ?? [];
      }
      resultContexts = contextRows.map((context) => ({
        id: context.id,
        understandingId: context.understandingId,
        medium: context.medium as ContextMedium,
        title: context.title ?? null,
        content: context.content,
      }));
    }

    return {
      seed: seedId,
      nodes,
      edges: edges.filter((edge) => activeNodeIds.has(edge.from) && activeNodeIds.has(edge.to)),
      contexts: resultContexts,
    };
  }
}
