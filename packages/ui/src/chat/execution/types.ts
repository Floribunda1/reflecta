export type AgentToolDetailContent =
  | {
      format: "text";
      value: string;
    }
  | {
      format: "pre" | "markdown";
      preview: string;
      full?: string;
    }
  | {
      format: "diff";
      value: string;
    };

export type AgentToolDetailRowView = {
  id: string;
  label?: string;
  title?: string;
  content?: AgentToolDetailContent;
  meta?: readonly string[];
};

export type AgentToolDetailMetaView = {
  label: string;
  value: string;
};

export type AgentToolDetailsView = {
  meta?: readonly AgentToolDetailMetaView[];
  rows?: readonly AgentToolDetailRowView[];
  badges?: readonly string[];
  emptyText?: string;
};

export type AgentExecutionStatus = "running" | "done" | "failed";

export type AgentToolActivityItemView = {
  id: string;
  label: string;
  details?: AgentToolDetailsView;
  error?: string;
};

export type AgentToolActivityView = {
  id: string;
  toolName?: string;
  status: AgentExecutionStatus;
  summary: string;
  items: readonly AgentToolActivityItemView[];
};

export type AgentReasoningView = {
  id: string;
  status: "streaming" | "done";
  markdown: string;
};

export type AgentContextCompactionView = {
  id: string;
  summary: string;
  tokensBefore?: number;
  estimatedTokensAfter?: number;
};

export type AgentPendingView = {
  id: string;
  label?: string;
};

export type AgentExecutionBlockView =
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "tool-activity"; activity: AgentToolActivityView }
  | { kind: "context-compaction"; compaction: AgentContextCompactionView }
  | { kind: "pending"; pending: AgentPendingView };

export type AgentActivityBlockView = Extract<
  AgentExecutionBlockView,
  { kind: "reasoning" | "tool-activity" }
>;
