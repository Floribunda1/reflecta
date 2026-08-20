/** understanding 域契约（迁移批 Round C）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import { ContextDTO } from "./context";

export class UnderstandingError extends S.TaggedError<UnderstandingError>()("UnderstandingError", {
  reason: S.String,
  code: S.Number,
}) {}

export const UnderstandingSummaryDTO = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  domainIds: S.Array(S.String),
  contextCount: S.Number,
  mentionCount: S.Number,
  mentionIds: S.Array(S.String),
  createdAt: S.String,
  updatedAt: S.String,
});
export type UnderstandingSummaryDTO = S.Schema.Type<typeof UnderstandingSummaryDTO>;

export const UnderstandingDTO = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  domainIds: S.Array(S.String),
  contexts: S.Array(ContextDTO),
  mentions: S.Array(UnderstandingSummaryDTO),
  referencedBy: S.Array(UnderstandingSummaryDTO),
  createdAt: S.String,
  updatedAt: S.String,
});
export type UnderstandingDTO = S.Schema.Type<typeof UnderstandingDTO>;

export const CreateUnderstandingInput = S.Struct({
  title: S.optional(S.String),
  body: S.optional(S.String),
  domainIds: S.optional(S.Array(S.String)),
});
export type CreateUnderstandingInput = S.Schema.Type<typeof CreateUnderstandingInput>;

export const UpdateUnderstandingInput = S.Struct({
  title: S.optional(S.NullOr(S.String)),
  body: S.optional(S.String),
  domainIds: S.optional(S.Array(S.String)),
});
export type UpdateUnderstandingInput = S.Schema.Type<typeof UpdateUnderstandingInput>;

export const ListUnderstandingsFilter = S.Struct({
  domainIds: S.optional(S.Array(S.String)),
  includeDescendants: S.optional(S.Boolean),
  searchQuery: S.optional(S.String),
  limit: S.optional(S.Number),
  offset: S.optional(S.Number),
});
export type ListUnderstandingsFilter = S.Schema.Type<typeof ListUnderstandingsFilter>;

export const UnderstandingList = rpc(
  "understanding.listUnderstandings",
  S.Struct({ filter: S.optional(ListUnderstandingsFilter) }),
  S.Array(UnderstandingSummaryDTO),
  UnderstandingError,
);
export const UnderstandingGetById = rpc(
  "understanding.getUnderstandingById",
  S.Struct({ id: S.String }),
  S.NullOr(UnderstandingDTO),
  UnderstandingError,
);
export const UnderstandingCreate = rpc(
  "understanding.createUnderstanding",
  S.Struct({ input: CreateUnderstandingInput }),
  UnderstandingDTO,
  UnderstandingError,
);
export const UnderstandingUpdate = rpc(
  "understanding.updateUnderstanding",
  S.Struct({ id: S.String, input: UpdateUnderstandingInput }),
  UnderstandingDTO,
  UnderstandingError,
);
export const UnderstandingDelete = rpc(
  "understanding.deleteUnderstanding",
  S.Struct({ id: S.String }),
  S.Void,
  UnderstandingError,
);
export const UnderstandingRestore = rpc(
  "understanding.restoreUnderstanding",
  S.Struct({ id: S.String }),
  S.Void,
  UnderstandingError,
);
export const UnderstandingPermanentlyDelete = rpc(
  "understanding.permanentlyDeleteUnderstanding",
  S.Struct({ id: S.String }),
  S.Void,
  UnderstandingError,
);
