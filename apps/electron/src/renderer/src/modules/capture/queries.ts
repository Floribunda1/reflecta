import { Effect } from "effect";
import { runPromise } from "@renderer/lib/effect-runtime";
import { effectQuery } from "@renderer/lib/effect-query";
import { rpc } from "@renderer/lib/effect-rpc";
import type {
  Domain,
  DomainTreeNode,
  CreateDomainInput,
  ReorderDomainItem,
  UpdateDomainInput,
} from "@shared/domain";
import type { CreateContextInput, UpdateContextInput } from "@shared/context";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type {
  CreateUnderstandingInput,
  ListUnderstandingsFilter,
  UnderstandingDTO,
  UnderstandingSummaryDTO,
  UpdateUnderstandingInput,
} from "@shared/understanding";
import type { AgentContextRef } from "@shared/agent";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useMemo } from "react";

export type UnderstandingListFilterKey = {
  selectedDomainId: string;
  includeDescendants: boolean;
  searchQuery: string;
};

export const ALL_UNDERSTANDINGS_LIST_FILTER: UnderstandingListFilterKey = {
  selectedDomainId: "all",
  includeDescendants: true,
  searchQuery: "",
};

export type UnderstandingListTotalKey = {
  selectedDomainId: string;
  includeDescendants: boolean;
};

/**
 * Query key 工厂（社区标准做法）：查询与失效共用同一 key 定义，杜绝两边漂移。
 * 列表用固定前缀（如 `understanding.list`），失效按前缀定向；实体用 `[entity, id]` 精确命中。
 */
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
  participationOverview: ["capture.participation.overview"] as const,
  canvases: ["understandingCanvas.listCanvases"] as const,
  recap: ["insights.getRecapData"] as const,
  entityDisplay: (ref: Pick<AgentContextRef, "type" | "id">) =>
    ["entity.display", ref.type, ref.id] as const,
};

export type EntityDisplay = { title: string | null };

export async function getEntityDisplay(ref: Pick<AgentContextRef, "type" | "id">) {
  if (ref.type === "understanding") {
    const entity = await runPromise(rpc.understandingGetById(ref.id));
    return entity ? { title: entity.title?.trim() || null } : null;
  }
  if (ref.type === "context") {
    const entity = await runPromise(rpc.contextGetById(ref.id));
    return entity ? { title: entity.title?.trim() || null } : null;
  }
  if (ref.type === "canvas") {
    const entity = await runPromise(rpc.canvasGet(ref.id));
    return entity ? { title: entity.canvas.title?.trim() || null } : null;
  }
  const entity = await runPromise(rpc.domainGetDomainById(ref.id));
  return entity ? { title: entity.name?.trim() || null } : null;
}

// ---------------------------------------------------------------------------
// 失效计划（FP：纯函数表达"一次写入影响哪些缓存"，由 applyInvalidations 统一执行）
// ---------------------------------------------------------------------------

type InvalidationPlan = {
  /** 定向失效的 query key 列表（按前缀匹配，stale-while-revalidate 保留）。 */
  readonly invalidate: readonly QueryKey[];
  /** 权威响应直接写缓存（setQueryData，零请求零闪烁）。 */
  readonly setData?: readonly {
    readonly key: QueryKey;
    readonly data: unknown;
  }[];
};

function applyInvalidations(queryClient: QueryClient, plan: InvalidationPlan): Promise<void> {
  const jobs = [
    ...plan.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ...(plan.setData ?? []).map(({ key, data }) => queryClient.setQueryData(key, data as never)),
  ];
  return Promise.all(jobs).then(() => undefined);
}

// ---------------------------------------------------------------------------
// 读 hooks
// ---------------------------------------------------------------------------

