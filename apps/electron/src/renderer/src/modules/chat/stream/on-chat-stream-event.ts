import type { ChatStreamEvent } from "@shared/chat";

export const CHAT_STREAM_CHANNEL = "chat:stream-event";

export type ChatStreamPayload = {
  requestId: string;
  event: ChatStreamEvent;
};

export function onChatStreamEvent(handler: (payload: ChatStreamPayload) => void): () => void {
  const listener = (_event: unknown, payload: ChatStreamPayload) => {
    handler(payload);
  };
  window.ipcRenderer.on(CHAT_STREAM_CHANNEL, listener);
  return () => window.ipcRenderer.removeListener(CHAT_STREAM_CHANNEL, listener);
}
