import { useCallback, useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Clock, Plus, X } from "lucide-react";
import type { AgentContextRef, AgentSessionEvent, AgentSessionSummary } from "@shared/agent";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { cn } from "@renderer/lib/utils";
import { ipcClient } from "@renderer/utils/ipc";
import { AgentThreadPanel } from "./agent-thread-panel";
import { chatQueryKeys } from "./session/query-keys";
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

function sameContextRef(left: AgentContextRef | null, right: AgentContextRef | null) {
  return Boolean(left && right && left.type === right.type && left.id === right.id);
}

function userMessageMatchesScope(event: AgentSessionEvent, scope: AgentContextRef | null) {
  return (
    event.type === "user.message" &&
    Array.isArray(event.contextRefs) &&
    event.contextRefs.some((ref) => sameContextRef(ref, scope))
  );
}

function firstUserText(events: AgentSessionEvent[]) {
  const message = events.find((event) => event.type === "user.message");
  return message?.type === "user.message" ? message.text.trim() : "";
}

function contextThreadTitle(title: string) {
  return `聊聊：${title}`;
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
  const { mutate: createThread, isPending: createThreadPending } = useCreateThreadMutation();
  const threadsQuery = useThreadsQuery();
  const threads = threadsQuery.data ?? [];
  const eventQueries = useQueries({
    queries: threads.map((thread) => ({
      queryKey: chatQueryKeys.sessionEvents(thread.id),
      queryFn: (): Promise<AgentSessionEvent[]> => ipcClient.chat.readSessionEvents(thread.id),
      enabled: Boolean(scope),
    })),
  });
  const contextKey = scope
    ? `${scope.type}:${scope.id}:${threadId ?? "draft"}:${contextNonce}`
    : undefined;
  const title = scopeTitle(scope);
  const historyItems = useMemo(() => {
    if (!scope) return [];
    return threads
      .flatMap((thread: AgentSessionSummary, index) => {
        if (thread.id === threadId) return [];
        const events = eventQueries[index]?.data ?? [];
        if (!events.some((event) => userMessageMatchesScope(event, scope))) return [];
        return {
          id: thread.id,
          title: firstUserText(events) || thread.title,
        };
      })
      .slice(0, 8);
  }, [eventQueries, scope, threadId, threads]);
  const historyLoading =
    threadsQuery.isFetching || eventQueries.some((query) => query.isFetching && !query.data);
  const createContextThread = useCallback(() => {
    if (!scope) return;
    createThread(contextThreadTitle(title), {
      onSuccess: (thread) => onBindThread(thread.id),
    });
  }, [createThread, onBindThread, scope, title]);

  useEffect(() => {
    if (!scope || threadId || createThreadPending) return;
    createContextThread();
  }, [createContextThread, createThreadPending, scope, threadId]);

  return (
    <aside
      data-testid={testId}
      className={cn("flex h-full min-h-0 min-w-0 flex-col bg-card", className)}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="min-w-0 flex-1">
          <div data-testid="contextual-agent-title" className="truncate text-sm font-medium">
            {title}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" size="icon-xs" variant="ghost" />}
              data-testid="contextual-agent-history-button"
              aria-label="历史对话"
              className="data-popup-open:bg-muted data-popup-open:text-foreground"
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
