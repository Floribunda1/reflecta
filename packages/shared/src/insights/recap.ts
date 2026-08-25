/**
 * insights/recap 域 wire format（Effect Schema 单一真源）。
 * ipc contract 与 renderer 的 recap 类型都从这里派生。
 */
import * as S from "effect/Schema";

export const SessionParticipation = S.Struct({
  sessionId: S.String,
  title: S.String,
  createdAt: S.String,
  updatedAt: S.String,
  messageCount: S.Number,
  userMessageDates: S.mutable(S.Array(S.String)),
});
export type SessionParticipation = S.Schema.Type<typeof SessionParticipation>;

export const RecapData = S.Struct({
  sessions: S.mutable(S.Array(SessionParticipation)),
  contextCreates: S.mutable(S.Array(S.String)),
  canvasElementCreates: S.mutable(S.Array(S.String)),
  canvasEdgeCreates: S.mutable(S.Array(S.String)),
  canvasReferencedUnderstandingIds: S.mutable(S.Array(S.String)),
});
export type RecapData = S.Schema.Type<typeof RecapData>;
