import fs from "node:fs";
import path from "node:path";
import { shell } from "electron";
import { getIpcContext, IpcMethod, IpcService } from "electron-ipc-decorator";
import type { AgentCommand } from "@shared/agent";
import { getContentStorageRoot } from "../config";
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
  exportMarkdown(filename: string, markdown: string) {
    const exportDir = path.join(getContentStorageRoot(), "exports");
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, markdownExportFilename(filename));
    fs.writeFileSync(filePath, markdown, "utf-8");
    shell.showItemInFolder(filePath);
    return filePath;
  }

  @IpcMethod()
  readSessionEvents(sessionId: string) {
    return piAgentHost.readSessionEvents(sessionId);
  }

  @IpcMethod()
  sendAgentCommand(command: AgentCommand) {
    const ctx = getIpcContext();
    ipcLog.info("chat.sendAgentCommand", {
      type: command.type,
      sessionId: "sessionId" in command ? command.sessionId : undefined,
    });
    return piAgentHost.sendAgentCommand(command, ctx.sender);
  }
}
