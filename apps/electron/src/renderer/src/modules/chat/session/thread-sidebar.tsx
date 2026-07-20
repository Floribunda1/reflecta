import { memo, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Spinner } from "@renderer/components/ui/spinner";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { AppChromeMenu } from "@renderer/modules/shared/layout/AppChromeMenu";
import { SidebarToggleButton } from "@renderer/modules/shared/layout/SidebarToggleButton";
import { cn } from "@renderer/lib/utils";
import type { AgentSessionSummary } from "@shared/agent";
import { groupAgentThreads } from "./thread-groups";

function ThreadSidebarComponent({
  threads,
  pending,
  activeThreadId,
  runningThreadId,
  onSelect,
  onCreate,
  onCollapse,
  titleGeneratingThreadId,
}: {
  threads: AgentSessionSummary[];
  pending?: boolean;
  activeThreadId: string | null;
  runningThreadId: string | null;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onCollapse: () => void;
  titleGeneratingThreadId?: string | null;
}) {
  const groups = useMemo(() => groupAgentThreads(threads), [threads]);

  return (
    <aside
      data-testid="agent-thread-sidebar"
      className="flex h-full min-h-0 w-[248px] shrink-0 flex-col overflow-hidden"
    >
      <div className="app-drag-region relative pl-4 pr-2 pt-14 pb-3">
        <SidebarToggleButton
          expanded
          label="收起对话列表"
          testId="agent-sidebar-collapse-button"
          className="absolute top-2.5 right-2"
          onClick={onCollapse}
        />
        <div className="flex h-8 items-center justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-medium">对话</div>
          <Button
            data-no-drag
            data-testid="agent-new-thread-button"
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-8 hover:bg-foreground/5 hover:text-foreground"
            aria-label="新建对话"
            onClick={onCreate}
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-2">
          {pending && threads.length === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">加载对话...</div>
          ) : null}
          {!pending && threads.length === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">还没有对话</div>
          ) : null}
          {groups.map((group) => (
            <div
              key={group.id}
              data-testid="agent-thread-group"
              data-thread-group-id={group.id}
              className="space-y-0.5"
            >
              <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
              {group.threads.map((thread) => {
                const generatingTitle = thread.id === titleGeneratingThreadId;
                const running = thread.id === runningThreadId;
                return (
                  <Button
                    key={thread.id}
                    data-testid="agent-thread-item"
                    data-thread-title={thread.title}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto w-full min-w-0 justify-start p-1.5 text-left font-normal text-foreground/85 hover:bg-foreground/5 hover:text-foreground",
                      thread.id === activeThreadId &&
                        "bg-foreground/5 text-foreground font-medium hover:bg-foreground/5",
                    )}
                    onClick={() => onSelect(thread.id)}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="block min-w-0 flex-1 truncate text-sm">{thread.title}</span>
                      {generatingTitle || running ? (
                        <Spinner
                          aria-label={generatingTitle ? "正在生成标题" : "Agent 正在响应"}
                          className="size-3 shrink-0 text-muted-foreground"
                        />
                      ) : null}
                    </span>
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
      <AppChromeMenu />
    </aside>
  );
}

export const ThreadSidebar = memo(ThreadSidebarComponent);
