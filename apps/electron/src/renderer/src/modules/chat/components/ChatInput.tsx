import { defineComponent, ref } from "vue";
import Button from "primevue/button";
import Textarea from "primevue/textarea";
import { useChatPageContext } from "../context";

export const ChatInput = defineComponent({
  name: "ChatInput",
  setup() {
    const ctx = useChatPageContext()!;
    const mentionOpen = ref(false);

    return () => (
      <div class="border-t border-surface-200 bg-surface-0 px-6 py-4">
        <div class="mx-auto max-w-3xl">
          {ctx.draftReferences.value.length > 0 && (
            <div class="mb-2 flex flex-wrap gap-2">
              {ctx.draftReferences.value.map((thought) => (
                <span
                  key={thought.id}
                  class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary"
                >
                  @{thought.title || "无标题"}
                  <button
                    type="button"
                    class="hover:text-primary-700"
                    onClick={() => ctx.removeDraftReference(thought.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div class="flex items-end gap-2">
            <Textarea
              v-model={ctx.draftText.value}
              rows={3}
              autoResize
              fluid
              placeholder="输入消息… 使用右侧面板 @ 引用 thought"
              disabled={!ctx.activeConversationId.value}
              {...{
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (ctx.canSend.value) void ctx.sendMessage();
                  }
                },
              }}
            />
            <div class="flex shrink-0 flex-col gap-2">
              {ctx.isStreaming.value ? (
                <Button
                  icon="pi pi-stop"
                  severity="danger"
                  aria-label="停止"
                  onClick={() => void ctx.cancelStream()}
                />
              ) : (
                <Button
                  icon="pi pi-send"
                  aria-label="发送"
                  disabled={!ctx.canSend.value}
                  onClick={() => void ctx.sendMessage()}
                />
              )}
            </div>
          </div>

          {mentionOpen.value && (
            <div class="mt-2 text-xs text-muted-color">请从右侧面板选择要引用的 thought</div>
          )}
        </div>
      </div>
    );
  },
});
