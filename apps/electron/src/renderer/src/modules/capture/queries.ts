import { ipcClient } from "@renderer/utils/ipc";
import type {
  Domain,
  DomainTreeNode,
  CreateDomainInput,
  ReorderDomainItem,
  UpdateDomainInput,
} from "@shared/domain";
import type { ContextDTO, CreateContextInput, UpdateContextInput } from "@shared/context";
import type {
  CreateUnderstandingInput,
  ListUnderstandingsFilter,
  UnderstandingDTO,
  UnderstandingSummaryDTO,
  UpdateUnderstandingInput,
} from "@shared/understanding";
import type { AgentContextRef } from "@shared/agent";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

export type UnderstandingListFilterKey = {
  selectedDomainId: string;
  includeDescendants: boolean;
  searchQuery: string;
};

export type UnderstandingListTotalKey = {
  selectedDomainId: string;
  includeDescendants: boolean;
};

export const captureQueryKeys = {
  domains: ["domain.listDomains"] as const,
  understandingLists: ["understanding.listUnderstandings"] as const,
  understandingList: (filter: UnderstandingListFilterKey) =>
    ["understanding.listUnderstandings", filter] as const,
  understandingListTotals: ["understanding.listUnderstandings.total"] as const,
  understandingListTotal: (filter: UnderstandingListTotalKey) =>
    ["understanding.listUnderstandings.total", filter] as const,
  understandingDetails: ["understanding.getUnderstandingById"] as const,
  understandingDetail: (understandingId: string) =>
    ["understanding.getUnderstandingById", understandingId] as const,
  entityDisplay: (ref: Pick<AgentContextRef, "type" | "id">) =>
    ["entity.display", ref.type, ref.id] as const,
};

export type EntityDisplay = { title: string | null };

export async function getEntityDisplay(ref: Pick<AgentContextRef, "type" | "id">) {
  if (ref.type === "understanding") {
    const entity = await ipcClient.understanding.getUnderstandingById(ref.id);
    return entity ? { title: entity.title?.trim() || null } : null;
  }
  if (ref.type === "context") {
    const entity = await ipcClient.context.getContextById(ref.id);
    return entity ? { title: entity.title?.trim() || null } : null;
  }
  const entity = await ipcClient.domain.getDomainById(ref.id);
  return entity ? { title: entity.name?.trim() || null } : null;
}

export function invalidateEntityDisplay(
  queryClient: QueryClient,
  ref: Pick<AgentContextRef, "type" | "id">,
) {
  return queryClient.invalidateQueries({ queryKey: captureQueryKeys.entityDisplay(ref) });
}

function buildDomainTree(flat: Domain[]): DomainTreeNode[] {
  const map = new Map<string, DomainTreeNode>();
  for (const domain of flat) {
    map.set(domain.id, {
      id: domain.id,
      name: domain.name,
      parentId: domain.parentId ?? null,
      sortOrder: domain.sortOrder,
      children: [],
    });
  }

  const roots: DomainTreeNode[] = [];
  for (const domain of flat) {
    const node = map.get(domain.id)!;
    if (domain.parentId && map.has(domain.parentId)) {
      map.get(domain.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: DomainTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) sortChildren(node.children);
  };
  sortChildren(roots);
  return roots;
}

function buildUnderstandingListFilter({
  selectedDomainId,
  includeDescendants,
  searchQuery,
}: UnderstandingListFilterKey): ListUnderstandingsFilter | undefined {
  const filter: ListUnderstandingsFilter = {};
  if (selectedDomainId !== "all") {
    filter.domainIds = [selectedDomainId];
    filter.includeDescendants = includeDescendants;
  }

  const normalizedSearchQuery = searchQuery.trim();
  if (normalizedSearchQuery) filter.searchQuery = normalizedSearchQuery;

  return Object.keys(filter).length > 0 ? filter : undefined;
}

function buildUnderstandingListTotalFilter({
  selectedDomainId,
  includeDescendants,
}: UnderstandingListTotalKey): ListUnderstandingsFilter | undefined {
  if (selectedDomainId === "all") return undefined;
  return {
    domainIds: [selectedDomainId],
    includeDescendants,
  };
}

const EMPTY_DOMAIN_LIST: Domain[] = [];

export function useCaptureDomains(enabled = true) {
  const {
    data: domainList,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: captureQueryKeys.domains,
    queryFn: () => ipcClient.domain.listDomains(),
    enabled,
  });

  const normalizedDomainList = domainList ?? EMPTY_DOMAIN_LIST;
  const domains = useMemo(() => buildDomainTree(normalizedDomainList), [normalizedDomainList]);

  return {
    domains,
    domainList: normalizedDomainList,
    loading: isFetching,
    refresh: refetch,
  };
}

export function useCaptureUnderstandingList(filterKey: UnderstandingListFilterKey) {
  return useQuery<UnderstandingSummaryDTO[]>({
    queryKey: captureQueryKeys.understandingList(filterKey),
    queryFn: () =>
      ipcClient.understanding.listUnderstandings(buildUnderstandingListFilter(filterKey)),
  });
}

