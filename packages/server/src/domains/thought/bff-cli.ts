import { and, eq, inArray, isNull } from "drizzle-orm";
import { ThoughtCore } from "./core";
import { contexts, thoughtConnections, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { SourceType } from "../context/types";
import type {
  CreateThoughtInput,
  GetThoughtOptions,
  ThoughtDetail,
  ThoughtSummary,
  UpdateThoughtInput,
} from "./types";
import type { ListThoughtsFilter } from "./types";
import { getThoughtConnectionCounts } from "./core";
import { toThoughtSummaries } from "./core";

export class ThoughtCliBff extends ThoughtCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async listThoughts(filter?: ListThoughtsFilter): Promise<ThoughtSummary[]> {
    const rows = await this.listThoughtRows({
      type: filter?.type,
      categoryIds: filter?.categoryIds,
      includeDescendants: filter?.includeDescendants,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return toThoughtSummaries(this.db, rows);
  }

  async getThought(id: string, options?: GetThoughtOptions): Promise<ThoughtDetail> {
    const row = await this.getThoughtRow(id);
    if (!row) {
      throw new Error(`Thought not found: ${id}`);
    }

    const summary = (await toThoughtSummaries(this.db, [row]))[0];
    const counts = await getThoughtConnectionCounts(this.db, id);

    const detail: ThoughtDetail = {
      ...summary,
      contextCount: counts.contextCount,
      referenceCount: counts.referenceCount,
      referencedByCount: counts.referencedByCount,
    };

    if (options?.includeContexts) {
      const ctxRows = await this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.thoughtId, id), isNull(contexts.deletedAt)));
      detail.contexts = ctxRows.map((r) => ({
        id: r.id,
        thoughtId: r.thoughtId,
        sourceType: r.sourceType as SourceType,
        sourceName: r.sourceName ?? null,
        content: r.content,
      }));
    }

    if (options?.includeReferences) {
      const connRows = await this.db
        .select()
        .from(thoughtConnections)
        .where(eq(thoughtConnections.sourceId, id));
      if (connRows.length > 0) {
        const targetIds = connRows.map((r) => r.targetId);
        const targetRows = await this.db
          .select()
          .from(thoughts)
          .where(and(inArray(thoughts.id, targetIds), isNull(thoughts.deletedAt)));
        detail.references = await toThoughtSummaries(this.db, targetRows);
      } else {
        detail.references = [];
      }
    }

    if (options?.includeReferencedBys) {
      const refRows = await this.db
        .select()
        .from(thoughtConnections)
        .where(eq(thoughtConnections.targetId, id));
      if (refRows.length > 0) {
        const sourceIds = refRows.map((r) => r.sourceId);
        const sourceRows = await this.db
          .select()
          .from(thoughts)
          .where(and(inArray(thoughts.id, sourceIds), isNull(thoughts.deletedAt)));
        detail.referencedBys = await toThoughtSummaries(this.db, sourceRows);
      } else {
        detail.referencedBys = [];
      }
    }

    return detail;
  }

  async createThought(input: CreateThoughtInput): Promise<ThoughtDetail> {
    const row = await super._createThought(input);
    return this.getThought(row.id);
  }

  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDetail> {
    const row = await super._updateThought(id, input);
    return this.getThought(row.id);
  }

  async listRecentThoughts(limit = 20): Promise<ThoughtSummary[]> {
    const rows = await this.listRecentThoughtRows(limit);
    return toThoughtSummaries(this.db, rows);
  }
}
