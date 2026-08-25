/** understanding 域 IPC handlers（业务在 services/core 的 understandingService）。 */
import { UnderstandingError } from "../../ipc";
import { understandingService } from "../services/core";
import { toVoid, type HandlerModule } from "./util";

const error = (message: string) => new UnderstandingError({ reason: message, code: 500 });

export const understanding: HandlerModule = {
  domain: "understanding",
  error,
  handlers: {
    "understanding.listUnderstandings": ({ filter }) =>
      understandingService.listUnderstandings(
        filter as import("@reflecta/shared").ListUnderstandingsFilter | undefined,
      ),
    "understanding.getUnderstandingById": ({ id }) => understandingService.getUnderstandingById(id),
    "understanding.createUnderstanding": ({ input }) =>
      understandingService.createUnderstanding(
        input as unknown as import("@reflecta/shared").CreateUnderstandingInput,
      ),
    "understanding.updateUnderstanding": ({ id, input }) =>
      understandingService.updateUnderstanding(
        id,
        input as unknown as import("@reflecta/shared").UpdateUnderstandingInput,
      ),
    "understanding.deleteUnderstanding": ({ id }) =>
      understandingService.deleteUnderstanding(id).pipe(toVoid),
    "understanding.restoreUnderstanding": ({ id }) =>
      understandingService.restoreUnderstanding(id).pipe(toVoid),
    "understanding.permanentlyDeleteUnderstanding": ({ id }) =>
      understandingService.permanentlyDeleteUnderstanding(id).pipe(toVoid),
  },
};
