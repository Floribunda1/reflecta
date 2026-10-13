/** understandingCanvas 域契约。schema 单一真源在 @reflecta/shared；
 *  这里做 noCtx 包裹（保留判别联合类型）与 rpc 面，类型为 schema 派生（与解码一致）。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
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

export const CanvasList = Rpc.make("understandingCanvas.listCanvases", {
  payload: S.Struct({}),
  success: S.Array(CanvasDTO),
  error: CanvasError,
});
export const CanvasListByUnderstanding = Rpc.make(
  "understandingCanvas.listCanvasesByUnderstanding",
  {
    payload: S.Struct({ understandingId: S.String }),
    success: S.Array(CanvasDTO),
    error: CanvasError,
  },
);
export const CanvasGet = Rpc.make("understandingCanvas.getCanvas", {
  payload: S.Struct({ id: S.String }),
  success: noCtx(S.NullOr(CanvasDetailDTO)),
  error: CanvasError,
});
export const CanvasListByIds = Rpc.make("understandingCanvas.listCanvasesByIds", {
  payload: S.Struct({ ids: S.Array(S.String) }),
  success: S.Array(S.NullOr(CanvasDetailDTO)),
  error: CanvasError,
});
export const CanvasCreate = Rpc.make("understandingCanvas.createCanvas", {
  payload: S.Struct({ input: S.optional(CreateCanvasInput) }),
  success: CanvasDTO,
  error: CanvasError,
});
export const CanvasUpdate = Rpc.make("understandingCanvas.updateCanvas", {
  payload: S.Struct({ id: S.String, input: UpdateCanvasInput }),
  success: S.NullOr(CanvasDTO),
  error: CanvasError,
});
export const CanvasDelete = Rpc.make("understandingCanvas.deleteCanvas", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: CanvasError,
});
export const CanvasUpdateViewport = Rpc.make("understandingCanvas.updateViewport", {
  payload: S.Struct({ canvasId: S.String, viewport: Viewport }),
  success: S.Void,
  error: CanvasError,
});
export const CanvasSave = Rpc.make("understandingCanvas.saveCanvas", {
  payload: noCtx(S.Struct({ canvasId: S.String, document: CanvasDocument })),
  success: S.Void,
  error: CanvasError,
});
