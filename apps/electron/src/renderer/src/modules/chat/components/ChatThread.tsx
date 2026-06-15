import { useEffect, useRef } from "react";
import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { useChatPageContext } from "../context";
import { ToolApprovalCard } from "./ToolApprovalCard";
import { MarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";

export function ChatThread() {
  const ctx = useChatPageContext();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ctx.chatMessages.length, ctx.chatMessages.at(-1), ctx.chatStatus]);

  const renderMessage = (message: UIMessage, messageIndex: number) => {
    if (message.role === "user") {
      const text = message.parts
        .filter((part) => isTextUIPart(part))
        .map((part) => part.text)
        .join("");
      return (
        <div key={message.id} className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-white">
            <div className="whitespace-pre-wrap">{text}</div>
          </div>
        </div>
      );
    }

    if (message.role !== "assistant") return null;
    const isLastMessage = messageIndex === ctx.chatMessages.length - 1;
    const isAnimating =
      isLastMessage && (ctx.chatStatus === "streaming" || ctx.chatStatus === "submitted");

    return (
      <div key={message.id} className="flex flex-col gap-2">
        {message.parts.map((part, partIndex) => {
          if (isTextUIPart(part)) {
            return (
              <div key={`${message.id}-text-${partIndex}`} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                  {part.text ? (
                    <MarkdownPreview content={part.text} />
                  ) : (
                    <span className="text-muted-foreground">思考中...</span>
                  )}
                  {isAnimating && (
                    <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-muted-foreground align-middle" />
                  )}
                </div>
              </div>
            );
          }
          if (isToolUIPart(part)) {
            return (
              <ToolApprovalCard
                key={`${message.id}-tool-${part.toolCallId}-${part.state}`}
                part={part}
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      {ctx.messagesLoading && ctx.chatMessages.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">加载消息...</div>
      )}
      {!ctx.messagesLoading && ctx.chatMessages.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center py-16 text-center">
          <div className="text-lg font-medium text-foreground">开始和 Agent 对话</div>
          <div className="mt-2 max-w-md text-sm text-muted-foreground">
            在右侧浏览知识库，@ 引用 thought，或直接在下方输入问题。
          </div>
        </div>
      )}
      {ctx.chatError && (
        <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ctx.chatError.message}
        </div>
      )}
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {ctx.chatMessages.map((message, index) => renderMessage(message, index))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
