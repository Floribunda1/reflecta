import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import { ArrowDown, ChevronDown, ChevronUp, MoreHorizontal, X } from "lucide-react";
import type { AgentModelSelection, AgentReasoningLevel, AgentReducedMessage } from "@shared/agent";
import { ChatJumpNav } from "@reflecta/ui/chat";
import { Button } from "@reflecta/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@reflecta/ui/components/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { Input } from "@reflecta/ui/components/input";
import { renderError } from "@renderer/lib/errors";
import { useDebounce, useLatest, useMemoizedFn } from "ahooks";
import { toast } from "@reflecta/ui/components/toast";
import { AgentChatComposer } from "./adapters/chat-composer-adapter";
import { ArtifactPanel } from "./artifact-panel";
import { buildArtifactPanelView, type LandedArtifact } from "./session/artifact-panel";
import { captureActions } from "../capture/store";
import type { InspectableContextRef } from "./context/context-reference";
import type { ApproveToolInput } from "./adapters/chat-message-adapter";
import { activateChatFindMarker, type ChatFindMarkerMatch } from "./messages/chat-find-highlight";
import { MessageList } from "./messages/message-list";
import { useAgentThreadView } from "./session/agent-thread-view";
import { buildChatFindMatches } from "./session/thread-view";
import {
  useAgentModelOptionsQuery,
  useSelectAgentModelMutation,
  useSelectAgentReasoningLevelMutation,
} from "./session/server-state";
import { exportThreadMarkdown, ThreadActionMenuItems } from "./session/thread-action-menu-items";

