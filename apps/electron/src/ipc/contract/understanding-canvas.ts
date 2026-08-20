/** understandingCanvas 域契约（Round C）。
 *  CanvasElementDTO 用扁平 Struct（非判别联合）承载元素：kind 为字面量联合、
 *  props 统一可选 text/label/color。这样 Schema 的 DecodingServices 天然为 never，
 *  无需 noCtx 收敛，handler 入参类型保持具体，规避判别联合触发 DecodingServices/unknown 问题。
 *  持存/往返功能等价；UI 侧仍用 @reflecta/server 的真判别类型做呈现。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class CanvasError extends S.TaggedError<CanvasError>()("CanvasError", {
  reason: S.String,
  code: S.Number,
}) {}

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));

export const CanvasElementKind = lit("understanding", "text", "group", "canvas_ref");
export const ElementProps = S.Struct({
  text: S.optional(S.String),
  label: S.optional(S.String),
  color: S.optional(S.String),
});

export const CanvasElementDTO = S.Struct({
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
  kind: CanvasElementKind,
  understandingId: S.NullOr(S.String),
  canvasRefId: S.NullOr(S.String),
  props: ElementProps,
});
export type CanvasElementDTO = S.Schema.Type<typeof CanvasElementDTO>;

export const EdgeStyle = S.Struct({
  routing: S.optional(lit("straight", "curve", "orthogonal")),
  lineStyle: S.optional(lit("solid", "dashed", "dotted")),
  color: S.optional(S.String),
  width: S.optional(lit("thin", "medium", "thick")),
  arrowhead: S.optional(lit("arrow", "block", "none")),
});
export type EdgeStyle = S.Schema.Type<typeof EdgeStyle>;

export const CanvasEdgeDTO = S.Struct({
  id: S.String,
  canvasId: S.String,
  sourceElementId: S.String,
  targetElementId: S.String,
  label: S.NullOr(S.String),
  style: S.NullOr(EdgeStyle),
  createdAt: S.String,
});
export type CanvasEdgeDTO = S.Schema.Type<typeof CanvasEdgeDTO>;

export const CanvasDTO = S.Struct({
  id: S.String,
  title: S.String,
  description: S.NullOr(S.String),
  viewport: S.NullOr(S.Struct({ x: S.Number, y: S.Number, zoom: S.Number })),
  createdAt: S.String,
  updatedAt: S.String,
});
export type CanvasDTO = S.Schema.Type<typeof CanvasDTO>;

export const CanvasUnderstandingRef = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  deleted: S.Boolean,
});
export const CanvasReferencedCanvas = S.Struct({
  id: S.String,
  title: S.String,
  deleted: S.Boolean,
});

export const CanvasDocument = S.Struct({
  elements: S.Array(CanvasElementDTO),
  edges: S.Array(CanvasEdgeDTO),
});
export type CanvasDocument = S.Schema.Type<typeof CanvasDocument>;

export const CanvasDetailDTO = S.Struct({
  canvas: CanvasDTO,
  elements: S.Array(CanvasElementDTO),
  edges: S.Array(CanvasEdgeDTO),
  understandingRefs: S.Array(CanvasUnderstandingRef),
  referencedCanvases: S.Array(CanvasReferencedCanvas),
});
export type CanvasDetailDTO = S.Schema.Type<typeof CanvasDetailDTO>;

export const Viewport = S.Struct({ x: S.Number, y: S.Number, zoom: S.Number });
export type Viewport = S.Schema.Type<typeof Viewport>;

export const GetCanvasDetailOptions = S.Struct({ includeBodies: S.optional(S.Boolean) });
export const CreateCanvasInput = S.Struct({ title: S.optional(S.String) });
export type CreateCanvasInput = S.Schema.Type<typeof CreateCanvasInput>;
export const UpdateCanvasInput = S.Struct({
  title: S.optional(S.String),
  description: S.optional(S.NullOr(S.String)),
  viewport: S.optional(S.NullOr(Viewport)),
});
export type UpdateCanvasInput = S.Schema.Type<typeof UpdateCanvasInput>;

export const CanvasList = rpc(
  "understandingCanvas.listCanvases",
  S.Struct({}),
  S.Array(CanvasDTO),
  CanvasError,
);
export const CanvasListByUnderstanding = rpc(
  "understandingCanvas.listCanvasesByUnderstanding",
  S.Struct({ understandingId: S.String }),
  S.Array(CanvasDTO),
  CanvasError,
);
export const CanvasGet = rpc(
  "understandingCanvas.getCanvas",
  S.Struct({ id: S.String }),
  S.NullOr(CanvasDetailDTO),
  CanvasError,
);
export const CanvasCreate = rpc(
  "understandingCanvas.createCanvas",
  S.Struct({ input: S.optional(CreateCanvasInput) }),
  CanvasDTO,
  CanvasError,
);
export const CanvasUpdate = rpc(
  "understandingCanvas.updateCanvas",
  S.Struct({ id: S.String, input: UpdateCanvasInput }),
  S.NullOr(CanvasDTO),
  CanvasError,
);
export const CanvasDelete = rpc(
  "understandingCanvas.deleteCanvas",
  S.Struct({ id: S.String }),
  S.Void,
  CanvasError,
);
export const CanvasUpdateViewport = rpc(
  "understandingCanvas.updateViewport",
  S.Struct({ canvasId: S.String, viewport: Viewport }),
  S.Void,
  CanvasError,
);
export const CanvasSave = rpc(
  "understandingCanvas.saveCanvas",
  S.Struct({ canvasId: S.String, document: CanvasDocument }),
  S.Void,
  CanvasError,
);
