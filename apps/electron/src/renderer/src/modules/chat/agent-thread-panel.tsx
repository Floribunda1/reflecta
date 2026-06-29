import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Copy,
  FileDown,
  MoreHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type {
  AgentContextRef,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentReducedMessage,
} from "@shared/agent";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { Input } from "@renderer/components/ui/input";
import { cn } from "@renderer/lib/utils";
import { useMemoizedFn } from "ahooks";
import { toast } from "sonner";
import { ipcClient } from "@renderer/utils/ipc";
import { ChatComposer } from "./composer/chat-composer";
import type { InspectableContextRef } from "./context/context-reference";
import { MessageList } from "./messages/message-list";
import { usePiAgentThreadView } from "./session/pi-thread-view";
import {
  useAgentModelOptionsQuery,
  useSelectAgentModelMutation,
  useSelectAgentReasoningLevelMutation,
} from "./session/server-state";
import { buildChatFindMatches, type ChatFindMatch, type ChatJumpItem } from "./session/thread-view";

const CHAT_JUMP_MIN_ITEMS = 4;

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

type AgentThreadPanelProps = {
  threadId: string;
  title?: string;
  scrollRequest?: number;
  initialContextKey?: string;
  initialContextRefs?: AgentContextRef[];
  titleGenerating?: boolean;
  onRename?: (title: string) => void;
  onGenerateTitle?: () => void;
  onForkAssistantMessage?: (messageId: string) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};

export function AgentThreadPanel({
  threadId,
  title,
  scrollRequest = 0,
  initialContextKey,
  initialContextRefs,
  titleGenerating,
  onRename,
  onGenerateTitle,
  onForkAssistantMessage,
  onArchive,
  onDelete,
  onInspectContextRef,
}: AgentThreadPanelProps) {
  const threadView = usePiAgentThreadView(threadId, scrollRequest);
  const modelOptionsQuery = useAgentModelOptionsQuery();
  const selectModelMutation = useSelectAgentModelMutation();
  const selectReasoningLevelMutation = useSelectAgentReasoningLevelMutation();
  const modelOptions = modelOptionsQuery.data?.options ?? [];
  const activeModel = modelOptionsQuery.data?.active ?? null;
  const activeReasoningLevel = modelOptionsQuery.data?.activeReasoningLevel ?? "medium";
  const modelSelectorDisabled =
    modelOptionsQuery.isFetching ||
    selectModelMutation.isPending ||
    selectReasoningLevelMutation.isPending;
  const selectModel = useMemoizedFn((selection: AgentModelSelection) =>
    selectModelMutation.mutate(selection),
  );
  const selectReasoningLevel = useMemoizedFn((level: AgentReasoningLevel) =>
    selectReasoningLevelMutation.mutate(level),
  );
  const [findQuery, setFindQuery] = useState("");
  const [activeFindMatch, setActiveFindMatch] = useState<ChatFindMatch | null>(null);

  useEffect(() => {
    setFindQuery("");
    setActiveFindMatch(null);
  }, [threadId]);

  return (
    <main
      data-testid="agent-thread-chat"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-transparent"
    >
      {title !== undefined && onRename && onGenerateTitle && onArchive && onDelete ? (
        <AgentThreadHeader
          threadId={threadId}
          title={title}
          messages={threadView.visibleMessages}
          isBusy={threadView.isBusy}
          titleGenerating={Boolean(titleGenerating)}
          onRename={onRename}
          onGenerateTitle={onGenerateTitle}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ) : null}
      <div className="relative min-h-0 flex-1">
        <ThreadFindBox
          messages={threadView.visibleMessages}
          query={findQuery}
          activeMatch={activeFindMatch}
          onQueryChange={setFindQuery}
          onActiveMatchChange={setActiveFindMatch}
        />
        <div
          ref={threadView.scrollRef}
          onScroll={threadView.handleScroll}
          className="h-full min-h-0 overflow-y-auto px-6 py-6"
        >
          {threadView.messagesFetching && threadView.visibleMessages.length === 0 ? (
            <div className="flex h-full min-h-0 min-w-0 items-center justify-center text-sm text-muted-foreground">
              加载 Agent...
            </div>
          ) : (
            <MessageList
              messages={threadView.visibleMessages}
              entitySources={threadView.entitySources}
              isBusy={threadView.isBusy}
              stoppedMessageId={threadView.stoppedMessageId}
              error={threadView.error}
              onRetry={threadView.actions.retry}
              onEdit={threadView.actions.editMessage}
              onRegenerate={threadView.actions.regenerate}
              onForkAssistant={onForkAssistantMessage}
              onApproveTool={(input) =>
                threadView.actions.approveTool({
                  ...input,
                  modelSelection: activeModel ?? undefined,
                })
              }
              onInspectContextRef={onInspectContextRef}
              highlightedMessageId={threadView.highlightedMessageId}
              findQuery={findQuery}
              activeFindMatch={activeFindMatch}
            />
          )}
        </div>
        <ChatJumpNav
          items={threadView.jumpItems}
          activeMessageId={threadView.activeJumpMessageId}
          onJump={threadView.jumpToMessage}
        />
        {threadView.showScrollToBottom ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="滚动到底部"
            className="absolute right-6 bottom-4 z-10 rounded-full bg-background/90 shadow-sm backdrop-blur"
            onClick={() => threadView.scrollToBottom()}
          >
            <ArrowDown />
          </Button>
        ) : null}
      </div>

      <ChatComposer
        isBusy={threadView.composerBusy}
        canStop={threadView.canStop}
        editingMessage={threadView.editingMessage}
        focusRequest={threadView.focusRequest}
        initialContextKey={initialContextKey}
        initialContextRefs={initialContextRefs}
        modelOptions={modelOptions}
        activeModel={activeModel}
        activeReasoningLevel={activeReasoningLevel}
        messages={threadView.visibleMessages}
        modelSelectorDisabled={modelSelectorDisabled}
        onSelectModel={selectModel}
        onSelectReasoningLevel={selectReasoningLevel}
        onSend={threadView.actions.send}
        onCancelEdit={threadView.actions.cancelEdit}
        onStop={threadView.actions.stop}
        onInspectContextRef={onInspectContextRef}
      />
    </main>
  );
}

