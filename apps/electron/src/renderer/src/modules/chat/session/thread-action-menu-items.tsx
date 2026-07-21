import { Archive, Copy, FileDown, Minimize2, Sparkles, Trash2 } from "lucide-react";
import type { AgentReducedMessage } from "@shared/agent";
import { ContextMenuItem, ContextMenuSeparator } from "@renderer/components/ui/context-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@renderer/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ipcClient } from "@renderer/utils/ipc";

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

export async function exportThreadMarkdown(title: string, messages: AgentReducedMessage[]) {
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
  const Item = menu === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator = menu === "context" ? ContextMenuSeparator : DropdownMenuSeparator;

  return (
    <>
      <Item data-testid="agent-export-markdown-button" disabled={!canExport} onClick={onExport}>
        <FileDown />
        导出 Markdown
      </Item>
      <Separator />
      <Item
        data-testid="agent-generate-title-menu-item"
        disabled={titleGenerating || isBusy || isCompacting}
        onClick={onGenerateTitle}
      >
        <Sparkles />
        {titleGenerating ? "生成中..." : "生成标题"}
      </Item>
      <Item
        data-testid="agent-compact-context-menu-item"
        disabled={!hasMessages || isBusy || isCompacting}
        onClick={onCompact}
      >
        <Minimize2 />
        {isCompacting ? "压缩中..." : "压缩上下文"}
      </Item>
      <Item
        data-testid="agent-copy-thread-id-menu-item"
        onClick={() => void copyThreadId(threadId)}
      >
        <Copy />
        复制对话 ID
      </Item>
      <Item data-testid="agent-archive-thread-menu-item" onClick={onArchive}>
        <Archive />
        归档
      </Item>
      <Separator />
      <Item data-testid="agent-delete-thread-menu-item" variant="destructive" onClick={onDelete}>
        <Trash2 />
        删除
      </Item>
    </>
  );
}
