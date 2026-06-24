import { useEffect } from "react";
import { X } from "lucide-react";
import type { AgentContextRef } from "@shared/agent";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";
import { AgentThreadPanel } from "./agent-thread-panel";
import { useCreateThreadMutation } from "./session/server-state";

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

export function ContextualAgentDock({
  testId,
  scope,
  threadId,
  contextNonce,
  onBindThread,
  onClose,
  className,
}: ContextualAgentDockProps) {
  const createThreadMutation = useCreateThreadMutation();
  const contextKey = scope ? `${scope.type}:${scope.id}:${contextNonce}` : undefined;
  const title = scopeTitle(scope);

  useEffect(() => {
    if (!scope || threadId || createThreadMutation.isPending) return;
    createThreadMutation.mutate(`聊聊：${title}`, {
      onSuccess: (thread) => onBindThread(thread.id),
    });
  }, [scope, threadId, title, onBindThread, createThreadMutation]);

  return (
    <aside
      data-testid={testId}
      className={cn("flex h-full min-h-0 min-w-0 flex-col bg-card/90", className)}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">Agent</div>
          <div className="truncate text-xs text-muted-foreground">{title}</div>
        </div>
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

      <div className="min-h-0 flex-1">
        {threadId ? (
          <AgentThreadPanel
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
