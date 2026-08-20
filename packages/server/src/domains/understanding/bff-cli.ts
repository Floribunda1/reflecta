import { Effect } from "effect";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { UnderstandingCore } from "./core";
import {
  contexts,
  understandingCanvases,
  understandingCanvasElements,
  understandingMentions,
  understandings,
} from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextDetail, ContextMedium } from "../context/types";
import type {
  CreateUnderstandingInput,
  GetUnderstandingOptions,
  UnderstandingListWithContexts,
  UnderstandingDetail,
  UnderstandingMentionRef,
  UnderstandingSummary,
  UpdateUnderstandingInput,
} from "./types";
import type { ListUnderstandingsFilter } from "./types";
import { getUnderstandingMentionCounts } from "./core";
import { toUnderstandingSummaries } from "./core";
import { extractUnderstandingWikiLinks, formatUnderstandingWikiLink } from "./wiki-links";
import type { RetrievalIndexUpdateSink } from "../shared/types";

export class UnderstandingCliBff extends UnderstandingCore {
  constructor(db: ReflectaDb, retrievalIndex?: RetrievalIndexUpdateSink) {
    super(db, retrievalIndex);
  }

  async listUnderstandings(filter?: ListUnderstandingsFilter): Promise<UnderstandingSummary[]> {
    const rows = await Effect.runPromise(
      this.listUnderstandingRows({
        domainIds: filter?.domainIds,
        includeDescendants: filter?.includeDescendants,
        limit: filter?.limit,
        offset: filter?.offset,
      }),
    );
    return Effect.runPromise(toUnderstandingSummaries(this.db, rows));
  }

  async listUnderstandingsWithContexts(
    filter?: ListUnderstandingsFilter,
  ): Promise<UnderstandingListWithContexts> {
    const understandings = await this.listUnderstandings(filter);
    return {
      understandings,
      contextsByUnderstandingId: await this.listContextsByUnderstandingId(
        understandings.map((understanding) => understanding.id),
      ),
    };
  }

  async getUnderstanding(
    id: string,
    options?: GetUnderstandingOptions,
  ): Promise<UnderstandingDetail> {
    const row = await Effect.runPromise(this.getUnderstandingRow(id));
    if (!row) {
      throw new Error(`Understanding not found: ${id}`);
    }

    const summary = (await Effect.runPromise(toUnderstandingSummaries(this.db, [row])))[0];
    const counts = await Effect.runPromise(getUnderstandingMentionCounts(this.db, id));

    const detail: UnderstandingDetail = {
      ...summary,
      contextCount: counts.contextCount,
      referenceCount: counts.referenceCount,
      referencedByCount: counts.referencedByCount,
    };

    if (options?.includeContexts) {
      detail.contexts = (await this.listContextsByUnderstandingId([id]))[id] ?? [];
    }

    if (options?.includeMentions) {
      detail.mentions = await this.listUnderstandingMentions(row, summary);
    }

    // TBD-2：该理解出现在哪些画布（C13 反向查询，understanding_get 与 UI 共用）
    detail.referencedByCanvases = await this.listReferencedByCanvases(id);

    return detail;
  }

  private async listReferencedByCanvases(
    understandingId: string,
  ): Promise<Array<{ id: string; title: string }>> {
    const rows = await this.db
      .select({ id: understandingCanvases.id, title: understandingCanvases.title })
      .from(understandingCanvasElements)
      .innerJoin(
        understandingCanvases,
        eq(understandingCanvases.id, understandingCanvasElements.canvasId),
      )
      .where(eq(understandingCanvasElements.understandingId, understandingId))
      .orderBy(desc(understandingCanvases.updatedAt));
    return rows;
  }

  async createUnderstanding(input: CreateUnderstandingInput): Promise<UnderstandingDetail> {
    const row = await Effect.runPromise(this._createUnderstanding(input));
    return this.getUnderstanding(row.id);
  }

  async updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Promise<UnderstandingDetail> {
    const row = await Effect.runPromise(this._updateUnderstanding(id, input));
    return this.getUnderstanding(row.id);
  }

  async listRecentUnderstandings(limit = 20): Promise<UnderstandingSummary[]> {
    const rows = await Effect.runPromise(this.listRecentUnderstandingRows(limit));
    return Effect.runPromise(toUnderstandingSummaries(this.db, rows));
  }

  async listRecentUnderstandingsWithContexts(limit = 20): Promise<UnderstandingListWithContexts> {
    const understandings = await this.listRecentUnderstandings(limit);
    return {
      understandings,
      contextsByUnderstandingId: await this.listContextsByUnderstandingId(
        understandings.map((understanding) => understanding.id),
      ),
    };
  }

  private async listContextsByUnderstandingId(
    understandingIds: string[],
  ): Promise<Record<string, ContextDetail[]>> {
    const result = Object.fromEntries(
      [...new Set(understandingIds)].map((id) => [id, [] as ContextDetail[]]),
    );
    if (understandingIds.length === 0) return result;

    const ctxRows = await this.db
      .select()
      .from(contexts)
      .where(and(inArray(contexts.understandingId, understandingIds), isNull(contexts.deletedAt)));

    for (const row of ctxRows) {
      const items = result[row.understandingId] ?? [];
      items.push({
        id: row.id,
        understandingId: row.understandingId,
        medium: row.medium as ContextMedium,
        title: row.title ?? null,
        content: row.content,
      });
      result[row.understandingId] = items;
    }

    return result;
  }

  private async listUnderstandingMentions(
    row: typeof understandings.$inferSelect,
    summary: UnderstandingSummary,
  ): Promise<UnderstandingMentionRef[]> {
    const outgoingLinks = extractUnderstandingWikiLinks(row.body);
    const [outgoingRows, incomingRows] = await Promise.all([
      this.db
        .select()
        .from(understandingMentions)
        .where(eq(understandingMentions.sourceId, row.id)),
      this.db
        .select()
        .from(understandingMentions)
        .where(eq(understandingMentions.targetId, row.id)),
    ]);

    const relatedIds = [
      ...outgoingRows.map((mention) => mention.targetId),
      ...incomingRows.map((mention) => mention.sourceId),
    ];
    const relatedRows =
      relatedIds.length === 0
        ? []
        : await this.db
            .select()
            .from(understandings)
            .where(and(inArray(understandings.id, relatedIds), isNull(understandings.deletedAt)));
    const relatedById = new Map(relatedRows.map((relatedRow) => [relatedRow.id, relatedRow]));
    const mentions: UnderstandingMentionRef[] = outgoingLinks.map((link) => {
      const targetRow = relatedById.get(link.target);
      return {
        direction: "outgoing",
        sourceUnderstandingId: row.id,
        targetUnderstandingId: targetRow?.id ?? null,
        sourceTitle: summary.title,
        targetTitle: targetRow?.title ?? link.title,
        rawText: link.rawText,
        resolved: Boolean(targetRow),
      };
    });

    for (const mention of incomingRows) {
      const sourceRow = relatedById.get(mention.sourceId);
      if (!sourceRow) continue;
      const sourceLinks = extractUnderstandingWikiLinks(sourceRow.body);
      const sourceLink = sourceLinks.find((link) => link.target === row.id);
      mentions.push({
        direction: "incoming",
        sourceUnderstandingId: sourceRow.id,
        targetUnderstandingId: row.id,
        sourceTitle: sourceRow.title ?? null,
        targetTitle: summary.title,
        rawText:
          sourceLink?.rawText ??
          formatUnderstandingWikiLink({
            title: summary.title ?? row.id,
            id: row.id,
          }),
        resolved: true,
      });
    }

    return mentions;
  }
}
