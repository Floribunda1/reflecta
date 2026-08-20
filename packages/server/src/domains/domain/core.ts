import { Effect } from "effect";
import * as S from "effect/Schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  contexts,
  domains,
  understandingDomains,
  understandingMentions,
  understandings,
} from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { CreateDomainInput, ReorderDomainItem, UpdateDomainInput } from "./types";
import type { DomainInspectResult, InspectDomainOptions } from "./types";
import { createEntityId } from "../shared/id";
import { makePageInfo } from "../shared/types";
import type { RetrievalIndexUpdateSink } from "../shared/types";
import { toUnderstandingSummaries } from "../understanding/core";
import type { UnderstandingNode } from "../understanding/types";
import type { ContextDetail, ContextMedium } from "../context/types";

export class DomainNotFoundError extends S.TaggedError<DomainNotFoundError>()(
  "DomainNotFoundError",
  { id: S.String },
) {}
export class InvalidParentError extends S.TaggedError<InvalidParentError>()("InvalidParentError", {
  message: S.String,
}) {}
export class DuplicateReorderItemError extends S.TaggedError<DuplicateReorderItemError>()(
  "DuplicateReorderItemError",
  { id: S.String },
) {}
export class InvalidSortOrderError extends S.TaggedError<InvalidSortOrderError>()(
  "InvalidSortOrderError",
  { sortOrder: S.Number },
) {}

export type DomainError =
  | DomainNotFoundError
  | InvalidParentError
  | DuplicateReorderItemError
  | InvalidSortOrderError;

export const getDomainDescendants = Effect.fn("getDomainDescendants")(
  (db: ReflectaDb, domainId: string): Effect.Effect<string[]> =>
    Effect.promise(async () => {
      const result = await db.all<{ id: string }>(sql`
        WITH RECURSIVE descendants(id) AS (
          SELECT id FROM domains WHERE parent_id = ${domainId}
          UNION ALL
          SELECT c.id FROM domains c
          INNER JOIN descendants d ON c.parent_id = d.id
        )
        SELECT id FROM descendants
      `);
      return result.map((r) => r.id);
    }),
);

export class DomainCore {
  constructor(
    protected db: ReflectaDb,
    private readonly retrievalIndex?: RetrievalIndexUpdateSink,
  ) {}

  listDomainRows(): Effect.Effect<Array<typeof domains.$inferSelect>> {
    return Effect.promise(() => this.db.select().from(domains).orderBy(domains.sortOrder));
  }

  getDomainRow(id: string): Effect.Effect<typeof domains.$inferSelect | null> {
    return Effect.promise(async () => {
      const rows = await this.db.select().from(domains).where(eq(domains.id, id)).limit(1);
      return rows[0] ?? null;
    });
  }

  createDomain(input: CreateDomainInput): Effect.Effect<typeof domains.$inferSelect, DomainError> {
    const db = this.db;
    const assertValidParent = this.assertValidParent.bind(this);
    return Effect.gen(function* () {
      const createdAt = new Date().toISOString();
      const parentId = input.parentId ?? null;
      yield* assertValidParent(undefined, parentId);

      const maxOrderResult = yield* Effect.promise(() =>
        db
          .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
          .from(domains)
          .where(parentId ? eq(domains.parentId, parentId) : sql`parent_id IS NULL`),
      );
      const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

      const rows = yield* Effect.promise(() =>
        db
          .insert(domains)
          .values({
            id: createEntityId(),
            name: input.name,
            parentId,
            sortOrder: nextOrder,
            createdAt,
            updatedAt: createdAt,
          })
          .returning(),
      );
      return rows[0];
    });
  }

