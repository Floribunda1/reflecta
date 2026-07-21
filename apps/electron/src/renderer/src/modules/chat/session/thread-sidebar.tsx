import { memo, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { Spinner } from "@renderer/components/ui/spinner";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { AppChromeMenu } from "@renderer/modules/shared/layout/AppChromeMenu";
import { SidebarToggleButton } from "@renderer/modules/shared/layout/SidebarToggleButton";
import { cn } from "@renderer/lib/utils";
import { ipcClient } from "@renderer/utils/ipc";
import { reduceAgentSession, type AgentSessionSummary } from "@shared/agent";
import { toast } from "sonner";
import { groupAgentThreads } from "./thread-groups";
import { exportThreadMarkdown, ThreadActionMenuItems } from "./thread-action-menu-items";

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

async function exportThread(thread: AgentSessionSummary) {
  try {
    const events = await ipcClient.chat.readSessionEvents(thread.id);
    await exportThreadMarkdown(thread.title, reduceAgentSession(events).messages);
  } catch (error) {
    toast.error("导出 Markdown 失败", { description: errorMessage(error) });
  }
}

async function compactThread(threadId: string) {
  try {
    const [modelSelection, reasoningLevel] = await Promise.all([
      ipcClient.config.getActiveAgentModel(),
      ipcClient.config.getActiveAgentReasoningLevel(),
    ]);
    await ipcClient.chat.sendAgentCommand({
      type: "context.compact",
      sessionId: threadId,
      modelSelection: modelSelection ?? undefined,
      reasoningLevel,
    });
    toast.success("上下文已压缩");
  } catch (error) {
    toast.error("压缩上下文失败", { description: errorMessage(error) });
  }
}

function ThreadSidebarComponent({
  threads,
  pending,
  activeThreadId,
  runningThreadId,
  onSelect,
  onCreate,
  onCollapse,
  onGenerateTitle,
  onArchive,
  onDelete,
  titleGeneratingThreadId,
}: {
  threads: AgentSessionSummary[];
  pending?: boolean;
  activeThreadId: string | null;
  runningThreadId: string | null;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onCollapse: () => void;
  onGenerateTitle: (threadId: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  titleGeneratingThreadId?: string | null;
}) {
  const groups = useMemo(() => groupAgentThreads(threads), [threads]);

  return (
    <aside
      data-testid="agent-thread-sidebar"
      className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden"
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
                  <ContextMenu key={thread.id}>
                    <ContextMenuTrigger
                      render={
                        <Button
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
                          onContextMenu={() => onSelect(thread.id)}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="block min-w-0 flex-1 truncate text-sm">
                              {thread.title}
                            </span>
                            {generatingTitle || running ? (
                              <Spinner
                                aria-label={generatingTitle ? "正在生成标题" : "Agent 正在响应"}
                                className="size-3 shrink-0 text-muted-foreground"
                              />
                            ) : null}
                          </span>
                        </Button>
                      }
                    />
                    <ContextMenuContent data-testid="agent-thread-context-menu" className="w-44">
                      <ThreadActionMenuItems
                        menu="context"
                        threadId={thread.id}
                        canExport
                        hasMessages
                        isBusy={running}
                        isCompacting={false}
                        titleGenerating={generatingTitle}
                        onExport={() => void exportThread(thread)}
                        onGenerateTitle={() => onGenerateTitle(thread.id)}
                        onCompact={() => void compactThread(thread.id)}
                        onArchive={() => onArchive(thread.id)}
                        onDelete={() => onDelete(thread.id)}
                      />
                    </ContextMenuContent>
                  </ContextMenu>
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