function buildDomainTree(flat: readonly Domain[]): DomainTreeNode[] {
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

const EMPTY_DOMAIN_LIST: readonly Domain[] = [];

export function useCaptureDomains(enabled = true) {
  const {
    data: domainList,
    isFetching,
    refetch,
  } = useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.domains,
      // schema 解码结果为深度只读，应用 DTO 类型为可变：边界处收窄（运行时即普通数组）。
      queryFn: () => rpc.domainListDomains().pipe(Effect.map((rows) => rows as Domain[])),
      enabled,
    }),
  );

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
  return useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.understandingList(filterKey),
      queryFn: () =>
        rpc
          .understandingList(buildUnderstandingListFilter(filterKey))
          .pipe(Effect.map((rows) => rows as UnderstandingSummaryDTO[])),
      // domain/搜索切换时保留旧数据渲染，避免 refetch 期间网格卸载重建（空白闪烁 + 全量重建）
      placeholderData: keepPreviousData,
    }),
  );
}

export function useCaptureUnderstandingListTotal(filterKey: UnderstandingListTotalKey) {
  return useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.understandingListTotal(filterKey),
      queryFn: () =>
        rpc
          .understandingList(buildUnderstandingListTotalFilter(filterKey))
          .pipe(Effect.map((rows) => rows as UnderstandingSummaryDTO[])),
    }),
  );
}

export function useCaptureUnderstandingDetail(understandingId: string) {
  return useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.understandingDetail(understandingId),
      queryFn: () =>
        rpc
          .understandingGetById(understandingId)
          .pipe(Effect.map((dto) => dto as UnderstandingDTO | null)),
    }),
  );
}

export type ParticipationOverviewData = {
  understandings: readonly UnderstandingSummaryDTO[];
  canvases: readonly CanvasDTO[];
  recap: RecapData;
};

/** 参与概览（捕获页顶部）：理解列表与网格默认筛选共用 query，避免进页拉两次全文。 */
export function useParticipationOverview(enabled = true) {
  const understandingsQuery = useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.understandingList(ALL_UNDERSTANDINGS_LIST_FILTER),
      queryFn: () =>
        rpc
          .understandingList(buildUnderstandingListFilter(ALL_UNDERSTANDINGS_LIST_FILTER))
          .pipe(Effect.map((rows) => rows as UnderstandingSummaryDTO[])),
      enabled,
    }),
  );
  const canvasesQuery = useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.canvases,
      queryFn: () => rpc.canvasList().pipe(Effect.map((rows) => rows as CanvasDTO[])),
      enabled,
    }),
  );
  const recapQuery = useQuery(
    effectQuery.queryOptions({
      queryKey: captureQueryKeys.recap,
      queryFn: () => rpc.insightsGetRecapData().pipe(Effect.map((data) => data as RecapData)),
      enabled,
    }),
  );

  const data = useMemo<ParticipationOverviewData | undefined>(() => {
    if (!understandingsQuery.data || !canvasesQuery.data || !recapQuery.data) return undefined;
    return {
      understandings: understandingsQuery.data,
      canvases: canvasesQuery.data,
      recap: recapQuery.data,
    };
  }, [canvasesQuery.data, recapQuery.data, understandingsQuery.data]);

  return { data };
}

// ---------------------------------------------------------------------------
// 写 hooks（effect-query：mutationFn 是 Effect 程序；onSuccess 执行失效计划）
// ---------------------------------------------------------------------------

export function useCreateUnderstandingMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (input: CreateUnderstandingInput) => rpc.understandingCreate(input),
      onSuccess: (dto) =>
        applyInvalidations(queryClient, {
          invalidate: [
            captureQueryKeys.understandingLists,
            captureQueryKeys.canvases,
            captureQueryKeys.recap,
          ],
          // 新建即返回完整 detail：直接写缓存，列表用失效即可。
          setData: [{ key: captureQueryKeys.understandingDetail(dto.id), data: dto }],
        }),
    }),
  );
}

export function useUpdateUnderstandingMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ id, input }: { id: string; input: UpdateUnderstandingInput }) =>
        rpc.understandingUpdate(id, input),
      onSuccess: (dto, variables) =>
        applyInvalidations(queryClient, {
          invalidate: [
            captureQueryKeys.understandingLists,
            captureQueryKeys.entityDisplay({ type: "understanding", id: dto.id }),
            ...(variables.input.body !== undefined ? [captureQueryKeys.understandingDetails] : []),
          ],
          // 更新返回完整 detail：直接写缓存，实体编辑零闪烁零请求。
          setData: [{ key: captureQueryKeys.understandingDetail(dto.id), data: dto }],
        }),
    }),
  );
}

