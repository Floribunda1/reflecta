/** understandingCanvas 域契约。schema 单一真源在 @reflecta/shared；
 *  这里做 noCtx 包裹（保留判别联合类型）与 rpc 面，类型为 schema 派生（与解码一致）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import {
  CanvasElementDTOSchema,
  CanvasEdgeDTOSchema,
  CanvasDTOSchema,
  CanvasDetailDTOSchema,
  CanvasDocumentSchema,
  CanvasViewportSchema,
  GetCanvasDetailOptionsSchema,
  CreateCanvasInputSchema,
  UpdateCanvasInputSchema,
  CanvasUnderstandingRefSchema,
  CanvasReferencedCanvasSchema,
} from "@reflecta/shared";

type NoCtx<A> = S.Codec<A, unknown, never, never>;
const noCtx = <A>(schema: S.Schema<A>): NoCtx<A> => schema as unknown as NoCtx<A>;

export class CanvasError extends S.TaggedError<CanvasError>()("CanvasError", {
  reason: S.String,
  code: S.Number,
}) {}

export const CanvasElementDTO = CanvasElementDTOSchema;
export type CanvasElementDTO = S.Schema.Type<typeof CanvasElementDTOSchema>;
export const CanvasEdgeDTO = CanvasEdgeDTOSchema;
export type CanvasEdgeDTO = S.Schema.Type<typeof CanvasEdgeDTOSchema>;
export const CanvasDTO = CanvasDTOSchema;
export type CanvasDTO = S.Schema.Type<typeof CanvasDTOSchema>;
export const CanvasUnderstandingRef = CanvasUnderstandingRefSchema;
export const CanvasReferencedCanvas = CanvasReferencedCanvasSchema;
export const CanvasDocument = noCtx(CanvasDocumentSchema);
export type CanvasDocument = S.Schema.Type<typeof CanvasDocumentSchema>;
export const CanvasDetailDTO = noCtx(CanvasDetailDTOSchema);
export type CanvasDetailDTO = S.Schema.Type<typeof CanvasDetailDTOSchema>;
export const Viewport = CanvasViewportSchema;
export type Viewport = S.Schema.Type<typeof CanvasViewportSchema>;
export const GetCanvasDetailOptions = GetCanvasDetailOptionsSchema;
export const CreateCanvasInput = CreateCanvasInputSchema;
export type CreateCanvasInput = S.Schema.Type<typeof CreateCanvasInputSchema>;
export const UpdateCanvasInput = UpdateCanvasInputSchema;
export type UpdateCanvasInput = S.Schema.Type<typeof UpdateCanvasInputSchema>;

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
