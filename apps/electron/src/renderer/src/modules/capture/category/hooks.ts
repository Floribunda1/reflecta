import type { ReorderCategoryItem } from "@shared/category";
import { useCallback } from "react";
import { useCategoryMutations } from "../queries";

export function useCategoryActions() {
  const categoryMutations = useCategoryMutations();

  const renameCategory = useCallback(
    async (id: string, name: string) => {
      await categoryMutations.updateCategory.mutateAsync({ id, input: { name } });
    },
    [categoryMutations.updateCategory],
  );

  const updateCategory = useCallback(
    async (id: string, input: { name?: string; parentId?: string | null }) => {
      await categoryMutations.updateCategory.mutateAsync({ id, input });
    },
    [categoryMutations.updateCategory],
  );

  const createCategory = useCallback(
    async (input: { name: string; parentId?: string | null }) => {
      await categoryMutations.createCategory.mutateAsync({
        name: input.name,
        parentId: input.parentId ?? null,
      });
    },
    [categoryMutations.createCategory],
  );

  const deleteCategory = useCallback(
    async (id: string, deleteThoughts?: boolean) => {
      await categoryMutations.deleteCategory.mutateAsync({ id, deleteThoughts });
    },
    [categoryMutations.deleteCategory],
  );

  const reorderCategories = useCallback(
    async (items: ReorderCategoryItem[]) => {
      await categoryMutations.reorderCategories.mutateAsync(items);
    },
    [categoryMutations.reorderCategories],
  );

  return {
    renameCategory,
    updateCategory,
    createCategory,
    deleteCategory,
    reorderCategories,
  };
}
