import { getIpcContext, IpcMethod, IpcService } from "electron-ipc-decorator";
import type { CancelAgentRunInput, SendAgentMessageInput } from "@shared/chat";
import type { AgentCommand } from "@shared/agent";
import { ipcLog } from "../logger";
import { agentRuntime, piAgentHost } from "./core";
import { isPiAgentRuntimeEnabled } from "./agent/pi-agent-host";

export class ChatService extends IpcService {
  static readonly groupName = "chat";

  @IpcMethod()
  listThreads() {
    if (isPiAgentRuntimeEnabled()) return piAgentHost.listThreads();
    return agentRuntime.listThreads();
  }

  @IpcMethod()
  createThread(title?: string) {
    if (isPiAgentRuntimeEnabled()) return piAgentHost.createThread(title);
    return agentRuntime.createThread(title);
  }

  @IpcMethod()
  renameThread(threadId: string, title: string) {
    if (isPiAgentRuntimeEnabled()) return piAgentHost.renameThread(threadId, title);
    return agentRuntime.renameThread(threadId, title);
  }

  @IpcMethod()
  generateThreadTitle(threadId: string) {
    if (isPiAgentRuntimeEnabled()) return piAgentHost.generateThreadTitle(threadId);
    return agentRuntime.generateThreadTitle(threadId);
  }

  @IpcMethod()
  archiveThread(threadId: string) {
    if (isPiAgentRuntimeEnabled()) return piAgentHost.archiveThread(threadId);
    return agentRuntime.archiveThread(threadId);
  }

  @IpcMethod()
  deleteThread(threadId: string) {
    if (isPiAgentRuntimeEnabled()) return piAgentHost.deleteThread(threadId);
    return agentRuntime.deleteThread(threadId);
  }

  @IpcMethod()
  getMessages(threadId: string) {
    if (isPiAgentRuntimeEnabled()) return [];
    return agentRuntime.getMessages(threadId);
  }

  @IpcMethod()
  getRuntimeMode() {
    return isPiAgentRuntimeEnabled() ? "pi" : "legacy";
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

  @IpcMethod()
  sendMessage(input: SendAgentMessageInput) {
    if (isPiAgentRuntimeEnabled()) throw new Error("Pi Agent runtime expects sendAgentCommand");
    const ctx = getIpcContext();
    ipcLog.info("chat.sendMessage", {
      requestId: input.requestId,
      threadId: input.threadId,
      messages: input.messages.length,
      modelSelection: input.modelSelection,
      reasoningLevel: input.reasoningLevel,
    });
    return agentRuntime.sendMessage({ ...input, webContents: ctx.sender });
  }

  @IpcMethod()
  cancelStream(input: CancelAgentRunInput) {
    if (isPiAgentRuntimeEnabled()) return;
    ipcLog.info("chat.cancelStream", { requestId: input.requestId });
    return agentRuntime.cancel(input.requestId);
  }
}
