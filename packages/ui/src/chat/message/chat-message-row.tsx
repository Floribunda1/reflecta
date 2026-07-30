import type { ReactNode } from "react";
import { Copy, FileText, GitFork, Pencil, RefreshCcw } from "lucide-react";
import { Button } from "../../components/button";
import { cn } from "../../lib/utils";
import type { ChatEntityBindings } from "../entity";
import { entityClassName, entityIcon } from "../entity-visual";
import { AgentActivityGroup } from "../execution/agent-activity-group";
import { isAgentActivityBlock } from "../execution/activity-presentation";
import {
  AgentExecutionBlock,
  AgentFailureStatus,
  AgentPendingBlock,
  AgentStoppedStatus,
} from "../execution/agent-execution-block";
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

function tailWorkingLabel(message: ChatAssistantMessageView) {
  if (message.status !== "streaming") return null;
  const last = message.blocks.at(-1);
  if (!last) return "正在思考";
  if (isAgentActivityBlock(last)) {
    const previous = message.blocks.at(-2);
    if (previous && isAgentActivityBlock(previous)) return null;
    if (last.kind === "reasoning" && last.reasoning.status === "streaming") return null;
    if (last.kind === "tool-activity" && last.activity.status === "running") return null;
    return "Reflecta 工作中...";
  }
  if (last.kind === "proposal") {
    if (last.proposal.lifecycle === "pending") return null;
    if (last.proposal.lifecycle === "preview" || last.proposal.lifecycle === "running") return null;
  }
  if (last.kind === "text" && last.status === "streaming") return null;
  return "Reflecta 工作中...";
}

function AgentMessageContent({
  message,
  entityBindings,
  onProposalDecision,
}: Omit<AgentMessageViewProps, "search">) {
  const renderedBlocks: ReactNode[] = [];

  for (let index = 0; index < message.blocks.length; index += 1) {
    const block = message.blocks[index];
    if (!block) continue;

    if (isAgentActivityBlock(block)) {
      const activities = [block];
      while (index + 1 < message.blocks.length) {
        const next = message.blocks[index + 1];
        if (!next || !isAgentActivityBlock(next)) break;
        activities.push(next);
        index += 1;
      }
      renderedBlocks.push(
        activities.length === 1 ? (
          <AgentExecutionBlock key={blockId(block)} block={block} entityBindings={entityBindings} />
        ) : (
          <AgentActivityGroup
            key={`activity-group:${blockId(block)}`}
            blocks={activities}
            active={message.status === "streaming" && index === message.blocks.length - 1}
            entityBindings={entityBindings}
          />
        ),
      );
      continue;
    }

    if (block.kind === "text") {
      renderedBlocks.push(
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
            <ChatMarkdown
              value={block.markdown}
              streaming={block.status === "streaming"}
              {...entityBindings}
            />
          )}
        </div>,
      );
      continue;
    }

    if (block.kind === "proposal") {
      renderedBlocks.push(
        <AgentProposalCard
          key={block.proposal.id}
          proposal={block.proposal}
          entityBindings={entityBindings}
          onDecision={onProposalDecision}
        />,
      );
      continue;
    }

    renderedBlocks.push(
      <AgentExecutionBlock key={blockId(block)} block={block} entityBindings={entityBindings} />,
    );
  }

  const workingLabel = tailWorkingLabel(message);
  return (
    <>
      {renderedBlocks}
      {message.status === "stopped" ? <AgentStoppedStatus /> : null}
      {workingLabel ? <AgentPendingBlock label={workingLabel} /> : null}
      {message.status === "failed" && message.blocks.length === 0 ? (
        <AgentFailureStatus error={message.error} />
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
          "group/message flex flex-col gap-1 transition-colors duration-300 [contain-intrinsic-size:auto_180px] [content-visibility:auto]",
          message.kind === "user" ? "items-end" : "items-start",
          row.highlighted && "scroll-mt-6 rounded-md bg-accent/50",
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
