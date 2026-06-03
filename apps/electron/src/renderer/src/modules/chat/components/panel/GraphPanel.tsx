import { defineComponent } from "vue";
import { useChatPageContext } from "../../context";

export const GraphPanel = defineComponent({
  name: "GraphPanel",
  setup() {
    const ctx = useChatPageContext()!;

    return () => (
      <div class="flex h-full flex-col p-4">
        <div class="text-sm font-medium text-color">局部引用图谱</div>
        <div class="mt-2 text-xs text-muted-color">
          MVP 占位：展示当前对话已引用的 thought。完整子图视图后续接入 Contemplate graph。
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          {ctx.conversationReferences.value.map((thought) => (
            <div
              key={thought.id}
              class="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-color"
            >
              {thought.title || thought.id}
            </div>
          ))}
        </div>
        {ctx.conversationReferences.value.length === 0 && (
          <div class="mt-6 text-sm text-muted-color">引用 thought 后将在此显示局部节点</div>
        )}
      </div>
    );
  },
});
