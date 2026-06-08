import fs from "node:fs";
import path from "node:path";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { streamSimple, type Message } from "@earendil-works/pi-ai";
import { SessionManager, convertToLlm } from "@earendil-works/pi-coding-agent";
import type { WebContents } from "electron";
import { nanoid } from "nanoid";
import { getStorageRoot } from "../../config";
import {
  agentMessageToDTO,
  CHAT_STREAM_CHANNEL,
  mapAssistantEventToStreamEvent,
  sessionEntriesToMessages,
  wrapStreamPayload,
} from "./message-mapper";
import { createReflectaModelRegistry } from "./model-config";
import { buildSystemPrompt, previewText } from "./prompt";
import { ChatRepository } from "./repository";
import { createReflectaTools, type ReflectaToolDeps } from "./tools";
import type {
  CancelStreamInput,
  ChatMessageDTO,
  ChatStreamEvent,
  ConfirmToolCallInput,
  ConversationDTO,
  SendMessageInput,
  SendMessageResult,
} from "@shared/chat";

type ActiveRun = {
  requestId: string;
  conversationId: string;
  webContents: WebContents;
  abortController: AbortController;
};

type ConversationSession = {
  agent: Agent;
  sessionManager: SessionManager;
};

type PendingToolApproval = {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
};

export interface ToolApprovalHost {
  emitToolEvent(event: ChatStreamEvent): Promise<void>;
  waitForToolApproval(toolCallId: string, signal?: AbortSignal): Promise<boolean>;
}

export class ChatRuntime implements ToolApprovalHost {
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly conversationSessions = new Map<string, ConversationSession>();
  private readonly pendingToolApprovals = new Map<string, PendingToolApproval>();
  private readonly toolDeps: ReflectaToolDeps;
  private currentRequestId: string | null = null;

  constructor(
    private readonly repository: ChatRepository,
    toolDeps: ReflectaToolDeps,
  ) {
    this.toolDeps = toolDeps;
  }

  async listConversations(): Promise<ConversationDTO[]> {
    return this.repository.listConversations();
  }

  async createConversation(title?: string): Promise<ConversationDTO> {
    return this.repository.createConversation(title);
  }

  async getConversation(conversationId: string): Promise<ConversationDTO | null> {
    return this.repository.getConversation(conversationId);
  }

  async renameConversation(conversationId: string, title: string): Promise<void> {
    return this.repository.renameConversation(conversationId, title);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.conversationSessions.delete(conversationId);
    return this.repository.deleteConversation(conversationId);
  }

  async getMessages(conversationId: string): Promise<ChatMessageDTO[]> {
    const conversation = await this.repository.getConversation(conversationId);
    if (!conversation?.piSessionFile || !fs.existsSync(conversation.piSessionFile)) {
      return [];
    }
    const sessionManager = SessionManager.open(
      conversation.piSessionFile,
      undefined,
      getStorageRoot(),
    );
    const entries = sessionManager.getEntries().filter((entry) => entry.type === "message");
    return sessionEntriesToMessages(entries);
  }

