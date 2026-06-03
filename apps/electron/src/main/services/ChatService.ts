import type {
  CancelStreamInput,
  ChatMessageDTO,
  ConfirmToolCallInput,
  ConversationDTO,
  SendMessageInput,
  SendMessageResult,
} from "@shared/chat";
import { getIpcContext, IpcMethod, IpcService } from "electron-ipc-decorator";
import { chatRuntime } from "./core";

export class ChatService extends IpcService {
  static readonly groupName = "chat";

  @IpcMethod()
  listConversations(): Promise<ConversationDTO[]> {
    return chatRuntime.listConversations();
  }

  @IpcMethod()
  createConversation(title?: string): Promise<ConversationDTO> {
    return chatRuntime.createConversation(title);
  }

  @IpcMethod()
  getConversation(conversationId: string): Promise<ConversationDTO | null> {
    return chatRuntime.getConversation(conversationId);
  }

  @IpcMethod()
  renameConversation(conversationId: string, title: string): Promise<void> {
    return chatRuntime.renameConversation(conversationId, title);
  }

  @IpcMethod()
  deleteConversation(conversationId: string): Promise<void> {
    return chatRuntime.deleteConversation(conversationId);
  }

  @IpcMethod()
  getMessages(conversationId: string): Promise<ChatMessageDTO[]> {
    return chatRuntime.getMessages(conversationId);
  }

  @IpcMethod()
  sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const ctx = getIpcContext();
    return chatRuntime.sendMessage({
      ...input,
      webContents: ctx.sender,
    });
  }

  @IpcMethod()
  confirmToolCall(input: ConfirmToolCallInput): Promise<void> {
    return chatRuntime.confirmToolCall(input);
  }

  @IpcMethod()
  rejectToolCall(input: ConfirmToolCallInput): Promise<void> {
    return chatRuntime.confirmToolCall({ ...input, approved: false });
  }

  @IpcMethod()
  cancelStream(input: CancelStreamInput): Promise<void> {
    return chatRuntime.cancel(input);
  }
}
