import { and, eq, inArray, isNull, sql, count } from "drizzle-orm";
import {
  contexts,
  understandingDomains,
  understandingConnections,
  understandings,
} from "../../db/schema";
import type { ContextMedium } from "../context/types";
import type {
  CreateUnderstandingInput,
  ListUnderstandingsFilter,
  UnderstandingDTO,
  UnderstandingSummaryDTO,
  UpdateUnderstandingInput,
} from "./types";
import { UnderstandingCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class UnderstandingElectronBff extends UnderstandingCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb());
  }

  async assembleUnderstandingSummaryDTOs(
    understandingRows: Array<typeof understandings.$inferSelect>,
  ): Promise<UnderstandingSummaryDTO[]> {
    if (understandingRows.length === 0) return [];

    const db = this.db;
    const ids = understandingRows.map((t) => t.id);

    const [tcRows, ctxCountRows, connRows] = await Promise.all([
      db
        .select()
        .from(understandingDomains)
        .where(inArray(understandingDomains.understandingId, ids)),
      db
        .select({ understandingId: contexts.understandingId, count: count() })
        .from(contexts)
        .where(and(inArray(contexts.understandingId, ids), isNull(contexts.deletedAt)))
        .groupBy(contexts.understandingId),
      db
        .select()
        .from(understandingConnections)
        .where(inArray(understandingConnections.sourceId, ids)),
    ]);

    const tcMap = new Map<string, string[]>();
    for (const r of tcRows) {
      const arr = tcMap.get(r.understandingId) ?? [];
      arr.push(r.domainId);
      tcMap.set(r.understandingId, arr);
    }

    const ctxCountMap = new Map<string, number>();
    for (const r of ctxCountRows) {
      ctxCountMap.set(r.understandingId, r.count);
    }

    const connMap = new Map<string, string[]>();
    for (const r of connRows) {
      const arr = connMap.get(r.sourceId) ?? [];
      arr.push(r.targetId);
      connMap.set(r.sourceId, arr);
    }

    return understandingRows.map((t) => ({
      id: t.id,
      title: t.title ?? null,
      body: t.body,
      domainIds: tcMap.get(t.id) ?? [],
      contextCount: ctxCountMap.get(t.id) ?? 0,
      connectionCount: (connMap.get(t.id) ?? []).length,
      connectionIds: connMap.get(t.id) ?? [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async listUnderstandings(filter?: ListUnderstandingsFilter): Promise<UnderstandingSummaryDTO[]> {
    let understandingRows = await this.listUnderstandingRows({
      domainIds: filter?.domainIds,
      includeDescendants: filter?.includeDescendants,
      limit: filter?.limit,
      offset: filter?.offset,
    });

    if (filter?.searchQuery) {
      const escaped = `"${filter.searchQuery.replace(/"/g, '""')}"*`;
      const ftsRows = await this.db.all<{ understanding_id: string }>(
        sql`SELECT understanding_id FROM fts_understandings WHERE fts_understandings MATCH ${escaped} ORDER BY rank`,
      );
      const matchingIds = new Set(ftsRows.map((r) => r.understanding_id));
      understandingRows = understandingRows.filter((t) => matchingIds.has(t.id));
    }

    return this.assembleUnderstandingSummaryDTOs(understandingRows);
  }

  async getUnderstandingById(id: string): Promise<UnderstandingDTO | null> {
    const row = await this.getUnderstandingRow(id);
    if (!row) return null;

    const [tcRows, ctxRows, connRows, refRows] = await Promise.all([
      this.db
        .select()
        .from(understandingDomains)
        .where(eq(understandingDomains.understandingId, id)),
      this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.understandingId, id), isNull(contexts.deletedAt))),
      this.db
        .select()
        .from(understandingConnections)
        .where(eq(understandingConnections.sourceId, id)),
      this.db
        .select()
        .from(understandingConnections)
        .where(eq(understandingConnections.targetId, id)),
    ]);

    const connectionIds = connRows.map((r) => r.targetId);
    const connections =
      connectionIds.length > 0
        ? await this.assembleUnderstandingSummaryDTOs(
            await this.db
              .select()
              .from(understandings)
              .where(inArray(understandings.id, connectionIds)),
          )
        : [];

    const referencedByIds = refRows.map((r) => r.sourceId);
    const referencedBy =
      referencedByIds.length > 0
        ? await this.assembleUnderstandingSummaryDTOs(
            await this.db
              .select()
              .from(understandings)
              .where(inArray(understandings.id, referencedByIds)),
          )
        : [];

    return {
      id: row.id,
      title: row.title ?? null,
      body: row.body,
      domainIds: tcRows.map((r) => r.domainId),
      contexts: ctxRows.map((r) => ({ ...r, medium: r.medium as ContextMedium })),
      connections,
      referencedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createUnderstanding(input: CreateUnderstandingInput): Promise<UnderstandingDTO> {
    const row = await super._createUnderstanding(input);
    const dto = await this.getUnderstandingById(row.id);
    if (!dto) throw new Error(`Understanding not found after creation: ${row.id}`);
    return dto;
  }

  async updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Promise<UnderstandingDTO> {
    const row = await super._updateUnderstanding(id, input);
    const dto = await this.getUnderstandingById(row.id);
    if (!dto) throw new Error(`Understanding not found after update: ${row.id}`);
    return dto;
  }

  async listRecentUnderstandings(limit = 20): Promise<UnderstandingSummaryDTO[]> {
    const rows = await this.listRecentUnderstandingRows(limit);
    return this.assembleUnderstandingSummaryDTOs(rows);
  }
}
