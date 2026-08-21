/** understandingCanvas 域 IPC handlers（业务在 services/core 的 understandingCanvasService）。 */
import { CanvasError } from "../../ipc";
import { understandingCanvasService } from "../services/core";
import { toVoid, type HandlerModule } from "./util";

const error = (message: string) => new CanvasError({ reason: message, code: 500 });

export const understandingCanvas: HandlerModule = {
  domain: "understandingCanvas",
  error,
  handlers: {
    "understandingCanvas.listCanvases": () => understandingCanvasService.listCanvases(),
    "understandingCanvas.listCanvasesByUnderstanding": ({ understandingId }) =>
      understandingCanvasService.listCanvasesByUnderstanding(understandingId),
    "understandingCanvas.getCanvas": ({ id }) =>
      understandingCanvasService.getCanvasDetail(id, { includeBodies: true }),
    "understandingCanvas.createCanvas": ({ input }) =>
      understandingCanvasService.createCanvas(
        input as import("@reflecta/server").CreateCanvasInput | undefined,
      ),
    "understandingCanvas.updateCanvas": ({ id, input }) =>
      understandingCanvasService.updateCanvas(
        id,
        input as import("@reflecta/server").UpdateCanvasInput,
      ),
    "understandingCanvas.deleteCanvas": ({ id }) =>
      understandingCanvasService.deleteCanvas(id).pipe(toVoid),
    "understandingCanvas.updateViewport": ({ canvasId, viewport }) =>
      understandingCanvasService
        .updateViewport(canvasId, viewport as import("@reflecta/server").Viewport)
        .pipe(toVoid),
    "understandingCanvas.saveCanvas": ({ canvasId, document }) =>
      understandingCanvasService.saveCanvas(
        canvasId,
        document as import("@reflecta/server").CanvasDocument,
      ),
  },
};
