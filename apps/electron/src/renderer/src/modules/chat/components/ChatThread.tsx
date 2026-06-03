import { defineComponent, nextTick, ref, watch } from "vue";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useChatPageContext } from "../context";
import { ToolApprovalCard } from "./ToolApprovalCard";

export const ChatThread = defineComponent({
  name: "ChatThread",
  setup() {
    const ctx = useChatPageContext()!;
    const bottomRef = ref<HTMLDivElement | null>(null);

    watch(
      () => [ctx.threadItems.value.length, ctx.threadItems.value.at(-1)],
      async () => {
        await nextTick();
        bottomRef.value?.scrollIntoView({ behavior: "smooth" });
      },
    );

    return () => (
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {ctx.messagesLoading.value && ctx.threadItems.value.length === 0 && (
          <div class="py-8 text-center text-sm text-muted-color">加载消息…</div>
        )}

        {!ctx.messagesLoading.value && ctx.threadItems.value.length === 0 && (
          <div class="flex h-full flex-col items-center justify-center py-16 text-center">
            <div class="text-lg font-medium text-color">开始和 Agent 对话</div>
            <div class="mt-2 max-w-md text-sm text-muted-color">
              在右侧浏览知识库，@ 引用 thought，或直接在下方输入问题。
            </div>
          </div>
        )}

        <div class="mx-auto flex max-w-3xl flex-col gap-4">
          {ctx.threadItems.value.map((item, index) => {
            if (item.kind === "tool") {
              return <ToolApprovalCard key={`tool-${item.tool.toolCallId}`} tool={item.tool} />;
            }

            if (item.kind === "assistant-draft") {
              return (
                <div key={item.id} class="flex justify-start">
                  <div class="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-100 px-4 py-3 text-sm leading-6 text-color">
                    {item.content ? (
                      <SimpleMarkdownPreview content={item.content} />
                    ) : (
                      <span class="text-muted-color">思考中…</span>
                    )}
                    {item.streaming && (
                      <span class="ml-1 inline-block h-4 w-1 animate-pulse bg-primary" />
                    )}
                  </div>
                </div>
              );
            }

            const { message } = item;
            const isUser = message.role === "user";

            return (
              <div
                key={`${message.id}-${index}`}
                class={["flex", isUser ? "justify-end" : "justify-start"]}
              >
                <div
                  class={[
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                    isUser
                      ? "rounded-br-md bg-primary text-primary-contrast"
                      : "rounded-bl-md bg-surface-100 text-color",
                  ]}
                >
                  {isUser ? (
                    <div class="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <SimpleMarkdownPreview content={message.content} />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  },
});
