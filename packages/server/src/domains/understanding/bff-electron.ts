import { and, eq, inArray, isNull, count } from "drizzle-orm";
import {
  contexts,
  understandingDomains,
  understandingMentions,
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
    super(options.getDb(), options.retrievalIndex);
  }

  async assembleUnderstandingSummaryDTOs(
    understandingRows: Array<typeof understandings.$inferSelect>,
  ): Promise<UnderstandingSummaryDTO[]> {
    if (understandingRows.length === 0) return [];

    const db = this.db;
    const ids = understandingRows.map((t) => t.id);

    const [tcRows, ctxCountRows, mentionRows] = await Promise.all([
      db
        .select()
        .from(understandingDomains)
        .where(inArray(understandingDomains.understandingId, ids)),
      db
        .select({ understandingId: contexts.understandingId, count: count() })
        .from(contexts)
        .where(and(inArray(contexts.understandingId, ids), isNull(contexts.deletedAt)))
        .groupBy(contexts.understandingId),
      db.select().from(understandingMentions).where(inArray(understandingMentions.sourceId, ids)),
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

    const mentionMap = new Map<string, string[]>();
    for (const r of mentionRows) {
      const arr = mentionMap.get(r.sourceId) ?? [];
      arr.push(r.targetId);
      mentionMap.set(r.sourceId, arr);
    }

    return understandingRows.map((t) => ({
      id: t.id,
      title: t.title ?? null,
      body: t.body,
      domainIds: tcMap.get(t.id) ?? [],
      contextCount: ctxCountMap.get(t.id) ?? 0,
      mentionCount: (mentionMap.get(t.id) ?? []).length,
      mentionIds: mentionMap.get(t.id) ?? [],
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
      const query = filter.searchQuery.toLocaleLowerCase();
      understandingRows = understandingRows.filter((t) =>
        `${t.title ?? ""}\n${t.body}`.toLocaleLowerCase().includes(query),
      );
    }

    return this.assembleUnderstandingSummaryDTOs(understandingRows);
  }

  async getUnderstandingById(id: string): Promise<UnderstandingDTO | null> {
    const row = await this.getUnderstandingRow(id);
    if (!row) return null;

    const [tcRows, ctxRows, mentionRows, refRows] = await Promise.all([
      this.db
        .select()
        .from(understandingDomains)
        .where(eq(understandingDomains.understandingId, id)),
      this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.understandingId, id), isNull(contexts.deletedAt))),
      this.db.select().from(understandingMentions).where(eq(understandingMentions.sourceId, id)),
      this.db.select().from(understandingMentions).where(eq(understandingMentions.targetId, id)),
    ]);

    const mentionIds = mentionRows.map((r) => r.targetId);
    const mentions =
      mentionIds.length > 0
        ? await this.assembleUnderstandingSummaryDTOs(
            await this.db
              .select()
              .from(understandings)
              .where(inArray(understandings.id, mentionIds)),
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
      mentions,
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