export function useCaptureUnderstandingListTotal(filterKey: UnderstandingListTotalKey) {
  return useQuery<UnderstandingSummaryDTO[]>({
    queryKey: captureQueryKeys.understandingListTotal(filterKey),
    queryFn: () =>
      ipcClient.understanding.listUnderstandings(buildUnderstandingListTotalFilter(filterKey)),
  });
}

export function useCaptureUnderstandingDetail(understandingId: string) {
  return useQuery<UnderstandingDTO | null>({
    queryKey: captureQueryKeys.understandingDetail(understandingId),
    queryFn: () => ipcClient.understanding.getUnderstandingById(understandingId),
  });
}

function invalidateUnderstandingLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: captureQueryKeys.understandingLists, exact: false }),
    queryClient.invalidateQueries({
      queryKey: captureQueryKeys.understandingListTotals,
      exact: false,
    }),
  ]);
}

function invalidateUnderstandingDetail(queryClient: QueryClient, understandingId: string) {
  return queryClient.invalidateQueries({
    queryKey: captureQueryKeys.understandingDetail(understandingId),
  });
}

function invalidateAllUnderstandingDetails(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: captureQueryKeys.understandingDetails,
    exact: false,
  });
}

function invalidateDomains(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: captureQueryKeys.domains });
}

export function useCreateUnderstandingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUnderstandingInput) =>
      ipcClient.understanding.createUnderstanding(input),
    onSuccess: () => invalidateUnderstandingLists(queryClient),
  });
}

export function useUpdateUnderstandingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUnderstandingInput }) =>
      ipcClient.understanding.updateUnderstanding(id, input),
    onSuccess: (_result, variables) =>
      Promise.all([
        invalidateUnderstandingDetail(queryClient, variables.id),
        invalidateEntityDisplay(queryClient, { type: "understanding", id: variables.id }),
        invalidateUnderstandingLists(queryClient),
        variables.input.body !== undefined
          ? invalidateAllUnderstandingDetails(queryClient)
          : Promise.resolve(),
      ]),
  });
}

export function useDeleteUnderstandingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipcClient.understanding.deleteUnderstanding(id),
    onSuccess: (_result, id) =>
      Promise.all([
        invalidateUnderstandingDetail(queryClient, id),
        invalidateEntityDisplay(queryClient, { type: "understanding", id }),
        invalidateUnderstandingLists(queryClient),
      ]),
  });
}

export function useCreateContextMutation(understandingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateContextInput, "understandingId">): Promise<ContextDTO> =>
      ipcClient.context.createContext({ ...input, understandingId }),
    onSuccess: () =>
      Promise.all([
        invalidateUnderstandingDetail(queryClient, understandingId),
        invalidateUnderstandingLists(queryClient),
      ]),
  });
}

export function useUpdateContextMutation(understandingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateContextInput }) =>
      ipcClient.context.updateContext(id, input),
    onSuccess: (_result, variables) =>
      Promise.all([
        invalidateUnderstandingDetail(queryClient, understandingId),
        invalidateEntityDisplay(queryClient, { type: "context", id: variables.id }),
      ]),
  });
}

export function useDeleteContextMutation(understandingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipcClient.context.deleteContext(id),
    onSuccess: (_result, id) =>
      Promise.all([
        invalidateUnderstandingDetail(queryClient, understandingId),
        invalidateUnderstandingLists(queryClient),
        invalidateEntityDisplay(queryClient, { type: "context", id }),
      ]),
  });
}

export function useDomainMutations() {
  const queryClient = useQueryClient();
  const invalidateDomainScope = () =>
    Promise.all([invalidateDomains(queryClient), invalidateUnderstandingLists(queryClient)]);

  const createDomain = useMutation({
    mutationFn: (input: CreateDomainInput) => ipcClient.domain.createDomain(input),
    onSuccess: invalidateDomainScope,
  });

  const updateDomain = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDomainInput }) =>
      ipcClient.domain.updateDomain(id, input),
    onSuccess: (_result, variables) =>
      Promise.all([
        invalidateDomainScope(),
        invalidateEntityDisplay(queryClient, { type: "domain", id: variables.id }),
      ]),
  });

  const deleteDomain = useMutation({
    mutationFn: ({ id, deleteUnderstandings }: { id: string; deleteUnderstandings?: boolean }) =>
      ipcClient.domain.deleteDomain(id, deleteUnderstandings),
    onSuccess: (_result, variables) =>
      Promise.all([
        invalidateDomainScope(),
        invalidateEntityDisplay(queryClient, { type: "domain", id: variables.id }),
      ]),
  });

  const reorderDomains = useMutation({
    mutationFn: (items: ReorderDomainItem[]) => ipcClient.domain.reorderDomains(items),
    onSuccess: invalidateDomainScope,
  });

  return {
    createDomain,
    updateDomain,
    deleteDomain,
    reorderDomains,
  };
}
