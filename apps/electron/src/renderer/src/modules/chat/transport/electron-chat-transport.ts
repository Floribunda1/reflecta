import { ipcClient } from "@renderer/utils/ipc";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { onChatStreamEvent } from "../stream/on-chat-stream-event";
import { ChatStreamChunkWriter } from "./chat-stream-event-to-ui-chunks";

export type ElectronChatTransportCallbacks = {
  onRequestStart?: (requestId: string) => void;
  onRequestEnd?: () => void;
};

export class ElectronChatTransport implements ChatTransport<UIMessage> {
  private activeRequestId: string | null = null;

  constructor(
    private readonly conversationId: string,
    private readonly callbacks: ElectronChatTransportCallbacks = {},
  ) {}

  async sendMessages({
    messages,
    abortSignal,
    body,
  }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const content = extractLastUserText(messages);
    if (!content) {
      throw new Error("No user message to send");
    }

    const referenceThoughtIds =
      body && typeof body === "object" && "referenceThoughtIds" in body
        ? (body.referenceThoughtIds as string[] | undefined)
        : undefined;

    const { requestId } = await ipcClient.chat.sendMessage({
      conversationId: this.conversationId,
      content,
      referenceThoughtIds,
    });

    this.activeRequestId = requestId;
    this.callbacks.onRequestStart?.(requestId);

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const writer = new ChatStreamChunkWriter(controller, requestId);

        const unsubscribe = onChatStreamEvent(({ requestId: eventRequestId, event }) => {
          if (eventRequestId !== requestId) return;
          writer.handleEvent(event);
          if (event.type === "done" || event.type === "error" || event.type === "cancelled") {
            cleanup();
          }
        });

        const cleanup = () => {
          unsubscribe();
          if (this.activeRequestId === requestId) {
            this.activeRequestId = null;
          }
          this.callbacks.onRequestEnd?.();
        };

        abortSignal?.addEventListener(
          "abort",
          () => {
            if (this.activeRequestId === requestId) {
              void ipcClient.chat.cancelStream({ requestId });
            }
            writer.handleEvent({ type: "cancelled" });
            cleanup();
          },
          { once: true },
        );
      },
    });
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}

function extractLastUserText(messages: UIMessage[]): string {
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") return "";
  return lastMessage.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}
