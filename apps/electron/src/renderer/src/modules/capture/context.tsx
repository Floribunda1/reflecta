import { createInjectionState, useLocalStorage } from "@vueuse/core";
import { ref } from "vue";

const [useCapturePageProvide, useCapturePageContext] = createInjectionState(() => {
  const selectedCategoryId = useLocalStorage("capture:selectedCategoryId", "all");
  const showAllDescendants = ref(true);
  const selectedThoughtId = useLocalStorage<string | null>("capture:selectedThoughtId", null);
  const focusMode = ref(false);
  const thoughtListPanelCollapsed = useLocalStorage("capture:thoughtListPanelCollapsed", false);
  const expandedCategoryKeys = useLocalStorage<Record<string, boolean>>(
    "capture:expandedCategoryKeys",
    {},
  );

  return {
    selectedCategoryId,
    showAllDescendants,
    selectedThoughtId,
    focusMode,
    thoughtListPanelCollapsed,
    expandedCategoryKeys,
  };
});

export { useCapturePageProvide, useCapturePageContext };
