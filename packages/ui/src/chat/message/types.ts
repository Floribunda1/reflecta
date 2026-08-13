import type { ChatEntityType } from "../entity";
import type { AgentExecutionBlockView } from "../execution/types";
import type { AgentProposalView } from "../proposal/types";

export type ChatMessageEntityView = {
  id: string;
  type: ChatEntityType;
  label: string;
};

export type ChatUserMessageContentPart =
  | { kind: "text"; text: string }
  | { kind: "entity"; entity: ChatMessageEntityView };

export type ChatMessageAttachmentView = {
  id: string;
  name: string;
  mediaType: string;
  previewUrl?: string;
  /** 本地磁盘路径（系统应用打开用；粘贴等来源为空）。 */
  filePath?: string;
};

export type ChatUserMessageView = {
  kind: "user";
  id: string;
  content?: readonly ChatUserMessageContentPart[];
  text?: string;
  entities?: readonly ChatMessageEntityView[];
  attachments?: readonly ChatMessageAttachmentView[];
};

export type AgentTextBlockView = {
  kind: "text";
  id: string;
  markdown: string;
  status: "streaming" | "done" | "failed";
  error?: string;
  createdAt?: string;
};

export type AgentImageBlockView = {
  kind: "image";
  id: string;
  src: string;
  alt: string;
};

export type AgentMessageBlockView =
  | AgentTextBlockView
  | AgentImageBlockView
  | AgentExecutionBlockView
  | {
      kind: "proposal";
      proposal: AgentProposalView;
    };

export type ChatAssistantMessageView = {
  kind: "assistant";
  id: string;
  status: "streaming" | "done" | "stopped" | "failed";
  blocks: readonly AgentMessageBlockView[];
  error?: string;
};

export type ChatMessageView = ChatUserMessageView | ChatAssistantMessageView;

export type ChatMessageActionType = "copy" | "edit" | "fork" | "regenerate";

export type ChatMessageAction = {
  messageId: string;
  type: ChatMessageActionType;
};

export type ChatMessageRowView = {
  message: ChatMessageView;
  timestampLabel?: string;
  highlighted?: boolean;
  enabledActions?: readonly ChatMessageActionType[];
  actionsDisabled?: boolean;
};
