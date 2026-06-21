import { memo, useMemo, useRef, type ReactNode } from "react";
import { Copy, FileText, Pencil, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import type { FileUIPart } from "ai";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@renderer/components/ui/empty";
import type { AgentChatMessage, AgentContextRef } from "@shared/chat";
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
import { messageText } from "../shared/text";
import type { ComposerJSON } from "../composer/composer-content";
import { AgentMessageContent, type ApproveToolInput } from "./agent-message-content";
import { buildAgentTurnView } from "./agent-turn-view";

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
      className={`${messageContextMentionClass(ref.type)} cursor-pointer rounded-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50`}
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

function fileUIParts(message: AgentChatMessage): FileUIPart[] {
  return message.parts.filter(
    (part): part is FileUIPart =>
      part.type === "file" && typeof part.url === "string" && typeof part.mediaType === "string",
  );
}

function MessageAttachment({ file }: { file: FileUIPart }) {
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
    <div className="flex max-w-72 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
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
  message: AgentChatMessage;
  text: string;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
  const refs = message.metadata?.contextRefs ?? [];
  const files = fileUIParts(message);
  const content = message.metadata?.composerContent as ComposerJSON | undefined;
  const renderedContent = content?.content?.map((node, index) =>
    renderComposerNode(node, String(index), onInspect),
  );

  return (
    <div
      data-slot="user-message-content"
      className="grid max-w-full gap-2 whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 leading-6 text-foreground"
    >
      {renderedContent && renderedContent.length > 0 ? renderedContent : text || null}
      {!renderedContent && refs.length > 0 ? (
        <>
          {" "}
          {refs.map((ref) => (
            <MentionChip key={contextKey(ref)} ref={ref} onInspect={onInspect} />
          ))}
        </>
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
  message: AgentChatMessage;
  createdAt: string;
  isBusy: boolean;
  isLastAssistant: boolean;
  stopped: boolean;
  onEdit: (message: AgentChatMessage) => void;
  onRegenerate: (messageId: string) => void;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};

function MessageRowComponent({
  message,
  createdAt,
  isBusy,
  isLastAssistant,
  stopped,
  onEdit,
  onRegenerate,
  onApproveTool,
  onInspectContextRef,
}: MessageRowProps) {
  const text = useMemo(() => messageText(message), [message]);
  const turn = useMemo(() => buildAgentTurnView(message.parts), [message.parts]);
  const timeLabel = messageTimeLabel(createdAt);
  const hasFiles = fileUIParts(message).length > 0;

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div
      className={[
        "group/message flex flex-col gap-1 [contain-intrinsic-size:auto_180px] [content-visibility:auto]",
        message.role === "user" ? "items-end" : "items-start",
      ].join(" ")}
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
      {message.role !== "user" &&
      message.metadata?.contextRefs &&
      message.metadata.contextRefs.length > 0 ? (
        <div className="flex max-w-full flex-wrap gap-1">
          {message.metadata.contextRefs.map((ref) => (
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
}: {
  messages: AgentChatMessage[];
  isBusy: boolean;
  stoppedMessageId: string | null;
  error?: Error;
  onRetry: () => void;
  onEdit: (message: AgentChatMessage) => void;
  onRegenerate: (messageId: string) => void;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  const lastAssistantId = messages.findLast((message) => message.role === "assistant")?.id;
  const localCreatedAtById = useRef(new Map<string, string>());

  const createdAtFor = (message: AgentChatMessage) => {
    if (message.createdAt) return message.createdAt;
    const cached = localCreatedAtById.current.get(message.id);
    if (cached) return cached;
    const createdAt = new Date().toISOString();
    localCreatedAtById.current.set(message.id, createdAt);
    return createdAt;
  };

  return (
    <div className="flex w-full flex-col gap-5">
      {messages.length === 0 ? (
        <Empty className="border-0 py-16">
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
          stopped={stoppedMessageId === message.id}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
          onApproveTool={onApproveTool}
          onInspectContextRef={onInspectContextRef}
        />
      ))}
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error.message}</span>
          <Button type="button" size="sm" variant="destructive" onClick={onRetry}>
            <RefreshCcw />
            重试
          </Button>
        </div>
      ) : null}
    </div>
  );
}
