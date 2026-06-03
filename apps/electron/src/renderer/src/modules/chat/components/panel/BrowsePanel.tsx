import { defineComponent, computed } from "vue";
import Button from "primevue/button";
import Tree from "primevue/tree";
import { useQuery } from "@tanstack/vue-query";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { ipcClient } from "@renderer/utils/ipc";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useChatPageContext } from "../../context";

function convertCategories(nodes: import("@shared/category").CategoryTreeNode[]) {
  return nodes.map((node) => ({
    key: node.id,
    label: node.name,
    data: node,
    children: node.children.length > 0 ? convertCategories(node.children) : undefined,
  }));
}

export const BrowsePanel = defineComponent({
  name: "BrowsePanel",
  setup() {
    const ctx = useChatPageContext()!;
    const { categories } = useCategoryData();

    const treeNodes = computed(() => convertCategories(categories.value));
    const allNodeData = [{ key: "all", label: "全部" }];

    const selectedKey = computed({
      get: () => {
        const id = ctx.selectedCategoryId.value;
        return id && id !== "all" ? { [id]: true } : { all: true };
      },
      set: (val: Record<string, boolean>) => {
        const keys = Object.keys(val);
        if (keys.length > 0) ctx.selectedCategoryId.value = keys[0]!;
      },
    });

    const thoughtsQuery = useQuery({
      queryKey: computed(() => ["chat.browse.thoughts", ctx.selectedCategoryId.value] as const),
      queryFn: () => {
        if (ctx.selectedCategoryId.value === "all") {
          return ipcClient.thought.listThoughts();
        }
        return ipcClient.thought.listThoughts({
          categoryIds: [ctx.selectedCategoryId.value],
          includeDescendants: true,
        });
      },
    });

    const selectedThoughtQuery = useQuery({
      queryKey: computed(() => ["chat.browse.thought", ctx.selectedThoughtId.value] as const),
      queryFn: () => ipcClient.thought.getThoughtById(ctx.selectedThoughtId.value!),
      enabled: computed(() => !!ctx.selectedThoughtId.value),
    });

    return () => (
      <div class="flex h-full min-h-0 flex-col">
        <div class="border-b border-surface-200 p-3">
          <Tree
            value={allNodeData}
            v-model:selectionKeys={selectedKey.value}
            selectionMode="single"
            class="border-none bg-transparent p-0 text-sm"
          />
          <Tree
            value={treeNodes.value}
            v-model:selectionKeys={selectedKey.value}
            selectionMode="single"
            class="max-h-40 overflow-auto border-none bg-transparent p-0 text-sm"
          />
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto border-b border-surface-200">
          {(thoughtsQuery.data.value ?? []).map((thought) => (
            <button
              key={thought.id}
              type="button"
              class={[
                "block w-full border-b border-surface-100 px-3 py-2 text-left hover:bg-surface-50",
                ctx.selectedThoughtId.value === thought.id ? "bg-primary-50" : "",
              ]}
              onClick={() => {
                ctx.selectedThoughtId.value = thought.id;
              }}
            >
              <div class="truncate text-sm font-medium text-color">{thought.title || "无标题"}</div>
              <div class="truncate text-xs text-muted-color">{thought.type}</div>
            </button>
          ))}
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          {selectedThoughtQuery.data.value ? (
            <div>
              <div class="flex items-start justify-between gap-2">
                <div class="text-sm font-semibold text-color">
                  {selectedThoughtQuery.data.value.title || "无标题"}
                </div>
                <Button
                  label="@ 引用"
                  size="small"
                  text
                  onClick={() => void ctx.addReference(selectedThoughtQuery.data.value!.id)}
                />
              </div>
              <div class="mt-2 text-sm text-muted-color">
                <SimpleMarkdownPreview content={selectedThoughtQuery.data.value.body ?? ""} />
              </div>
            </div>
          ) : (
            <div class="text-sm text-muted-color">选择一条 thought 查看详情</div>
          )}
        </div>
      </div>
    );
  },
});