type AgentThreadPanelProps = {
  threadId: string;
  title?: string;
  scrollRequest?: number;
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
  titleGenerating,
  onRename,
  onGenerateTitle,
  onForkAssistantMessage,
  onArchive,
  onDelete,
  onInspectContextRef,
}: AgentThreadPanelProps) {
  const threadView = useAgentThreadView(threadId, scrollRequest);
  const navigate = useNavigate();
  const artifactView = useMemo(
    () => buildArtifactPanelView(threadView.visibleMessages),
    [threadView.visibleMessages],
  );
  const openArtifact = useMemoizedFn((artifact: LandedArtifact) => {
    if (
      artifact.type === "understanding" ||
      artifact.type === "context" ||
      artifact.type === "canvas"
    ) {
      onInspectContextRef?.({ type: artifact.type, id: artifact.id, title: artifact.title });
      return;
    }
    if (artifact.type === "domain") {
      captureActions.selectDomain(artifact.id);
      navigate("/capture");
    }
  });
  const modelOptionsQuery = useAgentModelOptionsQuery();
  const selectModelMutation = useSelectAgentModelMutation();
  const selectReasoningLevelMutation = useSelectAgentReasoningLevelMutation();
  const modelOptions = modelOptionsQuery.data?.options ?? [];
  const activeModel = modelOptionsQuery.data?.active ?? null;
  const activeReasoningLevel = modelOptionsQuery.data?.activeReasoningLevel ?? "off";
  const selectModel = useMemoizedFn((selection: AgentModelSelection) =>
    selectModelMutation.mutate(selection),
  );
  const selectReasoningLevel = useMemoizedFn((level: AgentReasoningLevel) =>
    selectReasoningLevelMutation.mutate(level),
  );
  const [findQuery, setFindQuery] = useState("");
  const [findComposing, setFindComposing] = useState(false);
  const debouncedFindQuery = useDebounce(findQuery, { wait: 300 });
  const renderedFindQuery =
    findQuery.trim() && !findComposing && debouncedFindQuery === findQuery
      ? debouncedFindQuery
      : "";
  const retry = useMemoizedFn(threadView.actions.retry);
  const editMessage = useMemoizedFn(threadView.actions.editMessage);
  const regenerate = useMemoizedFn(threadView.actions.regenerate);
  const send = useMemoizedFn(threadView.actions.send);
  const cancelEdit = useMemoizedFn(threadView.actions.cancelEdit);
  const stop = useMemoizedFn(threadView.actions.stop);
  const reloadMessages = useMemoizedFn(threadView.actions.reloadMessages);
  const compact = useMemoizedFn(async () => {
    try {
      await threadView.actions.compact(activeModel ?? undefined, activeReasoningLevel);
      toast.add({ title: "上下文已压缩", type: "success" });
    } catch (error) {
      toast.add({ title: "压缩上下文失败", description: renderError(error), type: "error" });
    }
  });
  const approveTool = useMemoizedFn((input: ApproveToolInput) =>
    threadView.actions.approveTool({
      ...input,
      modelSelection: activeModel ?? undefined,
      reasoningLevel: activeReasoningLevel,
    }),
  );

  const header =
    title !== undefined && onRename && onGenerateTitle && onArchive && onDelete
      ? { title, onRename, onGenerateTitle, onArchive, onDelete }
      : null;

  return (
    <main
      data-testid="agent-thread-chat"
      data-thread-id={threadId}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-transparent"
    >
      {header ? (
        <PageTopBar
          actions={
            <>
              <ArtifactPanel view={artifactView} onOpen={openArtifact} />
              <AgentThreadActions
                threadId={threadId}
                title={header.title}
                messages={threadView.visibleMessages}
                isBusy={threadView.isBusy}
                isCompacting={threadView.isCompacting}
                titleGenerating={Boolean(titleGenerating)}
                onCompact={compact}
                onGenerateTitle={header.onGenerateTitle}
                onArchive={header.onArchive}
                onDelete={header.onDelete}
              />
            </>
          }
        >
          <AgentThreadTitle title={header.title} onRename={header.onRename} />
        </PageTopBar>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <ThreadFindBox
          messages={threadView.visibleMessages}
          query={findQuery}
          renderedQuery={renderedFindQuery}
          isComposing={findComposing}
          onJumpToMessage={threadView.jumpToMessage}
          onQueryChange={setFindQuery}
          onQueryComposingChange={setFindComposing}
        />
        <div
          data-testid="agent-message-scroll"
          ref={threadView.scrollRef}
          onScroll={threadView.handleScroll}
          className="h-full min-h-0 overflow-y-auto px-6 py-6 [scrollbar-gutter:stable_both-edges]"
        >
          {threadView.messagesError && threadView.visibleMessages.length === 0 ? (
            <Empty data-testid="agent-history-error" className="h-full">
              <EmptyHeader>
                <EmptyTitle>无法加载对话</EmptyTitle>
                <EmptyDescription>{renderError(threadView.messagesError)}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" variant="outline" onClick={() => void reloadMessages()}>
                  重新加载
                </Button>
              </EmptyContent>
            </Empty>
          ) : threadView.messagesFetching && threadView.visibleMessages.length === 0 ? (
            <div className="flex h-full min-h-0 min-w-0 items-center justify-center text-sm text-muted-foreground">
              加载对话...
            </div>
          ) : (
            <MessageList
              messages={threadView.visibleMessages}
              entityCatalog={threadView.entityCatalog}
              contextCompactions={threadView.contextCompactions}
              activeRunId={threadView.activeRunId}
              isBusy={threadView.isBusy}
              isCompacting={threadView.isCompacting}
              stoppedMessageId={threadView.stoppedMessageId}
              error={threadView.error}
              compactionError={threadView.compactionError}
              onRetry={retry}
              onEdit={editMessage}
              onRegenerate={regenerate}
              onForkAssistant={onForkAssistantMessage}
              onApproveTool={approveTool}
              onInspectContextRef={onInspectContextRef}
              highlightedMessageId={threadView.highlightedMessageId}
              findQuery={renderedFindQuery}
              editingMessageId={threadView.editingMessage?.id}
              editingMessageEditor={
                threadView.editingMessage ? (
                  <AgentChatComposer
                    variant="message-edit"
                    threadId={threadId}
                    isBusy={threadView.composerBusy}
                    isCompacting={threadView.isCompacting}
                    canStop={false}
                    editingMessage={threadView.editingMessage}
                    focusRequest={0}
                    modelOptions={modelOptions}
                    activeModel={activeModel}
                    activeReasoningLevel={activeReasoningLevel}
                    messages={threadView.visibleMessages}
                    onSelectModel={selectModel}
                    onSelectReasoningLevel={selectReasoningLevel}
                    onSend={send}
                    onCancelEdit={cancelEdit}
                    onStop={stop}
                    onInspectContextRef={onInspectContextRef}
                  />
                ) : null
              }
              virtualizer={threadView.messageVirtualizer}
            />
          )}
        </div>
        <ChatJumpNav
          items={threadView.turnNavigationItems}
          activeTurnId={threadView.activeTurnId}
          onJump={threadView.jumpToTurn}
        />
        {threadView.showScrollToBottom ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="滚动到底部"
            className="absolute right-6 bottom-4 z-10 rounded-full bg-background shadow-sm backdrop-blur"
            onClick={() => threadView.scrollToBottom()}
          >
            <ArrowDown />
          </Button>
        ) : null}
      </div>

      <AgentChatComposer
        threadId={threadId}
        isBusy={threadView.composerBusy}
        isCompacting={threadView.isCompacting}
        canStop={threadView.canStop}
        focusRequest={threadView.focusRequest}
        modelOptions={modelOptions}
        activeModel={activeModel}
        activeReasoningLevel={activeReasoningLevel}
        messages={threadView.visibleMessages}
        onSelectModel={selectModel}
        onSelectReasoningLevel={selectReasoningLevel}
        onSend={send}
        onStop={stop}
        onInspectContextRef={onInspectContextRef}
      />
    </main>
  );
}

function ThreadFindBox({
  messages,
  query,
  renderedQuery,
  isComposing,
  onJumpToMessage,
  onQueryChange,
  onQueryComposingChange,
}: {
  messages: AgentReducedMessage[];
  query: string;
  renderedQuery: string;
  isComposing: boolean;
  onJumpToMessage: (messageId: string) => void;
  onQueryChange: (query: string) => void;
  onQueryComposingChange: (isComposing: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pinnedMatch, setPinnedMatch] = useState<ChatFindMarkerMatch | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const jumpToMessageRef = useLatest(onJumpToMessage);
  const renderedMatches = useMemo<ChatFindMarkerMatch[]>(
    () =>
      open && renderedQuery.trim()
        ? buildChatFindMatches(messages, renderedQuery).map(({ messageId, matchIndex }) => ({
            messageId,
            matchIndex,
          }))
        : [],
    [messages, open, renderedQuery],
  );
  const activeMatch = useMemo(() => {
    if (!open || !renderedQuery.trim()) return null;
    if (pinnedMatch && renderedMatches.some((match) => sameFindMatch(match, pinnedMatch))) {
      return pinnedMatch;
    }
    return renderedMatches[0] ?? null;
  }, [open, pinnedMatch, renderedMatches, renderedQuery]);
  const close = useMemoizedFn(() => {
    setOpen(false);
    setPinnedMatch(null);
    onQueryChange("");
    onQueryComposingChange(false);
  });
  const activeIndex = activeMatch
    ? renderedMatches.findIndex((match) => sameFindMatch(match, activeMatch))
    : -1;
  const jumpToMatch = useMemoizedFn((match: ChatFindMarkerMatch | undefined) => {
    setPinnedMatch(match ?? null);
  });
  const jumpBy = useMemoizedFn((step: 1 | -1) => {
    if (renderedMatches.length === 0) return;
    let currentIndex: number;
    if (activeIndex >= 0) {
      currentIndex = activeIndex;
    } else if (step === 1) {
      // 无当前匹配时向下从 -1 起跳（+1 后落到第一个）；向上从 0 起跳（-1 后落到最后一个）。
      currentIndex = -1;
    } else {
      currentIndex = 0;
    }
    const nextIndex = (currentIndex + step + renderedMatches.length) % renderedMatches.length;
    jumpToMatch(renderedMatches[nextIndex]);
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
    jumpToMessageRef.current(activeMatch.messageId);
    let retryFrame = 0;
    const frame = requestAnimationFrame(() => {
      const root = inputRef.current?.closest<HTMLElement>('[data-testid="agent-thread-chat"]');
      const active = activateChatFindMarker(root ?? null, activeMatch);
      if (active) {
        active.scrollIntoView({ block: "center", inline: "nearest" });
        return;
      }
      retryFrame = requestAnimationFrame(() => {
        const marker = activateChatFindMarker(root ?? null, activeMatch);
        marker?.scrollIntoView({ block: "center", inline: "nearest" });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(retryFrame);
    };
  }, [activeMatch, jumpToMessageRef, open, renderedQuery]);

  if (!open) return null;

  const hasMatches = renderedMatches.length > 0;
  const canJump = Boolean(query.trim()) && !isComposing && hasMatches;
  const visibleIndex = hasMatches ? Math.max(activeIndex, 0) : 0;
  const countLabel = `${hasMatches ? visibleIndex + 1 : 0}/${renderedMatches.length}`;

  return (
    <div
      data-no-drag
      data-testid="agent-thread-find-box"
      className="absolute top-2 right-4 z-50 flex h-12 w-[min(420px,calc(100%-2rem))] items-center rounded-xl border border-border bg-popover shadow-xl"
    >
      <Input
        ref={inputRef}
        data-testid="agent-thread-find-input"
        value={query}
        onCompositionStart={() => {
          onQueryComposingChange(true);
          setPinnedMatch(null);
        }}
        onCompositionEnd={(event) => {
          onQueryChange(event.currentTarget.value);
          onQueryComposingChange(false);
          setPinnedMatch(null);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          onQueryChange(nextQuery);
          setPinnedMatch(null);
          if ((event.nativeEvent as InputEvent).isComposing) onQueryComposingChange(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (canJump) jumpBy(event.shiftKey ? -1 : 1);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        // DESIGN: chrome 式搜索框——无边框、聚焦无大 ring，与浏览器搜索栏主流做法一致（focus-visible:ring-0 有意关闭）。
        className="h-full min-w-0 flex-1 border-0 dark:bg-transparent bg-transparent px-5 shadow-none focus-visible:ring-0"
        placeholder="搜索对话"
      />
      <div className="px-3 tabular-nums text-muted-foreground">{countLabel}</div>
      <div className="h-8 w-px bg-border" />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="上一个匹配项"
        title="上一个匹配项"
        disabled={!canJump}
        className="mx-1"
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
        disabled={!canJump}
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
        className="mx-2"
        onClick={close}
      >
        <X />
      </Button>
    </div>
  );
}

function sameFindMatch(left: ChatFindMarkerMatch, right: ChatFindMarkerMatch) {
  return left.messageId === right.messageId && left.matchIndex === right.matchIndex;
}

function AgentThreadTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? title;
  const displayTitle = value.trim() || title.trim() || "新对话";

  const finishRename = () => {
    const nextTitle = value.trim();
    setDraft(null);
    if (!nextTitle) return;
    if (nextTitle !== title) onRename(nextTitle);
  };

  return (
    <Input
      data-testid="agent-thread-title"
      value={value}
      title={displayTitle}
      onFocus={() => setDraft(title)}
      onBlur={finishRename}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
      // DESIGN: EditableText 语义——线程标题重命名，内联编辑聚焦不显示输入框外壳（focus-visible:ring-0 有意关闭）。
      className="h-8 w-auto min-w-0 max-w-full field-sizing-content border-0 dark:bg-transparent bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
      placeholder="新对话"
    />
  );
}

function AgentThreadActions({
  threadId,
  title,
  messages,
  isBusy,
  isCompacting,
  titleGenerating,
  onCompact,
  onGenerateTitle,
  onArchive,
  onDelete,
}: {
  threadId: string;
  title: string;
  messages: AgentReducedMessage[];
  isBusy: boolean;
  isCompacting: boolean;
  titleGenerating: boolean;
  onCompact: () => void;
  onGenerateTitle: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const displayTitle = title.trim() || "新对话";
  const canExport = messages.some((message) => message.text.trim());

  return (
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
        <ThreadActionMenuItems
          menu="dropdown"
          threadId={threadId}
          canExport={canExport}
          hasMessages={messages.length > 0}
          isBusy={isBusy}
          isCompacting={isCompacting}
          titleGenerating={titleGenerating}
          onExport={() => void exportThreadMarkdown(displayTitle, messages)}
          onGenerateTitle={onGenerateTitle}
          onCompact={onCompact}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
