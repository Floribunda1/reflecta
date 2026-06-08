import type { ChatStreamEvent } from "@shared/chat";
import type { UIMessageChunk } from "ai";
import { WRITE_TOOL_NAMES } from "./write-tool-names";

export class ChatStreamChunkWriter {
  private textStarted = false;
  private textSegment = 0;
  private messageStarted = false;
  private closed = false;

  constructor(
    private readonly controller: ReadableStreamDefaultController<UIMessageChunk>,
    private readonly requestId: string,
  ) {}

  handleEvent(event: ChatStreamEvent) {
    if (this.closed) return;

    switch (event.type) {
      case "delta":
        this.ensureMessageStarted();
        this.ensureTextStarted();
        this.enqueue({
          type: "text-delta",
          id: this.currentTextPartId,
          delta: event.content,
        });
        break;
      case "tool_pending":
        this.ensureMessageStarted();
        this.endTextIfNeeded();
        this.enqueueToolInput(event.toolCallId, event.toolName, event.input);
        if (WRITE_TOOL_NAMES.has(event.toolName)) {
          this.enqueue({
            type: "tool-approval-request",
            approvalId: event.toolCallId,
            toolCallId: event.toolCallId,
          });
        }
        break;
      case "tool_running":
        this.ensureMessageStarted();
        this.endTextIfNeeded();
        this.enqueueToolInput(event.toolCallId, event.toolName, event.input ?? {});
        break;
      case "tool_result":
        if (event.isError) {
          this.enqueue({
            type: "tool-output-error",
            toolCallId: event.toolCallId,
            errorText: stringifyToolResult(event.result),
          });
        } else {
          this.enqueue({
            type: "tool-output-available",
            toolCallId: event.toolCallId,
            output: event.result,
          });
        }
        break;
      case "done":
        this.closeStream();
        break;
      case "error":
        this.enqueue({ type: "error", errorText: event.message });
        this.closeStream();
        break;
      case "cancelled":
        this.enqueue({ type: "abort" });
        this.closeStream();
        break;
    }
  }

  closeStream() {
    if (this.closed) return;
    this.endTextIfNeeded();
    this.enqueue({ type: "finish", finishReason: "stop" });
    this.closed = true;
    this.controller.close();
  }

  private get assistantMessageId() {
    return `assistant-${this.requestId}`;
  }

  private get currentTextPartId() {
    return `text-${this.requestId}-${this.textSegment}`;
  }

  private ensureMessageStarted() {
    if (this.messageStarted) return;
    this.enqueue({ type: "start", messageId: this.assistantMessageId });
    this.messageStarted = true;
  }

  private ensureTextStarted() {
    if (this.textStarted) return;
    this.enqueue({ type: "text-start", id: this.currentTextPartId });
    this.textStarted = true;
  }

  private endTextIfNeeded() {
    if (!this.textStarted) return;
    this.enqueue({ type: "text-end", id: this.currentTextPartId });
    this.textStarted = false;
    this.textSegment += 1;
  }

  private enqueueToolInput(toolCallId: string, toolName: string, input: unknown) {
    this.enqueue({
      type: "tool-input-available",
      toolCallId,
      toolName,
      input,
      dynamic: true,
    });
  }

  private enqueue(chunk: UIMessageChunk) {
    if (this.closed) return;
    this.controller.enqueue(chunk);
  }
}

function stringifyToolResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return "Tool execution failed";
  }
}
