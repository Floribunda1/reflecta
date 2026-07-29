import { memo, useMemo } from "react";
import {
  ChatThreadSidebar,
  type ChatThreadAction,
  type ChatThreadGroupView,
} from "@reflecta/ui/chat";
import { AppChromeMenu } from "@renderer/modules/shared/layout/AppChromeMenu";
import { ipcClient } from "@renderer/utils/ipc";
import { reduceAgentSession, type AgentSessionSummary } from "@shared/agent";
import { toast } from "sonner";
import { groupAgentThreads } from "./thread-groups";
import { copyThreadId, exportThreadMarkdown } from "./thread-action-menu-items";

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
        groups={groups}
        pending={pending}
        activeThreadId={activeThreadId}
        onSelect={onSelect}
        onCreate={onCreate}
        onCollapse={onCollapse}
        onAction={handleAction}
      />
      <AppChromeMenu />
    </div>
  );
}

export const ThreadSidebar = memo(ThreadSidebarComponent);
