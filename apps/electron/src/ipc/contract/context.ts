/** context 域契约。DTO schema 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import {
  ContextDTO,
  CreateContextInput,
  UpdateContextInput,
  TrashedContextDTO,
} from "@reflecta/shared";

export class ContextListError extends S.TaggedError<ContextListError>()("ContextListError", {
  reason: S.String,
  code: S.Number,
}) {}

export const ContextListByUnderstanding = rpc(
  "context.listContextsByUnderstanding",
  S.Struct({ understandingId: S.String }),
  S.Array(ContextDTO),
  ContextListError,
);
export const ContextGetById = rpc(
  "context.getContextById",
  S.Struct({ id: S.String }),
  S.NullOr(ContextDTO),
  ContextListError,
);
export const ContextCreate = rpc(
  "context.createContext",
  S.Struct({ input: CreateContextInput }),
  ContextDTO,
  ContextListError,
);
export const ContextUpdate = rpc(
  "context.updateContext",
  S.Struct({ id: S.String, input: UpdateContextInput }),
  ContextDTO,
  ContextListError,
);
export const ContextDelete = rpc(
  "context.deleteContext",
  S.Struct({ id: S.String }),
  S.Void,
  ContextListError,
);
export const ContextRestore = rpc(
  "context.restoreContext",
  S.Struct({ id: S.String }),
  S.Void,
  ContextListError,
);
export const ContextPermanentlyDelete = rpc(
  "context.permanentlyDeleteContext",
  S.Struct({ id: S.String }),
  S.Void,
  ContextListError,
);
export const ContextListTrashed = rpc(
  "context.listTrashedContexts",
  S.Struct({}),
  S.Array(TrashedContextDTO),
  ContextListError,
);
// ipc 内部（index 装配）仍需这些类型/schema，从 shared 再导出（定义单一真源）。
export {
  ContextDTO,
  CreateContextInput,
  UpdateContextInput,
  TrashedContextDTO,
} from "@reflecta/shared";
