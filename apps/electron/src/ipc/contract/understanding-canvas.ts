/** understandingCanvas 域契约（Round C，真判别联合版）。
 *  CanvasElementDTO 保留 kind 判别联合（kind 收窄 understandingId/canvasRefId/props），
 *  不因 electron-effect-rpc 的 SchemaNoContext 约束而放宽类型。
 *  解法：noCtx<A> 只把服务类型(R)钉成 never（使 DecodingServices=never、满足 SchemaNoContext），
 *  但保留 A（解码值类型=真联合），输入侧 unknown。这样运行时仍校验 kind/props 合法性。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

type NoCtx<A> = S.Codec<A, unknown, never, never>;
const noCtx = <A>(schema: S.Schema<A>): NoCtx<A> => schema as unknown as NoCtx<A>;

export class CanvasError extends S.TaggedError<CanvasError>()("CanvasError", {
  reason: S.String,
  code: S.Number,
}) {}

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

/** kind 判别联合：kind 收窄引用字段与 props（真类型安全，AI/开发可见）。 */
export const CanvasElementDTO = S.Union([
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
export type CanvasElementDTO = S.Schema.Type<typeof CanvasElementDTO>;

const CanvasEdgePortId = lit("top", "right", "bottom", "left");
const CanvasEdgeTerminal = S.Struct({ cell: S.String, port: CanvasEdgePortId });
const CanvasEdgeRouter = S.Struct({
  name: lit("normal", "orth", "oneSide", "manhattan", "metro", "er", "reflecta-curve"),
  args: S.optional(S.Record(S.String, S.Unknown)),
});
const CanvasEdgeConnector = S.Struct({
  name: lit("normal", "smooth", "rounded", "jumpover", "reflecta-curve"),
  args: S.optional(S.Record(S.String, S.Unknown)),
});

export const CanvasEdgeDTO = S.Struct({
  id: S.String,
  canvasId: S.String,
  source: CanvasEdgeTerminal,
  target: CanvasEdgeTerminal,
  router: S.NullOr(CanvasEdgeRouter),
  connector: CanvasEdgeConnector,
  attrs: S.Record(S.String, S.Record(S.String, S.Unknown)),
  label: S.NullOr(S.String),
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

/** 含判别联合的复合（decode 服务类型 unknown）→ noCtx<A>：保留 A、R=never。 */
export const CanvasDocument = noCtx(
  S.Struct({ elements: S.Array(CanvasElementDTO), edges: S.Array(CanvasEdgeDTO) }),
);
export type CanvasDocument = S.Schema.Type<typeof CanvasDocument>;

export const CanvasDetailDTO = noCtx(
  S.Struct({
    canvas: CanvasDTO,
    elements: S.Array(CanvasElementDTO),
    edges: S.Array(CanvasEdgeDTO),
    understandingRefs: S.Array(CanvasUnderstandingRef),
    referencedCanvases: S.Array(CanvasReferencedCanvas),
  }),
);
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
  noCtx(S.NullOr(CanvasDetailDTO)),
  CanvasError,
);
export const CanvasListByIds = rpc(
  "understandingCanvas.listCanvasesByIds",
  S.Struct({ ids: S.Array(S.String) }),
  S.Array(CanvasDetailDTO),
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
  noCtx(S.Struct({ canvasId: S.String, document: CanvasDocument })),
  S.Void,
  CanvasError,
);
