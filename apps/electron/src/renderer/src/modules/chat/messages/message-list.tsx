import { Fragment, useMemo } from "react";
import { RefreshCcw } from "lucide-react";
import { AgentExecutionBlock, AgentPendingBlock } from "@reflecta/ui/chat";
import { Button } from "@reflecta/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@reflecta/ui/components/empty";
import type {
  AgentContextCompacted,
  AgentEntityCatalogEntry,
  AgentReducedMessage,
} from "@shared/agent";
import { ConnectedChatMessageRow, type ApproveToolInput } from "../adapters/chat-message-adapter";
import type { InspectableContextRef } from "../context/context-reference";
import { shouldShowPendingAssistantPlaceholder } from "../session/thread-view";

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
}: {
  messages: AgentReducedMessage[];
  entityCatalog: AgentEntityCatalogEntry[];
  contextCompactions?: AgentContextCompacted[];
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
}) {
  const lastAssistantId = messages.findLast((message) => message.role === "assistant")?.id;
  const stoppedMessageVisible = stoppedMessageId
    ? messages.some((message) => message.id === stoppedMessageId)
    : true;
  const showPendingAssistant = shouldShowPendingAssistantPlaceholder(messages, isBusy);
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
      {messages.map((message) => (
        <Fragment key={message.id}>
          <ConnectedChatMessageRow
            message={message}
            entityCatalog={entityCatalog}
            isBusy={isBusy}
            isLastAssistant={message.id === lastAssistantId}
            highlighted={highlightedMessageId === message.id}
            findQuery={findQuery}
            stopped={stoppedMessageId === message.id}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onForkAssistant={onForkAssistant}
            onApproveTool={onApproveTool}
            onInspectContextRef={onInspectContextRef}
          />
          {compactionsByMessage.get(message.id)?.map((compaction) => (
            <AgentExecutionBlock key={compaction.id} block={compactionBlock(compaction)} />
          ))}
        </Fragment>
      ))}
      {unanchoredCompactions.map((compaction) => (
        <AgentExecutionBlock key={compaction.id} block={compactionBlock(compaction)} />
      ))}
      {isCompacting ? (
        <div
          data-testid="agent-context-compaction-progress"
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        >
          正在压缩较早的对话上下文…
        </div>
      ) : null}
      {showPendingAssistant ? <AgentPendingBlock /> : null}
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
