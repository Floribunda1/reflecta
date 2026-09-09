import { useEffect, useMemo, useState } from "react";
import {
  RESIZE_HANDLE_CLASS,
  RESIZE_HANDLE_GRIP_CHILD_CLASS,
} from "@renderer/modules/shared/layout/layout-constants";
import { useRailMenu } from "@renderer/modules/shared/layout/rail-menu-context";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import { useModal } from "@reflecta/ui/overlays";
import type { AgentSessionSummary } from "@shared/agent";
import { useKeyPress, useMemoizedFn } from "ahooks";
import { toast } from "@reflecta/ui/components/toast";
import { AgentThreadPanel } from "./agent-thread-panel";
import { CanvasInspectDialog } from "./context/canvas-inspector";
import { ContextInspector } from "./context/context-inspector";
import { inspectorPanelRef, type InspectableContextRef } from "./context/context-reference";
import { useActiveThreadId, useInspectorRef, useAgentUiActions } from "./session/chat-ui-store";
import { useRunningAgentSessionId } from "./session/agent-session-replica";
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
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import { cn } from "@reflecta/ui/lib/utils";
import { renderError } from "@renderer/lib/errors";

const EMPTY_THREADS: AgentSessionSummary[] = [];

function activeThreadIdFor(threads: { id: string }[], activeThreadId: string | null) {
  if (threads.length === 0) return null;
  if (activeThreadId && threads.some((thread) => thread.id === activeThreadId)) {
    return activeThreadId;
  }
  return threads[0]!.id;
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
      />
    </div>
  );
}

function ChatPageContent() {
  const [inspectorFocusMode, setInspectorFocusMode] = useState(false);
  const { confirm } = useModal();
  const threadsQuery = useThreadsQuery();
  const activeThreadId = useActiveThreadId();
  const inspectedRef = useInspectorRef();
  const panelRef = inspectorPanelRef(inspectedRef);
  const runningThreadId = useRunningAgentSessionId();
  const uiActions = useAgentUiActions();
  const createThreadMutation = useCreateThreadMutation();
  const deleteThreadMutation = useDeleteThreadMutation();
  const forkThreadFromMessageMutation = useForkThreadFromMessageMutation();
  const archiveThreadMutation = useArchiveThreadMutation();
  const renameThreadMutation = useRenameThreadMutation();
  const generateThreadTitleMutation = useGenerateThreadTitleMutation();
  const threads = threadsQuery.data ?? EMPTY_THREADS;
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const [threadScrollRequest, setThreadScrollRequest] = useState(0);
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null);
  const enterInspectorFocusMode = useMemoizedFn(() => {
    setInspectorFocusMode(true);
  });
  const exitInspectorFocusMode = useMemoizedFn(() => setInspectorFocusMode(false));
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
  const closeInspector = useMemoizedFn(() => {
    exitInspectorFocusMode();
    uiActions.closeInspector();
  });
  const openInspector = useMemoizedFn((ref: InspectableContextRef) => {
    // 对话引用不是一个可检视对象：切换到该对话线程。
    if (ref.type === "conversation") {
      selectThread(ref.id);
      return;
    }
    if (ref.type === "canvas") exitInspectorFocusMode();
    uiActions.openInspector(ref);
  });
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
      onSuccess: () => toast.add({ title: "已生成标题", type: "success" }),
      onError: (error) =>
        toast.add({ title: "生成标题失败", description: renderError(error), type: "error" }),
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

  // 对话列表迁入全局导航 rail（slot 模式：rail 是纯壳，不依赖业务模块）
  const railMenu = useMemo(
    () => (
      <ThreadSidebar
        inRail
        threads={threads}
        pending={threadsQuery.isFetching}
        activeThreadId={activeThreadId}
        runningThreadId={runningThreadId}
        onSelect={selectThread}
        onCreate={createThread}
        onGenerateTitle={generateThreadTitle}
        onArchive={archiveThread}
        onDelete={deleteThread}
        titleGeneratingThreadId={titleGeneratingThreadId}
      />
    ),
    [
      threads,
      threadsQuery.isFetching,
      activeThreadId,
      runningThreadId,
      selectThread,
      createThread,
      generateThreadTitle,
      archiveThread,
      deleteThread,
      titleGeneratingThreadId,
    ],
  );
  useRailMenu("agent", railMenu);

  useKeyPress(
    "esc",
    () => {
      if (inspectorFocusMode) exitInspectorFocusMode();
    },
    { exactMatch: true },
  );

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
    <>
      <ResizablePanelGroup
        id="agent-page"
        orientation="horizontal"
        className="h-full min-h-0 w-full overflow-hidden bg-transparent"
      >
        <ResizablePanel id="agent-workspace-panel" minSize="420px" className="min-h-0 min-w-0">
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={
              panelRef
                ? {
                    "agent-chat-main": 58,
                    "agent-chat-inspector": 42,
                  }
                : {
                    "agent-chat-main": 100,
                  }
            }
            className="min-h-0 min-w-0 bg-background"
          >
            <ResizablePanel
              id="agent-chat-main"
              minSize="28%"
              defaultSize={panelRef ? "58%" : "100%"}
              className="min-h-0 min-w-0"
            >
              <div
                aria-hidden={inspectorFocusMode}
                inert={inspectorFocusMode}
                className="h-full min-h-0 min-w-0"
              >
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
                  />
                ) : (
                  <div className="flex h-full min-h-0 min-w-0 flex-col">
                    <PageTopBar />
                    <main className="flex min-h-0 flex-1 items-center justify-center bg-transparent text-sm text-muted-foreground">
                      加载 Agent...
                    </main>
                  </div>
                )}
              </div>
            </ResizablePanel>
            {panelRef ? (
              <>
                <ResizableHandle
                  withHandle
                  disabled={inspectorFocusMode}
                  className={cn(
                    RESIZE_HANDLE_CLASS,
                    RESIZE_HANDLE_GRIP_CHILD_CLASS,
                    inspectorFocusMode ? "w-0 opacity-0 after:hidden" : "w-px",
                  )}
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
                      refToInspect={panelRef}
                      onClose={closeInspector}
                      onInspect={openInspector}
                      focusMode={inspectorFocusMode}
                      onFocusModeChange={(focused) =>
                        focused ? enterInspectorFocusMode() : exitInspectorFocusMode()
                      }
                    />
                  </div>
                </ResizablePanel>
              </>
            ) : null}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
      {inspectedRef?.type === "canvas" ? (
        <CanvasInspectDialog
          canvasId={inspectedRef.id}
          title={inspectedRef.title}
          onClose={closeInspector}
        />
      ) : null}
    </>
  );
}

export function ChatPage() {
  return <ChatPageContent />;
}
