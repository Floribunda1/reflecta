import type { WebContents } from "electron";
import {
  convertToModelMessages,
  createIdGenerator,
  isFileUIPart,
  streamText,
  type FileUIPart,
  type TextUIPart,
  type UIMessageChunk,
} from "ai";
import { agentLog } from "../../logger";
import agentSystemPrompt from "./agent-system-prompt.md?raw";
import type {
  AgentChatMessage,
  AgentReasoningLevel,
  AgentStreamPayload,
  SendAgentMessageInput,
  SendAgentMessageResult,
} from "@shared/chat";
import { agentMessageDisplayText } from "@shared/chat-display";
import { buildSelectedContextBlock } from "./context";
import { formatAgentError } from "./error";
import { getAgentModel } from "./model";
import { AgentRepository } from "./repository";
import { agentStopWhen, createAgentTools } from "./tools";
import { attachmentIdFor, attachmentSizeFor } from "./attachments";

export const AGENT_STREAM_CHANNEL = "agent:stream";
const MAX_MODEL_HISTORY_MESSAGES = 24;
const MAX_TITLE_TRANSCRIPT_CHARS = 6000;
const THREAD_TITLE_SYSTEM_PROMPT =
  "你是 Reflecta 的对话标题生成器。根据对话内容生成一个简短、具体、可扫描的中文标题。只输出标题，不要解释，不要加引号，不要超过 18 个汉字。";
type ActiveRun = {
  abortController: AbortController;
  webContents: WebContents;
  runId?: string;
  abortEmitted?: boolean;
};

export function selectModelMessages(messages: AgentChatMessage[]): AgentChatMessage[] {
  if (messages.length <= MAX_MODEL_HISTORY_MESSAGES) return messages;
  return messages.slice(-MAX_MODEL_HISTORY_MESSAGES);
}

function titleTranscript(messages: AgentChatMessage[]) {
  return selectModelMessages(messages)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const text = agentMessageDisplayText(message).trim();
      if (!text) return "";
      return `${message.role === "user" ? "用户" : "助手"}：${text}`;
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TITLE_TRANSCRIPT_CHARS);
}

export function cleanGeneratedThreadTitle(value: string) {
  const title = value
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return title || "新对话";
}

function supportsNativeFileParts(providerOptionsKey: string) {
  return providerOptionsKey === "openai";
}

function filePartAsText(part: FileUIPart, messageId: string, index: number): TextUIPart {
  const name = part.filename || "未命名附件";
  const attachmentId = attachmentIdFor(part, messageId, index);
  const size = attachmentSizeFor(part);
  return {
    type: "text",
    text:
      `\n\n[附件: ${name}; attachmentId=${attachmentId}; mediaType=${part.mediaType}` +
      `${size === undefined ? "" : `; size=${size} bytes`}] ` +
      `当前模型不支持直接接收 file/image message part；需要读取附件内容时调用 attachment_read。`,
  };
}

export function modelMessagesForProvider(
  messages: AgentChatMessage[],
  providerOptionsKey: string,
): AgentChatMessage[] {
  if (supportsNativeFileParts(providerOptionsKey)) return messages;
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part, index) =>
      isFileUIPart(part) ? filePartAsText(part, message.id, index) : part,
    ),
  }));
}

export function providerOptionsForReasoning(
  level: AgentReasoningLevel | undefined,
  providerOptionsKey = "openai",
  options: { instructions?: string; storeResponses?: boolean } = {},
): Record<string, Record<string, boolean | string | string[]>> {
  const reasoningEffort: Record<string, string> =
    level && level !== "default" ? { reasoningEffort: level } : {};
  if (providerOptionsKey === "openai") {
    return {
      openai: {
        ...reasoningEffort,
        reasoningSummary: "auto",
        ...(options.storeResponses === false
          ? { include: ["reasoning.encrypted_content"], store: false }
          : {}),
        ...(options.instructions ? { instructions: options.instructions } : {}),
      },
    };
  }

  return {
    openaiCompatible: reasoningEffort,
    [providerOptionsKey]: reasoningEffort,
  };
}

export class AgentRuntime {
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(private readonly repository: AgentRepository) {
    void this.repository.markInterruptedRuns();
  }

  listThreads() {
    return this.repository.listThreads();
  }

  createThread(title?: string) {
    return this.repository.createThread(title);
  }

  renameThread(threadId: string, title: string) {
    return this.repository.renameThread(threadId, title);
  }

  archiveThread(threadId: string) {
    return this.repository.archiveThread(threadId);
  }

  deleteThread(threadId: string) {
    return this.repository.deleteThread(threadId);
  }

  getMessages(threadId: string) {
    return this.repository.getMessages(threadId);
  }

