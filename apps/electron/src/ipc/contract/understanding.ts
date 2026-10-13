/** understanding 域契约。DTO schema 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import {
  UnderstandingSummaryDTO,
  UnderstandingDTO,
  CreateUnderstandingInput,
  UpdateUnderstandingInput,
  ListUnderstandingsFilter,
} from "@reflecta/shared";

export class UnderstandingError extends S.TaggedError<UnderstandingError>()("UnderstandingError", {
  reason: S.String,
  code: S.Number,
}) {}

export const UnderstandingList = Rpc.make("understanding.listUnderstandings", {
  payload: S.Struct({ filter: S.optional(ListUnderstandingsFilter) }),
  success: S.Array(UnderstandingSummaryDTO),
  error: UnderstandingError,
});
export const UnderstandingGetById = Rpc.make("understanding.getUnderstandingById", {
  payload: S.Struct({ id: S.String }),
  success: S.NullOr(UnderstandingDTO),
  error: UnderstandingError,
});
export const UnderstandingCreate = Rpc.make("understanding.createUnderstanding", {
  payload: S.Struct({ input: CreateUnderstandingInput }),
  success: UnderstandingDTO,
  error: UnderstandingError,
});
export const UnderstandingUpdate = Rpc.make("understanding.updateUnderstanding", {
  payload: S.Struct({ id: S.String, input: UpdateUnderstandingInput }),
  success: UnderstandingDTO,
  error: UnderstandingError,
});
export const UnderstandingDelete = Rpc.make("understanding.deleteUnderstanding", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: UnderstandingError,
});
export const UnderstandingRestore = Rpc.make("understanding.restoreUnderstanding", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: UnderstandingError,
});
export const UnderstandingPermanentlyDelete = Rpc.make(
  "understanding.permanentlyDeleteUnderstanding",
  { payload: S.Struct({ id: S.String }), success: S.Void, error: UnderstandingError },
);
// ipc 内部（index 装配）仍需这些类型/schema，从 shared 再导出（定义单一真源）。
export {
  UnderstandingSummaryDTO,
  UnderstandingDTO,
  CreateUnderstandingInput,
  UpdateUnderstandingInput,
  ListUnderstandingsFilter,
} from "@reflecta/shared";
