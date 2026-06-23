import { and, eq, inArray, isNull } from "drizzle-orm";
import { UnderstandingCore } from "./core";
import { contexts, understandingConnections, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextMedium } from "../context/types";
import type {
  CreateUnderstandingInput,
  GetUnderstandingOptions,
  UnderstandingDetail,
  UnderstandingSummary,
  UpdateUnderstandingInput,
} from "./types";
import type { ListUnderstandingsFilter } from "./types";
import { getUnderstandingConnectionCounts } from "./core";
import { toUnderstandingSummaries } from "./core";

export class UnderstandingCliBff extends UnderstandingCore {
  constructor(db: ReflectaDb) {
    super(db);
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
      const ctxRows = await this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.understandingId, id), isNull(contexts.deletedAt)));
      detail.contexts = ctxRows.map((r) => ({
        id: r.id,
        understandingId: r.understandingId,
        medium: r.medium as ContextMedium,
        title: r.title ?? null,
        content: r.content,
      }));
    }

    if (options?.includeReferences) {
      const connRows = await this.db
        .select()
        .from(understandingConnections)
        .where(eq(understandingConnections.sourceId, id));
      if (connRows.length > 0) {
        const targetIds = connRows.map((r) => r.targetId);
        const targetRows = await this.db
          .select()
          .from(understandings)
          .where(and(inArray(understandings.id, targetIds), isNull(understandings.deletedAt)));
        detail.references = await toUnderstandingSummaries(this.db, targetRows);
      } else {
        detail.references = [];
      }
    }

    if (options?.includeReferencedBys) {
      const refRows = await this.db
        .select()
        .from(understandingConnections)
        .where(eq(understandingConnections.targetId, id));
      if (refRows.length > 0) {
        const sourceIds = refRows.map((r) => r.sourceId);
        const sourceRows = await this.db
          .select()
          .from(understandings)
          .where(and(inArray(understandings.id, sourceIds), isNull(understandings.deletedAt)));
        detail.referencedBys = await toUnderstandingSummaries(this.db, sourceRows);
      } else {
        detail.referencedBys = [];
      }
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
}
