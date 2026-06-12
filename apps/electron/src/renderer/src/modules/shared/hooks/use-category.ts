import { ipcClient } from "@renderer/utils/ipc";
import type { CategoryTreeNode, Category } from "@shared/category";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

function buildTree(flat: Category[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  for (const c of flat) {
    map.set(c.id, {
      id: c.id,
      name: c.name,
      parentId: c.parentId ?? null,
      sortOrder: c.sortOrder,

      children: [],
    });
  }
  const roots: CategoryTreeNode[] = [];
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort children at each level by sortOrder
  const sortChildren = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);
  return roots;
}

export const useCategoryData = () => {
  const {
    data: categoryList,
    isFetching,
    refetch: refresh,
  } = useQuery({
    queryKey: ["category.listCategories"] as const,
    queryFn: () => ipcClient.category.listCategories(),
  });

  const normalizedCategoryList = categoryList ?? [];
  const categories = useMemo(() => buildTree(normalizedCategoryList), [normalizedCategoryList]);

  return {
    categories,
    categoryList: normalizedCategoryList,
    loading: isFetching,
    refresh,
  };
};