export function useDeleteUnderstandingMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (id: string) => rpc.understandingDelete(id),
      onSuccess: (_result, id) =>
        applyInvalidations(queryClient, {
          invalidate: [
            captureQueryKeys.understandingDetail(id),
            captureQueryKeys.entityDisplay({ type: "understanding", id }),
            captureQueryKeys.understandingLists,
            captureQueryKeys.canvases,
            captureQueryKeys.recap,
          ],
        }),
    }),
  );
}

export function useCreateContextMutation(understandingId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (input: Omit<CreateContextInput, "understandingId">) =>
        rpc.contextCreate({ ...input, understandingId }),
      onSuccess: () =>
        applyInvalidations(queryClient, {
          invalidate: [
            captureQueryKeys.understandingDetail(understandingId),
            captureQueryKeys.understandingLists,
          ],
        }),
    }),
  );
}

export function useUpdateContextMutation(understandingId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ id, input }: { id: string; input: UpdateContextInput }) =>
        rpc.contextUpdate(id, input),
      onSuccess: (_result, variables) =>
        applyInvalidations(queryClient, {
          invalidate: [
            captureQueryKeys.understandingDetail(understandingId),
            captureQueryKeys.entityDisplay({ type: "context", id: variables.id }),
          ],
        }),
    }),
  );
}

export function useDeleteContextMutation(understandingId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (id: string) => rpc.contextDelete(id),
      onSuccess: (_result, id) =>
        applyInvalidations(queryClient, {
          invalidate: [
            captureQueryKeys.understandingDetail(understandingId),
            captureQueryKeys.understandingLists,
            captureQueryKeys.entityDisplay({ type: "context", id }),
          ],
        }),
    }),
  );
}

export function useDomainMutations() {
  const queryClient = useQueryClient();
  const invalidateDomainScope = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: captureQueryKeys.domains }),
      queryClient.invalidateQueries({ queryKey: captureQueryKeys.understandingLists }),
    ]);

  const createDomain = useMutation(
    effectQuery.mutationOptions({
      mutationFn: (input: CreateDomainInput) => rpc.domainCreateDomain(input),
      onSuccess: invalidateDomainScope,
    }),
  );

  const updateDomain = useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ id, input }: { id: string; input: UpdateDomainInput }) =>
        rpc.domainUpdateDomain(id, input),
      onSuccess: (_result, variables) =>
        Promise.all([
          invalidateDomainScope(),
          queryClient.invalidateQueries({
            queryKey: captureQueryKeys.entityDisplay({ type: "domain", id: variables.id }),
          }),
        ]),
    }),
  );

  const deleteDomain = useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ id, deleteUnderstandings }: { id: string; deleteUnderstandings?: boolean }) =>
        rpc.domainDeleteDomain(id, deleteUnderstandings),
      onSuccess: (_result, variables) =>
        Promise.all([
          invalidateDomainScope(),
          queryClient.invalidateQueries({
            queryKey: captureQueryKeys.entityDisplay({ type: "domain", id: variables.id }),
          }),
        ]),
    }),
  );

  const reorderDomains = useMutation(
    effectQuery.mutationOptions({
      mutationFn: (items: ReorderDomainItem[]) => rpc.domainReorderDomains(items),
      onSuccess: invalidateDomainScope,
    }),
  );

  return {
    createDomain,
    updateDomain,
    deleteDomain,
    reorderDomains,
  };
}

/** 外部（chat 等）定向失效 entity display 用。 */
export function invalidateEntityDisplay(
  queryClient: QueryClient,
  ref: Pick<AgentContextRef, "type" | "id">,
) {
  return queryClient.invalidateQueries({ queryKey: captureQueryKeys.entityDisplay(ref) });
}
