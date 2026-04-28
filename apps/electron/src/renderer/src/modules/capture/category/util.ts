import type { CategoryTreeNode } from "@shared/category";

export const getCategoryPath = (categoryId: string, categories: CategoryTreeNode[]): string => {
  const findPath = (id: string, cats: CategoryTreeNode[], path: string[]): string[] | null => {
    for (const cat of cats) {
      if (cat.id === id) return [...path, cat.name];
      const found = findPath(id, cat.children, [...path, cat.name]);
      if (found) return found;
    }
    return null;
  };
  const result = findPath(categoryId, categories, []);
  return result ? result.join(" › ") : categoryId;
};
