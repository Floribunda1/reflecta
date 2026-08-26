/**
 * agent/chat 域 wire format（Effect Schema 单一真源）。
 *
 * 规范形态 = 渲染器实际消费的「富」形态（事件带 runId/createdAt、含
 * pending_approval 等）；主进程如实下发，chat 的 rpc 面与 preload typings
 * 均从这里派生，不再各自定义。
 */
import * as S from "effect/Schema";

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));
const Json = S.Record(S.String, S.Unknown);

export const AgentReasoningLevel = lit("off", "minimal", "low", "medium", "high", "xhigh", "max");
export type AgentReasoningLevel = S.Schema.Type<typeof AgentReasoningLevel>;

export const AgentContextRef = S.Struct({
  type: lit("understanding", "context", "domain", "canvas"),
  id: S.String,
  title: S.optional(S.String),
});
export type AgentContextRef = S.Schema.Type<typeof AgentContextRef>;

export type AgentComposerContentNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AgentComposerContentNode[];
};
export const AgentComposerContentNode: S.Schema<AgentComposerContentNode> = S.suspend(() =>
  S.Struct({
    type: S.optional(S.String),
    text: S.optional(S.String),
    attrs: S.optional(S.Record(S.String, S.Unknown)),
    content: S.optional(S.mutable(S.Array(S.suspend(() => AgentComposerContentNode)))),
  }),
);

export const AgentModelSelection = S.Struct({ providerId: S.String, modelId: S.String });
export type AgentModelSelection = S.Schema.Type<typeof AgentModelSelection>;

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

export const AgentFileAttachment = S.Struct({
  type: S.Literal("file"),
  mediaType: S.String,
  url: S.String,
  filename: S.optional(S.String),
  filePath: S.optional(S.String),
  providerMetadata: S.optional(Json),
});
export type AgentFileAttachment = S.Schema.Type<typeof AgentFileAttachment>;

const EventBaseFields = {
  id: S.String,
  sessionId: S.String,
  runId: S.optional(S.String),
  createdAt: S.String,
};
export const AgentEventBase = S.Struct(EventBaseFields);
export type AgentEventBase = S.Schema.Type<typeof AgentEventBase>;

export const AgentContextCompactionReason = lit("manual", "threshold", "overflow");
export type AgentContextCompactionReason = S.Schema.Type<typeof AgentContextCompactionReason>;

export const AgentToolApprovalState = lit("pending", "approved", "rejected");
export const AgentToolExecutionState = lit("not_started", "running", "completed", "failed");
export const AgentToolDisplayState = lit(
  "pending_approval",
  "rejected",
  "running",
  "completed",
  "failed",
);

export const AgentToolExecutionError = S.Struct({
  message: S.String,
  code: S.optional(S.String),
  details: S.optional(Json),
});
export type AgentToolExecutionError = S.Schema.Type<typeof AgentToolExecutionError>;

export const AgentContextCompactionStarted = S.Struct({
  ...EventBaseFields,
  type: S.Literal("context.compaction.started"),
  reason: AgentContextCompactionReason,
});
export type AgentContextCompactionStarted = S.Schema.Type<typeof AgentContextCompactionStarted>;

export const AgentContextCompacted = S.Struct({
  ...EventBaseFields,
  type: S.Literal("context.compacted"),
  reason: AgentContextCompactionReason,
  messageId: S.optional(S.String),
  summary: S.String,
  firstKeptEntryId: S.String,
  tokensBefore: S.Number,
  estimatedTokensAfter: S.optional(S.Number),
  contextWindow: S.optional(S.Number),
  afterMessageId: S.optional(S.String),
});
export type AgentContextCompacted = S.Schema.Type<typeof AgentContextCompacted>;

