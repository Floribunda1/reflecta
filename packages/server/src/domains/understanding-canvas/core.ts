import { Effect } from "effect";
import * as S from "effect/Schema";
import { and, desc, eq, inArray, isNotNull, like } from "drizzle-orm";
import {
  understandings,
  understandingCanvases,
  understandingCanvasEdges,
  understandingCanvasElements,
} from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { createEntityId } from "../shared/id";
import type {
  CanvasDetailDTO,
  CanvasDocument,
  CanvasDTO,
  CanvasElementDTO,
  CanvasEdgeDTO,
  CanvasHit,
  CanvasReferencedCanvas,
  CanvasUnderstandingRef,
  CreateCanvasInput,
  EdgeStyle,
  GetCanvasDetailOptions,
  ListCanvasesFilter,
  SearchCanvasesInput,
  UpdateCanvasInput,
  UnderstandingCanvasEdge,
  UnderstandingCanvasElement,
  Viewport,
} from "./types";
import {
  assertUnderstandingRefsExist,
  assertValidDocument,
  CanvasValidationError,
} from "./validate";

export class CanvasServiceError extends S.TaggedError<CanvasServiceError>()("CanvasServiceError", {
  message: S.String,
}) {}

const now = () => new Date().toISOString();

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function elementRowToDTO(row: UnderstandingCanvasElement): CanvasElementDTO {
  const base = {
    id: row.id,
    canvasId: row.canvasId,
    parentId: row.parentId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  switch (row.kind) {
    case "understanding":
      return {
        ...base,
        kind: "understanding",
        understandingId: row.understandingId,
        canvasRefId: null,
        props: parseJson(row.props, {}),
      };
    case "text":
      return {
        ...base,
        kind: "text",
        understandingId: null,
        canvasRefId: null,
        props: parseJson(row.props, { text: "" }),
      };
    case "group":
      return {
        ...base,
        kind: "group",
        understandingId: null,
        canvasRefId: null,
        props: parseJson(row.props, { label: "" }),
      };
    case "canvas_ref":
      return {
        ...base,
        kind: "canvas_ref",
        understandingId: null,
        canvasRefId: row.canvasRefId,
        props: parseJson(row.props, {}),
      };
    default:
      throw new Error(`Unknown element kind: ${String(row.kind)}`);
  }
}

export function edgeRowToDTO(row: UnderstandingCanvasEdge): CanvasEdgeDTO {
  return {
    id: row.id,
    canvasId: row.canvasId,
    sourceElementId: row.sourceElementId,
    targetElementId: row.targetElementId,
    label: row.label,
    style: parseJson<EdgeStyle | null>(row.props, null),
    createdAt: row.createdAt,
  };
}

export function canvasRowToDTO(row: typeof understandingCanvases.$inferSelect): CanvasDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    viewport: parseJson<Viewport | null>(row.viewport, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class CanvasCore {
  constructor(protected db: ReflectaDb) {}

  createCanvas(input?: CreateCanvasInput): Effect.Effect<CanvasDTO> {
    return Effect.promise(async () => {
      const timestamp = now();
      const id = createEntityId();
      const row = {
        id,
        title: input?.title?.trim() || "未命名画布",
        description: null,
        viewport: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.db.insert(understandingCanvases).values(row).run();
      return canvasRowToDTO(row);
    });
  }

  protected getCanvasRow(
    canvasId: string,
  ): Effect.Effect<typeof understandingCanvases.$inferSelect | null> {
    return Effect.promise(async () => {
      const rows = await this.db
        .select()
        .from(understandingCanvases)
        .where(eq(understandingCanvases.id, canvasId))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  getCanvas(id: string): Effect.Effect<CanvasDTO | null> {
    const getCanvasRow = this.getCanvasRow.bind(this);
    return Effect.gen(function* () {
      const row = yield* getCanvasRow(id);
      return row ? canvasRowToDTO(row) : null;
    });
  }

  updateCanvas(id: string, input: UpdateCanvasInput): Effect.Effect<CanvasDTO | null> {
    const getCanvasRow = this.getCanvasRow.bind(this);
    const db = this.db;
    return Effect.gen(function* () {
      const row = yield* getCanvasRow(id);
      if (!row) return null;
      const updates: Record<string, unknown> = { updatedAt: now() };
      if (input.title !== undefined) updates.title = input.title.trim() || "未命名画布";
      yield* Effect.sync(() => {
        db.update(understandingCanvases).set(updates).where(eq(understandingCanvases.id, id)).run();
      });
      const updated = yield* getCanvasRow(id);
      return updated ? canvasRowToDTO(updated) : null;
    });
  }

  updateViewport(id: string, viewport: Viewport): Effect.Effect<void> {
    return Effect.sync(() => {
      this.db
        .update(understandingCanvases)
        .set({ viewport: JSON.stringify(viewport), updatedAt: now() })
        .where(eq(understandingCanvases.id, id))
        .run();
    });
  }

  deleteCanvas(id: string): Effect.Effect<void> {
    return Effect.sync(() => {
      this.db.delete(understandingCanvases).where(eq(understandingCanvases.id, id)).run();
    });
  }

  listCanvases(filter?: ListCanvasesFilter): Effect.Effect<CanvasDTO[]> {
    return Effect.promise(async () => {
      const conditions = [];
      if (filter?.titleSearchKeyword) {
        conditions.push(like(understandingCanvases.title, `%${filter.titleSearchKeyword}%`));
      }
      const baseQuery = this.db
        .select()
        .from(understandingCanvases)
        .orderBy(desc(understandingCanvases.updatedAt));
      const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
      const rows = await (filter?.limit ? query.limit(filter.limit) : query);
      return rows.map(canvasRowToDTO);
    });
  }

  getCanvasDetail(
    id: string,
    options?: GetCanvasDetailOptions,
  ): Effect.Effect<CanvasDetailDTO | null> {
    const getCanvasRow = this.getCanvasRow.bind(this);
    const db = this.db;
    const loadUnderstandingRefs = this.loadUnderstandingRefs.bind(this);
    const loadReferencedCanvases = this.loadReferencedCanvases.bind(this);
    return Effect.gen(function* () {
      const canvasRow = yield* getCanvasRow(id);
      if (!canvasRow) return null;

      const elementRows = yield* Effect.promise(() =>
        db
          .select()
          .from(understandingCanvasElements)
          .where(eq(understandingCanvasElements.canvasId, id)),
      );
      const edgeRows = yield* Effect.promise(() =>
        db.select().from(understandingCanvasEdges).where(eq(understandingCanvasEdges.canvasId, id)),
      );
      const understandingRefs = yield* loadUnderstandingRefs(id, options?.includeBodies);
      const referencedCanvases = yield* loadReferencedCanvases(id);

      return {
        canvas: canvasRowToDTO(canvasRow),
        elements: elementRows.map(elementRowToDTO),
        edges: edgeRows.map(edgeRowToDTO),
        understandingRefs,
        referencedCanvases,
      };
    });
  }

  private loadUnderstandingRefs(
    canvasId: string,
    includeBodies = false,
  ): Effect.Effect<CanvasUnderstandingRef[]> {
    return Effect.promise(async () => {
      const refRows = await this.db
        .select()
        .from(understandingCanvasElements)
        .where(
          and(
            eq(understandingCanvasElements.canvasId, canvasId),
            isNotNull(understandingCanvasElements.understandingId),
          ),
        );
      const ids = [...new Set(refRows.map((row) => row.understandingId as string))];
      if (ids.length === 0) return [];

      const rows = await this.db
        .select()
        .from(understandings)
        .where(inArray(understandings.id, ids));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids
        .map((id) => {
          const row = byId.get(id);
          if (!row) return null;
          return {
            id: row.id,
            title: row.title,
            body: includeBodies ? row.body : "",
            deleted: Boolean(row.deletedAt),
          };
        })
        .filter((ref): ref is CanvasUnderstandingRef => ref !== null);
    });
  }

  searchCanvases(input: SearchCanvasesInput): Effect.Effect<CanvasHit[]> {
    const db = this.db;
    const listCanvasesByUnderstanding = this.listCanvasesByUnderstanding.bind(this);
    const getCanvasDetail = this.getCanvasDetail.bind(this);
    return Effect.gen(function* () {
      const limit = input.limit ?? 20;

      if (input.understandingId) {
        const understandingRows = yield* Effect.promise(() =>
          db
            .select({ id: understandings.id, title: understandings.title })
            .from(understandings)
            .where(eq(understandings.id, input.understandingId as string))
            .limit(1),
        );
        const title = understandingRows[0]?.title ?? (input.understandingId as string);
        const canvases = yield* listCanvasesByUnderstanding(input.understandingId as string);
        return canvases.slice(0, limit).map((canvas) => ({
          canvas,
          snippet: `引用理解「${title}」`,
          reason: `understandingId=${input.understandingId}`,
        }));
      }

      const terms = (input.query ?? "")
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5);
      if (terms.length === 0) return [];

      const canvasRows = yield* Effect.promise(() =>
        db.select().from(understandingCanvases).orderBy(desc(understandingCanvases.updatedAt)),
      );
      const hits: CanvasHit[] = [];

      for (const canvasRow of canvasRows) {
        const detail = yield* getCanvasDetail(canvasRow.id);
        if (!detail) continue;
        const hit = matchCanvasDocument(detail, terms);
        if (hit) {
          hits.push({ canvas: canvasRowToDTO(canvasRow), ...hit });
          if (hits.length >= limit) break;
        }
      }
      return hits;
    });
  }

  private loadReferencedCanvases(canvasId: string): Effect.Effect<CanvasReferencedCanvas[]> {
    return Effect.promise(async () => {
      const refRows = await this.db
        .select()
        .from(understandingCanvasElements)
        .where(
          and(
            eq(understandingCanvasElements.canvasId, canvasId),
            isNotNull(understandingCanvasElements.canvasRefId),
          ),
        );
      const ids = [...new Set(refRows.map((row) => row.canvasRefId as string))];
      if (ids.length === 0) return [];

      const rows = await this.db
        .select()
        .from(understandingCanvases)
        .where(inArray(understandingCanvases.id, ids));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids
        .map((id) => {
          const row = byId.get(id);
          if (!row) return null;
          return { id: row.id, title: row.title, deleted: false };
        })
        .filter((ref): ref is CanvasReferencedCanvas => ref !== null);
    });
  }

  listCanvasesByUnderstanding(understandingId: string): Effect.Effect<CanvasDTO[]> {
    return Effect.promise(async () => {
      const rows = await this.db
        .select({ canvas: understandingCanvases })
        .from(understandingCanvasElements)
        .innerJoin(
          understandingCanvases,
          eq(understandingCanvases.id, understandingCanvasElements.canvasId),
        )
        .where(eq(understandingCanvasElements.understandingId, understandingId))
        .orderBy(desc(understandingCanvases.updatedAt));
      return rows.map((row) => canvasRowToDTO(row.canvas));
    });
  }

  saveCanvas(canvasId: string, document: CanvasDocument): Effect.Effect<void, CanvasServiceError> {
    const getCanvasRow = this.getCanvasRow.bind(this);
    const db = this.db;
    return Effect.gen(function* () {
      // 校验 throw 的 CanvasValidationError → 可恢复的 CanvasError
      try {
        assertValidDocument(document);
      } catch (error) {
        const message = error instanceof CanvasValidationError ? error.message : "画布校验失败";
        return yield* Effect.fail(new CanvasServiceError({ message }));
      }

      const canvas = yield* getCanvasRow(canvasId);
      if (!canvas)
        return yield* Effect.fail(
          new CanvasServiceError({ message: `Canvas not found: ${canvasId}` }),
        );

      const understandingIds = document.elements
        .filter((element) => element.kind === "understanding" && element.understandingId)
        .map((element) => element.understandingId as string);
      const refsResult = yield* Effect.promise(async () => {
        try {
          await assertUnderstandingRefsExist(db, understandingIds);
          return { ok: true as const };
        } catch (error) {
          return {
            ok: false as const,
            message: error instanceof Error ? error.message : "引用的理解不存在",
          };
        }
      });
      if (!refsResult.ok) {
        return yield* Effect.fail(new CanvasServiceError({ message: refsResult.message }));
      }

      const timestamp = now();
      yield* Effect.promise(async () => {
        await db.transaction(async (tx) => {
          const existingElements = await tx
            .select()
            .from(understandingCanvasElements)
            .where(eq(understandingCanvasElements.canvasId, canvasId))
            .all();
          const existingEdges = await tx
            .select()
            .from(understandingCanvasEdges)
            .where(eq(understandingCanvasEdges.canvasId, canvasId))
            .all();

          const existingElementById = new Map(existingElements.map((row) => [row.id, row]));
          const existingEdgeById = new Map(existingEdges.map((row) => [row.id, row]));

          let changed = false;
          if (
            existingElements.length !== document.elements.length ||
            existingEdges.length !== document.edges.length
          ) {
            changed = true;
          } else {
            for (const element of document.elements) {
              const existing = existingElementById.get(element.id);
              if (
                !existing ||
                existing.kind !== element.kind ||
                existing.understandingId !==
                  (element.kind === "understanding" ? element.understandingId : null) ||
                existing.canvasRefId !==
                  (element.kind === "canvas_ref" ? element.canvasRefId : null) ||
                existing.props !== JSON.stringify(element.props) ||
                existing.parentId !== element.parentId ||
                existing.x !== element.x ||
                existing.y !== element.y ||
                existing.width !== element.width ||
                existing.height !== element.height ||
                existing.zIndex !== element.zIndex
              ) {
                changed = true;
                break;
              }
            }
            if (!changed) {
              for (const edge of document.edges) {
                const existing = existingEdgeById.get(edge.id);
                if (
                  !existing ||
                  existing.sourceElementId !== edge.sourceElementId ||
                  existing.targetElementId !== edge.targetElementId ||
                  existing.label !== edge.label ||
                  existing.props !== JSON.stringify(edge.style ?? {})
                ) {
                  changed = true;
                  break;
                }
              }
            }
          }
          if (changed) {
            for (const element of document.elements) {
              const existing = existingElementById.get(element.id);
              const row = {
                canvasId,
                kind: element.kind,
                understandingId: element.kind === "understanding" ? element.understandingId : null,
                canvasRefId: element.kind === "canvas_ref" ? element.canvasRefId : null,
                props: JSON.stringify(element.props),
                parentId: element.parentId,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                zIndex: element.zIndex,
              };
              if (existing) {
                await tx
                  .update(understandingCanvasElements)
                  .set(row)
                  .where(eq(understandingCanvasElements.id, element.id))
                  .run();
              } else {
                await tx
                  .insert(understandingCanvasElements)
                  .values({ id: element.id, ...row, createdAt: timestamp, updatedAt: timestamp })
                  .run();
              }
            }
            const docElementIds = new Set(document.elements.map((element) => element.id));
            for (const row of existingElements) {
              if (!docElementIds.has(row.id)) {
                await tx
                  .delete(understandingCanvasElements)
                  .where(eq(understandingCanvasElements.id, row.id))
                  .run();
              }
            }
            for (const edge of document.edges) {
              const existing = existingEdgeById.get(edge.id);
              const row = {
                canvasId,
                sourceElementId: edge.sourceElementId,
                targetElementId: edge.targetElementId,
                label: edge.label,
                props: JSON.stringify(edge.style ?? {}),
              };
              if (existing) {
                await tx
                  .update(understandingCanvasEdges)
                  .set(row)
                  .where(eq(understandingCanvasEdges.id, edge.id))
                  .run();
              } else {
                await tx
                  .insert(understandingCanvasEdges)
                  .values({ id: edge.id, ...row, createdAt: timestamp })
                  .run();
              }
            }
            const docEdgeIds = new Set(document.edges.map((edge) => edge.id));
            for (const row of existingEdges) {
              if (!docEdgeIds.has(row.id)) {
                await tx
                  .delete(understandingCanvasEdges)
                  .where(eq(understandingCanvasEdges.id, row.id))
                  .run();
              }
            }
            await tx
              .update(understandingCanvases)
              .set({ updatedAt: timestamp })
              .where(eq(understandingCanvases.id, canvasId))
              .run();
          }
        });
      });
    });
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function matchCanvasDocument(
  detail: CanvasDetailDTO,
  terms: string[],
): { snippet: string; reason: string } | null {
  const title = detail.canvas.title.toLocaleLowerCase();
  if (terms.some((term) => title.includes(term))) {
    return { snippet: detail.canvas.title, reason: "画布标题命中" };
  }
  for (const element of detail.elements) {
    if (element.kind === "group" && typeof element.props.label === "string") {
      const label = element.props.label;
      const hit = terms.find((term) => label.toLocaleLowerCase().includes(term));
      if (hit) return { snippet: label, reason: `组「${label}」命中` };
    }
    if (element.kind === "text" && typeof element.props.text === "string") {
      const text = element.props.text;
      const hit = terms.find((term) => text.toLocaleLowerCase().includes(term));
      if (hit) return { snippet: truncate(text, 60), reason: "文本卡命中" };
    }
  }
  for (const edge of detail.edges) {
    if (edge.label) {
      const label = edge.label;
      const hit = terms.find((term) => label.toLocaleLowerCase().includes(term));
      if (hit) return { snippet: label, reason: "连线标签命中" };
    }
  }
  for (const ref of detail.understandingRefs) {
    if (ref.title) {
      const hit = terms.find((term) => ref.title!.toLocaleLowerCase().includes(term));
      if (hit) return { snippet: ref.title, reason: `引用理解「${ref.title}」命中` };
    }
  }
  for (const referenced of detail.referencedCanvases) {
    const hit = terms.find((term) => referenced.title.toLocaleLowerCase().includes(term));
    if (hit) return { snippet: referenced.title, reason: `画布引用「${referenced.title}」命中` };
  }
  return null;
}
