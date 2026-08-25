/** insights 域契约。wire format 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import { RecapData } from "@reflecta/shared";

export class InsightsError extends S.TaggedError<InsightsError>()("InsightsError", {
  reason: S.String,
  code: S.Number,
}) {}

export const InsightsGetRecapData = rpc(
  "insights.getRecapData",
  S.Struct({}),
  RecapData,
  InsightsError,
);
