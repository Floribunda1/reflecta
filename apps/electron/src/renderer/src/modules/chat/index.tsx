import { useEffect, useState } from "react";
import { usePanelRef, type PanelSize } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { useMemoizedFn } from "ahooks";
import { toast } from "sonner";
import { AgentThreadPanel } from "./agent-thread-panel";
import { ContextInspector } from "./context/context-inspector";
import type { InspectableContextRef } from "./context/context-reference";
import {
  useActiveThreadId,
  useInspectorRef,
  useAgentUiActions,
  useRunningThreadId,
} from "./session/chat-ui-store";
import {
  useArchiveThreadMutation,
  useCreateThreadMutation,
  useDeleteThreadMutation,
  useForkThreadFromMessageMutation,
  useGenerateThreadTitleMutation,
  useRenameThreadMutation,
  useThreadsQuery,
} from "./session/server-state";
import { ThreadSidebar } from "./session/thread-sidebar";
import { SidebarToggleButton } from "@renderer/modules/shared/layout/SidebarToggleButton";
import { cn } from "@renderer/lib/utils";

function activeThreadIdFor(threads: { id: string }[], activeThreadId: string | null) {
  if (threads.length === 0) return null;
  if (activeThreadId && threads.some((thread) => thread.id === activeThreadId)) {
    return activeThreadId;
  }
  return threads[0]!.id;
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

function ThreadChat({
  threadId,
  title,
  scrollRequest,
  titleGenerating,
  onRename,
  onGenerateTitle,
  onForkAssistantMessage,
  onArchive,
  onDelete,
  onInspectContextRef,
  onExpandSidebar,
}: {
  threadId: string;
  title: string;
  scrollRequest: number;
  titleGenerating: boolean;
  onRename: (threadId: string, title: string) => void;
  onGenerateTitle: (threadId: string) => void;
  onForkAssistantMessage: (threadId: string, messageId: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onInspectContextRef: (ref: InspectableContextRef) => void;
  onExpandSidebar?: () => void;
}) {
  return (
    <div className="h-full min-h-0 min-w-0">
      <AgentThreadPanel
        threadId={threadId}
        title={title}
        scrollRequest={scrollRequest}
        titleGenerating={titleGenerating}
        onRename={(nextTitle) => onRename(threadId, nextTitle)}
        onGenerateTitle={() => onGenerateTitle(threadId)}
        onForkAssistantMessage={(messageId) => onForkAssistantMessage(threadId, messageId)}
        onArchive={() => onArchive(threadId)}
        onDelete={() => onDelete(threadId)}
        onInspectContextRef={onInspectContextRef}
        onExpandSidebar={onExpandSidebar}
      />
    </div>
  );
}

function ChatPageContent() {
  const [threadSidebarOpen, setThreadSidebarOpen] = useState(true);
  const threadSidebarPanelRef = usePanelRef();
  const { confirm } = useModal();
  const threadsQuery = useThreadsQuery();
  const activeThreadId = useActiveThreadId();
  const inspectedRef = useInspectorRef();
  const runningThreadId = useRunningThreadId();
  const uiActions = useAgentUiActions();
  const createThreadMutation = useCreateThreadMutation();
  const deleteThreadMutation = useDeleteThreadMutation();
  const forkThreadFromMessageMutation = useForkThreadFromMessageMutation();
  const archiveThreadMutation = useArchiveThreadMutation();
  const renameThreadMutation = useRenameThreadMutation();
  const generateThreadTitleMutation = useGenerateThreadTitleMutation();
  const threads = threadsQuery.data ?? [];
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const [threadScrollRequest, setThreadScrollRequest] = useState(0);
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null);
  const collapseThreadSidebar = useMemoizedFn(() => {
    setThreadSidebarOpen(false);
    threadSidebarPanelRef.current?.collapse();
  });
  const expandThreadSidebar = useMemoizedFn(() => {
    setThreadSidebarOpen(true);
    threadSidebarPanelRef.current?.expand();
  });
  const handleThreadSidebarResize = useMemoizedFn((size: PanelSize) => {
    setThreadSidebarOpen(size.inPixels > 0);
  });
  const confirmDeleteThread = useMemoizedFn((threadId: string) =>
    confirm({
      title: "删除对话",
      message: "该 Agent 对话会被删除，无法恢复。确定继续吗？",
      acceptLabel: "删除",
      danger: true,
      onAccept: () => {
        uiActions.clearThread(threadId);
        deleteThreadMutation.mutate(threadId);
      },
    }),
  );
  const closeInspector = useMemoizedFn(() => uiActions.closeInspector());
  const openInspector = useMemoizedFn((ref: InspectableContextRef) => uiActions.openInspector(ref));
  const createThread = useMemoizedFn(() =>
    createThreadMutation.mutate(undefined, {
      onSuccess: (thread) => {
        setDraftThreadId(thread.id);
        uiActions.selectThread(thread.id);
      },
    }),
  );
  const selectThread = useMemoizedFn((threadId: string) => {
    setDraftThreadId(null);
    uiActions.selectThread(threadId);
    setThreadScrollRequest((request) => request + 1);
  });
  const renameThread = useMemoizedFn((threadId: string, title: string) =>
    renameThreadMutation.mutate({ threadId, title }),
  );
  const titleGeneratingThreadId = generateThreadTitleMutation.isPending
    ? (generateThreadTitleMutation.variables ?? null)
    : null;
  const generateThreadTitle = useMemoizedFn((threadId: string) =>
    generateThreadTitleMutation.mutate(threadId, {
      onSuccess: () => toast.success("已生成标题"),
      onError: (error) => toast.error("生成标题失败", { description: errorMessage(error) }),
    }),
  );
  const forkThreadFromMessage = useMemoizedFn((threadId: string, messageId: string) =>
    forkThreadFromMessageMutation.mutate(
      { threadId, messageId },
      {
        onSuccess: (thread) => uiActions.selectThread(thread.id),
      },
    ),
  );
  const archiveThread = useMemoizedFn((threadId: string) => {
    uiActions.clearThread(threadId);
    archiveThreadMutation.mutate(threadId);
  });
  const deleteThread = useMemoizedFn((threadId: string) => confirmDeleteThread(threadId));

  useEffect(() => {
    if (draftThreadId && threads.some((thread) => thread.id === draftThreadId)) {
      setDraftThreadId(null);
    }
  }, [draftThreadId, threads]);

  useEffect(() => {
    if (threadsQuery.isFetching || createThreadMutation.isPending) return;

    const activeIsPersisted = activeThreadId
      ? threads.some((thread) => thread.id === activeThreadId)
      : false;
    const activeIsDraft = Boolean(activeThreadId && activeThreadId === draftThreadId);

    if (threads.length === 0) {
      if (!activeIsDraft) createThread();
      return;
    }

    if (activeIsDraft) return;

    if (activeThreadId && !activeIsPersisted) {
      selectThread(threads[0]!.id);
      return;
    }

    const nextThreadId = activeThreadIdFor(threads, activeThreadId);
    if (nextThreadId && nextThreadId !== activeThreadId) selectThread(nextThreadId);
  }, [
    activeThreadId,
    createThread,
    createThreadMutation.isPending,
    draftThreadId,
    selectThread,
    threads,
    threadsQuery.isFetching,
  ]);

  return (
    <ResizablePanelGroup
      id="agent-page"
      orientation="horizontal"
      className="h-full min-h-0 w-full overflow-hidden bg-background/45 backdrop-blur-2xl [&>[data-panel]]:transition-[flex-grow] [&>[data-panel]]:duration-200 [&>[data-panel]]:ease-out [&:has([data-separator=active])>[data-panel]]:transition-none motion-reduce:[&>[data-panel]]:transition-none"
    >
      <ResizablePanel
        id="agent-thread-sidebar-panel"
        panelRef={threadSidebarPanelRef}
        defaultSize="248px"
        minSize="200px"
        maxSize="480px"
        collapsedSize={0}
        collapsible
        groupResizeBehavior="preserve-pixel-size"
        onResize={handleThreadSidebarResize}
        style={{ overflow: "hidden" }}
      >
        <div
          data-testid="agent-thread-sidebar-container"
          aria-hidden={!threadSidebarOpen}
          inert={!threadSidebarOpen}
          className={cn(
            "h-full min-w-0 overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            threadSidebarOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-3 opacity-0",
          )}
        >
          <ThreadSidebar
            threads={threads}
            pending={threadsQuery.isFetching}
            activeThreadId={activeThreadId}
            runningThreadId={runningThreadId}
            onSelect={selectThread}
            onCreate={createThread}
            onCollapse={collapseThreadSidebar}
            titleGeneratingThreadId={titleGeneratingThreadId}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle
        id="agent-thread-sidebar-resize-handle"
        disabled={!threadSidebarOpen}
        className={cn(
          "cursor-col-resize bg-transparent after:w-px after:bg-border/50 hover:after:bg-border data-[resize-handle-active]:after:bg-ring",
          threadSidebarOpen ? "w-3" : "w-0 border-0 opacity-0 after:hidden",
        )}
      />
      <ResizablePanel id="agent-workspace-panel" minSize="420px" className="min-h-0 min-w-0">
        <ResizablePanelGroup
          orientation="horizontal"
          defaultLayout={
            inspectedRef
              ? {
                  "agent-chat-main": 58,
                  "agent-chat-inspector": 42,
                }
              : {
                  "agent-chat-main": 100,
                }
          }
          className="min-h-0 min-w-0 bg-card/70 backdrop-blur-sm"
        >
          <ResizablePanel
            id="agent-chat-main"
            minSize="28%"
            defaultSize={inspectedRef ? "58%" : "100%"}
            className="min-h-0 min-w-0"
          >
            <div className="h-full min-h-0 min-w-0">
              {activeThreadId ? (
                <ThreadChat
                  key={activeThreadId}
                  threadId={activeThreadId}
                  title={activeThread?.title ?? "新对话"}
                  scrollRequest={threadScrollRequest}
                  titleGenerating={titleGeneratingThreadId === activeThreadId}
                  onRename={renameThread}
                  onGenerateTitle={generateThreadTitle}
                  onForkAssistantMessage={forkThreadFromMessage}
                  onArchive={archiveThread}
                  onDelete={deleteThread}
                  onInspectContextRef={openInspector}
                  onExpandSidebar={threadSidebarOpen ? undefined : expandThreadSidebar}
                />
              ) : (
                <main className="relative flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden bg-transparent text-sm text-muted-foreground">
                  {threadSidebarOpen ? null : (
                    <SidebarToggleButton
                      expanded={false}
                      label="展开对话列表"
                      testId="agent-sidebar-expand-button"
                      className="absolute top-3 left-[86px]"
                      onClick={expandThreadSidebar}
                    />
                  )}
                  加载 Agent...
                </main>
              )}
            </div>
          </ResizablePanel>
          {inspectedRef ? (
            <>
              <ResizableHandle
                withHandle
                className="w-3 cursor-col-resize bg-transparent after:w-px after:bg-border/50 hover:after:bg-border data-[resize-handle-active]:after:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border/70"
              />
              <ResizablePanel
                id="agent-chat-inspector"
                minSize="30%"
                defaultSize="42%"
                maxSize="68%"
                className="min-h-0 min-w-0"
              >
                <div className="h-full min-h-0 min-w-0">
                  <ContextInspector
                    refToInspect={inspectedRef}
                    onClose={closeInspector}
                    onInspect={openInspector}
                  />
                </div>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function ChatPage() {
  return <ChatPageContent />;
}
