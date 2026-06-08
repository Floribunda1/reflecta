import { defineComponent, nextTick, ref, watch } from "vue";
import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { Streamdown } from "streamdown-vue3";
import { useChatPageContext } from "../context";
import { ToolApprovalCard } from "./ToolApprovalCard";

export const ChatThread = defineComponent({
  name: "ChatThread",
  setup() {
    const ctx = useChatPageContext()!;
    const bottomRef = ref<HTMLDivElement | null>(null);

    watch(
      () => [ctx.chatMessages.value.length, ctx.chatMessages.value.at(-1), ctx.chatStatus.value],
      async () => {
        await nextTick();
        bottomRef.value?.scrollIntoView({ behavior: "smooth" });
      },
    );

    const renderMessage = (message: UIMessage, messageIndex: number) => {
      if (message.role === "user") {
        const text = message.parts
          .filter((part) => isTextUIPart(part))
          .map((part) => part.text)
          .join("");

        return (
          <div key={message.id} class="flex justify-end">
            <div class="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-contrast">
              <div class="whitespace-pre-wrap">{text}</div>
            </div>
          </div>
        );
      }

      if (message.role !== "assistant") return null;

      const isLastMessage = messageIndex === ctx.chatMessages.value.length - 1;
      const isAnimating =
        isLastMessage &&
        (ctx.chatStatus.value === "streaming" || ctx.chatStatus.value === "submitted");

      return (
        <div key={message.id} class="flex flex-col gap-2">
          {message.parts.map((part, partIndex) => {
            if (isTextUIPart(part)) {
              const streaming = part.state === "streaming" || (isAnimating && !part.state);
              return (
                <div key={`${message.id}-text-${partIndex}`} class="flex justify-start">
                  <div class="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-100 px-4 py-3 text-sm leading-6 text-color">
                    {part.text ? (
                      <Streamdown
                        content={part.text}
                        mode="streaming"
                        isAnimating={streaming}
                        parseIncompleteMarkdown
                      />
                    ) : (
                      <span class="text-muted-color">思考中…</span>
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

    return () => (
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {ctx.messagesLoading.value && ctx.chatMessages.value.length === 0 && (
          <div class="py-8 text-center text-sm text-muted-color">加载消息…</div>
        )}

        {!ctx.messagesLoading.value && ctx.chatMessages.value.length === 0 && (
          <div class="flex h-full flex-col items-center justify-center py-16 text-center">
            <div class="text-lg font-medium text-color">开始和 Agent 对话</div>
            <div class="mt-2 max-w-md text-sm text-muted-color">
              在右侧浏览知识库，@ 引用 thought，或直接在下方输入问题。
            </div>
          </div>
        )}

        {ctx.chatError.value && (
          <div class="mx-auto mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {ctx.chatError.value.message}
          </div>
        )}

        <div class="mx-auto flex max-w-3xl flex-col gap-4">
          {ctx.chatMessages.value.map((message, index) => renderMessage(message, index))}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  },
});
