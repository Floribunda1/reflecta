/**
 * insights/recap 域 wire format（Effect Schema 单一真源）。
 * ipc contract 与 renderer 的 recap 类型都从这里派生。
 */
import * as S from "effect/Schema";
import { ContextMediumSchema } from "../capture/context";

export const SessionParticipation = S.Struct({
  sessionId: S.String,
  title: S.String,
  createdAt: S.String,
  updatedAt: S.String,
  messageCount: S.Number,
  userMessageDates: S.mutable(S.Array(S.String)),
});
export type SessionParticipation = S.Schema.Type<typeof SessionParticipation>;

export const ContextParticipation = S.Struct({
  id: S.String,
  medium: ContextMediumSchema,
  title: S.NullOr(S.String),
  createdAt: S.String,
});
export type ContextParticipation = S.Schema.Type<typeof ContextParticipation>;

export const RecapData = S.Struct({
  sessions: S.mutable(S.Array(SessionParticipation)),
  contexts: S.mutable(S.Array(ContextParticipation)),
  contextCreates: S.mutable(S.Array(S.String)),
  canvasElementCreates: S.mutable(S.Array(S.String)),
  canvasEdgeCreates: S.mutable(S.Array(S.String)),
  canvasReferencedUnderstandingIds: S.mutable(S.Array(S.String)),
});
export type RecapData = S.Schema.Type<typeof RecapData>;
