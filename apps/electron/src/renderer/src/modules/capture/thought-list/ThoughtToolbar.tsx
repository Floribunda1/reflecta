import { defineComponent, ref, watch } from "vue";
import { useCapturePageContext } from "../context";
import { type FilterMode, useThoughtListContext } from "./context";
import Button from "primevue/button";
import Menu from "primevue/menu";
import SelectButton from "primevue/selectbutton";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import { debounce } from "lodash-es";

export const ThoughtToolbar = defineComponent({
  name: "ThoughtToolbar",
  props: {
    categoryLabel: { type: String, required: true },
    thoughtCount: { type: Number, required: true },
  },
  setup(props) {
    const capture = useCapturePageContext()!;
    const thoughtList = useThoughtListContext()!;
    const newMenu = ref<InstanceType<typeof Menu>>();

    // Debounced search
    const searchInput = ref(thoughtList.searchQuery.value);

    watch(
      () => searchInput.value,
      debounce((val) => {
        thoughtList.searchQuery.value = val;
      }, 500),
    );

    // Sync from external changes (e.g., clearing search)
    watch(
      () => thoughtList.searchQuery.value,
      (val) => {
        if (val !== searchInput.value) {
          searchInput.value = val;
        }
      },
    );

    const filterOptions: { value: FilterMode; label: string }[] = [
      { value: "all", label: "全部" },
      { value: "idea", label: "Idea" },
      { value: "insight", label: "Insight" },
    ];

    const newMenuItems = [
      {
        label: "Idea",
        icon: "pi pi-lightbulb text-amber-500",
        command: () => {
          thoughtList.createThought({ type: "idea" });
        },
      },
      {
        label: "Insight",
        icon: "pi pi-star text-violet-500",
        command: () => {
          thoughtList.createThought({ type: "insight" });
        },
      },
    ];

    return () => (
      <div class="shrink-0 pt-4">
        <div class="mx-auto px-8 flex w-full flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-[280px] flex-1 md:max-w-[520px]">
              <IconField class="w-full">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model={searchInput.value}
                  placeholder="搜索 thought"
                  class="w-full"
                  pt={{
                    root: {
                      class:
                        "h-9 rounded border-[var(--p-content-border-color)] bg-surface-0 text-base shadow-none placeholder:text-muted-color",
                    },
                  }}
                />
              </IconField>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <SelectButton
                v-model={thoughtList.filterMode.value}
                options={filterOptions}
                optionLabel="label"
                optionValue="value"
                allowEmpty={false}
                size="small"
              />

              <div class="flex items-center gap-1 pl-2">
                {capture.selectedCategoryId.value !== "all" && (
                  <Button
                    icon="pi pi-filter"
                    text
                    rounded
                    size="small"
                    class="!h-9 !w-9"
                    v-tooltip_top={capture.showAllDescendants.value ? "仅显示直属" : "包含子类"}
                    severity={capture.showAllDescendants.value ? undefined : "secondary"}
                    onClick={() => {
                      capture.showAllDescendants.value = !capture.showAllDescendants.value;
                    }}
                  />
                )}
                {capture.selectedCategoryId.value === "all" && (
                  <Button
                    icon="pi pi-tag"
                    text
                    rounded
                    size="small"
                    class="!h-9 !w-9"
                    v-tooltip_top="无标签"
                    severity={thoughtList.showUncategorized.value ? undefined : "secondary"}
                    onClick={() => {
                      thoughtList.showUncategorized.value = !thoughtList.showUncategorized.value;
                    }}
                  />
                )}
                <Button
                  icon="pi pi-sort-alt"
                  text
                  rounded
                  size="small"
                  class="!h-9 !w-9"
                  v-tooltip_top={
                    thoughtList.sortMode.value === "created" ? "按创建时间" : "按修改时间"
                  }
                  severity={thoughtList.sortMode.value === "updated" ? undefined : "secondary"}
                  onClick={thoughtList.toggleSortMode}
                />
                <Button
                  icon="pi pi-plus"
                  label="新建"
                  size="small"
                  severity="secondary"
                  aria-label="新建 Thought"
                  class="!h-9"
                  outlined
                  onClick={(e: MouseEvent) => newMenu.value?.toggle(e)}
                />
                <Menu ref={newMenu} popup model={newMenuItems} />
              </div>
            </div>
          </div>

          <div class="flex min-w-0 items-baseline gap-3">
            <h2 class="truncate text-2xl font-semibold leading-tight text-color">
              {props.categoryLabel}
            </h2>
            <span class="shrink-0 text-base font-medium text-muted-color">
              {props.thoughtCount} thoughts
            </span>
          </div>
        </div>
      </div>
    );
  },
});
