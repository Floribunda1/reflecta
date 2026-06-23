import { and, eq, inArray, isNull } from "drizzle-orm";
import { contexts, understandingConnections, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { makePageInfo } from "../shared/types";
import { toUnderstandingSummaries } from "../understanding/core";
import type { ContextDetail, ContextMedium } from "../context/types";
import type { UnderstandingNode, UnderstandingSummary } from "../understanding/types";
import type { GraphNeighborhoodOptions, GraphNeighborhoodResult, GraphPathResult } from "./types";

export class GraphCliBff {
  constructor(private db: ReflectaDb) {}

  async graphNeighborhood(
    seedId: string,
    options?: GraphNeighborhoodOptions,
  ): Promise<GraphNeighborhoodResult> {
    const seedRows = await this.db
      .select()
      .from(understandings)
      .where(and(eq(understandings.id, seedId), isNull(understandings.deletedAt)))
      .limit(1);

    if (seedRows.length === 0) {
      throw new Error(`Understanding not found: ${seedId}`);
    }

    const depth = options?.depth ?? 1;
    const limit = options?.limit ?? 200;
    const offset = options?.offset ?? 0;

    let currentLayer = new Set<string>([seedId]);
    const visited = new Set<string>([seedId]);
    const allEdges: { from: string; to: string }[] = [];

    for (let d = 0; d < depth; d++) {
      const nextLayer = new Set<string>();
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

      for (const e of outRows) {
        allEdges.push({ from: e.sourceId, to: e.targetId });
        if (!visited.has(e.targetId)) {
          visited.add(e.targetId);
          nextLayer.add(e.targetId);
        }
      }

      for (const e of inRows) {
        allEdges.push({ from: e.sourceId, to: e.targetId });
        if (!visited.has(e.sourceId)) {
          visited.add(e.sourceId);
          nextLayer.add(e.sourceId);
        }
      }

      currentLayer = nextLayer;
    }

    const allIds = [...visited];
    const paginatedIds = allIds.slice(offset, offset + limit + 1);
    const hasMore = paginatedIds.length > limit;
    const nodeIds = paginatedIds.slice(0, limit);

    const understandingRows = await this.db
      .select()
      .from(understandings)
      .where(and(inArray(understandings.id, nodeIds), isNull(understandings.deletedAt)));

    const summaries = await toUnderstandingSummaries(this.db, understandingRows);
    const summaryMap = new Map(summaries.map((s) => [s.id, s]));

    const nodes: UnderstandingNode[] = nodeIds
      .map((id) => summaryMap.get(id))
      .filter((s): s is UnderstandingSummary => s !== undefined)
      .map((s) => ({ ...s }));

    let resultContexts: ContextDetail[] | undefined;

    if (options?.includeContexts) {
      const ctxRows = await this.db
        .select()
        .from(contexts)
        .where(and(inArray(contexts.understandingId, nodeIds), isNull(contexts.deletedAt)));

      const ctxMap = new Map<string, string[]>();
      for (const ctx of ctxRows) {
        const arr = ctxMap.get(ctx.understandingId) ?? [];
        arr.push(ctx.id);
        ctxMap.set(ctx.understandingId, arr);
      }

      for (const node of nodes) {
        node.contextIds = ctxMap.get(node.id) ?? [];
      }

      resultContexts = ctxRows.map((r) => ({
        id: r.id,
        understandingId: r.understandingId,
        medium: r.medium as ContextMedium,
        title: r.title ?? null,
        content: r.content,
      }));
    }

    return {
      seed: seedId,
      nodes,
      edges: allEdges.filter((e) => visited.has(e.from) && visited.has(e.to)),
      contexts: resultContexts,
      page: makePageInfo(limit, offset, hasMore),
    };
  }

  async graphPath(fromId: string, toId: string): Promise<GraphPathResult> {
    const [fromRows, toRows] = await Promise.all([
      this.db
        .select()
        .from(understandings)
        .where(and(eq(understandings.id, fromId), isNull(understandings.deletedAt)))
        .limit(1),
      this.db
        .select()
        .from(understandings)
        .where(and(eq(understandings.id, toId), isNull(understandings.deletedAt)))
        .limit(1),
    ]);

    if (fromRows.length === 0) {
      throw new Error(`Understanding not found: ${fromId}`);
    }
    if (toRows.length === 0) {
      throw new Error(`Understanding not found: ${toId}`);
    }

    if (fromId === toId) {
      return { from: fromId, to: toId, paths: [{ nodes: [fromId], edges: [] }] };
    }

    const MAX_DEPTH = 6;
    const MAX_PATHS = 10;
    const paths: GraphPathResult["paths"] = [];

    const queue: Array<{ node: string; path: string[]; edges: { from: string; to: string }[] }> = [
      { node: fromId, path: [fromId], edges: [] },
    ];

    while (queue.length > 0 && paths.length < MAX_PATHS) {
      const depth = queue[0].path.length;
      if (depth >= MAX_DEPTH) break;

      const layer: Array<{ node: string; path: string[]; edges: { from: string; to: string }[] }> =
        [];
      while (queue.length > 0 && queue[0].path.length === depth) {
        layer.push(queue.shift()!);
      }

      const layerNodes = [...new Set(layer.map((item) => item.node))];
      const connRows =
        layerNodes.length > 0
          ? await this.db
              .select()
              .from(understandingConnections)
              .where(inArray(understandingConnections.sourceId, layerNodes))
          : [];

      const connMap = new Map<string, typeof connRows>();
      for (const conn of connRows) {
        const arr = connMap.get(conn.sourceId) ?? [];
        arr.push(conn);
        connMap.set(conn.sourceId, arr);
      }

      for (const item of layer) {
        const nodeConns = connMap.get(item.node) ?? [];
        for (const conn of nodeConns) {
          if (item.path.includes(conn.targetId)) continue;

          const newPath = [...item.path, conn.targetId];
          const newEdges = [...item.edges, { from: conn.sourceId, to: conn.targetId }];

          if (conn.targetId === toId) {
            paths.push({ nodes: newPath, edges: newEdges });
          } else {
            queue.push({ node: conn.targetId, path: newPath, edges: newEdges });
          }
        }
      }
    }

    return { from: fromId, to: toId, paths };
  }
}
