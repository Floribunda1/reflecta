import { defineComponent } from "vue";
import Button from "primevue/button";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useChatPageContext } from "../../context";

export const ReferencesPanel = defineComponent({
  name: "ReferencesPanel",
  setup() {
    const ctx = useChatPageContext()!;

    return () => (
      <div class="h-full overflow-y-auto p-3">
        {ctx.conversationReferences.value.length === 0 && (
          <div class="text-sm text-muted-color">当前对话还没有引用任何 thought</div>
        )}

        {ctx.conversationReferences.value.map((thought) => (
          <div key={thought.id} class="mb-3 rounded-lg border border-surface-200 p-3">
            <div class="flex items-center justify-between gap-2">
              <div class="truncate text-sm font-medium text-color">{thought.title || "无标题"}</div>
              <Button
                label="@ 再次引用"
                size="small"
                text
                onClick={() => void ctx.addReference(thought.id)}
              />
            </div>
            {thought.body && (
              <div class="mt-2 text-xs text-muted-color">
                <SimpleMarkdownPreview content={thought.body} lineClamp={3} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
});
