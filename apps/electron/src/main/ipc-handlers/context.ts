/** context 域 IPC handlers（业务在 services/core 的 contextService）。 */
import { ContextListError } from "../../ipc";
import { contextService } from "../services/core";
import { toVoid, type HandlerModule } from "./util";

const error = (message: string) => new ContextListError({ reason: message, code: 500 });

export const context: HandlerModule = {
  domain: "context",
  error,
  handlers: {
    "context.listContexts": ({ options }) => contextService.listAllContexts(options),
    "context.listContextsByUnderstanding": ({ understandingId }) =>
      contextService.listContextsByUnderstanding(understandingId),
    "context.getContextById": ({ id }) => contextService.getContextById(id),
    "context.createContext": ({ input }) =>
      contextService.createContext(input as import("@reflecta/shared").CreateContextInput),
    "context.updateContext": ({ id, input }) =>
      contextService.updateContext(id, input as import("@reflecta/shared").UpdateContextInput),
    "context.deleteContext": ({ id }) => contextService.deleteContext(id).pipe(toVoid),
    "context.restoreContext": ({ id }) => contextService.restoreContext(id).pipe(toVoid),
    "context.permanentlyDeleteContext": ({ id }) =>
      contextService.permanentlyDeleteContext(id).pipe(toVoid),
    "context.listTrashedContexts": () => contextService.listTrashedContexts(),
  },
};
