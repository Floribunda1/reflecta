import { defineComponent, computed } from "vue";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { useCapturePageContext } from "../context";
import { useThoughtListProvide, useThoughtListContext } from "./context";
import { ThoughtCard } from "./ThoughtCard";
import { ThoughtToolbar } from "./ThoughtToolbar";

const ThoughtListInner = defineComponent({
  name: "ThoughtListInner",
  setup() {
    const thoughtList = useThoughtListContext()!;
    const capture = useCapturePageContext()!;
    const { categoryList } = useCategoryData();

    const categoryLabel = computed(() => {
      if (capture.selectedCategoryId.value === "all") return "全部笔记";
      const cat = categoryList.value.find((c) => c.id === capture.selectedCategoryId.value);
      return cat?.name ?? "";
    });

    return () => {
      return (
        <div class="flex h-full flex-col bg-surface-0">
          <ThoughtToolbar
            categoryLabel={categoryLabel.value}
            thoughtCount={thoughtList.displayedThoughts.value.length}
          />

          <div class="flex-1 min-h-0 overflow-y-auto capture-scroll border-t border-surface mt-4">
            <div class="mx-auto flex w-full flex-col divide-y divide-[var(--p-content-border-color)] py-2">
              {thoughtList.displayedThoughts.value.map((thought) => (
                <ThoughtCard key={thought.id} thought={thought} />
              ))}
              {thoughtList.displayedThoughts.value.length === 0 && (
                <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--p-content-border-color)] bg-transparent px-4 py-16">
                  <i class="pi pi-file text-2xl text-muted-color" />
                  <div class="flex flex-col items-center gap-0.5">
                    <span class="text-sm font-medium text-muted-color">暂无 Thought</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };
  },
});

export const ThoughtList = defineComponent({
  name: "ThoughtList",
  setup() {
    useThoughtListProvide();
    return () => <ThoughtListInner />;
  },
});
