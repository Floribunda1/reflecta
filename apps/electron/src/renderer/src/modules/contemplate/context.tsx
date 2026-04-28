import { createInjectionState, useLocalStorage } from "@vueuse/core";
import { ref } from "vue";

const [useContemplatePageProvide, useContemplatePageContext] = createInjectionState(() => {
  const selectedCategoryIds = useLocalStorage<string[]>("contemplate:selectedCategoryIds", []);
  const selectedThoughtId = ref<string | null>(null);
  const showAllDescendants = useLocalStorage<boolean>("contemplate:showAllDescendants", false);

  return {
    selectedCategoryIds,
    selectedThoughtId,
    showAllDescendants,
  };
});

export { useContemplatePageProvide, useContemplatePageContext };
