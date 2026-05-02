import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { contexts, thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../electron/types";
import { extractThoughtWikiLinkTargets, normalizeThoughtWikiLinkBody } from "../../wiki-links";
import { getCategoryDescendants, getThoughtConnectionCounts, toThoughtSummaries } from "./shared";
import type {
  CreateThoughtInput,
  GetThoughtOptions,
  ListThoughtsOptions,
  SourceType,
  ThoughtDetail,
  ThoughtSummary,
  UpdateThoughtInput,
} from "./types";

export class ThoughtService {
  constructor(private db: ReflectaDb) {}

  async listThoughts(options?: ListThoughtsOptions): Promise<{
    items: ThoughtSummary[];
    page: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
  }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(thoughts.deletedAt)];

    if (options?.type) {
      conditions.push(eq(thoughts.type, options.type));
    }

    if (options?.categoryId) {
      let catIds = [options.categoryId];
      if (options.includeDescendants) {
        const descendants = await getCategoryDescendants(this.db, options.categoryId);
        catIds = [...catIds, ...descendants];
      }
      conditions.push(
        inArray(
          thoughts.id,
          this.db
            .select({ id: thoughtCategories.thoughtId })
            .from(thoughtCategories)
            .where(inArray(thoughtCategories.categoryId, catIds)),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(thoughts)
      .where(and(...conditions))
      .orderBy(desc(thoughts.updatedAt))
      .limit(limit + 1)
      .offset(offset);

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
    const rows = await this.db
      .select()
      .from(thoughts)
      .where(and(eq(thoughts.id, id), isNull(thoughts.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Thought not found: ${id}`);
    }

    const summary = (await toThoughtSummaries(this.db, [rows[0]]))[0];
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
    const createdAt = new Date().toISOString();
    const id = nanoid();
    const body = normalizeThoughtWikiLinkBody(input.body) ?? "";

    await this.db.transaction(async (tx) => {
      await tx.insert(thoughts).values({
        id,
        type: input.type,
        title: input.title ?? null,
        body,
        createdAt,
        updatedAt: createdAt,
      });

      if (input.categoryIds && input.categoryIds.length > 0) {
        await tx.insert(thoughtCategories).values(
          input.categoryIds.map((catId) => ({
            thoughtId: id,
            categoryId: catId,
          })),
        );
      }

      await tx.run(
        sql`INSERT INTO fts_thoughts (thought_id, title, body) VALUES (${id}, ${input.title ?? ""}, ${body})`,
      );
    });

    await this.syncWikiLinkConnections(id, body);

    return this.getThought(id);
  }

  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDetail> {
    const updates: Partial<typeof thoughts.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.type !== undefined) updates.type = input.type;
    const normalizedBody = normalizeThoughtWikiLinkBody(input.body);
    if (normalizedBody !== undefined) updates.body = normalizedBody;
    if (input.title !== undefined) updates.title = input.title;

    await this.db.transaction(async (tx) => {
      const rows = await tx.update(thoughts).set(updates).where(eq(thoughts.id, id)).returning();
      if (rows.length === 0) {
        throw new Error(`Thought not found: ${id}`);
      }

      if (input.body !== undefined || input.title !== undefined) {
        const row = rows[0];
        await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
        await tx.run(
          sql`INSERT INTO fts_thoughts (thought_id, title, body) VALUES (${id}, ${row.title ?? ""}, ${row.body})`,
        );
      }

      if (input.categoryIds !== undefined) {
        await tx.delete(thoughtCategories).where(eq(thoughtCategories.thoughtId, id));
        if (input.categoryIds.length > 0) {
          await tx.insert(thoughtCategories).values(
            input.categoryIds.map((catId) => ({
              thoughtId: id,
              categoryId: catId,
            })),
          );
        }
      }
    });

    if (normalizedBody !== undefined) {
      await this.syncWikiLinkConnections(id, normalizedBody);
    }

    return this.getThought(id);
  }

  async deleteThought(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(thoughts)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(thoughts.id, id))
        .returning();
      if (rows.length === 0) {
        throw new Error(`Thought not found: ${id}`);
      }
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
    });
  }

  private async syncWikiLinkConnections(sourceId: string, body: string): Promise<void> {
    const linkTargets = extractThoughtWikiLinkTargets(body);

    await this.db.transaction(async (tx) => {
      await tx.delete(thoughtConnections).where(eq(thoughtConnections.sourceId, sourceId));

      if (linkTargets.length === 0) return;

      const rows = await tx
        .select()
        .from(thoughts)
        .where(
          and(
            isNull(thoughts.deletedAt),
            or(inArray(thoughts.id, linkTargets), inArray(thoughts.title, linkTargets)),
          ),
        )
        .orderBy(desc(thoughts.updatedAt));

      const targetIds = new Set<string>();
      for (const target of linkTargets) {
        const row = rows.find((t) => t.id === target) ?? rows.find((t) => t.title === target);
        if (row && row.id !== sourceId) targetIds.add(row.id);
      }

      if (targetIds.size === 0) return;
      await tx
        .insert(thoughtConnections)
        .values([...targetIds].map((targetId) => ({ sourceId, targetId })))
        .onConflictDoNothing();
    });
  }
}
