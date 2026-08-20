/** chat 域业务逻辑（删除式迁移：从 ChatService 抽出为纯函数，供 Effect handler 调用）。 */
import fs from "node:fs";
import path from "node:path";
import { dialog, shell } from "electron";
import type { AgentCommand } from "@shared/agent";
import { piAgentHost } from "./core";

function markdownExportFilename(filename: string) {
  const base = filename.trim().replace(/[\\/:*?"<>|]+/g, "-") || "agent-chat.md";
  return base.endsWith(".md") ? base : `${base}.md`;
}

export function listThreads() {
  return piAgentHost.listThreads();
}
export function listSkills() {
  return piAgentHost.listSkills();
}
export function createThread(title?: string) {
  return piAgentHost.createThread(title);
}
export function renameThread(threadId: string, title: string) {
  return piAgentHost.renameThread(threadId, title);
}
export function generateThreadTitle(threadId: string) {
  return piAgentHost.generateThreadTitle(threadId);
}
export function archiveThread(threadId: string) {
  return piAgentHost.archiveThread(threadId);
}
export function deleteThread(threadId: string) {
  return piAgentHost.deleteThread(threadId);
}
export function forkThreadFromMessage(threadId: string, messageId: string) {
  return piAgentHost.forkThreadFromMessage(threadId, messageId);
}

export async function exportMarkdown(filename: string, markdown: string): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: "导出 Markdown",
    defaultPath: markdownExportFilename(filename),
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (result.canceled || !result.filePath) return null;

  const filePath = result.filePath.endsWith(".md") ? result.filePath : `${result.filePath}.md`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, markdown, "utf-8");
  shell.showItemInFolder(filePath);
  return filePath;
}

export function readSessionProjection(sessionId: string) {
  return piAgentHost.readSessionProjection(sessionId);
}
export function sendAgentCommand(command: AgentCommand) {
  return piAgentHost.sendAgentCommand(command);
}
