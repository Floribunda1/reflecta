/** context 域契约。DTO schema 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import {
  ContextDTO,
  CreateContextInput,
  UpdateContextInput,
  TrashedContextDTO,
  SearchOptions,
} from "@reflecta/shared";

export class ContextListError extends S.TaggedError<ContextListError>()("ContextListError", {
  reason: S.String,
  code: S.Number,
}) {}

export const ContextListByUnderstanding = Rpc.make("context.listContextsByUnderstanding", {
  payload: S.Struct({ understandingId: S.String }),
  success: S.Array(ContextDTO),
  error: ContextListError,
});
export const ContextList = Rpc.make("context.listContexts", {
  payload: S.Struct({ options: S.optional(SearchOptions) }),
  success: S.Array(ContextDTO),
  error: ContextListError,
});
export const ContextGetById = Rpc.make("context.getContextById", {
  payload: S.Struct({ id: S.String }),
  success: S.NullOr(ContextDTO),
  error: ContextListError,
});
export const ContextCreate = Rpc.make("context.createContext", {
  payload: S.Struct({ input: CreateContextInput }),
  success: ContextDTO,
  error: ContextListError,
});
export const ContextUpdate = Rpc.make("context.updateContext", {
  payload: S.Struct({ id: S.String, input: UpdateContextInput }),
  success: ContextDTO,
  error: ContextListError,
});
export const ContextDelete = Rpc.make("context.deleteContext", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: ContextListError,
});
export const ContextRestore = Rpc.make("context.restoreContext", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: ContextListError,
});
export const ContextPermanentlyDelete = Rpc.make("context.permanentlyDeleteContext", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: ContextListError,
});
export const ContextListTrashed = Rpc.make("context.listTrashedContexts", {
  payload: S.Struct({}),
  success: S.Array(TrashedContextDTO),
  error: ContextListError,
});
// ipc 内部（index 装配）仍需这些类型/schema，从 shared 再导出（定义单一真源）。
export {
  ContextDTO,
  CreateContextInput,
  UpdateContextInput,
  TrashedContextDTO,
} from "@reflecta/shared";
