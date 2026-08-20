import { Effect } from "effect";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
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
import { UnderstandingCore, UnderstandingNotFoundError, type UnderstandingError } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class UnderstandingElectronBff extends UnderstandingCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb(), options.retrievalIndex);
  }

  assembleUnderstandingSummaryDTOs(
    understandingRows: Array<typeof understandings.$inferSelect>,
  ): Effect.Effect<UnderstandingSummaryDTO[]> {
    const db = this.db;
    return Effect.gen(function* () {
      if (understandingRows.length === 0) return [];
      const ids = understandingRows.map((t) => t.id);

      const [tcRows, ctxCountRows, mentionRows] = yield* Effect.all([
        Effect.promise(() =>
          db
            .select()
            .from(understandingDomains)
            .where(inArray(understandingDomains.understandingId, ids)),
        ),
        Effect.promise(() =>
          db
            .select({ understandingId: contexts.understandingId, count: count() })
            .from(contexts)
            .where(and(inArray(contexts.understandingId, ids), isNull(contexts.deletedAt)))
            .groupBy(contexts.understandingId),
        ),
        Effect.promise(() =>
          db
            .select()
            .from(understandingMentions)
            .where(inArray(understandingMentions.sourceId, ids)),
        ),
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
    });
  }

  listUnderstandings(
    filter?: ListUnderstandingsFilter,
  ): Effect.Effect<UnderstandingSummaryDTO[], UnderstandingError> {
    const listUnderstandingRows = this.listUnderstandingRows.bind(this);
    const assemble = this.assembleUnderstandingSummaryDTOs.bind(this);
    return Effect.gen(function* () {
      let understandingRows = yield* listUnderstandingRows({
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

      return yield* assemble(understandingRows);
    });
  }

  getUnderstandingById(id: string): Effect.Effect<UnderstandingDTO | null, UnderstandingError> {
    const db = this.db;
    const getUnderstandingRow = this.getUnderstandingRow.bind(this);
    const assemble = this.assembleUnderstandingSummaryDTOs.bind(this);
    return Effect.gen(function* () {
      const row = yield* getUnderstandingRow(id);
      if (!row) return null;

      const [tcRows, ctxRows, mentionRows, refRows] = yield* Effect.all([
        Effect.promise(() =>
          db
            .select()
            .from(understandingDomains)
            .where(eq(understandingDomains.understandingId, id)),
        ),
        Effect.promise(() =>
          db
            .select()
            .from(contexts)
            .where(and(eq(contexts.understandingId, id), isNull(contexts.deletedAt))),
        ),
        Effect.promise(() =>
          db.select().from(understandingMentions).where(eq(understandingMentions.sourceId, id)),
        ),
        Effect.promise(() =>
          db.select().from(understandingMentions).where(eq(understandingMentions.targetId, id)),
        ),
      ]);

      const mentionIds = mentionRows.map((r) => r.targetId);
      const mentions =
        mentionIds.length > 0
          ? yield* assemble(
              yield* Effect.promise(() =>
                db.select().from(understandings).where(inArray(understandings.id, mentionIds)),
              ),
            )
          : [];

      const referencedByIds = refRows.map((r) => r.sourceId);
      const referencedBy =
        referencedByIds.length > 0
          ? yield* assemble(
              yield* Effect.promise(() =>
                db.select().from(understandings).where(inArray(understandings.id, referencedByIds)),
              ),
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
    });
  }

  createUnderstanding(
    input: CreateUnderstandingInput,
  ): Effect.Effect<UnderstandingDTO, UnderstandingError> {
    const _createUnderstanding = this._createUnderstanding.bind(this);
    const getUnderstandingById = this.getUnderstandingById.bind(this);
    return Effect.gen(function* () {
      const row = yield* _createUnderstanding(input);
      const dto = yield* getUnderstandingById(row.id);
      if (!dto) return yield* Effect.fail(new UnderstandingNotFoundError({ id: row.id }));
      return dto;
    });
  }

  updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Effect.Effect<UnderstandingDTO, UnderstandingError> {
    const _updateUnderstanding = this._updateUnderstanding.bind(this);
    const getUnderstandingById = this.getUnderstandingById.bind(this);
    return Effect.gen(function* () {
      const row = yield* _updateUnderstanding(id, input);
      const dto = yield* getUnderstandingById(row.id);
      if (!dto) return yield* Effect.fail(new UnderstandingNotFoundError({ id: row.id }));
      return dto;
    });
  }

  listRecentUnderstandings(limit = 20): Effect.Effect<UnderstandingSummaryDTO[]> {
    const listRecentUnderstandingRows = this.listRecentUnderstandingRows.bind(this);
    const assemble = this.assembleUnderstandingSummaryDTOs.bind(this);
    return Effect.gen(function* () {
      const rows = yield* listRecentUnderstandingRows(limit);
      return yield* assemble(rows);
    });
  }
}
