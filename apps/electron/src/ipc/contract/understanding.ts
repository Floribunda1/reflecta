/** understanding 域契约。DTO schema 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
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
// ipc 内部（index 装配）仍需这些类型/schema，从 shared 再导出（定义单一真源）。
export {
  UnderstandingSummaryDTO,
  UnderstandingDTO,
  CreateUnderstandingInput,
  UpdateUnderstandingInput,
  ListUnderstandingsFilter,
} from "@reflecta/shared";
