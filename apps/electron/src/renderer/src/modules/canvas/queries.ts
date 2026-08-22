import { Effect } from "effect";
import { runPromise } from "@renderer/lib/effect-runtime";
import { effectQuery } from "@renderer/lib/effect-query";
import { rpc } from "@renderer/lib/effect-rpc";
import type {
  CanvasDTO,
  CanvasDetailDTO,
  CreateCanvasInput,
  UpdateCanvasInput,
  Viewport,
} from "@reflecta/server";
import type { CanvasDocument as CanvasDocumentContract } from "@reflecta/ui/canvas";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * 画布 IPC hooks（计划 §2）：queryKey 前缀 ["understandingCanvas.*"]，
 * 与 capture 参与概览共用 listCanvases 的 queryKey（同一数据源，进页不拉两次）。
 */

export const canvasQueryKeys = {
  list: ["understandingCanvas.listCanvases"] as const,
  detail: (canvasId: string) => ["understandingCanvas.getCanvas", canvasId] as const,
};

export function useCanvasList() {
  return useQuery(
    effectQuery.queryOptions({
      queryKey: canvasQueryKeys.list,
      queryFn: () => rpc.canvasList().pipe(Effect.map((rows) => rows as CanvasDTO[])),
    }),
  );
}

/** 画布详情（renderer 交互需要正文：includeBodies 已在 IPC 服务端固定为 true）。 */
export function useCanvasDetail(canvasId: string | null) {
  return useQuery(
    effectQuery.queryOptions({
      queryKey: canvasQueryKeys.detail(canvasId ?? ""),
      queryFn: () =>
        canvasId
          ? rpc.canvasGet(canvasId).pipe(Effect.map((dto) => dto as CanvasDetailDTO | null))
          : Effect.succeed(null as CanvasDetailDTO | null),
      enabled: Boolean(canvasId),
    }),
  );
}

/** 引用画布卡的小型预览：单次批量 IPC 拉取所有被引用画布的详情（按 id 排序签名做 queryKey，
 * 返回顺序与入参 refIds 一致，缺失画布为 null）。 */
export function useReferencedCanvasPreviews(refIds: string[]) {
  const key = refIds.toSorted().join(",");
  return useQuery(
    effectQuery.queryOptions({
      queryKey: ["understandingCanvas.refPreviews", key] as const,
      queryFn: () =>
        rpc.canvasListByIds(refIds).pipe(Effect.map((rows) => rows as (CanvasDetailDTO | null)[])),
      enabled: refIds.length > 0,
    }),
  );
}

/** M6-6 / M8-8：某理解出现在哪些画布（画布归属）。 */
export function useCanvasListByUnderstanding(understandingId: string | null) {
  const queryKey = [
    "understandingCanvas.listCanvasesByUnderstanding",
    understandingId ?? "",
  ] as const;
  return useQuery(
    effectQuery.queryOptions({
      queryKey,
      queryFn: () =>
        understandingId
          ? rpc
              .canvasListByUnderstanding(understandingId)
              .pipe(Effect.map((rows) => rows as CanvasDTO[]))
          : Effect.succeed([] as CanvasDTO[]),
      enabled: Boolean(understandingId),
    }),
  );
}

function invalidateCanvasList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: canvasQueryKeys.list, exact: false });
}

function invalidateCanvasDetail(queryClient: QueryClient, canvasId: string) {
  return queryClient.invalidateQueries({ queryKey: canvasQueryKeys.detail(canvasId) });
}

/** 供 capture 侧（M6-6 画布归属）在理解保存后刷新引用画布数据（计划 §2 失效策略）。 */
export function refreshCanvasDetail(queryClient: QueryClient, canvasId: string) {
  return invalidateCanvasDetail(queryClient, canvasId);
}

/** 理解出现在哪些画布 —— 供 Capture 详情「出现于 N 张画布」区块（M6-6）。 */
export async function listCanvasesByUnderstanding(understandingId: string): Promise<CanvasDTO[]> {
  return runPromise(rpc.canvasListByUnderstanding(understandingId)) as Promise<CanvasDTO[]>;
}

export function useCreateCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (input?: CreateCanvasInput) => rpc.canvasCreate(input),
      onSuccess: () => invalidateCanvasList(queryClient),
    }),
  );
}

export function useRenameCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ id, input }: { id: string; input: UpdateCanvasInput }) =>
        rpc.canvasUpdate(id, input),
      onSuccess: (_result, variables) =>
        Promise.all([
          invalidateCanvasList(queryClient),
          invalidateCanvasDetail(queryClient, variables.id),
        ]),
    }),
  );
}

export function useDeleteCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (id: string) => rpc.canvasDelete(id),
      onSuccess: (_result, id) =>
        Promise.all([invalidateCanvasList(queryClient), invalidateCanvasDetail(queryClient, id)]),
    }),
  );
}

/** 文档级全量写（T3）：React Flow 变更防抖后提交；invalidate list 保持「最近活跃排序」新鲜。
 * detail 的引用同步（新拖入的理解/画布引用补全正文预览）由 Workspace 保存回调按需刷新，
 * 不走每次保存的无条件重拉，避免保存后回灌 detail 扰动实时视图。
 * 入参用 ui 契约类型（渲染层零映射），边界处结构一致直接透传（server 的
 * understanding/canvas_ref props 类型带有 Record<string, never> 历史包袱）。 */
export function useSaveCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({
        canvasId,
        document,
      }: {
        canvasId: string;
        document: CanvasDocumentContract;
      }) =>
        rpc.canvasSave(canvasId, document as unknown as import("../../../../ipc").CanvasDocument),
      onSuccess: () => invalidateCanvasList(queryClient),
    }),
  );
}

/** 视口单独写（M1-5 恢复）：settle 后提交；只失效 detail 缓存（平移不刷列表）。 */
export function useUpdateViewportMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ canvasId, viewport }: { canvasId: string; viewport: Viewport }) =>
        rpc.canvasUpdateViewport(canvasId, viewport as import("../../../../ipc").Viewport),
      onSuccess: (_result, { canvasId }) => invalidateCanvasDetail(queryClient, canvasId),
    }),
  );
}
