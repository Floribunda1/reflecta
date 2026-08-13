import {
  Archive,
  Copy,
  FileDown,
  Minimize2,
  PanelLeft,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "#components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "#components/context-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "#components/dropdown-menu";
import { ScrollArea } from "#components/scroll-area";
import { Spinner } from "#components/spinner";
import { cn } from "#lib/utils";

export type ChatThreadAction =
  | "export"
  | "generate-title"
  | "compact"
  | "copy-id"
  | "archive"
  | "delete";

export type ChatThreadSummaryView = {
  id: string;
  title: string;
  running?: boolean;
  titleGenerating?: boolean;
  compacting?: boolean;
  hasMessages?: boolean;
};

export type ChatThreadGroupView = {
  id: string;
  label: string;
  threads: readonly ChatThreadSummaryView[];
};

export function ChatThreadActionMenuItems({
  menu,
  canExport,
  hasMessages,
  isBusy,
  isCompacting,
  titleGenerating,
  onAction,
}: {
  menu: "dropdown" | "context";
  canExport: boolean;
  hasMessages: boolean;
  isBusy: boolean;
  isCompacting: boolean;
  titleGenerating: boolean;
  onAction: (action: ChatThreadAction) => void;
}) {
  const Item = menu === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator = menu === "context" ? ContextMenuSeparator : DropdownMenuSeparator;

  return (
    <>
      <Item
        data-testid="agent-export-markdown-button"
        disabled={!canExport}
        onClick={() => onAction("export")}
      >
        <FileDown />
        导出 Markdown
      </Item>
      <Separator />
      <Item
        data-testid="agent-generate-title-menu-item"
        disabled={titleGenerating || isBusy || isCompacting}
        onClick={() => onAction("generate-title")}
      >
        <Sparkles />
        {titleGenerating ? "生成中..." : "生成标题"}
      </Item>
      <Item
        data-testid="agent-compact-context-menu-item"
        disabled={!hasMessages || isBusy || isCompacting}
        onClick={() => onAction("compact")}
      >
        <Minimize2 />
        {isCompacting ? "压缩中..." : "压缩上下文"}
      </Item>
      <Item data-testid="agent-copy-thread-id-menu-item" onClick={() => onAction("copy-id")}>
        <Copy />
        复制对话 ID
      </Item>
      <Item data-testid="agent-archive-thread-menu-item" onClick={() => onAction("archive")}>
        <Archive />
        归档
      </Item>
      <Separator />
      <Item
        data-testid="agent-delete-thread-menu-item"
        variant="destructive"
        onClick={() => onAction("delete")}
      >
        <Trash2 />
        删除
      </Item>
    </>
  );
}

export function ChatThreadSidebar({
  groups,
  pending = false,
  activeThreadId,
  className,
  onSelect,
  onCreate,
  onCollapse,
  onAction,
}: {
  groups: readonly ChatThreadGroupView[];
  pending?: boolean;
  activeThreadId: string | null;
  className?: string;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onCollapse: () => void;
  onAction: (threadId: string, action: ChatThreadAction) => void;
}) {
  const threadCount = groups.reduce((count, group) => count + group.threads.length, 0);

  return (
    <aside
      data-testid="agent-thread-sidebar"
      className={cn("flex min-h-0 w-full flex-1 flex-col overflow-hidden", className)}
    >
      <div className="app-drag-region relative pt-14 pr-2 pb-3 pl-4">
        <Button
          data-no-drag
          data-testid="agent-sidebar-collapse-button"
          type="button"
          size="icon-sm"
          variant="ghost"
          className="absolute top-2.5 right-2"
          aria-label="收起对话列表"
          title="收起对话列表"
          onClick={onCollapse}
        >
          <PanelLeft size={16} />
        </Button>
        <div className="flex h-8 items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">对话</span>
          </div>
          <Button
            data-no-drag
            data-testid="agent-new-thread-button"
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="新建对话"
            onClick={onCreate}
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-2">
          {pending && threadCount === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">加载对话...</div>
          ) : null}
          {!pending && threadCount === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">还没有对话</div>
          ) : null}
          {groups.map((group) => (
            <div
              key={group.id}
              data-testid="agent-thread-group"
              data-thread-group-id={group.id}
              className="space-y-1"
            >
              {/* DESIGN: 时间分组 eyebrow label——10px 用户特批字号（排版尺外，尺最小 12px）+ tracking-wider 字距 + 紧凑行高。 */}
              <div className="px-2.5 pb-1.5 text-[10px] leading-4 font-medium tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.threads.map((thread) => (
                <ContextMenu key={thread.id}>
                  <ContextMenuTrigger
                    render={
                      <Button
                        data-testid="agent-thread-item"
                        data-thread-title={thread.title}
                        type="button"
                        variant={thread.id === activeThreadId ? "secondary" : "ghost"}
                        size="sm"
                        // DESIGN: sm 用 0.8rem，避免和面板「对话」同档；h-8 盖掉 sm 的 h-7，行高略撑开。
                        className={cn(
                          "h-8 w-full min-w-0 justify-start px-2.5 text-left font-normal",
                          thread.id === activeThreadId ? "font-medium" : "text-muted-foreground",
                        )}
                        onClick={() => onSelect(thread.id)}
                        onContextMenu={() => onSelect(thread.id)}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="block min-w-0 flex-1 truncate">{thread.title}</span>
                          {thread.titleGenerating || thread.running || thread.compacting ? (
                            <Spinner
                              aria-label={
                                thread.titleGenerating
                                  ? "正在生成标题"
                                  : thread.compacting
                                    ? "正在压缩上下文"
                                    : "Agent 正在响应"
                              }
                              className="size-3 shrink-0 text-muted-foreground"
                            />
                          ) : null}
                        </span>
                      </Button>
                    }
                  />
                  <ContextMenuContent data-testid="agent-thread-context-menu" className="w-44">
                    <ChatThreadActionMenuItems
                      menu="context"
                      canExport
                      hasMessages={thread.hasMessages ?? true}
                      isBusy={Boolean(thread.running)}
                      isCompacting={Boolean(thread.compacting)}
                      titleGenerating={Boolean(thread.titleGenerating)}
                      onAction={(action) => onAction(thread.id, action)}
                    />
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
