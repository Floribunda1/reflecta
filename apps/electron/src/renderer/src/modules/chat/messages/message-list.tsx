import { useMemo, type ReactNode } from "react";
import type { ReactVirtualizer } from "@tanstack/react-virtual";
import {
  AgentContextCompactionStatus,
  AgentExecutionBlock,
  AgentFailureStatus,
  AgentPendingBlock,
  AgentStoppedStatus,
} from "@reflecta/ui/chat";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@reflecta/ui/components/empty";
import type {
  AgentContextCompacted,
  AgentEntityCatalogEntry,
  AgentReducedMessage,
} from "@shared/agent";
import { ConnectedChatMessageRow, type ApproveToolInput } from "../adapters/chat-message-adapter";
import type { InspectableContextRef } from "../context/context-reference";
import { activeAssistantMessageId } from "../session/thread-view";

function compactionBlock(compaction: AgentContextCompacted) {
  return {
    kind: "context-compaction" as const,
    compaction: {
      id: compaction.id,
      summary: compaction.summary,
      tokensBefore: compaction.tokensBefore,
      estimatedTokensAfter: compaction.estimatedTokensAfter,
    },
  };
}

export function MessageList({
  messages,
  entityCatalog,
  contextCompactions = [],
  activeRunId,
  isBusy,
  isCompacting = false,
  stoppedMessageId,
  error,
  compactionError,
  onRetry,
  onEdit,
  onRegenerate,
  onForkAssistant,
  onApproveTool,
  onInspectContextRef,
  highlightedMessageId,
  findQuery,
  editingMessageId,
  editingMessageEditor,
  virtualizer,
}: {
  messages: AgentReducedMessage[];
  entityCatalog: AgentEntityCatalogEntry[];
  contextCompactions?: AgentContextCompacted[];
  activeRunId: string | null;
  isBusy: boolean;
  isCompacting?: boolean;
  stoppedMessageId: string | null;
  error?: Error;
  compactionError?: Error;
  onRetry: () => void;
  onEdit: (message: AgentReducedMessage) => void;
  onRegenerate: (messageId: string) => void;
  onForkAssistant?: (messageId: string) => void;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  highlightedMessageId?: string | null;
  findQuery?: string;
  editingMessageId?: string;
  editingMessageEditor?: ReactNode;
  virtualizer?: ReactVirtualizer<HTMLDivElement, HTMLDivElement>;
}) {
  const lastAssistantId = messages.findLast((message) => message.role === "assistant")?.id;
  const activeAssistantId = activeAssistantMessageId(messages, activeRunId);
  const stoppedMessageVisible = stoppedMessageId
    ? messages.some((message) => message.id === stoppedMessageId)
    : true;
  const showPendingAssistant = isBusy && !activeAssistantId;
  const compactionsByMessage = useMemo(() => {
    const grouped = new Map<string, AgentContextCompacted[]>();
    for (const compaction of contextCompactions) {
      if (!compaction.afterMessageId) continue;
      const current = grouped.get(compaction.afterMessageId) ?? [];
      grouped.set(compaction.afterMessageId, [...current, compaction]);
    }
    return grouped;
  }, [contextCompactions]);
  const messageIds = useMemo(() => new Set(messages.map((message) => message.id)), [messages]);
  const unanchoredCompactions = contextCompactions.filter(
    (compaction) => !compaction.afterMessageId || !messageIds.has(compaction.afterMessageId),
  );
  const virtualItems = virtualizer?.getVirtualItems();

  const renderMessage = (message: AgentReducedMessage, index: number, virtualized: boolean) => {
    const editing = editingMessageId === message.id;
    const compactions = compactionsByMessage.get(message.id) ?? [];
    return (
      <div
        key={message.id}
        ref={virtualized ? virtualizer?.measureElement : undefined}
        data-index={virtualized ? index : undefined}
        data-agent-message-id={message.id}
        data-message-role={message.role}
        className={
          virtualized ? "absolute top-0 left-0 flex w-full flex-col gap-5" : "flex flex-col gap-5"
        }
      >
        {editing && editingMessageEditor ? (
          <div
            data-testid="agent-message-edit-row"
            className="flex w-full flex-col items-end gap-1"
          >
            {editingMessageEditor}
          </div>
        ) : (
          <ConnectedChatMessageRow
            message={message}
            entityCatalog={entityCatalog}
            isBusy={isBusy}
            isLastAssistant={message.id === lastAssistantId}
            assistantRunning={message.id === activeAssistantId}
            highlighted={highlightedMessageId === message.id}
            findQuery={findQuery}
            stopped={stoppedMessageId === message.id}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onForkAssistant={onForkAssistant}
            onApproveTool={onApproveTool}
            onInspectContextRef={onInspectContextRef}
          />
        )}
        {compactions.map((compaction) => (
          <AgentExecutionBlock key={compaction.id} block={compactionBlock(compaction)} />
        ))}
      </div>
    );
  };

  return (
    <div data-testid="agent-message-list" className="mx-auto w-full max-w-4xl">
      {messages.length === 0 && !showPendingAssistant ? (
        <Empty data-testid="agent-empty-state" className="border-0 py-16">
          <EmptyHeader>
            <EmptyTitle>开始和 Agent 对话</EmptyTitle>
            <EmptyDescription>直接提问，或通过 @ 选择知识库对象。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {virtualizer ? (
        <div ref={virtualizer.containerRef} className="relative w-full">
          {virtualItems?.map((item) => renderMessage(messages[item.index]!, item.index, true))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {messages.map((message, index) => renderMessage(message, index, false))}
        </div>
      )}
      <div className={messages.length > 0 ? "mt-5 flex flex-col gap-5" : "flex flex-col gap-5"}>
        {unanchoredCompactions.map((compaction) => (
          <AgentExecutionBlock key={compaction.id} block={compactionBlock(compaction)} />
        ))}
        {isCompacting ? <AgentContextCompactionStatus /> : null}
        {showPendingAssistant ? <AgentPendingBlock /> : null}
        {stoppedMessageId && !stoppedMessageVisible ? <AgentStoppedStatus /> : null}
        {error ? <AgentFailureStatus error={error.message} onRetry={onRetry} /> : null}
        {compactionError ? (
          <div
            data-testid="agent-context-compaction-error"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            压缩上下文失败：{compactionError.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
