import { memo, useMemo } from "react";
import {
  ChatThreadSidebar,
  type ChatThreadAction,
  type ChatThreadGroupView,
} from "@reflecta/ui/chat";
import { Effect } from "effect";
import { ipcClient } from "@renderer/utils/ipc";
import { rpc } from "@renderer/lib/effect-rpc";
import { errorMessage } from "@renderer/utils/errors";
import type { AgentSessionSummary } from "@shared/agent";
import { toast } from "sonner";
import { groupAgentThreads } from "./thread-groups";
import { copyThreadId, exportThreadMarkdown } from "./thread-action-menu-items";

async function exportThread(thread: AgentSessionSummary) {
  try {
    const projection = await ipcClient.chat.readSessionProjection(thread.id);
    await exportThreadMarkdown(thread.title, projection.messages);
  } catch (error) {
    toast.error("导出 Markdown 失败", { description: errorMessage(error) });
  }
}

async function compactThread(threadId: string) {
  try {
    const [modelSelection, reasoningLevel] = await Promise.all([
      Effect.runPromise(rpc.configGetActiveModel()),
      Effect.runPromise(rpc.configGetReasoningLevel()),
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
  inRail = false,
}: {
  threads: AgentSessionSummary[];
  pending?: boolean;
  activeThreadId: string | null;
  runningThreadId: string | null;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onCollapse?: () => void;
  onGenerateTitle: (threadId: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  titleGeneratingThreadId?: string | null;
  /** 渲染在全局导航 rail 内：titlebar 区与折叠权归 rail */
  inRail?: boolean;
}) {
  const groups = useMemo<ChatThreadGroupView[]>(
    () =>
      groupAgentThreads(threads).map((group) => ({
        id: group.id,
        label: group.label,
        threads: group.threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          running: thread.id === runningThreadId,
          titleGenerating: thread.id === titleGeneratingThreadId,
        })),
      })),
    [runningThreadId, threads, titleGeneratingThreadId],
  );
  const handleAction = (threadId: string, action: ChatThreadAction) => {
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) return;

    if (action === "export") void exportThread(thread);
    else if (action === "generate-title") onGenerateTitle(threadId);
    else if (action === "compact") void compactThread(threadId);
    else if (action === "copy-id") void copyThreadId(threadId);
    else if (action === "archive") onArchive(threadId);
    else onDelete(threadId);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <ChatThreadSidebar
        inRail={inRail}
        groups={groups}
        pending={pending}
        activeThreadId={activeThreadId}
        onSelect={onSelect}
        onCreate={onCreate}
        onCollapse={() => onCollapse?.()}
        onAction={handleAction}
      />
    </div>
  );
}

export const ThreadSidebar = memo(ThreadSidebarComponent);
