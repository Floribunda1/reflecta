import { Copy, FileText, GitFork, Pencil, RefreshCcw } from "lucide-react";
import { Button } from "../../components/button";
import { cn } from "../../lib/utils";
import type { ChatEntityBindings } from "../entity";
import { entityClassName, entityIcon } from "../entity-visual";
import { AgentExecutionBlock, AgentPendingBlock } from "../execution/agent-execution-block";
import { ChatMarkdown } from "../markdown/chat-markdown";
import { AgentProposalCard } from "../proposal/agent-proposal-card";
import type { AgentProposalDecision } from "../proposal/types";
import {
  ChatSearchProvider,
  renderTextWithChatSearchHighlights,
  useChatSearchState,
} from "./chat-search";
import type {
  AgentMessageBlockView,
  ChatAssistantMessageView,
  ChatMessageAction,
  ChatMessageAttachmentView,
  ChatMessageEntityView,
  ChatMessageRowView,
  ChatUserMessageView,
} from "./types";

export type AgentMessageViewProps = {
  message: ChatAssistantMessageView;
  search?: { query: string };
  entityBindings?: ChatEntityBindings;
  onProposalDecision?: (decision: AgentProposalDecision) => void;
};

export type ChatMessageRowProps = {
  row: ChatMessageRowView;
  search?: { query: string };
  entityBindings?: ChatEntityBindings;
  onAction?: (action: ChatMessageAction) => void;
  onEntityOpen?: (entity: ChatMessageEntityView) => void;
  onProposalDecision?: (decision: AgentProposalDecision) => void;
};