  updateDomain(
    id: string,
    input: UpdateDomainInput,
  ): Effect.Effect<typeof domains.$inferSelect, DomainError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    const listUnderstandingIdsForDomain = this.listUnderstandingIdsForDomain.bind(this);
    const assertValidParent = this.assertValidParent.bind(this);
    return Effect.gen(function* () {
      const affectedUnderstandingIds =
        input.name === undefined ? [] : yield* listUnderstandingIdsForDomain(id);
      if (input.parentId !== undefined) {
        yield* assertValidParent(id, input.parentId);
      }

      const updates: Partial<typeof domains.$inferInsert> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) updates.name = input.name;
      if (input.parentId !== undefined) updates.parentId = input.parentId;

      const rows = yield* Effect.promise(() =>
        db.update(domains).set(updates).where(eq(domains.id, id)).returning(),
      );
      if (rows.length === 0) return yield* Effect.fail(new DomainNotFoundError({ id }));
      retrievalIndex?.enqueue(affectedUnderstandingIds);
      return rows[0];
    });
  }

  deleteDomain(id: string, deleteUnderstandings = false): Effect.Effect<void, DomainError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    const getDomainRow = this.getDomainRow.bind(this);
    const listUnderstandingIdsForDomain = this.listUnderstandingIdsForDomain.bind(this);
    return Effect.gen(function* () {
      const domain = yield* getDomainRow(id);
      if (!domain) return yield* Effect.fail(new DomainNotFoundError({ id }));
      const affectedUnderstandingIds = yield* listUnderstandingIdsForDomain(id);
      yield* Effect.promise(async () => {
        await db.transaction((tx) => {
          if (deleteUnderstandings) {
            const rows = tx
              .select({ understandingId: understandingDomains.understandingId })
              .from(understandingDomains)
              .where(eq(understandingDomains.domainId, id))
              .all();
            const understandingIds = rows.map((r) => r.understandingId);
            if (understandingIds.length > 0) {
              tx.delete(understandings).where(inArray(understandings.id, understandingIds)).run();
            }
          }
          tx.delete(domains).where(eq(domains.id, id)).run();
        });
      });
      retrievalIndex?.enqueue(affectedUnderstandingIds);
    });
  }

  reorderDomains(items: ReorderDomainItem[]): Effect.Effect<void, DomainError> {
    const db = this.db;
    const getDomainRow = this.getDomainRow.bind(this);
    const assertValidParent = this.assertValidParent.bind(this);
    return Effect.gen(function* () {
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item.id)) {
          return yield* Effect.fail(new DuplicateReorderItemError({ id: item.id }));
        }
        seen.add(item.id);
        if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
          return yield* Effect.fail(new InvalidSortOrderError({ sortOrder: item.sortOrder }));
        }
        if (!(yield* getDomainRow(item.id))) {
          return yield* Effect.fail(new DomainNotFoundError({ id: item.id }));
        }
        yield* assertValidParent(item.id, item.parentId);
      }

      const updatedAt = new Date().toISOString();
      yield* Effect.promise(async () => {
        await db.transaction((tx) => {
          for (const item of items) {
            tx.update(domains)
              .set({
                parentId: item.parentId,
                sortOrder: item.sortOrder,
                updatedAt,
              })
              .where(eq(domains.id, item.id))
              .run();
          }
        });
      });
    });
  }

  private assertValidParent(
    id: string | undefined,
    parentId: string | null,
  ): Effect.Effect<void, DomainError> {
    const db = this.db;
    const getDomainRow = this.getDomainRow.bind(this);
    return Effect.gen(function* () {
      if (parentId === null) return;
      if (parentId === id) {
        return yield* Effect.fail(
          new InvalidParentError({ message: "Domain cannot be its own parent" }),
        );
      }
      if (!(yield* getDomainRow(parentId))) {
        return yield* Effect.fail(new DomainNotFoundError({ id: parentId }));
      }
      if (!id) return;
      const descendants = yield* getDomainDescendants(db, id);
      if (descendants.includes(parentId)) {
        return yield* Effect.fail(
          new InvalidParentError({ message: "Domain cannot be moved under its descendant" }),
        );
      }
    });
  }

  private listUnderstandingIdsForDomain(domainId: string): Effect.Effect<string[]> {
    return Effect.promise(async () => {
      const rows = await this.db
        .select({ understandingId: understandingDomains.understandingId })
        .from(understandingDomains)
        .where(eq(understandingDomains.domainId, domainId));
      return rows.map((row) => row.understandingId);
    });
  }
}

/**
 * 查看领域及其下辖理解/上下文/关系（CLI inspect 的 Effect 程序；门面只跑 runPromise）。
 * 页面大小取 limit+1 判定 hasMore，同原 bff-cli 行为。
 */
