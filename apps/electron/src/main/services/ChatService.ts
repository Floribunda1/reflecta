import { getIpcContext, IpcMethod, IpcService } from "electron-ipc-decorator";
import type { CancelAgentRunInput, SendAgentMessageInput } from "@shared/chat";
import { ipcLog } from "../logger";
import { agentRuntime } from "./core";

export class ChatService extends IpcService {
  static readonly groupName = "chat";

  @IpcMethod()
  listThreads() {
    return agentRuntime.listThreads();
  }

  @IpcMethod()
  createThread(title?: string) {
    return agentRuntime.createThread(title);
  }

  @IpcMethod()
  renameThread(threadId: string, title: string) {
    return agentRuntime.renameThread(threadId, title);
  }

  @IpcMethod()
  archiveThread(threadId: string) {
    return agentRuntime.archiveThread(threadId);
  }

  @IpcMethod()
  deleteThread(threadId: string) {
    return agentRuntime.deleteThread(threadId);
  }

  @IpcMethod()
  getMessages(threadId: string) {
    return agentRuntime.getMessages(threadId);
  }

  @IpcMethod()
  sendMessage(input: SendAgentMessageInput) {
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
    ipcLog.info("chat.cancelStream", { requestId: input.requestId });
    return agentRuntime.cancel(input.requestId);
  }
}
