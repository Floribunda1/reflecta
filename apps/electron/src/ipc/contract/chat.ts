/** chat 域契约（迁移批：chat，最后一域）。agent 类型面较大，深联合用 noCtx<A> 保真。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

type NoCtx<A> = S.Codec<A, unknown, never, never>;
const noCtx = <A>(schema: S.Schema<A>): NoCtx<A> => schema as unknown as NoCtx<A>;

export class ChatError extends S.TaggedError<ChatError>()("ChatError", {
  reason: S.String,
  code: S.Number,
}) {}

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));
const Json = S.Record(S.String, S.Unknown);
const AnyJson = S.Unknown;

export const AgentReasoningLevel = lit("off", "minimal", "low", "medium", "high", "xhigh", "max");
export type AgentReasoningLevel = S.Schema.Type<typeof AgentReasoningLevel>;

export const AgentContextRef = S.Struct({
  type: lit("understanding", "context", "domain", "canvas"),
  id: S.String,
  title: S.optional(S.String),
});
export type AgentContextRef = S.Schema.Type<typeof AgentContextRef>;

export const AgentModelSelection = S.Struct({ providerId: S.String, modelId: S.String });
export type AgentModelSelection = S.Schema.Type<typeof AgentModelSelection>;

export const AgentFileAttachment = S.Struct({
  type: S.Literal("file"),
  mediaType: S.String,
  url: S.String,
  filename: S.optional(S.String),
  filePath: S.optional(S.String),
  providerMetadata: S.optional(Json),
});
export type AgentFileAttachment = S.Schema.Type<typeof AgentFileAttachment>;

export const AgentUsage = S.Struct({
  input: S.Number,
  output: S.Number,
  cacheRead: S.Number,
  cacheWrite: S.Number,
  totalTokens: S.Number,
  cost: S.optional(
    S.Struct({
      input: S.Number,
      output: S.Number,
      cacheRead: S.Number,
      cacheWrite: S.Number,
      total: S.Number,
    }),
  ),
});
export type AgentUsage = S.Schema.Type<typeof AgentUsage>;

export const AgentContextUsage = S.Struct({
  tokens: S.NullOr(S.Number),
  contextWindow: S.Number,
  percent: S.NullOr(S.Number),
});
export type AgentContextUsage = S.Schema.Type<typeof AgentContextUsage>;

export const AgentReasoning = lit("off", "minimal", "low", "medium", "high", "xhigh", "max");

export const AgentToolExecutionError = S.Struct({
  message: S.String,
  code: S.optional(S.String),
  details: S.optional(Json),
});
export const ToolApprovalState = lit("pending", "approved", "rejected");
export const ToolExecutionState = lit("not_started", "running", "completed", "failed");
export const ToolDisplayState = lit(
  "pending",
  "running",
  "completed",
  "failed",
  "approved",
  "rejected",
);

/** 压缩记录（字段宽松，保主要字段） */
export const AgentContextCompacted = noCtx(
  S.Struct({
    type: S.Literal("context.compacted"),
    reason: lit("manual", "threshold", "overflow"),
    messageId: S.optional(S.String),
    summary: S.String,
    firstKeptEntryId: S.String,
    tokensBefore: S.Number,
    estimatedTokensAfter: S.optional(S.Number),
    contextWindow: S.optional(S.Number),
    afterMessageId: S.optional(S.String),
  }),
);

export const AgentContextCompactionStarted = noCtx(
  S.Struct({
    type: S.Literal("context.compaction.started"),
    reason: lit("manual", "threshold", "overflow"),
  }),
);

export const AgentEntityCatalogEntry = S.Struct({
  key: S.String,
  entity: AgentContextRef,
  origin: S.Union([
    S.Struct({ kind: S.Literal("user_context"), messageId: S.String }),
    S.Struct({ kind: S.Literal("tool_result"), toolCallId: S.String, toolName: S.String }),
  ]),
});

