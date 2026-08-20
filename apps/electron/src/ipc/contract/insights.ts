/** insights 域契约（迁移批 Round B）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class InsightsError extends S.TaggedError<InsightsError>()("InsightsError", {
  reason: S.String,
  code: S.Number,
}) {}

export const SessionParticipation = S.Struct({
  sessionId: S.String,
  title: S.String,
  createdAt: S.String,
  updatedAt: S.String,
  messageCount: S.Number,
  userMessageDates: S.Array(S.String),
});
export type SessionParticipation = S.Schema.Type<typeof SessionParticipation>;

export const RecapData = S.Struct({
  sessions: S.Array(SessionParticipation),
  contextCreates: S.Array(S.String),
  canvasElementCreates: S.Array(S.String),
  canvasEdgeCreates: S.Array(S.String),
  canvasReferencedUnderstandingIds: S.Array(S.String),
});
export type RecapData = S.Schema.Type<typeof RecapData>;

export const InsightsGetRecapData = rpc(
  "insights.getRecapData",
  S.Struct({}),
  RecapData,
  InsightsError,
);
