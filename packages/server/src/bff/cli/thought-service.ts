import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  createThought as coreCreateThought,
  deleteThought as coreDeleteThought,
  getThoughtRow,
  listThoughtRows,
  updateThought as coreUpdateThought,
} from "../core/thought-core";
import { contexts, thoughtConnections, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type {
  CreateThoughtInput,
  GetThoughtOptions,
  ListThoughtsOptions,
  SourceType,
  ThoughtDetail,
  ThoughtSummary,
  UpdateThoughtInput,
} from "./types";
import { getThoughtConnectionCounts } from "../core/shared";
import { toThoughtSummaries } from "./shared";

export class ThoughtService {
  constructor(private db: ReflectaDb) {}

  async listThoughts(options?: ListThoughtsOptions): Promise<{
    items: ThoughtSummary[];
    page: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
  }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const rows = await listThoughtRows(this.db, {
      type: options?.type,
      categoryId: options?.categoryId,
      includeDescendants: options?.includeDescendants,
      limit: limit + 1,
      offset,
    });

    const hasMore = rows.length > limit;
    const items = await toThoughtSummaries(this.db, rows.slice(0, limit));

    return {
      items,
      page: {
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
    };
  }

  async getThought(id: string, options?: GetThoughtOptions): Promise<ThoughtDetail> {
    const row = await getThoughtRow(this.db, id);
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
    const row = await coreCreateThought(this.db, input);
    return this.getThought(row.id);
  }

  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDetail> {
    const row = await coreUpdateThought(this.db, id, input);
    return this.getThought(row.id);
  }

  async deleteThought(id: string): Promise<void> {
    await coreDeleteThought(this.db, id);
  }
}