export const inspectDomainProgram = Effect.fn("inspectDomainProgram")(function* (
  db: ReflectaDb,
  id: string,
  options?: InspectDomainOptions,
): Effect.fn.Return<DomainInspectResult, DomainError> {
  const domainRows = yield* Effect.promise(() =>
    db.select().from(domains).where(eq(domains.id, id)).limit(1),
  );
  const domain = domainRows[0] ?? null;
  if (!domain) return yield* Effect.fail(new DomainNotFoundError({ id }));

  const descendantIds = yield* getDomainDescendants(db, id);
  const descendantIdSet = new Set(descendantIds);
  const allDomainRows = yield* Effect.promise(() =>
    db.select().from(domains).orderBy(domains.sortOrder),
  );
  const descendantDomains = allDomainRows.filter((row) => descendantIdSet.has(row.id));
  const targetCatIds = [id, ...descendantIds];

  const limit = options?.limit ?? 200;
  const offset = options?.offset ?? 0;

  const understandingRows = yield* Effect.promise(() =>
    db
      .select()
      .from(understandings)
      .where(
        and(
          isNull(understandings.deletedAt),
          inArray(
            understandings.id,
            db
              .select({ id: understandingDomains.understandingId })
              .from(understandingDomains)
              .where(inArray(understandingDomains.domainId, targetCatIds)),
          ),
        ),
      )
      .orderBy(desc(understandings.updatedAt))
      .limit(limit + 1)
      .offset(offset),
  );

  const hasMore = understandingRows.length > limit;
  const paginatedRows = understandingRows.slice(0, limit);
  const understandingIds = paginatedRows.map((row) => row.id);

  const summaries = yield* toUnderstandingSummaries(db, paginatedRows);
  const nodeUnderstandings: UnderstandingNode[] = summaries.map((summary) => ({
    ...summary,
  }));

  let resultContexts: ContextDetail[] | undefined;
  let resultEdges: { from: string; to: string }[] | undefined;

  if (options?.includeContexts) {
    const ctxRows = yield* Effect.promise(() =>
      db
        .select()
        .from(contexts)
        .where(
          and(inArray(contexts.understandingId, understandingIds), isNull(contexts.deletedAt)),
        ),
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
    resultContexts = ctxRows.map((row) => ({
      id: row.id,
      understandingId: row.understandingId,
      medium: row.medium as ContextMedium,
      title: row.title ?? null,
      content: row.content,
    }));
  }

  if (options?.includeEdges) {
    const [outRows, inRows] = yield* Effect.all([
      Effect.promise(() =>
        db
          .select()
          .from(understandingMentions)
          .where(inArray(understandingMentions.sourceId, understandingIds)),
      ),
      Effect.promise(() =>
        db
          .select()
          .from(understandingMentions)
          .where(inArray(understandingMentions.targetId, understandingIds)),
      ),
    ]);

    const edgeSet = new Set<string>();
    resultEdges = [];
    for (const row of outRows) {
      const key = `${row.sourceId}->${row.targetId}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        resultEdges.push({ from: row.sourceId, to: row.targetId });
      }
    }
    for (const row of inRows) {
      const key = `${row.sourceId}->${row.targetId}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        resultEdges.push({ from: row.sourceId, to: row.targetId });
      }
    }
  }

  return {
    domain: { id: domain.id, name: domain.name, parentId: domain.parentId },
    domains: descendantDomains.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parentId,
    })),
    understandings: nodeUnderstandings,
    contexts: resultContexts,
    edges: resultEdges,
    page: makePageInfo(limit, offset, hasMore),
  };
});

export const resolveDomainRefs = Effect.fn("resolveDomainRefs")(
  (
    db: ReflectaDb,
    understandingIds: string[],
  ): Effect.Effect<Map<string, { id: string; name: string; parentId: string | null }[]>> =>
    Effect.promise(async () => {
      if (understandingIds.length === 0) return new Map();

      const tcRows = await db
        .select()
        .from(understandingDomains)
        .where(inArray(understandingDomains.understandingId, understandingIds));

      const domainIds = [...new Set(tcRows.map((tc) => tc.domainId))];
      const catRows =
        domainIds.length > 0
          ? await db.select().from(domains).where(inArray(domains.id, domainIds))
          : [];
      const catMap = new Map(catRows.map((c) => [c.id, c]));

      const result = new Map<string, { id: string; name: string; parentId: string | null }[]>();
      for (const tc of tcRows) {
        const cat = catMap.get(tc.domainId);
        if (!cat) continue;
        const refs = result.get(tc.understandingId) ?? [];
        refs.push({ id: cat.id, name: cat.name, parentId: cat.parentId });
        result.set(tc.understandingId, refs);
      }
      return result;
    }),
);
