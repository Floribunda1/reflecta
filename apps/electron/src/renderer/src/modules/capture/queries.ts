import { ipcClient } from "@renderer/utils/ipc";
import type {
  Category,
  CategoryTreeNode,
  CreateCategoryInput,
  ReorderCategoryItem,
  UpdateCategoryInput,
} from "@shared/category";
import type { ContextDTO, CreateContextInput, UpdateContextInput } from "@shared/context";
import type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  UpdateThoughtInput,
} from "@shared/thought";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

export type ThoughtListFilterKey = {
  selectedCategoryId: string;
  includeDescendants: boolean;
  searchQuery: string;
};

export type ThoughtListTotalKey = {
  selectedCategoryId: string;
  includeDescendants: boolean;
};

export const captureQueryKeys = {
  categories: ["category.listCategories"] as const,
  thoughtLists: ["thought.listThoughts"] as const,
  thoughtList: (filter: ThoughtListFilterKey) => ["thought.listThoughts", filter] as const,
  thoughtListTotals: ["thought.listThoughts.total"] as const,
  thoughtListTotal: (filter: ThoughtListTotalKey) =>
    ["thought.listThoughts.total", filter] as const,
  thoughtDetails: ["thought.getThoughtById"] as const,
  thoughtDetail: (thoughtId: string) => ["thought.getThoughtById", thoughtId] as const,
};

export function buildCategoryTree(flat: Category[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  for (const category of flat) {
    map.set(category.id, {
      id: category.id,
      name: category.name,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder,
      children: [],
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const category of flat) {
    const node = map.get(category.id)!;
    if (category.parentId && map.has(category.parentId)) {
      map.get(category.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) sortChildren(node.children);
  };
  sortChildren(roots);
  return roots;
}

export function buildThoughtListFilter({
  selectedCategoryId,
  includeDescendants,
  searchQuery,
}: ThoughtListFilterKey): ListThoughtsFilter | undefined {
  const filter: ListThoughtsFilter = {};
  if (selectedCategoryId !== "all") {
    filter.categoryIds = [selectedCategoryId];
    filter.includeDescendants = includeDescendants;
  }

  const normalizedSearchQuery = searchQuery.trim();
  if (normalizedSearchQuery) filter.searchQuery = normalizedSearchQuery;

  return Object.keys(filter).length > 0 ? filter : undefined;
}

function buildThoughtListTotalFilter({
  selectedCategoryId,
  includeDescendants,
}: ThoughtListTotalKey): ListThoughtsFilter | undefined {
  if (selectedCategoryId === "all") return undefined;
  return {
    categoryIds: [selectedCategoryId],
    includeDescendants,
  };
}

const EMPTY_CATEGORY_LIST: Category[] = [];

export function useCaptureCategories() {
  const {
    data: categoryList,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: captureQueryKeys.categories,
    queryFn: () => ipcClient.category.listCategories(),
  });

  const normalizedCategoryList = categoryList ?? EMPTY_CATEGORY_LIST;
  const categories = useMemo(
    () => buildCategoryTree(normalizedCategoryList),
    [normalizedCategoryList],
  );

  return {
    categories,
    categoryList: normalizedCategoryList,
    loading: isFetching,
    refresh: refetch,
  };
}

export function useCaptureThoughtList(filterKey: ThoughtListFilterKey) {
  return useQuery<ThoughtSummaryDTO[]>({
    queryKey: captureQueryKeys.thoughtList(filterKey),
    queryFn: () => ipcClient.thought.listThoughts(buildThoughtListFilter(filterKey)),
  });
}

export function useCaptureThoughtListTotal(filterKey: ThoughtListTotalKey) {
  return useQuery<ThoughtSummaryDTO[]>({
    queryKey: captureQueryKeys.thoughtListTotal(filterKey),
    queryFn: () => ipcClient.thought.listThoughts(buildThoughtListTotalFilter(filterKey)),
  });
}

export function useCaptureThoughtDetail(thoughtId: string) {
  return useQuery<ThoughtDTO | null>({
    queryKey: captureQueryKeys.thoughtDetail(thoughtId),
    queryFn: () => ipcClient.thought.getThoughtById(thoughtId),
  });
}

export function invalidateThoughtLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: captureQueryKeys.thoughtLists, exact: false }),
    queryClient.invalidateQueries({ queryKey: captureQueryKeys.thoughtListTotals, exact: false }),
  ]);
}

export function invalidateThoughtDetail(queryClient: QueryClient, thoughtId: string) {
  return queryClient.invalidateQueries({
    queryKey: captureQueryKeys.thoughtDetail(thoughtId),
  });
}

export function invalidateAllThoughtDetails(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: captureQueryKeys.thoughtDetails,
    exact: false,
  });
}

export function invalidateCategories(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: captureQueryKeys.categories });
}

export function useCreateThoughtMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThoughtInput) => ipcClient.thought.createThought(input),
    onSuccess: () => invalidateThoughtLists(queryClient),
  });
}

export function useUpdateThoughtMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateThoughtInput }) =>
      ipcClient.thought.updateThought(id, input),
    onSuccess: (_result, variables) =>
      Promise.all([
        invalidateThoughtDetail(queryClient, variables.id),
        invalidateThoughtLists(queryClient),
        variables.input.body !== undefined
          ? invalidateAllThoughtDetails(queryClient)
          : Promise.resolve(),
      ]),
  });
}

export function useDeleteThoughtMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipcClient.thought.deleteThought(id),
    onSuccess: (_result, id) =>
      Promise.all([invalidateThoughtDetail(queryClient, id), invalidateThoughtLists(queryClient)]),
  });
}

export function useCreateContextMutation(thoughtId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateContextInput, "thoughtId">): Promise<ContextDTO> =>
      ipcClient.context.createContext({ ...input, thoughtId }),
    onSuccess: () =>
      Promise.all([
        invalidateThoughtDetail(queryClient, thoughtId),
        invalidateThoughtLists(queryClient),
      ]),
  });
}

export function useUpdateContextMutation(thoughtId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateContextInput }) =>
      ipcClient.context.updateContext(id, input),
    onSuccess: () => invalidateThoughtDetail(queryClient, thoughtId),
  });
}

export function useDeleteContextMutation(thoughtId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipcClient.context.deleteContext(id),
    onSuccess: () =>
      Promise.all([
        invalidateThoughtDetail(queryClient, thoughtId),
        invalidateThoughtLists(queryClient),
      ]),
  });
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const invalidateCategoryScope = () =>
    Promise.all([invalidateCategories(queryClient), invalidateThoughtLists(queryClient)]);

  const createCategory = useMutation({
    mutationFn: (input: CreateCategoryInput) => ipcClient.category.createCategory(input),
    onSuccess: invalidateCategoryScope,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      ipcClient.category.updateCategory(id, input),
    onSuccess: invalidateCategoryScope,
  });

  const deleteCategory = useMutation({
    mutationFn: ({ id, deleteThoughts }: { id: string; deleteThoughts?: boolean }) =>
      ipcClient.category.deleteCategory(id, deleteThoughts),
    onSuccess: invalidateCategoryScope,
  });

  const reorderCategories = useMutation({
    mutationFn: (items: ReorderCategoryItem[]) => ipcClient.category.reorderCategories(items),
    onSuccess: invalidateCategoryScope,
  });

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}
