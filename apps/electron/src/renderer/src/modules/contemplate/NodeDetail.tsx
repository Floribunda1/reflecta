import { defineComponent } from "vue";
import { ThoughtDetail } from "@renderer/modules/capture/thought-detail";
import { useContemplatePageContext } from "./context";

export const NodeDetail = defineComponent({
  name: "NodeDetail",
  setup() {
    const ctx = useContemplatePageContext()!;

    return () => (
      <div
        class="flex h-full w-full flex-col"
        style="border-left:1px solid var(--p-content-border-color); background:var(--p-surface-0)"
      >
        {ctx.selectedThoughtId.value ? (
          <ThoughtDetail
            thoughtId={ctx.selectedThoughtId.value}
            presentation="panel"
            onClose={() => (ctx.selectedThoughtId.value = null)}
            onDeleted={() => (ctx.selectedThoughtId.value = null)}
          />
        ) : (
          <div class="flex flex-col items-center justify-center h-full gap-2 px-6">
            <i
              class="pi pi-share-alt text-4xl"
              style="color: var(--p-text-muted-color); opacity: 0.2"
            />
            <span class="text-sm text-center" style="color: var(--p-text-muted-color)">
              点击图中节点查看详情
            </span>
          </div>
        )}
      </div>
    );
  },
});
