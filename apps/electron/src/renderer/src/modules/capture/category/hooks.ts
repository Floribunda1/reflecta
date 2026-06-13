import { ipcClient } from "@renderer/utils/ipc";
import type { ReorderCategoryItem } from "@shared/category";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useCategoryActions() {
  const queryClient = useQueryClient();

  const refreshCategories = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["category.listCategories"] }),
    [queryClient],
  );

  const renameCategory = useCallback(
    async (id: string, name: string) => {
      await ipcClient.category.updateCategory(id, { name });
      await refreshCategories();
    },
    [refreshCategories],
  );

  const updateCategory = useCallback(
    async (id: string, input: { name?: string; parentId?: string | null }) => {
      await ipcClient.category.updateCategory(id, input);
      await refreshCategories();
    },
    [refreshCategories],
  );

  const createCategory = useCallback(
    async (input: { name: string; parentId?: string | null }) => {
      await ipcClient.category.createCategory({
        name: input.name,
        parentId: input.parentId ?? null,
      });
      await refreshCategories();
    },
    [refreshCategories],
  );

  const deleteCategory = useCallback(
    async (id: string, deleteThoughts?: boolean) => {
      await ipcClient.category.deleteCategory(id, deleteThoughts);
      await refreshCategories();
    },
    [refreshCategories],
  );

  const reorderCategories = useCallback(
    async (items: ReorderCategoryItem[]) => {
      await ipcClient.category.reorderCategories(items);
      await refreshCategories();
    },
    [refreshCategories],
  );

  return {
    renameCategory,
    updateCategory,
    createCategory,
    deleteCategory,
    reorderCategories,
  };
}
