/** trash 域 IPC handlers（restore/permanentlyDelete 走 understandingService / understandingCanvasService，成功归一为 void）。 */
import { TrashListError } from "../../ipc";
import { trashService, understandingCanvasService, understandingService } from "../services/core";
import { toVoid, type HandlerModule } from "./util";

const error = (message: string) => new TrashListError({ reason: message, code: 500 });

export const trash: HandlerModule = {
  domain: "trash",
  error,
  handlers: {
    "trash.listTrashedUnderstandings": () => trashService.listTrashedUnderstandings(),
    "trash.restoreUnderstanding": ({ id }) =>
      understandingService.restoreUnderstanding(id).pipe(toVoid),
    "trash.permanentlyDeleteUnderstanding": ({ id }) =>
      understandingService.permanentlyDeleteUnderstanding(id).pipe(toVoid),
    "trash.listTrashedCanvases": () => understandingCanvasService.listTrashedCanvases(),
    "trash.restoreCanvas": ({ id }) => understandingCanvasService.restoreCanvas(id).pipe(toVoid),
    "trash.permanentlyDeleteCanvas": ({ id }) =>
      understandingCanvasService.permanentlyDeleteCanvas(id).pipe(toVoid),
  },
};
