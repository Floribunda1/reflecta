import mediumZoom, { type Zoom } from "medium-zoom";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { Copy, FileText, GitFork, Pencil, RefreshCcw } from "lucide-react";
import { Button } from "../../components/button";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "../../components/attachment";
import { cn } from "#lib/utils";
import { attachmentMeta } from "#lib/file-meta";
import type { ChatEntityBindings } from "../entity";
import {
  entityClassName,
  CHAT_ENTITY_ICON_FONT_SIZE,
  ENTITY_ICON_CLASS,
  entityIcon,
} from "../entity-visual";
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
  /** 附件打开（有本地路径时用系统应用打开）。 */
  onAttachmentOpen?: (attachment: ChatMessageAttachmentView) => void;
  onProposalDecision?: (decision: AgentProposalDecision) => void;
};

function ZoomableChatImage({ src, alt, className, ...props }: ComponentProps<"img">) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef<Zoom | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const zoom = mediumZoom(image);
    zoomRef.current = zoom;
    return () => {
      zoomRef.current = null;
      zoom.detach();
    };
  }, [src]);

  return (
    <img
      {...props}
      ref={imageRef}
      src={src}
      alt={alt}
      role="button"
      tabIndex={0}
      aria-label={`${alt || "图片"}，点击放大`}
      className={cn(className, "cursor-zoom-in")}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        void zoomRef.current?.toggle({ target: event.currentTarget });
      }}
    />
  );
}

function MessageEntityMention({
  entity,
  onOpen,
}: {
  entity: ChatMessageEntityView;
  onOpen?: (entity: ChatMessageEntityView) => void;
}) {
  const Icon = entityIcon(entity.type);
  const className = entityClassName(entity.type);
  if (entity.type === "domain" || !onOpen) {
    return (
      <span data-slot="user-context-mention" className={className}>
        {Icon ? (
          <Icon className={ENTITY_ICON_CLASS} style={{ fontSize: CHAT_ENTITY_ICON_FONT_SIZE }} />
        ) : null}
        {entity.label}
      </span>
    );
  }
  // DESIGN: 可点击提及不能用 shadcn Button（inline-flex 会破坏正文基线），
  // 只能原生 button + reset。hover:opacity-80 仅可点击版有——span 版（domain /
  // 不可点击）刻意无 hover，可点击性靠 text-primary 颜色表达，hover 是第二重反馈。
  return (
    <button
      type="button"
      data-slot="user-context-mention"
      className={`${className} m-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring`}
      onClick={() => onOpen(entity)}
    >
      {Icon ? (
        <Icon className={ENTITY_ICON_CLASS} style={{ fontSize: CHAT_ENTITY_ICON_FONT_SIZE }} />
      ) : null}
      {entity.label}
    </button>
  );
}

function MessageAttachment({
  attachment,
  onOpen,
}: {
  attachment: ChatMessageAttachmentView;
  onOpen?: (attachment: ChatMessageAttachmentView) => void;
}) {
  const isImage = attachment.mediaType.startsWith("image/") && Boolean(attachment.previewUrl);
  const canOpen = Boolean(attachment.filePath);
  // 图片无本地路径（粘贴/生成）→ 应用内 medium-zoom 放大；否则统一系统应用打开。
  if (isImage && !canOpen) {
    return (
      <ZoomableChatImage
        src={attachment.previewUrl}
        alt={attachment.name}
        className="max-h-72 max-w-full rounded-md border border-border object-contain shadow-xs"
      />
    );
  }
  return (
    <Attachment data-testid="agent-message-attachment" state="done">
      <AttachmentMedia variant={isImage ? "image" : "icon"}>
        {isImage ? <img src={attachment.previewUrl} alt={attachment.name} /> : <FileText />}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{attachment.name}</AttachmentTitle>
        <AttachmentDescription>{attachmentMeta(attachment.name, undefined)}</AttachmentDescription>
      </AttachmentContent>
      {canOpen ? (
        <AttachmentTrigger
          aria-label={`打开 ${attachment.name}`}
          onClick={() => onOpen?.(attachment)}
        />
      ) : null}
    </Attachment>
  );
}

function UserMessageContent({
  message,
  onEntityOpen,
  onAttachmentOpen,
}: {
  message: ChatUserMessageView;
  onEntityOpen?: (entity: ChatMessageEntityView) => void;
  onAttachmentOpen?: (attachment: ChatMessageAttachmentView) => void;
}) {
  const searchState = useChatSearchState();
  const hasContent = Boolean(
    message.content?.length ||
    message.text ||
    message.entities?.length ||
    message.attachments?.length,
  );
  return (
    <div
      data-slot="user-message-content"
      data-testid="agent-user-message"
      className="flex max-w-full flex-col gap-2 whitespace-pre-wrap rounded-lg border border-border bg-card px-4 py-3 text-foreground shadow-xs"
    >
      {message.content?.length || message.text || message.entities?.length ? (
        <div data-slot="user-message-text" className="text-body">
          {message.content?.map((part, index) =>
            part.kind === "entity" ? (
              <MessageEntityMention
                key={`${part.entity.type}:${part.entity.id}:${index}`}
                entity={part.entity}
                onOpen={onEntityOpen}
              />
            ) : (
              <span key={`text:${index}`}>
                {renderTextWithChatSearchHighlights(
                  part.text,
                  searchState,
                  `message-${message.id}-${index}`,
                )}
              </span>
            ),
          ) ??
            (message.text
              ? renderTextWithChatSearchHighlights(
                  message.text,
                  searchState,
                  `message-${message.id}`,
                )
              : null)}
          {!message.content?.length && message.entities?.length ? (
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
            <MessageAttachment
              key={attachment.id}
              attachment={attachment}
              onOpen={onAttachmentOpen}
            />
          ))}
        </div>
      ) : null}
      {!hasContent ? <span className="text-sm text-muted-foreground">...</span> : null}
    </div>
  );
}

