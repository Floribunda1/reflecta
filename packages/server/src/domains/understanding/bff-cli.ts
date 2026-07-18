import { and, eq, inArray, isNull } from "drizzle-orm";
import { UnderstandingCore } from "./core";
import { contexts, understandingConnections, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextDetail, ContextMedium } from "../context/types";
import type {
  CreateUnderstandingInput,
  GetUnderstandingOptions,
  UnderstandingListWithContexts,
  UnderstandingDetail,
  UnderstandingRelation,
  UnderstandingSummary,
  UpdateUnderstandingInput,
} from "./types";
import type { ListUnderstandingsFilter } from "./types";
import { getUnderstandingConnectionCounts } from "./core";
import { toUnderstandingSummaries } from "./core";
import { extractUnderstandingWikiLinks, formatUnderstandingWikiLink } from "./wiki-links";
import type { RetrievalIndexUpdateSink } from "../shared/types";

export class UnderstandingCliBff extends UnderstandingCore {
  constructor(db: ReflectaDb, retrievalIndex?: RetrievalIndexUpdateSink) {
    super(db, retrievalIndex);
  }

  async listUnderstandings(filter?: ListUnderstandingsFilter): Promise<UnderstandingSummary[]> {
    const rows = await this.listUnderstandingRows({
      domainIds: filter?.domainIds,
      includeDescendants: filter?.includeDescendants,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return toUnderstandingSummaries(this.db, rows);
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
    const row = await this.getUnderstandingRow(id);
    if (!row) {
      throw new Error(`Understanding not found: ${id}`);
    }

    const summary = (await toUnderstandingSummaries(this.db, [row]))[0];
    const counts = await getUnderstandingConnectionCounts(this.db, id);

    const detail: UnderstandingDetail = {
      ...summary,
      contextCount: counts.contextCount,
      referenceCount: counts.referenceCount,
      referencedByCount: counts.referencedByCount,
    };

    if (options?.includeContexts) {
      detail.contexts = (await this.listContextsByUnderstandingId([id]))[id] ?? [];
    }

    if (options?.includeRelations) {
      detail.relations = await this.listUnderstandingRelations(row, summary);
    }

    return detail;
  }

  async createUnderstanding(input: CreateUnderstandingInput): Promise<UnderstandingDetail> {
    const row = await super._createUnderstanding(input);
    return this.getUnderstanding(row.id);
  }

  async updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Promise<UnderstandingDetail> {
    const row = await super._updateUnderstanding(id, input);
    return this.getUnderstanding(row.id);
  }

  async listRecentUnderstandings(limit = 20): Promise<UnderstandingSummary[]> {
    const rows = await this.listRecentUnderstandingRows(limit);
    return toUnderstandingSummaries(this.db, rows);
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

  private async listUnderstandingRelations(
    row: typeof understandings.$inferSelect,
    summary: UnderstandingSummary,
  ): Promise<UnderstandingRelation[]> {
    const outgoingLinks = extractUnderstandingWikiLinks(row.body);
    const [outgoingRows, incomingRows] = await Promise.all([
      this.db
        .select()
        .from(understandingConnections)
        .where(eq(understandingConnections.sourceId, row.id)),
      this.db
        .select()
        .from(understandingConnections)
        .where(eq(understandingConnections.targetId, row.id)),
    ]);

    const relatedIds = [
      ...outgoingRows.map((connection) => connection.targetId),
      ...incomingRows.map((connection) => connection.sourceId),
    ];
    const relatedRows =
      relatedIds.length === 0
        ? []
        : await this.db
            .select()
            .from(understandings)
            .where(and(inArray(understandings.id, relatedIds), isNull(understandings.deletedAt)));
    const relatedById = new Map(relatedRows.map((relatedRow) => [relatedRow.id, relatedRow]));
    const relatedByTitle = new Map(
      relatedRows.flatMap((relatedRow) =>
        relatedRow.title ? [[relatedRow.title, relatedRow] as const] : [],
      ),
    );

    const relations: UnderstandingRelation[] = outgoingLinks.map((link) => {
      const targetRow = relatedById.get(link.target) ?? relatedByTitle.get(link.target);
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

    for (const connection of incomingRows) {
      const sourceRow = relatedById.get(connection.sourceId);
      if (!sourceRow) continue;
      const sourceLinks = extractUnderstandingWikiLinks(sourceRow.body);
      const sourceLink = sourceLinks.find(
        (link) =>
          link.target === row.id || (summary.title !== null && link.target === summary.title),
      );
      relations.push({
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

    return relations;
  }
}
