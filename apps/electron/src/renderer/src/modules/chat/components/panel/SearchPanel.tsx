import { computed, defineComponent, ref } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { useQuery } from "@tanstack/vue-query";
import { ipcClient } from "@renderer/utils/ipc";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useChatPageContext } from "../../context";

export const SearchPanel = defineComponent({
  name: "SearchPanel",
  setup() {
    const ctx = useChatPageContext()!;
    const inputValue = ref("");

    const searchQuery = useQuery({
      queryKey: computed(() => ["chat.panel.search", ctx.panelSearchQuery.value] as const),
      queryFn: () => ipcClient.search.search(ctx.panelSearchQuery.value),
      enabled: computed(() => ctx.panelSearchQuery.value.length > 0),
    });

    return () => (
      <div class="flex h-full min-h-0 flex-col">
        <div class="border-b border-surface-200 p-3">
          <div class="flex gap-2">
            <InputText
              v-model={inputValue.value}
              placeholder="搜索 Thought 或 Context"
              fluid
              {...{
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key === "Enter") ctx.panelSearchQuery.value = inputValue.value;
                },
              }}
            />
            <Button
              icon="pi pi-search"
              onClick={() => {
                ctx.panelSearchQuery.value = inputValue.value;
              }}
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          {!ctx.panelSearchQuery.value && (
            <div class="p-4 text-sm text-muted-color">输入关键词后搜索</div>
          )}

          {searchQuery.isFetching.value && <div class="p-4 text-sm text-muted-color">搜索中…</div>}

          {searchQuery.data.value?.thoughts.map((thought) => (
            <div key={thought.id} class="border-b border-surface-100 px-3 py-3 hover:bg-surface-50">
              <div class="flex items-center justify-between gap-2">
                <div class="truncate text-sm font-medium text-color">
                  {thought.title || "无标题"}
                </div>
                <Button
                  label="@"
                  size="small"
                  text
                  onClick={() => void ctx.addReference(thought.id)}
                />
              </div>
              {thought.body && (
                <div class="mt-1 text-xs text-muted-color">
                  <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
});
