import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { ipcClient } from "@renderer/utils/ipc";
import type { ReorderCategoryItem } from "@shared/category";
import { createInjectionState } from "@vueuse/core";

const [useCategoryProvide, useCategoryContext] = createInjectionState(() => {
  const { categories, loading, refresh } = useCategoryData();

  const renameCategory = async (id: string, name: string) => {
    await ipcClient.category.updateCategory(id, { name });
    await refresh();
  };

  const updateCategory = async (id: string, input: { name?: string; parentId?: string | null }) => {
    await ipcClient.category.updateCategory(id, input);
    await refresh();
  };

  const createCategory = async (input: { name: string; parentId?: string | null }) => {
    await ipcClient.category.createCategory({
      name: input.name,
      parentId: input.parentId ?? null,
    });
    await refresh();
  };

  const deleteCategory = async (id: string, deleteThoughts?: boolean) => {
    await ipcClient.category.deleteCategory(id, deleteThoughts);
    await refresh();
  };

  const reorderCategories = async (items: ReorderCategoryItem[]) => {
    await ipcClient.category.reorderCategories(items);
    await refresh();
  };

  return {
    categories,
    loading,
    refresh,
    renameCategory,
    updateCategory,
    createCategory,
    deleteCategory,
    reorderCategories,
  };
});

export { useCategoryProvide, useCategoryContext };
