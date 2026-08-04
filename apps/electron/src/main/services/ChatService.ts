import fs from "node:fs";
import path from "node:path";
import { dialog, shell } from "electron";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import type { AgentCommand } from "@shared/agent";
import { ipcLog } from "../logger";
import { piAgentHost } from "./core";

function markdownExportFilename(filename: string) {
  const base = filename.trim().replace(/[\\/:*?"<>|]+/g, "-") || "agent-chat.md";
  return base.endsWith(".md") ? base : `${base}.md`;
}

export class ChatService extends IpcService {
  static readonly groupName = "chat";

  @IpcMethod()
  listThreads() {
    return piAgentHost.listThreads();
  }

  @IpcMethod()
  listSkills() {
    return piAgentHost.listSkills();
  }

  @IpcMethod()
  createThread(title?: string) {
    return piAgentHost.createThread(title);
  }

  @IpcMethod()
  renameThread(threadId: string, title: string) {
    return piAgentHost.renameThread(threadId, title);
  }

  @IpcMethod()
  generateThreadTitle(threadId: string) {
    return piAgentHost.generateThreadTitle(threadId);
  }

  @IpcMethod()
  archiveThread(threadId: string) {
    return piAgentHost.archiveThread(threadId);
  }

  @IpcMethod()
  deleteThread(threadId: string) {
    return piAgentHost.deleteThread(threadId);
  }

  @IpcMethod()
  forkThreadFromMessage(threadId: string, messageId: string) {
    return piAgentHost.forkThreadFromMessage(threadId, messageId);
  }

  @IpcMethod()
  async exportMarkdown(filename: string, markdown: string): Promise<string | null> {
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

  @IpcMethod()
  readSessionProjection(sessionId: string) {
    return piAgentHost.readSessionProjection(sessionId);
  }

  @IpcMethod()
  sendAgentCommand(command: AgentCommand) {
    ipcLog.info("chat.sendAgentCommand", {
      type: command.type,
      sessionId: "sessionId" in command ? command.sessionId : undefined,
    });
    return piAgentHost.sendAgentCommand(command);
  }
}
