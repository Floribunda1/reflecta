import { useMemo, type ReactNode } from "react";
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
}) {
  const lastAssistantId = messages.findLast((message) => message.role === "assistant")?.id;
  const activeAssistantId = activeAssistantMessageId(messages, activeRunId);
  const editingMessageIndex = editingMessageId
    ? messages.findIndex((message) => message.id === editingMessageId)
    : -1;
  // The editor stays outside the mapped message branch; flex order places it visually in situ.
  const firstMessageOrder = -messages.length * 2;
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

  return (
    <div data-testid="agent-message-list" className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {messages.length === 0 && !showPendingAssistant ? (
        <Empty data-testid="agent-empty-state" className="border-0 py-16">
          <EmptyHeader>
            <EmptyTitle>开始和 Agent 对话</EmptyTitle>
            <EmptyDescription>直接提问，或通过 @ 选择知识库对象。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {messages.map((message, index) => {
        const editing = editingMessageId === message.id;
        const compactions = compactionsByMessage.get(message.id) ?? [];
        return (
          <div
            key={message.id}
            className={editing && compactions.length === 0 ? "hidden" : "flex flex-col gap-5"}
            style={{ order: firstMessageOrder + index * 2 + 1 }}
          >
            {editing ? null : (
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
      })}
      <div
        data-testid={editingMessageIndex >= 0 ? "agent-message-edit-row" : undefined}
        data-agent-message-id={editingMessageIndex >= 0 ? editingMessageId : undefined}
        data-message-role={editingMessageIndex >= 0 ? "user" : undefined}
        className={
          editingMessageIndex >= 0 && editingMessageEditor
            ? "flex w-full flex-col items-end gap-1"
            : "hidden"
        }
        style={{ order: firstMessageOrder + editingMessageIndex * 2 }}
      >
        {editingMessageEditor}
      </div>
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
  );
}