/** assistant 内容块：5 分支联合（深，noCtx 保真） */
export const AgentReducedAssistantBlock = noCtx(
  S.Union([
    S.Struct({ kind: S.Literal("reasoning"), text: S.String, createdAt: S.String }),
    S.Struct({
      kind: S.Literal("tool"),
      toolCallId: S.String,
      toolName: S.String,
      input: S.optional(AnyJson),
      output: S.optional(AnyJson),
      error: S.optional(S.String),
      state: lit("running", "completed", "failed"),
      createdAt: S.String,
    }),
    S.Struct({
      kind: S.Literal("approval"),
      approvalId: S.String,
      toolCallId: S.String,
      toolName: S.String,
      title: S.String,
      description: S.optional(S.String),
      payload: S.optional(AnyJson),
      preview: S.optional(S.Boolean),
      output: S.optional(AnyJson),
      error: S.optional(S.String),
      executionError: S.optional(AgentToolExecutionError),
      approved: S.optional(S.Boolean),
      rejectionReason: S.optional(S.String),
      state: lit("pending", "approved", "rejected", "completed", "failed"),
      approvalState: ToolApprovalState,
      executionState: ToolExecutionState,
      displayState: ToolDisplayState,
      createdAt: S.String,
    }),
    S.Struct({
      kind: S.Literal("text"),
      text: S.String,
      state: S.optional(lit("streaming", "done", "failed")),
      error: S.optional(S.String),
      createdAt: S.String,
    }),
    S.Struct({ kind: S.Literal("context-compaction"), compaction: S.Unknown }),
  ]),
);

export const AgentMessageProjection = noCtx(
  S.Struct({
    id: S.String,
    role: lit("user", "assistant"),
    text: S.String,
    createdAt: S.String,
    runId: S.optional(S.String),
    blocks: S.optional(S.Array(AgentReducedAssistantBlock)),
    contextRefs: S.optional(S.Array(AgentContextRef)),
    files: S.optional(S.Array(AgentFileAttachment)),
    composerContent: S.optional(S.Unknown),
    usage: S.optional(AgentUsage),
    contextUsage: S.optional(AgentContextUsage),
    model: S.optional(AgentModelSelection),
    stopReason: S.optional(S.String),
  }),
);

export const AgentSessionProjection = noCtx(
  S.Struct({
    sessionId: S.String,
    messages: S.Array(AgentMessageProjection),
    activeRunId: S.NullOr(S.String),
    status: lit("idle", "running", "waiting", "failed", "cancelled"),
    error: S.NullOr(S.String),
    entityCatalog: S.Array(AgentEntityCatalogEntry),
    contextCompactions: S.Array(S.Unknown),
    activeCompaction: S.NullOr(S.Unknown),
    compactionError: S.NullOr(S.String),
    cancelledAssistantMessageId: S.NullOr(S.String),
  }),
);
export type AgentSessionProjection = S.Schema.Type<typeof AgentSessionProjection>;

export const AgentSessionSummary = S.Struct({
  id: S.String,
  title: S.String,
  status: lit("active", "archived"),
  createdAt: S.String,
  updatedAt: S.String,
  runtime: S.Literal("pi"),
});
export type AgentSessionSummary = S.Schema.Type<typeof AgentSessionSummary>;

export const AgentSkillSummary = S.Struct({ name: S.String, description: S.String });
export type AgentSkillSummary = S.Schema.Type<typeof AgentSkillSummary>;

/** send 命令：8 分支联合（按 type 分发，保真） */
export const AgentCommand = noCtx(
  S.Union([
    S.Struct({ type: S.Literal("session.create"), title: S.optional(S.String) }),
    S.Struct({
      type: S.Literal("message.send"),
      sessionId: S.String,
      text: S.String,
      messageId: S.optional(S.String),
      contextRefs: S.optional(S.Array(AgentContextRef)),
      files: S.optional(S.Array(AgentFileAttachment)),
      composerContent: S.optional(S.Unknown),
      modelSelection: S.optional(AgentModelSelection),
      reasoningLevel: S.optional(AgentReasoningLevel),
    }),
    S.Struct({ type: S.Literal("run.cancel"), sessionId: S.String }),
    S.Struct({
      type: S.Literal("context.compact"),
      sessionId: S.String,
      modelSelection: S.optional(AgentModelSelection),
      reasoningLevel: S.optional(AgentReasoningLevel),
    }),
    S.Struct({
      type: S.Literal("tool.approve"),
      sessionId: S.String,
      approvalId: S.String,
      modelSelection: S.optional(AgentModelSelection),
      reasoningLevel: S.optional(AgentReasoningLevel),
    }),
    S.Struct({
      type: S.Literal("tool.reject"),
      sessionId: S.String,
      approvalId: S.String,
      reason: S.optional(S.String),
      modelSelection: S.optional(AgentModelSelection),
      reasoningLevel: S.optional(AgentReasoningLevel),
    }),
    S.Struct({ type: S.Literal("session.rename"), sessionId: S.String, title: S.String }),
    S.Struct({ type: S.Literal("session.delete"), sessionId: S.String }),
  ]),
);
export type AgentCommand = S.Schema.Type<typeof AgentCommand>;

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
