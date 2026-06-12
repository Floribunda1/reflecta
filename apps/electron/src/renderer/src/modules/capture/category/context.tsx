import { createContext, ReactNode, useContext, useMemo } from "react";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { ipcClient } from "@renderer/utils/ipc";
import type { CategoryTreeNode, ReorderCategoryItem } from "@shared/category";

type CategoryContextValue = {
  categories: CategoryTreeNode[];
  loading: boolean;
  refresh: () => Promise<unknown>;
  renameCategory: (id: string, name: string) => Promise<void>;
  updateCategory: (id: string, input: { name?: string; parentId?: string | null }) => Promise<void>;
  createCategory: (input: { name: string; parentId?: string | null }) => Promise<void>;
  deleteCategory: (id: string, deleteThoughts?: boolean) => Promise<void>;
  reorderCategories: (items: ReorderCategoryItem[]) => Promise<void>;
};

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const { categories, loading, refresh } = useCategoryData();

  const value = useMemo<CategoryContextValue>(
    () => ({
      categories,
      loading,
      refresh,
      renameCategory: async (id, name) => {
        await ipcClient.category.updateCategory(id, { name });
        await refresh();
      },
      updateCategory: async (id, input) => {
        await ipcClient.category.updateCategory(id, input);
        await refresh();
      },
      createCategory: async (input) => {
        await ipcClient.category.createCategory({
          name: input.name,
          parentId: input.parentId ?? null,
        });
        await refresh();
      },
      deleteCategory: async (id, deleteThoughts) => {
        await ipcClient.category.deleteCategory(id, deleteThoughts);
        await refresh();
      },
      reorderCategories: async (items) => {
        await ipcClient.category.reorderCategories(items);
        await refresh();
      },
    }),
    [categories, loading, refresh],
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategoryContext() {
  const context = useContext(CategoryContext);
  if (!context) throw new Error("useCategoryContext must be used within CategoryProvider");
  return context;
}
