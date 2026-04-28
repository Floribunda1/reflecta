import { defineComponent, ref } from "vue";
import Button from "primevue/button";
import Menu from "primevue/menu";
import ToggleSwitch from "primevue/toggleswitch";
import { useContemplatePageContext } from "../context";
import { CategoryTreeSelect } from "../../shared/biz-components/CategoryTreeSelect";
import { ipcClient } from "@renderer/utils/ipc";
import { useQueryClient } from "@tanstack/vue-query";
import type { ThoughtType } from "@shared/thought";
import { THOUGHT_TYPE_COLOR } from "@renderer/theme";
import { cloneDeep } from "lodash-es";

export const FilterPanel = defineComponent({
  name: "FilterPanel",
  setup() {
    const ctx = useContemplatePageContext()!;
    const open = ref(true);
    const queryClient = useQueryClient();
    const newMenu = ref<InstanceType<typeof Menu>>();

    const thoughtIconClass: Record<string, string> = {
      amber: "text-amber-500",
      violet: "text-violet-500",
    };

    const createThought = async (type: ThoughtType) => {
      const dto = await ipcClient.thought.createThought({
        type,
        body: "",
        categoryIds:
          ctx.selectedCategoryIds.value.length > 0
            ? cloneDeep(ctx.selectedCategoryIds.value)
            : undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: ["contemplate.listThoughts"],
        exact: false,
      });
      ctx.selectedThoughtId.value = dto.id;
    };

    const newMenuItems = [
      {
        label: "Idea",
        icon: `pi pi-lightbulb ${thoughtIconClass[THOUGHT_TYPE_COLOR.idea]}`,
        command: () => createThought("idea"),
      },
      {
        label: "Insight",
        icon: `pi pi-star ${thoughtIconClass[THOUGHT_TYPE_COLOR.insight]}`,
        command: () => createThought("insight"),
      },
    ];

    return () => (
      <div class="absolute left-6 top-4 z-20">
        <div class="flex min-h-11 max-w-[min(760px,calc(100vw-5rem))] items-center gap-2 rounded-xl border border-surface-200/80 bg-surface-0/90 px-2 py-2 shadow-[0_8px_24px_color-mix(in_srgb,var(--p-surface-950),transparent_94%)] backdrop-blur">
          <Button
            text
            severity="secondary"
            icon={open.value ? "pi pi-times" : "pi pi-filter"}
            aria-label={open.value ? "收起筛选" : "展开筛选"}
            class="!h-8 !w-8"
            v-tooltip={{
              value: open.value ? "收起筛选" : "展开筛选",
              position: "bottom",
            }}
            onClick={() => (open.value = !open.value)}
          />

          <Button
            icon="pi pi-plus"
            aria-label="新建 Thought"
            class="!h-8 !w-8"
            onClick={(e: MouseEvent) => newMenu.value?.toggle(e)}
          />
          <Menu ref={newMenu} popup model={newMenuItems} />

          {open.value && (
            <div class="flex min-w-0 items-center gap-2 border-l border-surface-200 pl-2">
              <div class="w-[min(420px,calc(100vw-21rem))] min-w-64">
                <CategoryTreeSelect
                  variant="inline"
                  v-model={ctx.selectedCategoryIds.value}
                  placeholder="全部 Category"
                />
              </div>

              <label
                for="show-descendants"
                class="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-muted-color transition-colors hover:bg-surface-100 hover:text-color"
              >
                <ToggleSwitch v-model={ctx.showAllDescendants.value} inputId="show-descendants" />
                <span>包含子类</span>
              </label>
            </div>
          )}
        </div>

        {!open.value && ctx.selectedCategoryIds.value.length > 0 && (
          <div class="mt-2 inline-flex rounded-lg border border-surface-200/80 bg-surface-0/85 px-2 py-1 text-xs text-muted-color shadow-sm backdrop-blur">
            {ctx.selectedCategoryIds.value.length} 个 Category
          </div>
        )}
      </div>
    );
  },
});
