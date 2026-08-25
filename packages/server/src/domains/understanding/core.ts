import { Effect } from "effect";
import * as S from "effect/Schema";
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  domains,
  contexts,
  understandingDomains,
  understandingMentions,
  understandings,
} from "../../db/schema";
import { collectEntityReferences, normalizeEntityReferenceEscapes } from "@reflecta/shared";
import { getDomainDescendants } from "../domain/core";
import type { ReflectaDb } from "../../db/types";
import type { UnderstandingSummary } from "./types";
import type {
  CreateUnderstandingInput,
  ListUnderstandingsFilter,
  UpdateUnderstandingInput,
} from "@reflecta/shared";
import { resolveDomainRefs } from "../domain/core";
import type { RetrievalIndexUpdateSink } from "../shared/types";
import { createEntityId } from "@reflecta/shared";

export class UnderstandingNotFoundError extends S.TaggedError<UnderstandingNotFoundError>()(
  "UnderstandingNotFoundError",
  { id: S.String },
) {}
export class UnderstandingDomainNotFoundError extends S.TaggedError<UnderstandingDomainNotFoundError>()(
  "UnderstandingDomainNotFoundError",
  { domainId: S.String },
) {}

export type UnderstandingError = UnderstandingNotFoundError | UnderstandingDomainNotFoundError;

export const getUnderstandingMentionCounts = Effect.fn("getUnderstandingMentionCounts")(function* (
  db: ReflectaDb,
  understandingId: string,
): Effect.fn.Return<{ contextCount: number; referenceCount: number; referencedByCount: number }> {
  const [ctxCountRes, refCountRes, refByCountRes] = yield* Effect.all([
    Effect.promise(() =>
      db
        .select({ count: count() })
        .from(contexts)
        .where(and(eq(contexts.understandingId, understandingId), isNull(contexts.deletedAt))),
    ),
    Effect.promise(() =>
      db
        .select({ count: count() })
        .from(understandingMentions)
        .where(eq(understandingMentions.sourceId, understandingId)),
    ),
    Effect.promise(() =>
      db
        .select({ count: count() })
        .from(understandingMentions)
        .where(eq(understandingMentions.targetId, understandingId)),
    ),
  ]);

  return {
    contextCount: ctxCountRes[0]?.count ?? 0,
    referenceCount: refCountRes[0]?.count ?? 0,
    referencedByCount: refByCountRes[0]?.count ?? 0,
  };
});

export class UnderstandingCore {
  constructor(
    protected db: ReflectaDb,
    private readonly retrievalIndex?: RetrievalIndexUpdateSink,
  ) {}

  listUnderstandingRows(
    filter?: ListUnderstandingsFilter & { limit?: number; offset?: number },
  ): Effect.Effect<Array<typeof understandings.$inferSelect>> {
    const db = this.db;
    return Effect.gen(function* () {
      const conditions = [isNull(understandings.deletedAt)];

      if (filter?.domainIds && filter.domainIds.length > 0) {
        const domainIds = filter.domainIds;
        let catIds = domainIds;
        if (filter?.includeDescendants) {
          const allDescendants: string[] = [];
          for (const catId of domainIds) {
            const descendants = yield* getDomainDescendants(db, catId);
            allDescendants.push(...descendants);
          }
          catIds = [...new Set([...catIds, ...allDescendants])];
        }
        conditions.push(
          inArray(
            understandings.id,
            db
              .select({ id: understandingDomains.understandingId })
              .from(understandingDomains)
              .where(inArray(understandingDomains.domainId, catIds)),
          ),
        );
      }

      let query = db
        .select()
        .from(understandings)
        .where(and(...conditions))
        .orderBy(desc(understandings.updatedAt))
        .$dynamic();

      if (filter?.limit !== undefined) {
        query = query.limit(filter.limit);
      }
      if (filter?.offset !== undefined) {
        query = query.offset(filter.offset);
      }

      return yield* Effect.promise(() => query);
    });
  }

  listRecentUnderstandingRows(
    limit = 20,
  ): Effect.Effect<Array<typeof understandings.$inferSelect>> {
    return Effect.promise(() =>
      this.db
        .select()
        .from(understandings)
        .where(isNull(understandings.deletedAt))
        .orderBy(desc(understandings.updatedAt))
        .limit(limit),
    );
  }

