import { ipcClient } from "@renderer/utils/ipc";
import type {
  CanvasDTO,
  CanvasDetailDTO,
  CanvasDocument as ServerCanvasDocument,
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
  return useQuery<CanvasDTO[]>({
    queryKey: canvasQueryKeys.list,
    queryFn: () => ipcClient.understandingCanvas.listCanvases(),
  });
}

/** 画布详情（renderer 交互需要正文：includeBodies 已在 IPC 服务端固定为 true）。 */
export function useCanvasDetail(canvasId: string | null) {
  return useQuery<CanvasDetailDTO | null>({
    queryKey: canvasQueryKeys.detail(canvasId ?? ""),
    queryFn: () =>
      canvasId ? ipcClient.understandingCanvas.getCanvas(canvasId) : Promise.resolve(null),
    enabled: Boolean(canvasId),
  });
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

export function useCreateCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: CreateCanvasInput) => ipcClient.understandingCanvas.createCanvas(input),
    onSuccess: () => invalidateCanvasList(queryClient),
  });
}

export function useRenameCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCanvasInput }) =>
      ipcClient.understandingCanvas.updateCanvas(id, input),
    onSuccess: (_result, variables) =>
      Promise.all([
        invalidateCanvasList(queryClient),
        invalidateCanvasDetail(queryClient, variables.id),
      ]),
  });
}

export function useDeleteCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipcClient.understandingCanvas.deleteCanvas(id),
    onSuccess: (_result, id) =>
      Promise.all([invalidateCanvasList(queryClient), invalidateCanvasDetail(queryClient, id)]),
  });
}

/** 文档级全量写（T3）：X6 变更防抖后提交；invalidate list 保持「最近活跃排序」新鲜，
 * 并 invalidate detail（M3-A6 引用同步：新拖入的理解引用随详情刷新补全正文）。
 * 入参用 ui 契约类型（X6 层零映射），边界处结构一致直接透传（server 的
 * understanding/canvas_ref props 类型带有 Record<string, never> 历史包袱）。 */
export function useSaveCanvasMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ canvasId, document }: { canvasId: string; document: CanvasDocumentContract }) =>
      ipcClient.understandingCanvas.saveCanvas(
        canvasId,
        document as unknown as ServerCanvasDocument,
      ),
    onSuccess: (_result, { canvasId }) =>
      Promise.all([
        invalidateCanvasList(queryClient),
        invalidateCanvasDetail(queryClient, canvasId),
      ]),
  });
}

/** 视口单独写（M1-5 恢复）：settle 后提交；不 invalidate（避免平移时列表反复刷新）。 */
export function useUpdateViewportMutation() {
  return useMutation({
    mutationFn: ({ canvasId, viewport }: { canvasId: string; viewport: Viewport }) =>
      ipcClient.understandingCanvas.updateViewport(canvasId, viewport),
  });
}