  async sendMessage(
    input: SendMessageInput & { webContents: WebContents },
  ): Promise<SendMessageResult> {
    const requestId = nanoid();
    const abortController = new AbortController();

    this.activeRuns.set(requestId, {
      requestId,
      conversationId: input.conversationId,
      webContents: input.webContents,
      abortController,
    });

    void this.runTurn(requestId, input, abortController.signal).catch((error) => {
      this.emit(requestId, {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });

    return { requestId };
  }

  async confirmToolCall(input: ConfirmToolCallInput): Promise<void> {
    const pending = this.pendingToolApprovals.get(input.toolCallId);
    if (!pending) {
      throw new Error("No pending tool call found");
    }
    pending.resolve(input.approved);
    this.pendingToolApprovals.delete(input.toolCallId);
  }

  async cancel(input: CancelStreamInput): Promise<void> {
    const run = this.activeRuns.get(input.requestId);
    if (!run) return;
    run.abortController.abort();
    const session = this.conversationSessions.get(run.conversationId);
    session?.agent.abort();
    for (const [toolCallId, pending] of this.pendingToolApprovals.entries()) {
      pending.resolve(false);
      this.pendingToolApprovals.delete(toolCallId);
    }
    this.emit(input.requestId, { type: "cancelled" });
    this.activeRuns.delete(input.requestId);
    if (this.currentRequestId === input.requestId) {
      this.currentRequestId = null;
    }
  }

  async emitToolEvent(event: ChatStreamEvent): Promise<void> {
    if (!this.currentRequestId) return;
    this.emit(this.currentRequestId, event);
  }

  waitForToolApproval(toolCallId: string, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve, reject) => {
      const pending: PendingToolApproval = { resolve, reject };
      this.pendingToolApprovals.set(toolCallId, pending);

      const onAbort = () => {
        this.pendingToolApprovals.delete(toolCallId);
        resolve(false);
      };

      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private async runTurn(
    requestId: string,
    input: SendMessageInput,
    signal: AbortSignal,
  ): Promise<void> {
    const run = this.activeRuns.get(requestId);
    if (!run) return;

    this.currentRequestId = requestId;

    const { agent, sessionManager } = await this.getOrCreateSession(
      input.conversationId,
      input.referenceThoughtIds ?? [],
    );

    const unsubscribe = agent.subscribe(async (event) => {
      if (event.type === "message_update") {
        const mapped = mapAssistantEventToStreamEvent(event.assistantMessageEvent);
        if (mapped) {
          this.emit(requestId, mapped);
        }
      }

      if (event.type === "message_end") {
        sessionManager.appendMessage(event.message as Message);
      }

      if (event.type === "tool_execution_start" && !this.isWriteTool(event.toolName)) {
        this.emit(requestId, {
          type: "tool_running",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: "args" in event ? event.args : undefined,
        });
      }

      if (event.type === "tool_execution_end" && !this.isWriteTool(event.toolName)) {
        this.emit(requestId, {
          type: "tool_result",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result,
          isError: event.isError,
        });
      }

      if (event.type === "agent_end") {
        const lastAssistant = [...event.messages]
          .reverse()
          .find((message) => message.role === "assistant");
        const preview = lastAssistant
          ? previewText(agentMessageToDTO(lastAssistant, "preview").content)
          : previewText(input.content);

        const conversation = await this.repository.getConversation(input.conversationId);
        const title =
          conversation && conversation.title === "新对话"
            ? previewText(input.content, 40)
            : undefined;

        await this.repository.touchConversation({
          conversationId: input.conversationId,
          lastMessagePreview: preview,
          title,
        });

        this.emit(requestId, { type: "done", conversationId: input.conversationId });
        unsubscribe();
        this.activeRuns.delete(requestId);
        if (this.currentRequestId === requestId) {
          this.currentRequestId = null;
        }
      }
    });

    try {
      if (signal.aborted) {
        throw new Error("aborted");
      }
      await agent.prompt(input.content);
      await agent.waitForIdle();
    } catch (error) {
      if (signal.aborted) {
        this.emit(requestId, { type: "cancelled" });
      } else {
        this.emit(requestId, {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      unsubscribe();
      this.activeRuns.delete(requestId);
      if (this.currentRequestId === requestId) {
        this.currentRequestId = null;
      }
    }
  }

  private async getOrCreateSession(
    conversationId: string,
    referenceThoughtIds: string[],
  ): Promise<ConversationSession> {
    const existing = this.conversationSessions.get(conversationId);
    if (existing) {
      existing.agent.state.systemPrompt = await buildSystemPrompt(
        this.toolDeps.thoughtService,
        referenceThoughtIds,
      );
      return existing;
    }

    const conversation = await this.repository.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const sessionDir = path.join(getStorageRoot(), "agent-sessions");
    fs.mkdirSync(sessionDir, { recursive: true });

    const { modelRegistry, model } = await createReflectaModelRegistry();
    const systemPrompt = await buildSystemPrompt(this.toolDeps.thoughtService, referenceThoughtIds);

    let sessionManager: SessionManager;
    if (conversation.piSessionFile && fs.existsSync(conversation.piSessionFile)) {
      sessionManager = SessionManager.open(
        conversation.piSessionFile,
        sessionDir,
        getStorageRoot(),
      );
    } else {
      sessionManager = SessionManager.create(getStorageRoot(), sessionDir);
      const sessionFile = sessionManager.getSessionFile();
      const sessionId = sessionManager.getSessionId();
      if (sessionFile && sessionId) {
        await this.repository.bindPiSession({
          conversationId,
          piSessionId: sessionId,
          piSessionFile: sessionFile,
        });
      }
    }

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        thinkingLevel: "off",
        tools: [],
      },
      convertToLlm: (messages) => convertToLlm(messages as AgentMessage[]),
      streamFn: async (activeModel, context, options) => {
        const auth = await modelRegistry.getApiKeyAndHeaders(activeModel);
        if (!auth.ok) {
          throw new Error(auth.error);
        }
        return streamSimple(activeModel, context, {
          ...options,
          apiKey: auth.apiKey,
          headers: auth.headers ?? options?.headers,
        });
      },
      sessionId: sessionManager.getSessionId(),
      toolExecution: "sequential",
    });

    agent.state.tools = createReflectaTools(this.toolDeps, this);

    const context = sessionManager.buildSessionContext();
    if (context.messages.length > 0) {
      agent.state.messages = context.messages;
    }

    const session = { agent, sessionManager };
    this.conversationSessions.set(conversationId, session);
    return session;
  }

  private emit(requestId: string, event: ChatStreamEvent) {
    const run = this.activeRuns.get(requestId);
    if (!run || run.webContents.isDestroyed()) return;
    run.webContents.send(CHAT_STREAM_CHANNEL, wrapStreamPayload(requestId, event));
  }

  private isWriteTool(toolName: string): boolean {
    return toolName.startsWith("propose_");
  }
}
