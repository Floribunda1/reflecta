import { defineComponent, onMounted, onUnmounted } from "vue";
import { CategoryTree } from "./category";
import { useCapturePageProvide } from "./context";
import { ThoughtDetail } from "./thought-detail";
import { ThoughtList } from "./thought-list";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
import { searchEventBus, type SearchSelectPayload } from "@renderer/utils/searchEventBus";
import { ipcClient } from "@renderer/utils/ipc";

export const CapturePage = defineComponent({
  name: "CapturePage",
  setup() {
    const { selectedThoughtId, selectedCategoryId } = useCapturePageProvide();

    const handleThoughtSelected = async ({ thoughtId, categoryIds }: SearchSelectPayload) => {
      selectedThoughtId.value = thoughtId;
      let cats = categoryIds;
      if (cats === undefined) {
        const thought = await ipcClient.thought.getThoughtById(thoughtId);
        cats = thought?.categoryIds ?? [];
      }
      selectedCategoryId.value = cats.length > 0 ? cats[0] : "all";
    };

    onMounted(() => {
      searchEventBus.on("thoughtSelected", handleThoughtSelected);
    });
    onUnmounted(() => searchEventBus.off("thoughtSelected", handleThoughtSelected));

    return () => (
      <Splitter
        layout="horizontal"
        class="h-full w-full rounded-none! border-none! bg-surface-0"
        gutterSize={1}
      >
        <SplitterPanel size={18} minSize={12}>
          <CategoryTree />
        </SplitterPanel>
        <SplitterPanel size={82} minSize={40}>
          {selectedThoughtId.value ? (
            <ThoughtDetail
              thoughtId={selectedThoughtId.value}
              onClose={() => (selectedThoughtId.value = null)}
              onDeleted={() => (selectedThoughtId.value = null)}
            />
          ) : (
            <ThoughtList />
          )}
        </SplitterPanel>
      </Splitter>
    );
  },
});