  async generateThreadTitle(threadId: string): Promise<string> {
    const messages = await this.repository.getMessages(threadId);
    const transcript = titleTranscript(messages);
    if (!transcript) throw new Error("没有可用于生成标题的对话内容");

    const { model, providerOptionsKey, codexSubscription } = await getAgentModel();
    const providerOptions = providerOptionsForReasoning("default", providerOptionsKey, {
      instructions: codexSubscription ? THREAD_TITLE_SYSTEM_PROMPT : undefined,
      storeResponses: codexSubscription ? false : undefined,
    });
    const result = streamText({
      model,
      system: codexSubscription ? undefined : THREAD_TITLE_SYSTEM_PROMPT,
      prompt: `请为下面这段对话生成标题：\n\n${transcript}`,
      providerOptions,
    });
    const text: string[] = [];
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") text.push(part.text);
    }
    const title = cleanGeneratedThreadTitle(text.join(""));
    await this.repository.renameThread(threadId, title);
    return title;
  }

  async sendMessage(
    input: SendAgentMessageInput & { webContents: WebContents },
  ): Promise<SendAgentMessageResult> {
    const requestId = input.requestId;
    const abortController = new AbortController();
    this.activeRuns.set(requestId, { abortController, webContents: input.webContents });
    agentLog.info("run.requested", {
      requestId,
      threadId: input.threadId,
      requestMessages: input.messages.length,
      modelSelection: input.modelSelection,
      reasoningLevel: input.reasoningLevel,
    });

    void this.run(requestId, input, abortController).catch((error) => {
      if (abortController.signal.aborted) return;
      agentLog.error("run.unhandledError", {
        requestId,
        threadId: input.threadId,
        error,
      });
      this.emit(input.webContents, requestId, {
        type: "error",
        errorText: formatAgentError(error),
      });
      this.activeRuns.delete(requestId);
    });

    return { requestId };
  }

  async cancel(requestId: string): Promise<void> {
    const active = this.activeRuns.get(requestId);
    agentLog.info("run.cancelRequested", {
      requestId,
      found: Boolean(active),
      runId: active?.runId,
    });
    if (!active) return;
    active.abortController.abort();
    if (active.runId) {
      await this.repository.finishRun(active.runId, "cancelled");
    }
    this.emitAbort(requestId, "cancelled");
  }

  private async run(
    requestId: string,
    input: SendAgentMessageInput & { webContents: WebContents },
    abortController: AbortController,
  ): Promise<void> {
    const { model, modelId, providerOptionsKey, codexSubscription } = await getAgentModel(
      input.modelSelection,
    );
    const runId = await this.repository.createRun(input.threadId, modelId);
    agentLog.info("run.started", {
      requestId,
      runId,
      threadId: input.threadId,
      modelId,
    });
    const active = this.activeRuns.get(requestId);
    if (active) active.runId = runId;
    if (abortController.signal.aborted) {
      await this.repository.finishRun(runId, "cancelled");
      this.emitAbort(requestId, "cancelled");
      return;
    }

    await this.repository.replaceMessages(input.threadId, input.messages);

    const modelMessages = modelMessagesForProvider(
      selectModelMessages(input.messages),
      providerOptionsKey,
    );
    const selectedContextBlock = await buildSelectedContextBlock(input.messages);
    const systemPrompt = agentSystemPrompt + selectedContextBlock;
    const providerOptions = providerOptionsForReasoning(input.reasoningLevel, providerOptionsKey, {
      instructions: codexSubscription ? systemPrompt : undefined,
      storeResponses: codexSubscription ? false : undefined,
    });
    agentLog.debug("run.modelInputReady", {
      requestId,
      runId,
      persistedMessages: input.messages.length,
      modelMessages: modelMessages.length,
      selectedContextChars: selectedContextBlock.length,
    });
    const tools = createAgentTools(this.repository, input.threadId);
    const result = streamText({
      model,
      system: codexSubscription ? undefined : systemPrompt,
      messages: await convertToModelMessages(modelMessages),
      tools,
      stopWhen: agentStopWhen<typeof tools>(),
      providerOptions,
      abortSignal: abortController.signal,
    });

    const stream = result.toUIMessageStream({
      originalMessages: input.messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onFinish: async ({ responseMessage, isAborted }) => {
        agentLog.info("run.finishCallback", {
          requestId,
          runId,
          threadId: input.threadId,
          isAborted,
          responseMessageId: responseMessage.id,
        });
        if (isAborted) {
          await this.repository.finishRun(runId, "cancelled");
          return;
        }
        await this.repository.replaceMessages(input.threadId, [
          ...input.messages,
          responseMessage as AgentChatMessage,
        ]);
        await this.repository.finishRun(runId, "completed");
      },
      onError: (error) => (error instanceof Error ? error.message : "Unknown error"),
    });

    try {
      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount += 1;
        this.emit(input.webContents, requestId, chunk);
      }
      agentLog.info("run.streamDrained", {
        requestId,
        runId,
        threadId: input.threadId,
        chunks: chunkCount,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        await this.repository.finishRun(runId, "cancelled");
        this.emitAbort(requestId, "cancelled");
        return;
      }
      const errorText = formatAgentError(error);
      await this.repository.finishRun(runId, "failed", errorText);
      agentLog.error("run.streamFailed", {
        requestId,
        runId,
        threadId: input.threadId,
        error,
      });
      throw error;
    } finally {
      this.activeRuns.delete(requestId);
    }
  }

  private emit(webContents: WebContents, requestId: string, chunk: UIMessageChunk) {
    if (webContents.isDestroyed()) return;
    const payload: AgentStreamPayload = { requestId, chunk };
    webContents.send(AGENT_STREAM_CHANNEL, payload);
  }

  private emitAbort(requestId: string, reason: string) {
    const active = this.activeRuns.get(requestId);
    if (!active || active.abortEmitted) return;
    active.abortEmitted = true;
    this.emit(active.webContents, requestId, { type: "abort", reason });
  }
}