function blockId(block: AgentMessageBlockView) {
  if (block.kind === "text") return block.id;
  if (block.kind === "image") return block.id;
  if (block.kind === "reasoning") return block.reasoning.id;
  if (block.kind === "tool-activity") return block.activity.id;
  if (block.kind === "context-compaction") return block.compaction.id;
  if (block.kind === "pending") return block.pending.id;
  return block.proposal.id;
}

/** 取块的时间戳；无法解析的块（image/compaction/proposal/pending）返回 undefined */
function blockCreatedAt(block?: AgentMessageBlockView) {
  if (!block) return undefined;
  if (block.kind === "text") return block.createdAt;
  if (block.kind === "reasoning") return block.reasoning.createdAt;
  if (block.kind === "tool-activity") return block.activity.createdAt;
  return undefined;
}

/** 从 fromIndex 起找下一个有时间戳的块（跳过空 text / 无法解析的块），
 *  作为 thinking 块的结束时刻。 */
function followingCreatedAt(blocks: readonly AgentMessageBlockView[], fromIndex: number) {
  for (let i = fromIndex; i < blocks.length; i += 1) {
    const createdAt = blockCreatedAt(blocks[i]);
    if (createdAt) return createdAt;
  }
  return undefined;
}

function tailWorkingLabel(message: ChatAssistantMessageView) {
  if (message.status !== "streaming") return null;
  const last = message.blocks.at(-1);
  if (!last) return "等待中...";
  if (isAgentActivityBlock(last)) {
    const previous = message.blocks.at(-2);
    if (previous && isAgentActivityBlock(previous)) return null;
    if (last.kind === "reasoning" && last.reasoning.status === "streaming") return null;
    if (last.kind === "tool-activity" && last.activity.status === "running") return null;
    return "等待中...";
  }
  if (last.kind === "proposal") {
    if (last.proposal.lifecycle === "pending") return null;
    if (last.proposal.lifecycle === "preview" || last.proposal.lifecycle === "running") return null;
  }
  // text 块在数据层无 state（view 构造时 status 恒为 done），正文流式的判据
  // 用消息级 status + 尾部是 text 块（text 在尾部 = 正文输出中）。
  if (last.kind === "text") return null;
  return "等待中...";
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
        <AgentActivityGroup
          key={`activity-group:${blockId(block)}`}
          blocks={activities}
          active={message.status === "streaming" && index === message.blocks.length - 1}
          endedAt={followingCreatedAt(message.blocks, index + 1)}
          entityBindings={entityBindings}
        />,
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
              className="rounded-md border border-danger bg-danger-muted px-3 py-2 text-sm text-destructive"
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

    if (block.kind === "image") {
      renderedBlocks.push(
        <ZoomableChatImage
          key={block.id}
          data-testid="agent-generated-image"
          data-block-id={block.id}
          src={block.src}
          alt={block.alt}
          className="max-h-128 max-w-full rounded-lg border border-border object-contain"
        />,
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
  copy: { title: "复制", icon: Copy, testId: "agent-copy-message-button" },
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
  onAttachmentOpen,
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
          "group/message flex flex-col gap-1 transition-colors duration-300",
          message.kind === "user" ? "items-end" : "items-start",
          row.highlighted && "scroll-mt-6 rounded-md bg-muted",
        )}
      >
        {message.kind === "user" ? (
          <UserMessageContent
            message={message}
            onEntityOpen={onEntityOpen}
            onAttachmentOpen={onAttachmentOpen}
          />
        ) : (
          <AgentMessageContent
            message={message}
            entityBindings={entityBindings}
            onProposalDecision={onProposalDecision}
          />
        )}
        {row.timestampLabel || row.enabledActions?.length ? (
          <div className="flex items-center gap-1">
            {row.timestampLabel ? (
              <time data-slot="message-time" className="px-1 text-xs text-muted-foreground">
                {row.timestampLabel}
              </time>
            ) : null}
            {row.enabledActions?.length ? (
              <div
                className={cn(
                  "flex gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100",
                  message.kind === "user" && "order-first",
                )}
              >
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
        ) : null}
      </div>
    </ChatSearchProvider>
  );
}
