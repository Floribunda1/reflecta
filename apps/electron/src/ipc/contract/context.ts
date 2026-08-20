/** context 域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class ContextListError extends S.TaggedError<ContextListError>()("ContextListError", {
  reason: S.String,
  code: S.Number,
}) {}

export const ContextDTO = S.Struct({
  id: S.String,
  understandingId: S.String,
  medium: S.String,
  title: S.NullOr(S.String),
  content: S.String,
  createdAt: S.String,
  deletedAt: S.NullOr(S.String),
});
export type ContextDTO = S.Schema.Type<typeof ContextDTO>;

export const CreateContextInput = S.Struct({
  understandingId: S.String,
  medium: S.String,
  title: S.optional(S.String),
  content: S.String,
});
export type CreateContextInput = S.Schema.Type<typeof CreateContextInput>;

export const UpdateContextInput = S.Struct({
  understandingId: S.optional(S.String),
  medium: S.optional(S.String),
  title: S.optional(S.String),
  content: S.optional(S.String),
});
export type UpdateContextInput = S.Schema.Type<typeof UpdateContextInput>;

export const TrashedContextDTO = S.Struct({
  id: S.String,
  understandingId: S.String,
  understandingTitle: S.NullOr(S.String),
  medium: S.String,
  title: S.NullOr(S.String),
  content: S.String,
  deletedAt: S.String,
});
export type TrashedContextDTO = S.Schema.Type<typeof TrashedContextDTO>;

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
