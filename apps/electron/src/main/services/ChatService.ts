import { getIpcContext, IpcMethod, IpcService } from "electron-ipc-decorator";
import type { AgentCommand } from "@shared/agent";
import { ipcLog } from "../logger";
import { piAgentHost } from "./core";

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
