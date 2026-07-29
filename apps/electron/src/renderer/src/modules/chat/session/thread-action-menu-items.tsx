import type { AgentReducedMessage } from "@shared/agent";
import {
  ChatThreadActionMenuItems,
  collectChatEntityReferences,
  replaceChatEntityReferences,
  type ChatThreadAction,
  type ChatEntityReference,
} from "@reflecta/ui/chat";
import { toast } from "sonner";
import { ipcClient } from "@renderer/utils/ipc";
import { getEntityDisplay } from "../../capture/queries";

function referenceKey(reference: Pick<ChatEntityReference, "type" | "id">) {
  return `${reference.type}:${reference.id}`;
}

function referenceTypeLabel(reference: ChatEntityReference) {
  if (reference.type === "understanding") return "Understanding";
  if (reference.type === "context") return "Context";
  return "Domain";
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

export async function exportThreadMarkdown(title: string, messages: AgentReducedMessage[]) {
  const references = new Map<string, ChatEntityReference>();
  for (const message of messages) {
    for (const reference of collectChatEntityReferences(message.text)) {
      references.set(referenceKey(reference), reference);
    }
  }
  const labels = new Map(
    await Promise.all(
      [...references].map(async ([key, ref]) => {
        try {
          const display = await getEntityDisplay(ref);
          return [
            key,
            display === null ? "引用不可用" : display.title || `未命名 ${referenceTypeLabel(ref)}`,
          ] as const;
        } catch {
          return [key, "引用加载失败"] as const;
        }
      }),
    ),
  );

  const parts = [`# ${title.trim() || "Agent 对话"}`];
  for (const message of messages) {
    const text = replaceChatEntityReferences(
      message.text.trim(),
      (reference, source) => labels.get(referenceKey(reference)) ?? source,
    );
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

export async function copyThreadId(threadId: string) {
  try {
    if (!navigator.clipboard) throw new Error("当前环境不支持剪贴板");
    await navigator.clipboard.writeText(threadId);
    toast.success("已复制对话 ID");
  } catch (error) {
    toast.error("复制失败", { description: errorMessage(error) });
  }
}

export function ThreadActionMenuItems({
  menu,
  threadId,
  canExport,
  hasMessages,
  isBusy,
  isCompacting,
  titleGenerating,
  onExport,
  onGenerateTitle,
  onCompact,
  onArchive,
  onDelete,
}: {
  menu: "dropdown" | "context";
  threadId: string;
  canExport: boolean;
  hasMessages: boolean;
  isBusy: boolean;
  isCompacting: boolean;
  titleGenerating: boolean;
  onExport: () => void;
  onGenerateTitle: () => void;
  onCompact: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const handleAction = (action: ChatThreadAction) => {
    if (action === "export") onExport();
    else if (action === "generate-title") onGenerateTitle();
    else if (action === "compact") onCompact();
    else if (action === "copy-id") void copyThreadId(threadId);
    else if (action === "archive") onArchive();
    else onDelete();
  };

  return (
    <ChatThreadActionMenuItems
      menu={menu}
      canExport={canExport}
      hasMessages={hasMessages}
      isBusy={isBusy}
      isCompacting={isCompacting}
      titleGenerating={titleGenerating}
      onAction={handleAction}
    />
  );
}
