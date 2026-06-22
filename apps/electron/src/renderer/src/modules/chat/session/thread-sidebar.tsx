import { memo, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Spinner } from "@renderer/components/ui/spinner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { APP_CHROME_MENU_HIT_AREA_CLASS } from "@renderer/modules/shared/layout/AppChromeMenu";
import { cn } from "@renderer/lib/utils";
import type { AgentThreadDTO } from "@shared/chat";
import { groupAgentThreads } from "./thread-groups";

function ThreadSidebarComponent({
  threads,
  pending,
  activeThreadId,
  runningThreadId,
  onSelect,
  onCreate,
  onRename,
  onGenerateTitle,
  onArchive,
  onDelete,
  titleGenerating,
}: {
  threads: AgentThreadDTO[];
  pending?: boolean;
  activeThreadId: string | null;
  runningThreadId: string | null;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onRename: (threadId: string, title: string) => void;
  onGenerateTitle: (threadId: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  titleGenerating?: boolean;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const groups = useMemo(() => groupAgentThreads(threads), [threads]);
  const finishRename = (thread: AgentThreadDTO) => {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (title && title !== thread.title) onRename(thread.id, title);
  };
  const startRename = (thread: AgentThreadDTO) => {
    setRenamingId(thread.id);
    setRenameDraft(thread.title);
  };

  return (
    <aside className="flex h-full min-h-0 w-[248px] shrink-0 flex-col overflow-hidden">
      <div className="app-drag-region relative pl-4 pr-2 pt-14 pb-3">
        {/* Electron requires no-drag inside the same drag region to release this hit area. */}
        <div
          data-no-drag
          aria-hidden="true"
          className={`${APP_CHROME_MENU_HIT_AREA_CLASS} pointer-events-none`}
        />
        <div className="flex h-8 items-center justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-medium">对话</div>
          <Button
            data-no-drag
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-8"
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
            <div key={group.id} className="space-y-0.5">
              <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
              {group.threads.map((thread) => (
                <ContextMenu key={thread.id}>
                  <ContextMenuTrigger
                    render={
                      <Button
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
                        <span className="min-w-0 flex-1">
                          {renamingId === thread.id ? (
                            <Input
                              autoFocus
                              className="h-7 w-full text-sm"
                              value={renameDraft}
                              onBlur={() => finishRename(thread)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => setRenameDraft(event.target.value)}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") finishRename(thread);
                                if (event.key === "Escape") setRenamingId(null);
                              }}
                            />
                          ) : (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="block min-w-0 flex-1 truncate text-sm">
                                {thread.title}
                              </span>
                              {thread.id === runningThreadId ? (
                                <Spinner
                                  aria-label="Agent 正在响应"
                                  className="size-3 shrink-0 text-muted-foreground"
                                />
                              ) : null}
                            </span>
                          )}
                        </span>
                      </Button>
                    }
                  />
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => startRename(thread)}>重命名</ContextMenuItem>
                    <ContextMenuItem
                      disabled={titleGenerating || thread.id === runningThreadId}
                      onClick={() => onGenerateTitle(thread.id)}
                    >
                      {titleGenerating ? "生成中..." : "生成标题"}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onArchive(thread.id)}>归档</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onClick={() => onDelete(thread.id)}>
                      删除
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

export const ThreadSidebar = memo(ThreadSidebarComponent);
