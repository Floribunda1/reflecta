/** chat 域契约。agent wire format 单一真源在 @reflecta/shared（富形态），这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
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

export const ChatListThreads = rpc(
  "chat.listThreads",
  S.Struct({}),
  S.Array(AgentSessionSummary),
  ChatError,
);
export const ChatListSkills = rpc(
  "chat.listSkills",
  S.Struct({}),
  S.Array(AgentSkillSummary),
  ChatError,
);
export const ChatCreateThread = rpc(
  "chat.createThread",
  S.Struct({ title: S.optional(S.String) }),
  AgentSessionSummary,
  ChatError,
);
export const ChatRenameThread = rpc(
  "chat.renameThread",
  S.Struct({ threadId: S.String, title: S.String }),
  S.Void,
  ChatError,
);
export const ChatGenerateTitle = rpc(
  "chat.generateThreadTitle",
  S.Struct({ threadId: S.String }),
  S.String,
  ChatError,
);
export const ChatArchiveThread = rpc(
  "chat.archiveThread",
  S.Struct({ threadId: S.String }),
  S.Void,
  ChatError,
);
export const ChatDeleteThread = rpc(
  "chat.deleteThread",
  S.Struct({ threadId: S.String }),
  S.Void,
  ChatError,
);
export const ChatForkFromMessage = rpc(
  "chat.forkThreadFromMessage",
  S.Struct({ threadId: S.String, messageId: S.String }),
  AgentSessionSummary,
  ChatError,
);
export const ChatExportMarkdown = rpc(
  "chat.exportMarkdown",
  S.Struct({ filename: S.String, markdown: S.String }),
  S.NullOr(S.String),
  ChatError,
);
export const ChatReadProjection = rpc(
  "chat.readSessionProjection",
  S.Struct({ sessionId: S.String }),
  noCtx(S.NullOr(AgentSessionProjection)),
  ChatError,
);
export const ChatSendCommand = rpc(
  "chat.sendAgentCommand",
  noCtx(S.Struct({ command: AgentCommand })),
  S.Void,
  ChatError,
);
