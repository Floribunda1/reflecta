import { ipcClient } from "@renderer/utils/ipc";
import type { CreateThoughtInput, ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import { useQuery } from "@tanstack/vue-query";
import { createInjectionState } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useCapturePageContext } from "../context";

export type FilterMode = "all" | "idea" | "insight";
export type SortMode = "created" | "updated";

const [useThoughtListProvide, useThoughtListContext] = createInjectionState(() => {
  const capture = useCapturePageContext()!;

  const filterMode = ref<FilterMode>("all");
  const sortMode = ref<SortMode>("created");
  const searchQuery = ref("");
  const showUncategorized = ref(false);

  // Reset when user navigates away from "全部"
  watch(
    () => capture.selectedCategoryId.value,
    (val) => {
      if (val !== "all") showUncategorized.value = false;
    },
  );

  const queryKey = computed(() => [
    "thought.listThoughts",
    capture.selectedCategoryId.value,
    capture.showAllDescendants.value,
    filterMode.value,
    searchQuery.value,
  ]);

  const {
    data,
    isFetching,
    refetch: refresh,
  } = useQuery({
    queryKey,
    queryFn: () => {
      const filter: {
        categoryIds?: string[];
        includeDescendants?: boolean;
        type?: ThoughtType;
        searchQuery?: string;
      } = {};
      if (capture.selectedCategoryId.value !== "all") {
        filter.categoryIds = [capture.selectedCategoryId.value];
        filter.includeDescendants = capture.showAllDescendants.value;
      }
      if (filterMode.value !== "all") filter.type = filterMode.value;
      if (searchQuery.value) filter.searchQuery = searchQuery.value;
      return ipcClient.thought.listThoughts(Object.keys(filter).length > 0 ? filter : undefined);
    },
  });

  const loading = isFetching;

  const displayedThoughts = computed<ThoughtSummaryDTO[]>(() => {
    let list = data.value ?? [];
    if (showUncategorized.value) {
      list = list.filter((t) => t.categoryIds.length === 0);
    }
    return [...list].sort((a, b) => {
      const dateA = sortMode.value === "created" ? a.createdAt : a.updatedAt;
      const dateB = sortMode.value === "created" ? b.createdAt : b.updatedAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  });

  const toggleSortMode = () => {
    sortMode.value = sortMode.value === "created" ? "updated" : "created";
  };

  const createThought = async (input: Omit<CreateThoughtInput, "categoryIds">) => {
    const dto = await ipcClient.thought.createThought({
      ...input,
      categoryIds:
        capture.selectedCategoryId.value !== "all" ? [capture.selectedCategoryId.value] : [],
    });
    await refresh();
    capture.selectedThoughtId.value = dto.id;
    return dto;
  };

  const deleteThought = async (id: string) => {
    await ipcClient.thought.deleteThought(id);
    await refresh();
    capture.selectedThoughtId.value = null;
  };

  return {
    displayedThoughts,
    loading,
    refresh,
    filterMode,
    sortMode,
    toggleSortMode,
    searchQuery,
    showUncategorized,
    createThought,
    deleteThought,
  };
});

export { useThoughtListProvide, useThoughtListContext };