async function exportMarkdown(title: string, messages: AgentReducedMessage[]) {
  const parts = [`# ${title.trim() || "Agent 对话"}`];
  for (const message of messages) {
    const text = message.text.trim();
    if (!text) continue;
    parts.push(`## ${message.role === "user" ? "用户" : "Agent"}\n\n${text}`);
  }

  const filename = `${(title.trim() || "agent-chat").replace(/[\\/:*?"<>|]+/g, "-")}.md`;
  try {
    const filePath = await ipcClient.chat.exportMarkdown(filename, `${parts.join("\n\n")}\n`);
    if (!filePath) return;
    toast.success("已导出 Markdown", { description: filePath });
  } catch (error) {
    toast.error("导出 Markdown 失败", { description: errorMessage(error) });
  }
}

async function copyThreadId(threadId: string) {
  try {
    if (!navigator.clipboard) throw new Error("当前环境不支持剪贴板");
    await navigator.clipboard.writeText(threadId);
    toast.success("已复制对话 ID");
  } catch (error) {
    toast.error("复制失败", { description: errorMessage(error) });
  }
}

function ThreadFindBox({
  messages,
  query,
  activeMatch,
  onQueryChange,
  onActiveMatchChange,
}: {
  messages: AgentReducedMessage[];
  query: string;
  activeMatch: ChatFindMatch | null;
  onQueryChange: (query: string) => void;
  onActiveMatchChange: (match: ChatFindMatch | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const close = useMemoizedFn(() => {
    setOpen(false);
    onQueryChange("");
    onActiveMatchChange(null);
    setActiveIndex(0);
  });
  const matches = useMemo(
    () => (open ? buildChatFindMatches(messages, query) : []),
    [messages, open, query],
  );
  const jumpToMatch = useMemoizedFn((match: ChatFindMatch | undefined, index: number) => {
    setActiveIndex(index);
    onActiveMatchChange(match ?? null);
  });
  const jumpBy = useMemoizedFn((step: 1 | -1) => {
    if (matches.length === 0) return;
    const nextIndex = (activeIndex + step + matches.length) % matches.length;
    jumpToMatch(matches[nextIndex], nextIndex);
  });

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
        return;
      }

      if (open && event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open || !activeMatch) return;
    const frame = requestAnimationFrame(() => {
      const root = inputRef.current?.closest<HTMLElement>('[data-testid="agent-thread-chat"]');
      const active = root?.querySelector<HTMLElement>('[data-chat-find-active="true"]');
      if (active) {
        active.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return;
      }

      root
        ?.querySelector<HTMLElement>(
          `[data-agent-message-id="${escapeCssAttribute(activeMatch.messageId)}"]`,
        )
        ?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeMatch, open, query]);

  if (!open) return null;

  const hasMatches = matches.length > 0;
  const visibleIndex = hasMatches ? Math.min(activeIndex, matches.length - 1) : 0;
  const countLabel = `${hasMatches ? visibleIndex + 1 : 0}/${matches.length}`;

  return (
    <div
      data-no-drag
      data-testid="agent-thread-find-box"
      className="absolute top-2 right-4 z-50 flex h-14 w-[min(420px,calc(100%-2rem))] items-center rounded-xl border border-border/70 bg-background shadow-xl"
    >
      <Input
        ref={inputRef}
        data-testid="agent-thread-find-input"
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          const nextMatches = buildChatFindMatches(messages, nextQuery);
          onQueryChange(nextQuery);
          jumpToMatch(nextMatches[0], 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            jumpBy(event.shiftKey ? -1 : 1);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-5 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        placeholder="搜索对话"
      />
      <div className="px-3 text-base tabular-nums text-muted-foreground">{countLabel}</div>
      <div className="h-8 w-px bg-border" />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="上一个匹配项"
        title="上一个匹配项"
        disabled={!query.trim() || !hasMatches}
        className="mx-1 text-muted-foreground"
        onClick={() => jumpBy(-1)}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="下一个匹配项"
        title="下一个匹配项"
        disabled={!query.trim() || !hasMatches}
        className="text-muted-foreground"
        onClick={() => jumpBy(1)}
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="关闭搜索"
        title="关闭搜索"
        className="mx-2 text-muted-foreground"
        onClick={close}
      >
        <X />
      </Button>
    </div>
  );
}

function escapeCssAttribute(value: string) {
  return globalThis.CSS?.escape?.(value) ?? value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function AgentThreadHeader({
  threadId,
  title,
  messages,
  isBusy,
  titleGenerating,
  onRename,
  onGenerateTitle,
  onArchive,
  onDelete,
}: {
  threadId: string;
  title: string;
  messages: AgentReducedMessage[];
  isBusy: boolean;
  titleGenerating: boolean;
  onRename: (title: string) => void;
  onGenerateTitle: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(title);
  const displayTitle = draft.trim() || title.trim() || "新对话";
  const canExport = messages.some((message) => message.text.trim());

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const finishRename = () => {
    const nextTitle = draft.trim();
    if (!nextTitle) {
      setDraft(title);
      return;
    }
    if (nextTitle !== title) onRename(nextTitle);
  };

  return (
    <header className="app-drag-region flex h-12 shrink-0 items-center justify-between gap-3 border-b px-6">
      <Input
        data-no-drag
        data-testid="agent-thread-title"
        value={draft}
        title={displayTitle}
        onBlur={finishRename}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(title);
        }}
        className="h-8 min-w-0 max-w-[520px] flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
        placeholder="新对话"
      />

      <div data-no-drag className="flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                data-testid="agent-thread-actions-button"
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="对话操作"
                title="对话操作"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-44">
            <DropdownMenuItem
              data-testid="agent-export-markdown-button"
              disabled={!canExport}
              onClick={() => void exportMarkdown(displayTitle, messages)}
            >
              <FileDown />
              导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="agent-generate-title-menu-item"
              disabled={titleGenerating || isBusy}
              onClick={onGenerateTitle}
            >
              <Sparkles />
              {titleGenerating ? "生成中..." : "生成标题"}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="agent-copy-thread-id-menu-item"
              onClick={() => void copyThreadId(threadId)}
            >
              <Copy />
              复制对话 ID
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="agent-archive-thread-menu-item" onClick={onArchive}>
              <Archive />
              归档
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="agent-delete-thread-menu-item"
              variant="destructive"
              onClick={onDelete}
            >
              <Trash2 />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ChatJumpNav({
  items,
  activeMessageId,
  onJump,
}: {
  items: ChatJumpItem[];
  activeMessageId: string | null;
  onJump: (messageId: string) => void;
}) {
  if (items.length < CHAT_JUMP_MIN_ITEMS) return null;

  return (
    <nav
      data-testid="agent-chat-jump-nav"
      aria-label="消息跳转"
      className="group/jump pointer-events-auto absolute right-1 top-1/2 z-20 hidden max-h-[58%] w-4 -translate-y-1/2 overflow-x-hidden overflow-y-hidden rounded-md border border-transparent bg-transparent p-0.5 shadow-none backdrop-blur transition-[width,padding,background-color,border-color,box-shadow] duration-150 hover:w-72 hover:overflow-y-auto hover:rounded-lg hover:border-border hover:bg-background/95 hover:p-2 hover:shadow-xl focus-within:w-72 focus-within:overflow-y-auto focus-within:rounded-lg focus-within:border-border focus-within:bg-background/95 focus-within:p-2 focus-within:shadow-xl xl:block"
    >
      {items.map((item) => {
        const active = item.messageId === activeMessageId;
        return (
          <button
            key={item.messageId}
            type="button"
            data-testid="agent-chat-jump-item"
            data-active={active ? "true" : undefined}
            title={item.label}
            aria-label={item.label}
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 rounded-md px-0 text-left text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none group-hover/jump:justify-start group-hover/jump:px-2 group-focus-within/jump:justify-start group-focus-within/jump:px-2",
              active && "font-medium text-primary",
            )}
            onClick={() => onJump(item.messageId)}
          >
            <span
              data-testid="agent-chat-jump-label"
              className="hidden min-w-0 flex-1 truncate group-hover/jump:block group-focus-within/jump:block"
            >
              {item.label}
            </span>
            <span
              data-testid="agent-chat-jump-marker"
              aria-hidden
              className={cn(
                "h-0.5 w-3 shrink-0 rounded-full bg-muted-foreground/40",
                active && "bg-primary",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