function MessageEntityMention({
  entity,
  onOpen,
}: {
  entity: ChatMessageEntityView;
  onOpen?: (entity: ChatMessageEntityView) => void;
}) {
  const content = `${entityIcon(entity.type)} ${entity.label}`;
  const className = entityClassName(entity.type);
  if (entity.type === "domain" || !onOpen) {
    return (
      <span data-slot="user-context-mention" className={className}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-slot="user-context-mention"
      className={`${className} m-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50`}
      onClick={() => onOpen(entity)}
    >
      {content}
    </button>
  );
}

function MessageAttachment({ attachment }: { attachment: ChatMessageAttachmentView }) {
  if (attachment.mediaType.startsWith("image/") && attachment.previewUrl) {
    return (
      <img
        src={attachment.previewUrl}
        alt={attachment.name}
        className="max-h-72 max-w-full rounded-md border border-border object-contain"
      />
    );
  }
  return (
    <div
      data-testid="agent-message-attachment"
      className="flex max-w-72 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{attachment.name}</span>
    </div>
  );
}

function UserMessageContent({
  message,
  onEntityOpen,
}: {
  message: ChatUserMessageView;
  onEntityOpen?: (entity: ChatMessageEntityView) => void;
}) {
  const searchState = useChatSearchState();
  const hasContent = Boolean(
    message.text || message.entities?.length || message.attachments?.length,
  );
  return (
    <div
      data-slot="user-message-content"
      data-testid="agent-user-message"
      className="flex max-w-full flex-col gap-2 whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-foreground"
    >
      {message.text || message.entities?.length ? (
        <div data-slot="user-message-text" className="leading-6">
          {message.text
            ? renderTextWithChatSearchHighlights(message.text, searchState, `message-${message.id}`)
            : null}
          {message.entities?.length ? (
            <>
              {message.text ? " " : null}
              {message.entities.map((entity) => (
                <MessageEntityMention
                  key={`${entity.type}:${entity.id}`}
                  entity={entity}
                  onOpen={onEntityOpen}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {message.attachments?.length ? (
        <div className="flex max-w-full flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <MessageAttachment key={attachment.id} attachment={attachment} />
          ))}
        </div>
      ) : null}
      {!hasContent ? <span className="text-sm text-muted-foreground">...</span> : null}
    </div>
  );
}

function blockId(block: AgentMessageBlockView) {
  if (block.kind === "text") return block.id;
  if (block.kind === "reasoning") return block.reasoning.id;
  if (block.kind === "tool-activity") return block.activity.id;
  if (block.kind === "context-compaction") return block.compaction.id;
  if (block.kind === "pending") return block.pending.id;
  return block.proposal.id;
}

function AgentMessageContent({
  message,
  entityBindings,
  onProposalDecision,
}: Omit<AgentMessageViewProps, "search">) {
  return (
    <>
      {message.blocks.map((block) => {
        if (block.kind === "text") {
          return (
            <div
              key={block.id}
              data-testid="agent-assistant-text"
              data-block-id={block.id}
              className="w-full px-1 py-1"
            >
              {block.status === "failed" ? (
                <div
                  data-testid="agent-final-answer-error"
                  className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  最终答案生成失败：{block.error ?? "未知错误"}
                </div>
              ) : (
                <ChatMarkdown value={block.markdown} {...entityBindings} />
              )}
            </div>
          );
        }
        if (block.kind === "proposal") {
          return (
            <AgentProposalCard
              key={block.proposal.id}
              proposal={block.proposal}
              entityBindings={entityBindings}
              onDecision={onProposalDecision}
            />
          );
        }
        return (
          <AgentExecutionBlock key={blockId(block)} block={block} entityBindings={entityBindings} />
        );
      })}
      {message.status === "stopped" ? (
        <div
          data-testid="agent-stopped-state"
          className="max-w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          已停止
        </div>
      ) : null}
      {message.status === "streaming" && message.blocks.length === 0 ? <AgentPendingBlock /> : null}
      {message.status === "failed" && message.blocks.length === 0 ? (
        <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          回复失败：{message.error ?? "未知错误"}
        </div>
      ) : null}
      {message.status === "done" && message.blocks.length === 0 ? (
        <div className="max-w-full rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          ...
        </div>
      ) : null}
    </>
  );
}

export function AgentMessageView({
  message,
  search,
  entityBindings,
  onProposalDecision,
}: AgentMessageViewProps) {
  return (
    <ChatSearchProvider messageId={message.id} query={search?.query}>
      <AgentMessageContent
        message={message}
        entityBindings={entityBindings}
        onProposalDecision={onProposalDecision}
      />
    </ChatSearchProvider>
  );
}

const actionPresentation = {
  copy: { title: "复制", icon: Copy },
  edit: { title: "编辑并重发", icon: Pencil, testId: "agent-edit-message-button" },
  fork: { title: "Fork 到这里", icon: GitFork, testId: "agent-fork-message-button" },
  regenerate: { title: "重新生成", icon: RefreshCcw, testId: "agent-regenerate-button" },
} as const;

export function ChatMessageRow({
  row,
  search,
  entityBindings,
  onAction,
  onEntityOpen,
  onProposalDecision,
}: ChatMessageRowProps) {
  const { message } = row;
  return (
    <ChatSearchProvider messageId={message.id} query={search?.query}>
      <div
        data-testid="agent-message-row"
        data-agent-message-id={message.id}
        data-highlighted={row.highlighted ? "true" : undefined}
        data-message-role={message.kind}
        className={cn(
          "group/message flex flex-col gap-1 [contain-intrinsic-size:auto_180px] [content-visibility:auto]",
          message.kind === "user" ? "items-end" : "items-start",
          row.highlighted && "scroll-mt-6 rounded-lg bg-primary/5 ring-2 ring-primary/20",
        )}
      >
        {message.kind === "user" ? (
          <UserMessageContent message={message} onEntityOpen={onEntityOpen} />
        ) : (
          <AgentMessageContent
            message={message}
            entityBindings={entityBindings}
            onProposalDecision={onProposalDecision}
          />
        )}
        {row.timestampLabel ? (
          <time
            data-slot="message-time"
            className="px-1 text-[11px] leading-4 text-muted-foreground/70"
          >
            {row.timestampLabel}
          </time>
        ) : null}
        {row.enabledActions?.length ? (
          <div className="flex gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
            {row.enabledActions.map((type) => {
              const presentation = actionPresentation[type];
              const Icon = presentation.icon;
              return (
                <Button
                  key={type}
                  data-testid={"testId" in presentation ? presentation.testId : undefined}
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  title={presentation.title}
                  disabled={row.actionsDisabled}
                  onClick={() => onAction?.({ messageId: message.id, type })}
                >
                  <Icon />
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>
    </ChatSearchProvider>
  );
}
