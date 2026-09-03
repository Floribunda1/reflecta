/**
 * 画布 wire format 的运行时 Effect Schema（供 IPC 解码）。
 *
 * 规范类型（可变语义、UI/domain 用）在 `./document`；这里只提供运行时 schema，
 * 常量以 `Schema` 后缀避免与类型重名冲突。detail DTO（CanvasDTO / refs / 输入等）
 * 无规范类型于别处，类型由此派生。
 */
import * as S from "effect/Schema";

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));

const ElementBase = {
  id: S.String,
  canvasId: S.String,
  parentId: S.NullOr(S.String),
  x: S.Number,
  y: S.Number,
  width: S.Number,
  height: S.Number,
  zIndex: S.Number,
  createdAt: S.String,
  updatedAt: S.String,
};

/** kind 判别联合：kind 收窄引用字段与 props。 */
export const CanvasElementDTOSchema = S.Union([
  S.Struct({
    ...ElementBase,
    kind: S.Literal("understanding"),
    understandingId: S.NullOr(S.String),
    canvasRefId: S.Null,
    props: S.Struct({ color: S.optional(S.String) }),
  }),
  S.Struct({
    ...ElementBase,
    kind: S.Literal("text"),
    understandingId: S.Null,
    canvasRefId: S.Null,
    props: S.Struct({ text: S.String, color: S.optional(S.String) }),
  }),
  S.Struct({
    ...ElementBase,
    kind: S.Literal("group"),
    understandingId: S.Null,
    canvasRefId: S.Null,
    props: S.Struct({ label: S.String, color: S.optional(S.String) }),
  }),
  S.Struct({
    ...ElementBase,
    kind: S.Literal("canvas_ref"),
    understandingId: S.Null,
    canvasRefId: S.NullOr(S.String),
    props: S.Struct({ color: S.optional(S.String) }),
  }),
]);

const CanvasEdgePortIdSchema = lit("top", "right", "bottom", "left");
const CanvasEdgeTerminalSchema = S.Struct({ cell: S.String, port: CanvasEdgePortIdSchema });
const CanvasEdgeRouterSchema = S.Struct({
  name: lit(
    "normal",
    "orth",
    "oneSide",
    "manhattan",
    "metro",
    "er",
    "reflecta-curve",
    "reflecta-right-angle",
  ),
  args: S.optional(S.Record(S.String, S.Unknown)),
});
const CanvasEdgeConnectorSchema = S.Struct({
  name: lit("normal", "smooth", "rounded", "jumpover", "reflecta-curve"),
  args: S.optional(S.Record(S.String, S.Unknown)),
});

export const CanvasEdgeDTOSchema = S.Struct({
  id: S.String,
  canvasId: S.String,
  source: CanvasEdgeTerminalSchema,
  target: CanvasEdgeTerminalSchema,
  router: S.NullOr(CanvasEdgeRouterSchema),
  connector: CanvasEdgeConnectorSchema,
  attrs: S.Record(S.String, S.Record(S.String, S.Unknown)),
  label: S.NullOr(S.String),
  createdAt: S.String,
});

export const CanvasDocumentSchema = S.Struct({
  elements: S.Array(CanvasElementDTOSchema),
  edges: S.Array(CanvasEdgeDTOSchema),
});

export const CanvasViewportSchema = S.Struct({ x: S.Number, y: S.Number, zoom: S.Number });

export const CanvasDTOSchema = S.Struct({
  id: S.String,
  title: S.String,
  viewport: S.NullOr(CanvasViewportSchema),
  createdAt: S.String,
  updatedAt: S.String,
});

export const CanvasUnderstandingRefSchema = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  deleted: S.Boolean,
});

export const CanvasReferencedCanvasSchema = S.Struct({
  id: S.String,
  title: S.String,
  deleted: S.Boolean,
});

export const CanvasDetailDTOSchema = S.Struct({
  canvas: CanvasDTOSchema,
  elements: S.Array(CanvasElementDTOSchema),
  edges: S.Array(CanvasEdgeDTOSchema),
  understandingRefs: S.Array(CanvasUnderstandingRefSchema),
  referencedCanvases: S.Array(CanvasReferencedCanvasSchema),
});

export const GetCanvasDetailOptionsSchema = S.Struct({ includeBodies: S.optional(S.Boolean) });

export const CreateCanvasInputSchema = S.Struct({ title: S.optional(S.String) });

export const UpdateCanvasInputSchema = S.Struct({
  title: S.optional(S.String),
  viewport: S.optional(S.NullOr(CanvasViewportSchema)),
});
