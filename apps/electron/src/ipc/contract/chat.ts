/** chat 域契约。agent wire format 单一真源在 @reflecta/shared（富形态），这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import {
  AgentSessionSummary,
  AgentSkillSummary,
  AgentSessionProjection,
  AgentCommand,
} from "@reflecta/shared";

type NoCtx<A> = S.Codec<A, unknown, never, never>;
const noCtx = <A>(schema: S.Schema<A>): NoCtx<A> => schema as unknown as NoCtx<A>;

export class ChatError extends S.TaggedError<ChatError>()("ChatError", {
  reason: S.String,
  code: S.Number,
}) {}

export const ChatListThreads = Rpc.make("chat.listThreads", {
  payload: S.Struct({}),
  success: S.Array(AgentSessionSummary),
  error: ChatError,
});
export const ChatListSkills = Rpc.make("chat.listSkills", {
  payload: S.Struct({}),
  success: S.Array(AgentSkillSummary),
  error: ChatError,
});
export const ChatCreateThread = Rpc.make("chat.createThread", {
  payload: S.Struct({ title: S.optional(S.String) }),
  success: AgentSessionSummary,
  error: ChatError,
});
export const ChatRenameThread = Rpc.make("chat.renameThread", {
  payload: S.Struct({ threadId: S.String, title: S.String }),
  success: S.Void,
  error: ChatError,
});
export const ChatGenerateTitle = Rpc.make("chat.generateThreadTitle", {
  payload: S.Struct({ threadId: S.String }),
  success: S.String,
  error: ChatError,
});
export const ChatArchiveThread = Rpc.make("chat.archiveThread", {
  payload: S.Struct({ threadId: S.String }),
  success: S.Void,
  error: ChatError,
});
export const ChatDeleteThread = Rpc.make("chat.deleteThread", {
  payload: S.Struct({ threadId: S.String }),
  success: S.Void,
  error: ChatError,
});
export const ChatForkFromMessage = Rpc.make("chat.forkThreadFromMessage", {
  payload: S.Struct({ threadId: S.String, messageId: S.String }),
  success: AgentSessionSummary,
  error: ChatError,
});
export const ChatExportMarkdown = Rpc.make("chat.exportMarkdown", {
  payload: S.Struct({ filename: S.String, markdown: S.String }),
  success: S.NullOr(S.String),
  error: ChatError,
});
export const ChatReadProjection = Rpc.make("chat.readSessionProjection", {
  payload: S.Struct({ sessionId: S.String }),
  success: noCtx(S.NullOr(AgentSessionProjection)),
  error: ChatError,
});
export const ChatSendCommand = Rpc.make("chat.sendAgentCommand", {
  payload: noCtx(S.Struct({ command: AgentCommand })),
  success: S.Void,
  error: ChatError,
});
