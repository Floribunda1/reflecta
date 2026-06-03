import { defineComponent, ref } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { useConfirm } from "primevue/useconfirm";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useChatPageContext } from "../context";

export const ConversationSidebar = defineComponent({
  name: "ConversationSidebar",
  setup() {
    const ctx = useChatPageContext()!;
    const confirm = useConfirm();
    const renamingId = ref<string | null>(null);
    const renameValue = ref("");

    const startRename = (id: string, title: string) => {
      renamingId.value = id;
      renameValue.value = title;
    };

    const commitRename = async () => {
      if (!renamingId.value) return;
      const title = renameValue.value.trim();
      if (title) {
        await ctx.renameConversation(renamingId.value, title);
      }
      renamingId.value = null;
    };

    return () => (
      <aside class="flex h-full w-[260px] shrink-0 flex-col border-r border-surface-200 bg-surface-50">
        <div class="flex items-center justify-between border-b border-surface-200 px-4 py-3">
          <span class="text-sm font-semibold text-color">对话</span>
          <Button
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            text
            aria-label="新建对话"
            disabled={ctx.isStreaming.value}
            onClick={() => void ctx.createConversation()}
          />
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          {ctx.conversationsLoading.value && ctx.conversations.value.length === 0 && (
            <div class="px-2 py-4 text-sm text-muted-color">加载中…</div>
          )}

          {!ctx.conversationsLoading.value && ctx.conversations.value.length === 0 && (
            <div class="px-2 py-4 text-sm text-muted-color">暂无对话，点击 + 新建</div>
          )}

          {ctx.conversations.value.map((conversation) => {
            const active = ctx.activeConversationId.value === conversation.id;
            const renaming = renamingId.value === conversation.id;

            return (
              <div
                key={conversation.id}
                class={[
                  "group mb-1 rounded-lg border px-3 py-2 transition-colors",
                  active
                    ? "border-primary-200 bg-primary-50"
                    : "border-transparent hover:border-surface-200 hover:bg-surface-0",
                  ctx.isStreaming.value && !active ? "opacity-50" : "",
                ]}
              >
                {renaming ? (
                  <InputText
                    v-model={renameValue.value}
                    size="small"
                    fluid
                    autofocus
                    {...{
                      onKeydown: (e: KeyboardEvent) => {
                        if (e.key === "Enter") void commitRename();
                        if (e.key === "Escape") renamingId.value = null;
                      },
                      onBlur: () => void commitRename(),
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    class="w-full text-left"
                    disabled={ctx.isStreaming.value && !active}
                    onClick={() => ctx.selectConversation(conversation.id)}
                  >
                    <div class="truncate text-sm font-medium text-color">{conversation.title}</div>
                    {conversation.lastMessagePreview && (
                      <div class="mt-0.5 truncate text-xs text-muted-color">
                        {conversation.lastMessagePreview}
                      </div>
                    )}
                    <div class="mt-1 text-[11px] text-muted-color">
                      {formatDistanceToNow(new Date(conversation.updatedAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </div>
                  </button>
                )}

                {!renaming && (
                  <div class="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      icon="pi pi-pencil"
                      size="small"
                      text
                      severity="secondary"
                      class="!h-6 !w-6"
                      onClick={() => startRename(conversation.id, conversation.title)}
                    />
                    <Button
                      icon="pi pi-trash"
                      size="small"
                      text
                      severity="danger"
                      class="!h-6 !w-6"
                      disabled={ctx.isStreaming.value}
                      onClick={() => {
                        confirm.require({
                          message: "确定删除这个对话吗？",
                          header: "删除对话",
                          icon: "pi pi-exclamation-triangle",
                          acceptLabel: "删除",
                          rejectLabel: "取消",
                          accept: () => void ctx.deleteConversation(conversation.id),
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    );
  },
});