  getUnderstandingRow(id: string): Effect.Effect<typeof understandings.$inferSelect | null> {
    const db = this.db;
    return Effect.promise(async () => {
      const rows = await db
        .select()
        .from(understandings)
        .where(and(eq(understandings.id, id), isNull(understandings.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  _createUnderstanding(
    input: CreateUnderstandingInput,
  ): Effect.Effect<typeof understandings.$inferSelect, UnderstandingError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    const getUnderstandingRow = this.getUnderstandingRow.bind(this);
    const assertDomainIdsExist = this.assertDomainIdsExist.bind(this);
    const syncWikiLinkMentions = this.syncWikiLinkMentions.bind(this);
    return Effect.gen(function* () {
      const createdAt = new Date().toISOString();
      const id = createEntityId();
      const body = normalizeEntityReferenceEscapes(input.body) ?? "";
      yield* assertDomainIdsExist(input.domainIds);

      yield* Effect.sync(() => {
        db.transaction((tx) => {
          tx.insert(understandings)
            .values({
              id,
              title: input.title ?? null,
              body,
              createdAt,
              updatedAt: createdAt,
            })
            .run();

          if (input.domainIds && input.domainIds.length > 0) {
            tx.insert(understandingDomains)
              .values(
                input.domainIds.map((catId) => ({
                  understandingId: id,
                  domainId: catId,
                })),
              )
              .run();
          }
        });
      });

      yield* syncWikiLinkMentions(id, body);

      const row = yield* getUnderstandingRow(id);
      if (!row) return yield* Effect.fail(new UnderstandingNotFoundError({ id }));
      retrievalIndex?.enqueue([id]);
      return row;
    });
  }

  _updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Effect.Effect<typeof understandings.$inferSelect, UnderstandingError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    const assertDomainIdsExist = this.assertDomainIdsExist.bind(this);
    const getUnderstandingRow = this.getUnderstandingRow.bind(this);
    const syncWikiLinkMentions = this.syncWikiLinkMentions.bind(this);
    return Effect.gen(function* () {
      const updates: Partial<typeof understandings.$inferInsert> = {
        updatedAt: new Date().toISOString(),
      };
      const normalizedBody = normalizeEntityReferenceEscapes(input.body);
      yield* assertDomainIdsExist(input.domainIds);
      if (normalizedBody !== undefined) updates.body = normalizedBody;
      if (input.title !== undefined) updates.title = input.title;

      const rows: Array<typeof understandings.$inferSelect> = yield* Effect.sync(() =>
        db.transaction((tx) => {
          const result = tx
            .update(understandings)
            .set(updates)
            .where(eq(understandings.id, id))
            .returning()
            .all();

          if (input.domainIds !== undefined) {
            tx.delete(understandingDomains)
              .where(eq(understandingDomains.understandingId, id))
              .run();
            if (input.domainIds.length > 0) {
              tx.insert(understandingDomains)
                .values(
                  input.domainIds.map((catId) => ({
                    understandingId: id,
                    domainId: catId,
                  })),
                )
                .run();
            }
          }
          return result;
        }),
      );
      if (rows.length === 0) return yield* Effect.fail(new UnderstandingNotFoundError({ id }));

      if (normalizedBody !== undefined) {
        yield* syncWikiLinkMentions(id, normalizedBody);
      }

      const row = yield* getUnderstandingRow(id);
      if (!row) return yield* Effect.fail(new UnderstandingNotFoundError({ id }));
      retrievalIndex?.enqueue([id]);
      return row;
    });
  }

  deleteUnderstanding(id: string): Effect.Effect<void, UnderstandingError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    return Effect.gen(function* () {
      const rows: Array<typeof understandings.$inferSelect> = yield* Effect.sync(() =>
        db.transaction((tx) =>
          tx
            .update(understandings)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(understandings.id, id))
            .returning()
            .all(),
        ),
      );
      if (rows.length === 0) return yield* Effect.fail(new UnderstandingNotFoundError({ id }));
      retrievalIndex?.enqueue([id]);
    });
  }

  restoreUnderstanding(id: string): Effect.Effect<void> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    return Effect.gen(function* () {
      let restored = false;
      yield* Effect.sync(() => {
        db.transaction((tx) => {
          const rows = tx
            .update(understandings)
            .set({ deletedAt: null })
            .where(and(eq(understandings.id, id), isNotNull(understandings.deletedAt)))
            .returning()
            .all();
          if (rows.length > 0) restored = true;
        });
      });
      if (restored) retrievalIndex?.enqueue([id]);
    });
  }

  permanentlyDeleteUnderstanding(id: string): Effect.Effect<void> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    return Effect.gen(function* () {
      yield* Effect.sync(() => {
        db.transaction((tx) => {
          tx.delete(understandings).where(eq(understandings.id, id)).run();
        });
      });
      retrievalIndex?.enqueue([id]);
    });
  }

  syncWikiLinkMentions(sourceId: string, body: string): Effect.Effect<void> {
    const db = this.db;
    return Effect.sync(() => {
      const linkTargets = collectEntityReferences(body)
        .filter((reference) => reference.type === "understanding")
        .map((reference) => reference.id);

      db.transaction((tx) => {
        tx.delete(understandingMentions).where(eq(understandingMentions.sourceId, sourceId)).run();

        if (linkTargets.length === 0) return;

        const rows = tx
          .select()
          .from(understandings)
          .where(and(isNull(understandings.deletedAt), inArray(understandings.id, linkTargets)))
          .orderBy(desc(understandings.updatedAt))
          .all();

        const targetIds = new Set<string>();
        for (const target of linkTargets) {
          const row = rows.find((candidate) => candidate.id === target);
          if (row && row.id !== sourceId) targetIds.add(row.id);
        }

        if (targetIds.size === 0) return;
        tx.insert(understandingMentions)
          .values([...targetIds].map((targetId) => ({ sourceId, targetId })))
          .onConflictDoNothing()
          .run();
      });
    });
  }

  private assertDomainIdsExist(
    domainIds: string[] | undefined,
  ): Effect.Effect<void, UnderstandingError> {
    const db = this.db;
    return Effect.gen(function* () {
      if (!domainIds?.length) return;
      const uniqueIds = [...new Set(domainIds)];
      const rows = yield* Effect.promise(() =>
        db.select({ id: domains.id }).from(domains).where(inArray(domains.id, uniqueIds)),
      );
      if (rows.length === uniqueIds.length) return;
      const found = new Set(rows.map((row) => row.id));
      const missing = uniqueIds.find((domainId) => !found.has(domainId));
      return yield* Effect.fail(
        new UnderstandingDomainNotFoundError({ domainId: missing ?? uniqueIds[0] }),
      );
    });
  }
}

export const toUnderstandingSummaries = Effect.fn("toUnderstandingSummaries")(function* (
  db: ReflectaDb,
  rows: Array<typeof understandings.$inferSelect>,
): Effect.fn.Return<UnderstandingSummary[]> {
  const ids = rows.map((r) => r.id);
  const catRefs = yield* resolveDomainRefs(db, ids);
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? null,
    body: row.body,
    domains: catRefs.get(row.id) ?? [],
  }));
});
