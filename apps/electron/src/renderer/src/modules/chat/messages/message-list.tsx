import { memo, useMemo, type ReactNode } from "react";
import { Copy, FileText, Pencil, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@renderer/components/ui/empty";
import { cn } from "@renderer/lib/utils";
import type { AgentContextRef, AgentFileAttachment, AgentReducedMessage } from "@shared/agent";
import {
  contextKey,
  contextMentionIcon,
  contextRefFromMentionNode,
  contextTitle,
  contextTypeLabel,
  inspectableContextRef,
  messageContextMentionClass,
  type InspectableContextRef,
} from "../context/context-reference";
import type { ComposerJSON } from "../composer/composer-content";
import {
  AgentMessageContent,
  RunningResponsePlaceholder,
  type ApproveToolInput,
} from "./agent-message-content";
import { buildAgentTurnView } from "./agent-turn-view";
import { shouldShowPendingAssistantPlaceholder } from "../session/thread-view";

function MentionChip({
  ref,
  onInspect,
}: {
  ref: AgentContextRef;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
  const inspectableRef = inspectableContextRef(ref);
  const content = `${contextMentionIcon(ref.type)} ${contextTitle(ref)}`;

  if (!inspectableRef || !onInspect) {
    return (
      <span data-slot="user-context-mention" className={messageContextMentionClass(ref.type)}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="user-context-mention"
      className={`${messageContextMentionClass(ref.type)} m-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50`}
      onClick={() => onInspect(inspectableRef)}
    >
      {content}
    </button>
  );
}

function renderComposerNode(
  node: ComposerJSON,
  key: string,
  onInspect?: (ref: InspectableContextRef) => void,
): ReactNode {
  if (node.type === "text") return node.text ?? "";
  const ref = contextRefFromMentionNode(node);
  if (ref) return <MentionChip key={key} ref={ref} onInspect={onInspect} />;
  if (node.type === "paragraph") {
    return (
      <span key={key} data-slot="user-message-paragraph">
        {node.content?.map((child, index) =>
          renderComposerNode(child, `${key}-${index}`, onInspect),
        )}
      </span>
    );
  }
  return (
    node.content?.map((child, index) => renderComposerNode(child, `${key}-${index}`, onInspect)) ??
    null
  );
}

function messageTimeLabel(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "M月d日 HH:mm:ss");
}

function messageFiles(message: AgentReducedMessage): AgentFileAttachment[] {
  return message.files ?? [];
}

function MessageAttachment({ file }: { file: AgentFileAttachment }) {
  const name = file.filename || file.mediaType;
  if (file.mediaType.startsWith("image/")) {
    return (
      <img
        src={file.url}
        alt={name}
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
      <span className="min-w-0 truncate">{name}</span>
    </div>
  );
}

function UserMessageContent({
  message,
  text,
  onInspect,
}: {
  message: AgentReducedMessage;
  text: string;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
  const refs = message.contextRefs ?? [];
  const files = messageFiles(message);
  const content = message.composerContent as ComposerJSON | undefined;
  const renderedContent =
    content?.content?.map((node, index) => renderComposerNode(node, String(index), onInspect)) ??
    [];
  const hasRenderedContent = renderedContent.length > 0;
  const hasTextContent = hasRenderedContent || Boolean(text) || refs.length > 0;

  return (
    <div
      data-slot="user-message-content"
      data-testid="agent-user-message"
      className="flex max-w-full flex-col gap-2 whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-foreground"
    >
      {hasTextContent ? (
        <div data-slot="user-message-text" className="leading-6">
          {hasRenderedContent ? renderedContent : text || null}
          {!hasRenderedContent && refs.length > 0 ? (
            <>
              {" "}
              {refs.map((ref) => (
                <MentionChip key={contextKey(ref)} ref={ref} onInspect={onInspect} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {files.length > 0 ? (
        <div className="flex max-w-full flex-wrap gap-2">
          {files.map((file, index) => (
            <MessageAttachment key={`${file.filename ?? file.mediaType}-${index}`} file={file} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type MessageRowProps = {
  message: AgentReducedMessage;
  createdAt: string;
  isBusy: boolean;
  isLastAssistant: boolean;
  highlighted: boolean;
  stopped: boolean;
  onEdit: (message: AgentReducedMessage) => void;
  onRegenerate: (messageId: string) => void;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};

function MessageRowComponent({
  message,
  createdAt,
  isBusy,
  isLastAssistant,
  highlighted,
  stopped,
  onEdit,
  onRegenerate,
  onApproveTool,
  onInspectContextRef,
}: MessageRowProps) {
  const text = message.text;
  const turn = useMemo(
    () => buildAgentTurnView(message.blocks ?? [], isBusy && isLastAssistant),
    [isBusy, isLastAssistant, message.blocks],
  );
  const timeLabel = messageTimeLabel(createdAt);
  const hasFiles = messageFiles(message).length > 0;

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div
      data-testid="agent-message-row"
      data-agent-message-id={message.id}
      data-highlighted={highlighted ? "true" : undefined}
      data-message-role={message.role}
      className={cn(
        "group/message flex flex-col gap-1 [contain-intrinsic-size:auto_180px] [content-visibility:auto]",
        message.role === "user" ? "items-end" : "items-start",
        highlighted && "scroll-mt-6 rounded-lg bg-primary/5 ring-2 ring-primary/20",
      )}
    >
      {message.role === "user" && (text || hasFiles) ? (
        <UserMessageContent message={message} text={text} onInspect={onInspectContextRef} />
      ) : null}
      {message.role === "assistant" ? (
        <AgentMessageContent
          message={message}
          turn={turn}
          isBusy={isBusy}
          isLastAssistant={isLastAssistant}
          stopped={stopped}
          onApproveTool={onApproveTool}
          onInspectContextRef={onInspectContextRef}
        />
      ) : null}
      {message.role !== "user" && message.contextRefs && message.contextRefs.length > 0 ? (
        <div className="flex max-w-full flex-wrap gap-1">
          {message.contextRefs.map((ref) => (
            <Badge key={contextKey(ref)} variant="outline">
              {contextTypeLabel(ref.type)} · {contextTitle(ref)}
            </Badge>
          ))}
        </div>
      ) : null}
      {message.role === "user" && !text && !hasFiles ? (
        <div className="max-w-full rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          ...
        </div>
      ) : null}
      {timeLabel ? (
        <time
          data-slot="message-time"
          dateTime={createdAt}
          className="px-1 text-[11px] leading-4 text-muted-foreground/70"
        >
          {timeLabel}
        </time>
      ) : null}
      <div className="flex gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
        <Button type="button" size="icon-xs" variant="ghost" title="复制" onClick={copyMessage}>
          <Copy />
        </Button>
        {message.role === "user" ? (
          <Button
            data-testid="agent-edit-message-button"
            type="button"
            size="icon-xs"
            variant="ghost"
            title="编辑并重发"
            disabled={isBusy}
            onClick={() => onEdit(message)}
          >
            <Pencil />
          </Button>
        ) : null}
        {isLastAssistant ? (
          <Button
            data-testid="agent-regenerate-button"
            type="button"
            size="icon-xs"
            variant="ghost"
            title="重新生成"
            disabled={isBusy}
            onClick={() => onRegenerate(message.id)}
          >
            <RefreshCcw />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export const MessageRow = memo(MessageRowComponent, (previous, next) => {
  return (
    previous.message === next.message &&
    previous.createdAt === next.createdAt &&
    previous.isBusy === next.isBusy &&
    previous.isLastAssistant === next.isLastAssistant &&
    previous.highlighted === next.highlighted &&
    previous.stopped === next.stopped &&
    previous.onEdit === next.onEdit &&
    previous.onRegenerate === next.onRegenerate &&
    previous.onApproveTool === next.onApproveTool &&
    previous.onInspectContextRef === next.onInspectContextRef
  );
});

export function MessageList({
  messages,
  isBusy,
  stoppedMessageId,
  error,
  onRetry,
  onEdit,
  onRegenerate,
  onApproveTool,
  onInspectContextRef,
  highlightedMessageId,
}: {
  messages: AgentReducedMessage[];
  isBusy: boolean;
  stoppedMessageId: string | null;
  error?: Error;
  onRetry: () => void;
  onEdit: (message: AgentReducedMessage) => void;
  onRegenerate: (messageId: string) => void;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  highlightedMessageId?: string | null;
}) {
  const lastAssistantId = messages.findLast((message) => message.role === "assistant")?.id;
  const stoppedMessageVisible = stoppedMessageId
    ? messages.some((message) => message.id === stoppedMessageId)
    : true;
  const showPendingAssistant = shouldShowPendingAssistantPlaceholder(messages, isBusy);

  const createdAtFor = (message: AgentReducedMessage) => message.createdAt;

  return (
    <div data-testid="agent-message-list" className="flex w-full flex-col gap-5">
      {messages.length === 0 && !showPendingAssistant ? (
        <Empty data-testid="agent-empty-state" className="border-0 py-16">
          <EmptyHeader>
            <EmptyTitle>开始和 Agent 对话</EmptyTitle>
            <EmptyDescription>直接提问，或通过 @ 选择知识库对象。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          createdAt={createdAtFor(message)}
          isBusy={isBusy}
          isLastAssistant={message.id === lastAssistantId}
          highlighted={highlightedMessageId === message.id}
          stopped={stoppedMessageId === message.id}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
          onApproveTool={onApproveTool}
          onInspectContextRef={onInspectContextRef}
        />
      ))}
      {showPendingAssistant ? <RunningResponsePlaceholder /> : null}
      {stoppedMessageId && !stoppedMessageVisible ? (
        <div
          data-testid="agent-stopped-state"
          className="max-w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          已停止
        </div>
      ) : null}
      {error ? (
        <div
          data-testid="agent-error-banner"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>回复失败：{error.message}</span>
          <Button
            data-testid="agent-retry-button"
            type="button"
            size="sm"
            variant="destructive"
            onClick={onRetry}
          >
            <RefreshCcw />
            重试
          </Button>
        </div>
      ) : null}
    </div>
  );
}
