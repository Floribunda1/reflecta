import type { AgentReducedMessage } from "@shared/agent";
import { runPromise } from "@renderer/lib/effect-runtime";
import {
  ChatThreadActionMenuItems,
  type ChatThreadAction,
  type ChatEntityReference,
} from "@reflecta/ui/chat";
import { collectEntityReferences, conversationMessagesToMarkdown } from "@reflecta/shared";
import { toast } from "@reflecta/ui/components/toast";
import { rpc } from "@renderer/lib/effect-rpc";
import { renderError } from "@renderer/lib/errors";
import { getEntityDisplay } from "../../capture/queries";

function referenceKey(reference: Pick<ChatEntityReference, "type" | "id">) {
  return `${reference.type}:${reference.id}`;
}

function referenceTypeLabel(reference: ChatEntityReference) {
  if (reference.type === "understanding") return "Understanding";
  if (reference.type === "context") return "Context";
  return "Domain";
}

export async function exportThreadMarkdown(title: string, messages: AgentReducedMessage[]) {
  const references = new Map<string, ChatEntityReference>();
  for (const message of messages) {
    for (const reference of collectEntityReferences(message.text)) {
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

  const { markdown } = conversationMessagesToMarkdown({
    title,
    messages,
    mode: "replace-references",
    labels,
  });
  const filename = `${(title.trim() || "agent-chat").replace(/[\\/:*?"<>|]+/g, "-")}.md`;
  try {
    const filePath = await runPromise(rpc.chatExportMarkdown(filename, `${markdown}\n`));
    if (!filePath) return;
    toast.add({ title: "已导出 Markdown", description: filePath, type: "success" });
  } catch (error) {
    toast.add({ title: "导出 Markdown 失败", description: renderError(error), type: "error" });
  }
}

export async function copyThreadId(threadId: string) {
  try {
    if (!navigator.clipboard) throw new Error("当前环境不支持剪贴板");
    await navigator.clipboard.writeText(threadId);
    toast.add({ title: "已复制对话 ID", type: "success" });
  } catch (error) {
    toast.add({ title: "复制失败", description: renderError(error), type: "error" });
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
