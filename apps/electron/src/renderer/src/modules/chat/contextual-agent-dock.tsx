import { useCallback, useEffect } from "react";
import { Clock, ExternalLink, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AgentContextRef, AgentSessionSummary } from "@shared/agent";
import { Button } from "@reflecta/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { cn } from "@reflecta/ui/lib/utils";
import { AgentThreadPanel } from "./agent-thread-panel";
import { useAgentUiActions } from "./session/chat-ui-store";
import { useCreateThreadMutation, useThreadsQuery } from "./session/server-state";

type ContextualAgentDockProps = {
  testId: string;
  scope: AgentContextRef | null;
  threadId: string | null;
  contextNonce: number;
  onBindThread: (threadId: string) => void;
  onClose: () => void;
  className?: string;
};

function scopeTitle(scope: AgentContextRef | null) {
  if (!scope) return "当前上下文";
  return scope.title?.trim() || (scope.type === "domain" ? "当前领域" : "当前理解");
}

function scopeContextRefs(scope: AgentContextRef | null): AgentContextRef[] {
  return scope ? [scope] : [];
}

function contextThreadTitle(title: string) {
  return `聊聊：${title}`;
}

export function buildContextualAgentHistoryItems(
  threads: AgentSessionSummary[],
  threadId: string | null,
) {
  return threads
    .filter((thread) => thread.id !== threadId)
    .slice(0, 10)
    .map((thread) => ({ id: thread.id, title: thread.title }));
}

export function ContextualAgentDock({
  testId,
  scope,
  threadId,
  contextNonce,
  onBindThread,
  onClose,
  className,
}: ContextualAgentDockProps) {
  const navigate = useNavigate();
  const agentUiActions = useAgentUiActions();
  const { mutate: createThread, isPending: createThreadPending } = useCreateThreadMutation();
  const threadsQuery = useThreadsQuery();
  const threads = threadsQuery.data ?? [];
  const contextKey = scope
    ? `${scope.type}:${scope.id}:${threadId ?? "draft"}:${contextNonce}`
    : undefined;
  const title = scopeTitle(scope);
  const historyItems = buildContextualAgentHistoryItems(threads, threadId);
  const historyLoading = threadsQuery.isFetching;
  const createContextThread = useCallback(() => {
    if (!scope) return;
    createThread(contextThreadTitle(title), {
      onSuccess: (thread) => onBindThread(thread.id),
    });
  }, [createThread, onBindThread, scope, title]);
  const jumpToAgent = useCallback(() => {
    if (!threadId) return;
    agentUiActions.selectThread(threadId);
    agentUiActions.requestComposerFocus(threadId);
    void navigate("/agent");
  }, [agentUiActions, navigate, threadId]);

  useEffect(() => {
    if (!scope || threadId || createThreadPending) return;
    createContextThread();
  }, [createContextThread, createThreadPending, scope, threadId]);

  return (
    <aside
      data-testid={testId}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col border-l border-border bg-background",
        className,
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="min-w-0 flex-1">
          <div data-testid="contextual-agent-title" className="truncate text-sm font-medium">
            {title}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="跳转到 Agent 页面"
            data-testid="contextual-agent-jump-button"
            disabled={!threadId}
            onClick={jumpToAgent}
          >
            <ExternalLink />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" size="icon-xs" variant="ghost" />}
              data-testid="contextual-agent-history-button"
              aria-label="历史对话"
              disabled={!scope}
            >
              <Clock />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>历史对话</DropdownMenuLabel>
                {historyItems.length > 0 ? (
                  historyItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      data-testid="contextual-agent-history-thread"
                      onClick={() => onBindThread(item.id)}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    {historyLoading ? "加载历史..." : "暂无历史"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="新建上下文对话"
            data-testid="contextual-agent-new-button"
            disabled={!scope || createThreadPending}
            onClick={createContextThread}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="关闭 Agent"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {threadId ? (
          <AgentThreadPanel
            key={threadId}
            threadId={threadId}
            initialContextKey={contextKey}
            initialContextRefs={scopeContextRefs(scope)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载 Agent...
          </div>
        )}
      </div>
    </aside>
  );
}
