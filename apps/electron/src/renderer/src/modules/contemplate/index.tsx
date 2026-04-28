import { defineComponent, ref, onUnmounted, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useContemplatePageProvide, useContemplatePageContext } from "./context";
import { FilterPanel } from "./filter-panel";
import { GraphCanvas } from "./graph";
import { NodeDetail } from "./NodeDetail";
import { searchEventBus, type SearchSelectPayload } from "@renderer/utils/searchEventBus";

const MIN_PANEL_WIDTH = 440;
const MAX_PANEL_WIDTH = 680;
const DEFAULT_PANEL_WIDTH = 560;

const ContemplatePageInner = defineComponent({
  name: "ContemplatePageInner",
  setup() {
    const ctx = useContemplatePageContext()!;
    const route = useRoute();
    const panelWidth = ref(DEFAULT_PANEL_WIDTH);

    const handleThoughtSelected = ({ thoughtId }: SearchSelectPayload) => {
      ctx.selectedThoughtId.value = thoughtId;
    };

    onMounted(() => {
      searchEventBus.on("thoughtSelected", handleThoughtSelected);
      const pending = route.query.selectThoughtId;
      if (pending && typeof pending === "string") {
        ctx.selectedThoughtId.value = pending;
      }
    });

    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      const delta = startX - e.clientX;
      panelWidth.value = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + delta));
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    function onDragHandleMouseDown(e: MouseEvent) {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startWidth = panelWidth.value;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    onUnmounted(() => {
      searchEventBus.off("thoughtSelected", handleThoughtSelected);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    });

    return () => (
      <div class="contemplate-page relative h-full w-full overflow-hidden">
        <GraphCanvas />
        <FilterPanel />
        {ctx.selectedThoughtId.value !== null && (
          <div
            class="absolute bottom-0 right-0 top-0 z-10 flex overflow-hidden"
            style={{ width: `${panelWidth.value}px` }}
          >
            <div
              class="absolute bottom-0 left-0 top-0 z-20 w-1 cursor-col-resize transition-colors hover:bg-primary-300"
              onMousedown={onDragHandleMouseDown}
            />
            <div class="flex-1 overflow-hidden">
              <NodeDetail />
            </div>
          </div>
        )}
      </div>
    );
  },
});

export const ContemplatePage = defineComponent({
  name: "ContemplatePage",
  setup() {
    useContemplatePageProvide();
    return () => <ContemplatePageInner />;
  },
});
