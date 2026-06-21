import type { ChatTransport, UIMessageChunk } from "ai";
import { nanoid } from "nanoid";
import { ipcClient } from "@renderer/utils/ipc";
import { loggerFor } from "@renderer/utils/logger";
import type {
  AgentChatMessage,
  AgentModelSelection,
  AgentReasoningLevel,
  SendAgentMessageInput,
} from "@shared/chat";

const transportLog = loggerFor("chat.transport");

type AgentRequestBody = {
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
};

function agentRequestBody(value: unknown): AgentRequestBody {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const modelSelection =
    record.modelSelection &&
    typeof record.modelSelection === "object" &&
    typeof (record.modelSelection as Record<string, unknown>).providerId === "string" &&
    typeof (record.modelSelection as Record<string, unknown>).modelId === "string"
      ? (record.modelSelection as AgentModelSelection satisfies AgentModelSelection)
      : undefined;
  const reasoningLevel = record.reasoningLevel;
  return {
    ...(modelSelection ? { modelSelection } : {}),
    ...(reasoningLevel === "default" ||
    reasoningLevel === "low" ||
    reasoningLevel === "medium" ||
    reasoningLevel === "high" ||
    reasoningLevel === "xhigh"
      ? { reasoningLevel }
      : {}),
  };
}

function terminalType(chunk: UIMessageChunk) {
  if (chunk.type === "finish") return "finish";
  if (chunk.type === "abort") return "abort";
  if (chunk.type === "error") return "error";
  return null;
}

function errorFromChunk(chunk: UIMessageChunk) {
  return new Error(
    "errorText" in chunk && chunk.errorText ? chunk.errorText : "Agent stream failed",
  );
}

export class ElectronChatTransport implements ChatTransport<AgentChatMessage> {
  constructor(private readonly threadId: string) {}

  async sendMessages({
    messages,
    abortSignal,
    body,
  }: Parameters<ChatTransport<AgentChatMessage>["sendMessages"]>[0]) {
    const requestId = `agent-${nanoid()}`;
    const requestBody = agentRequestBody(body);
    let listener:
      | ((event: unknown, payload: { requestId: string; chunk: UIMessageChunk }) => void)
      | null = null;
    let controllerRef: ReadableStreamDefaultController<UIMessageChunk> | null = null;
    let closed = false;

    const cleanup = () => {
      if (!listener) return;
      window.ipcRenderer.removeListener("agent:stream", listener);
      listener = null;
    };
    const close = () => {
      if (closed) return;
      closed = true;
      cleanup();
      controllerRef?.close();
    };
    const fail = (error: Error) => {
      if (closed) return;
      closed = true;
      cleanup();
      controllerRef?.error(error);
    };
    const cancelMainRun = () => {
      void ipcClient.chat.cancelStream({ requestId });
    };

    const stream = new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        controllerRef = controller;
        listener = (_event, payload) => {
          if (payload.requestId !== requestId || closed) return;
          const terminal = terminalType(payload.chunk);
          if (terminal === "abort") {
            close();
            return;
          }
          if (terminal === "error") {
            fail(errorFromChunk(payload.chunk));
            return;
          }
          controller.enqueue(payload.chunk);
          if (terminal === "finish") close();
        };
        window.ipcRenderer.on("agent:stream", listener);
      },
      cancel: () => {
        cleanup();
      },
    });

    abortSignal?.addEventListener(
      "abort",
      () => {
        transportLog.info("abort", { requestId, threadId: this.threadId });
        cancelMainRun();
        close();
      },
      { once: true },
    );

    const input: SendAgentMessageInput = {
      requestId,
      threadId: this.threadId,
      messages,
      ...requestBody,
    };
    transportLog.info("send", {
      requestId,
      threadId: this.threadId,
      messages: messages.length,
      modelSelection: requestBody.modelSelection,
      reasoningLevel: requestBody.reasoningLevel,
    });
    void ipcClient.chat.sendMessage(input).catch((error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });

    return stream;
  }

  async reconnectToStream() {
    return null;
  }
}
