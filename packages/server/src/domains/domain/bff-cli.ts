import { and, desc, inArray, isNull } from "drizzle-orm";
import {
  contexts,
  understandingDomains,
  understandingConnections,
  understandings,
} from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { DomainCore } from "./core";
import { getDomainDescendants } from "./core";
import { makePageInfo } from "../shared/types";
import { toUnderstandingSummaries } from "../understanding/core";
import type { ContextDetail, ContextMedium } from "../context/types";
import type { UnderstandingNode } from "../understanding/types";
import type {
  DomainInspectResult,
  DomainSummary,
  CreateDomainInput,
  InspectDomainOptions,
  UpdateDomainInput,
} from "./types";

export class DomainCliBff extends DomainCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async listDomains(): Promise<DomainSummary[]> {
    const rows = await this.listDomainRows();
    return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId }));
  }

  async getDomain(id: string): Promise<DomainSummary> {
    const row = await this.getDomainRow(id);
    if (!row) {
      throw new Error(`Domain not found: ${id}`);
    }
    return { id: row.id, name: row.name, parentId: row.parentId };
  }

  async inspectDomain(id: string, options?: InspectDomainOptions): Promise<DomainInspectResult> {
    const domain = await this.getDomainRow(id);
    if (!domain) {
      throw new Error(`Domain not found: ${id}`);
    }

    const allCats = await this.listDomainRows();

    const descendantIds = await getDomainDescendants(this.db, id);
    const targetCatIds = [id, ...descendantIds];

    const limit = options?.limit ?? 200;
    const offset = options?.offset ?? 0;

    const understandingRows = await this.db
      .select()
      .from(understandings)
      .where(
        and(
          isNull(understandings.deletedAt),
          inArray(
            understandings.id,
            this.db
              .select({ id: understandingDomains.understandingId })
              .from(understandingDomains)
              .where(inArray(understandingDomains.domainId, targetCatIds)),
          ),
        ),
      )
      .orderBy(desc(understandings.updatedAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = understandingRows.length > limit;
    const paginatedUnderstandingRows = understandingRows.slice(0, limit);
    const understandingIds = paginatedUnderstandingRows.map((t) => t.id);

    const summaries = await toUnderstandingSummaries(this.db, paginatedUnderstandingRows);
    const nodeUnderstandings: UnderstandingNode[] = summaries.map((s) => ({ ...s }));

    let resultContexts: ContextDetail[] | undefined;
    let resultEdges: { from: string; to: string }[] | undefined;

    if (options?.includeContexts) {
      const ctxRows = await this.db
        .select()
        .from(contexts)
        .where(
          and(inArray(contexts.understandingId, understandingIds), isNull(contexts.deletedAt)),
        );

      const ctxMap = new Map<string, string[]>();
      for (const ctx of ctxRows) {
        const arr = ctxMap.get(ctx.understandingId) ?? [];
        arr.push(ctx.id);
        ctxMap.set(ctx.understandingId, arr);
      }

      for (const node of nodeUnderstandings) {
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

    if (options?.includeEdges) {
      const [outRows, inRows] = await Promise.all([
        this.db
          .select()
          .from(understandingConnections)
          .where(inArray(understandingConnections.sourceId, understandingIds)),
        this.db
          .select()
          .from(understandingConnections)
          .where(inArray(understandingConnections.targetId, understandingIds)),
      ]);

      const edgeSet = new Set<string>();
      resultEdges = [];

      for (const e of outRows) {
        const key = `${e.sourceId}->${e.targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          resultEdges.push({ from: e.sourceId, to: e.targetId });
        }
      }

      for (const e of inRows) {
        const key = `${e.sourceId}->${e.targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          resultEdges.push({ from: e.sourceId, to: e.targetId });
        }
      }
    }

    return {
      domain: { id: domain.id, name: domain.name, parentId: domain.parentId },
      domains: allCats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
      understandings: nodeUnderstandings,
      contexts: resultContexts,
      edges: resultEdges,
      page: makePageInfo(limit, offset, hasMore),
    };
  }

  async createDomainSummary(input: CreateDomainInput): Promise<DomainSummary> {
    const row = await super.createDomain(input);
    return { id: row.id, name: row.name, parentId: row.parentId };
  }

  async updateDomainSummary(id: string, input: UpdateDomainInput): Promise<DomainSummary> {
    const row = await super.updateDomain(id, input);
    return { id: row.id, name: row.name, parentId: row.parentId };
  }
}