export const AgentEntityCatalogEntry = S.Struct({
  key: S.String,
  entity: AgentContextRef,
  origin: S.Union([
    S.Struct({ kind: S.Literal("user_context"), messageId: S.String }),
    S.Struct({ kind: S.Literal("tool_result"), toolCallId: S.String, toolName: S.String }),
  ]),
});
export type AgentEntityCatalogEntry = S.Schema.Type<typeof AgentEntityCatalogEntry>;

/** assistant 内容块：5 分支联合（富形态，displayState 含 pending_approval） */
export const AgentReducedAssistantBlock = S.Union([
  S.Struct({ kind: S.Literal("reasoning"), text: S.String, createdAt: S.String }),
  S.Struct({
    kind: S.Literal("tool"),
    toolCallId: S.String,
    toolName: S.String,
    input: S.optional(S.Unknown),
    output: S.optional(S.Unknown),
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
    payload: S.optional(S.Unknown),
    preview: S.optional(S.Boolean),
    output: S.optional(S.Unknown),
    error: S.optional(S.String),
    executionError: S.optional(AgentToolExecutionError),
    approved: S.optional(S.Boolean),
    rejectionReason: S.optional(S.String),
    state: lit("pending", "approved", "rejected", "completed", "failed"),
    approvalState: AgentToolApprovalState,
    executionState: AgentToolExecutionState,
    displayState: AgentToolDisplayState,
    createdAt: S.String,
  }),
  S.Struct({
    kind: S.Literal("text"),
    text: S.String,
    state: S.optional(lit("streaming", "done", "failed")),
    error: S.optional(S.String),
    createdAt: S.String,
  }),
  S.Struct({ kind: S.Literal("context-compaction"), compaction: AgentContextCompacted }),
]);
export type AgentReducedAssistantBlock = S.Schema.Type<typeof AgentReducedAssistantBlock>;

export const AgentMessageProjection = S.Struct({
  id: S.String,
  role: lit("user", "assistant"),
  text: S.String,
  createdAt: S.String,
  runId: S.optional(S.String),
  blocks: S.optional(S.mutable(S.Array(AgentReducedAssistantBlock))),
  contextRefs: S.optional(S.mutable(S.Array(AgentContextRef))),
  files: S.optional(S.mutable(S.Array(AgentFileAttachment))),
  composerContent: S.optional(AgentComposerContentNode),
  usage: S.optional(AgentUsage),
  contextUsage: S.optional(AgentContextUsage),
  model: S.optional(AgentModelSelection),
  stopReason: S.optional(S.String),
});
export type AgentMessageProjection = S.Schema.Type<typeof AgentMessageProjection>;

export const AgentSessionProjection = S.Struct({
  sessionId: S.String,
  messages: S.mutable(S.Array(AgentMessageProjection)),
  activeRunId: S.NullOr(S.String),
  status: lit("idle", "running", "waiting", "failed", "cancelled"),
  error: S.NullOr(S.String),
  entityCatalog: S.mutable(S.Array(AgentEntityCatalogEntry)),
  contextCompactions: S.mutable(S.Array(AgentContextCompacted)),
  activeCompaction: S.NullOr(AgentContextCompactionStarted),
  compactionError: S.NullOr(S.String),
  cancelledAssistantMessageId: S.NullOr(S.String),
});
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
export const AgentCommand = S.Union([
  S.Struct({ type: S.Literal("session.create"), title: S.optional(S.String) }),
  S.Struct({
    type: S.Literal("message.send"),
    sessionId: S.String,
    text: S.String,
    messageId: S.optional(S.String),
    contextRefs: S.optional(S.mutable(S.Array(AgentContextRef))),
    files: S.optional(S.mutable(S.Array(AgentFileAttachment))),
    composerContent: S.optional(AgentComposerContentNode),
    modelSelection: S.optional(AgentModelSelection),
    reasoningLevel: S.optional(AgentReasoningLevel),
  }),
  S.Struct({
    type: S.Literal("run.retry"),
    sessionId: S.String,
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
]);
export type AgentCommand = S.Schema.Type<typeof AgentCommand>;
