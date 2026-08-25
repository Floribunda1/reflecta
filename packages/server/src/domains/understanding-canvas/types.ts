import type { InferSelectModel } from "drizzle-orm";
import type {
  understandingCanvases,
  understandingCanvasEdges,
  understandingCanvasElements,
} from "../../db/schema";
import type { CanvasDTO } from "@reflecta/shared";

export type UnderstandingCanvas = InferSelectModel<typeof understandingCanvases>;
export type UnderstandingCanvasElement = InferSelectModel<typeof understandingCanvasElements>;
export type UnderstandingCanvasEdge = InferSelectModel<typeof understandingCanvasEdges>;

// wire format（单一真源在 @reflecta/shared）
export type {
  CanvasDTO,
  CanvasDetailDTO,
  CanvasUnderstandingRef,
  CanvasReferencedCanvas,
  CreateCanvasInput,
  UpdateCanvasInput,
  GetCanvasDetailOptions,
} from "@reflecta/shared";

export type CanvasHit = {
  canvas: CanvasDTO;
  snippet: string;
  reason: string;
};

export type SearchCanvasesInput = {
  query?: string;
  understandingId?: string;
  limit?: number;
};

export type ListCanvasesFilter = {
  titleSearchKeyword?: string;
  limit?: number;
};
