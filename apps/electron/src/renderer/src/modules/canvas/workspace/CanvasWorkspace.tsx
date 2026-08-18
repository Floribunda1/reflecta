import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelsTopLeft } from "lucide-react";
import type { Node } from "@antv/x6";
import { debounce } from "lodash-es";
import { useQueryClient } from "@tanstack/react-query";
import {
  CanvasGraph,
  CanvasZoomControls,
  createCanvasDnd,
  createCanvasDndNode,
  type CanvasCellAction,
  type CanvasGraphHandle,
  type CanvasShapeData,
} from "@reflecta/ui/canvas";
import type { CanvasDocument, CanvasViewport } from "@reflecta/ui/canvas";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@reflecta/ui/components/empty";
import { useModal } from "@reflecta/ui/overlays";
import { useNavigateToCanvas } from "@renderer/modules/shared/navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import { cn } from "@reflecta/ui/lib/utils";
import { RESIZE_HANDLE_CLASS } from "@renderer/modules/shared/layout/layout-constants";
import {
  canvasQueryKeys,
  refreshCanvasDetail,
  useCanvasDetail,
  useSaveCanvasMutation,
  useUpdateViewportMutation,
} from "../queries";
import { useCanvasStore } from "../store";
import { CanvasDetailPanel } from "./CanvasDetailPanel";
import { CanvasEdgeStylePanel } from "./CanvasEdgeStylePanel";
import { CanvasEdgeLabelEditor } from "./CanvasEdgeLabelEditor";
import { CanvasLibraryPanel } from "./CanvasLibraryPanel";
import { CanvasRefPickerModal } from "./CanvasRefPickerModal";
import { CanvasToolbar } from "./CanvasToolbar";
import { newCanvasRefElement } from "./element-factory";

const SAVE_DEBOUNCE_MS = 800;
const VIEWPORT_SETTLE_MS = 600;

function CanvasEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <Empty>
        <EmptyContent>
          <EmptyMedia variant="icon">
            <PanelsTopLeft />
          </EmptyMedia>
          <EmptyTitle>这张画布还是空的</EmptyTitle>
          <EmptyDescription>从理解库拖入理解，或从工具栏拖入文本 / 图形 / 组</EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  );
}

/**
 * 画布工作区（Phase 1 组装）：
 * 标题编辑工具栏 + 无限画布（X6）+ 左下控制 + 右下缩略图 + 画布内空态 +
 * 库面板最小闭环；事件桥 → zustand 镜像 + 防抖 saveCanvas / viewport settle 提交（M7-6 / M1-5）。
 */
export function CanvasWorkspace({ canvasId }: { canvasId: string }) {
  const navigateToCanvas = useNavigateToCanvas();
  const { openModal, closeModal } = useModal();
  const { data: detail, isLoading } = useCanvasDetail(canvasId);
  const canvas = detail?.canvas ?? null;

  // 初始文档：仅取首次详情（引用同步 refetch 不重载画布，避免覆盖未保存手势）；切换画布由 key 重挂载
  const initialDocumentRef = useRef<CanvasDocument | null>(null);
  if (!initialDocumentRef.current && detail) {
    initialDocumentRef.current = { elements: detail.elements, edges: detail.edges };
  }
  const initialDocument = initialDocumentRef.current;

  // store 镜像
  const setDocument = useCanvasStore((state) => state.setDocument);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setSelection = useCanvasStore((state) => state.setSelection);

  const saveCanvas = useSaveCanvasMutation();
  const updateViewport = useUpdateViewportMutation();
  const saveRef = useRef<ReturnType<typeof debounce> | undefined>(undefined);

  const graphRef = useRef<CanvasGraphHandle>(null);
  const [dnd, setDnd] = useState<import("@antv/x6").Dnd | null>(null);
  const [minimapContainer, setMinimapContainer] = useState<HTMLDivElement | null>(null);
  // 右侧单面板（库 / 详情 / 连线样式互斥；关闭恢复全宽，M6-5）
  const [rightPanel, setRightPanel] = useState<
    | { mode: "library" }
    | { mode: "detail"; understandingId: string }
    | { mode: "edge-style"; edgeId: string }
    | null
  >(null);
  const libraryOpen = rightPanel?.mode === "library";

  // Dnd 绑定图实例
  useEffect(() => {
    const graph = graphRef.current?.graph;
    if (!graph) return;
    const instance = createCanvasDnd(graph);
    setDnd(instance);
    return () => instance.dispose();
  }, [detail, canvasId]);

  const queryClient = useQueryClient();
  const refsRef = useRef<ReadonlyMap<string, { id: string }>>(new Map());
  refsRef.current = new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref]));

  // 事件桥 → 镜像 + 防抖保存
  const handleDocumentChange = useCallback(
    (document: CanvasDocument) => {
      // 只保留端点均为真实元素的边：X6 交互期可能出现指向已移除节点的瞬态边，
      // 带入 saveCanvas 会触发服务端校验失败（error invoking saveCanvas）。
      const elementIds = new Set(document.elements.map((element) => element.id));
      const edges = document.edges.filter(
        (edge) => elementIds.has(edge.sourceElementId) && elementIds.has(edge.targetElementId),
      );
      const sanitized = edges.length === document.edges.length ? document : { ...document, edges };
      setDocument(sanitized);
      // 引用同步（M3-A6）：拖入的理解不在已知 refs 中 → 失效 detail 刷新卡片内容（不重载画布）
      const missingRef = document.elements.some(
        (element) =>
          element.kind === "understanding" &&
          element.understandingId &&
          !refsRef.current.has(element.understandingId),
      );
      if (missingRef) void refreshCanvasDetail(queryClient, canvasId);
      if (!saveRef.current) {
        saveRef.current = debounce((doc: CanvasDocument) => {
          // 自动保存失败静默（避免未处理拒绝弹错 toast；下次变更会再保存）
          void saveCanvas.mutateAsync({ canvasId, document: doc }).catch(() => {});
        }, SAVE_DEBOUNCE_MS);
      }
      saveRef.current(sanitized);
    },
    [canvasId, queryClient, saveCanvas, setDocument],
  );

  const viewportSaveRef = useRef<ReturnType<typeof debounce> | undefined>(undefined);
  const handleViewportChange = useCallback(
    (viewport: CanvasViewport) => {
      setViewport(viewport);
      if (!viewportSaveRef.current) {
        viewportSaveRef.current = debounce((vp: CanvasViewport) => {
          void updateViewport.mutateAsync({ canvasId, viewport: vp });
        }, VIEWPORT_SETTLE_MS);
      }
      viewportSaveRef.current?.(viewport);
    },
    [canvasId, setViewport, updateViewport],
  );

  // 卸载时冲刷未保存的文档 / 视口，并清除 detail 缓存（重进总是新鲜加载，避免 stale 空文档被首次捕获）
  useEffect(
    () => () => {
      saveRef.current?.flush();
      viewportSaveRef.current?.flush();
      queryClient.removeQueries({ queryKey: canvasQueryKeys.detail(canvasId) });
    },
    [canvasId, queryClient],
  );

  // 组动作（M3-D）：级联删除组 / 解除组
  const handleCellAction = useCallback((action: CanvasCellAction) => {
    const graph = graphRef.current?.graph;
    if (!graph) return;
    if (action.type === "delete-group") {
      const group = graph.getCellById(action.nodeId) as Node | null;
      group?.remove({ deep: true });
    } else if (action.type === "ungroup") {
      const group = graph.getCellById(action.nodeId) as Node | null;
      if (!group) return;
      for (const child of group.getChildren() ?? []) group.unembed(child);
    }
  }, []);

  const shapeData = useMemo<CanvasShapeData>(
    () => ({
      understandingRefs: new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref])),
      referencedCanvases: new Map((detail?.referencedCanvases ?? []).map((ref) => [ref.id, ref])),
      onCanvasRefClick: (targetCanvasId) => navigateToCanvas(targetCanvasId),
      onCellAction: handleCellAction,
    }),
    [detail, handleCellAction, navigateToCanvas],
  );

  // 画布引用卡创建（M3-E1）：选目标画布 → 在画布中心落卡
  const handleOpenCanvasRefPicker = useCallback(() => {
    openModal(
      <CanvasRefPickerModal
        excludeCanvasId={canvasId}
        onClose={closeModal}
        onPick={(target) => {
          closeModal();
          const graph = graphRef.current?.graph;
          if (!graph) return;
          graph.addNode(createCanvasDndNode(newCanvasRefElement(target.id)));
        }}
      />,
      { title: "引用画布", widthClassName: "max-w-md" },
    );
  }, [canvasId, closeModal, openModal]);

  // 选中变化 → 联动（M6 / M4-7）：理解卡 → 详情；连线 → 样式面板；其它 → 关闭
  const handleSelectionChange = useCallback(
    (cellIds: string[]) => {
      setSelection(cellIds);
      const graph = graphRef.current?.graph;
      if (graph && cellIds.length === 1) {
        const cell = graph.getCellById(cellIds[0]);
        const data = cell?.getData() as
          | { kind?: string; understandingId?: string | null }
          | undefined;
        if (cell?.isEdge()) {
          setRightPanel({ mode: "edge-style", edgeId: cell.id });
          return;
        }
        if (data?.kind === "understanding" && data.understandingId) {
          setRightPanel({ mode: "detail", understandingId: data.understandingId });
          return;
        }
      }
      // 非理解卡 / 非连线选中 → 关闭详情与样式面板（库保持由“理解库”按钮控制）
      setRightPanel((prev) => (prev && prev.mode !== "library" ? null : prev));
    },
    [setSelection],
  );

  const [detailPanelKey, setDetailPanelKey] = useState<string>("");
  const elementCount = useCanvasStore((state) => state.document.elements.length);
  // 连线标签就地编辑（M4-3）：双击连线 → 在边中点渲染输入框
  const [edgeLabelEditor, setEdgeLabelEditor] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleEdgeDblClick = useCallback((edgeId: string) => {
    const graph = graphRef.current?.graph;
    const edge = graph?.getCellById(edgeId) as import("@antv/x6").Edge | null;
    if (!edge || !graph) return;
    const view = graph.findViewByCell(edge) as import("@antv/x6").EdgeView | null;
    const point = view?.getPointAtRatio(0.5);
    if (!point) return;
    const client = graph.localToPage(point.x, point.y);
    setEdgeLabelEditor({ edgeId, x: client.x, y: client.y });
  }, []);

  // 删除选中（M4-6）：Delete / Backspace（基于 store 单选选中集）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const graph = graphRef.current?.graph;
      if (!graph) return;
      const selected = useCanvasStore.getState().selection;
      selected.forEach((id) => graph.getCellById(id)?.remove());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      data-testid="canvas-workspace"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <CanvasToolbar
        canvas={canvas}
        dnd={dnd}
        libraryOpen={libraryOpen}
        onToggleLibrary={() =>
          setRightPanel(rightPanel?.mode === "library" ? null : { mode: "library" })
        }
        onOpenCanvasRefPicker={handleOpenCanvasRefPicker}
      />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        <ResizablePanel
          id="canvas-main"
          minSize="30%"
          defaultSize={rightPanel ? 62 : 100}
          className="min-h-0 min-w-0"
        >
          <div className="relative flex h-full min-h-0 min-w-0">
            <CanvasGraph
              key={canvasId}
              ref={graphRef}
              document={initialDocument}
              viewport={canvas?.viewport ?? null}
              canvasId={canvasId}
              shapeData={shapeData}
              onDocumentChange={handleDocumentChange}
              onViewportChange={handleViewportChange}
              onSelectionChange={handleSelectionChange}
              onEdgeDblClick={handleEdgeDblClick}
              minimap={{ container: minimapContainer, width: 200, height: 140 }}
              className="absolute inset-0"
            />

            {!isLoading && detail && elementCount === 0 ? <CanvasEmptyState /> : null}

            <CanvasZoomControls
              className="absolute bottom-4 left-4"
              onZoomIn={() => graphRef.current?.graph?.zoom(1.25)}
              onZoomOut={() => graphRef.current?.graph?.zoom(0.8)}
              onFit={() => graphRef.current?.graph?.zoomToFit({ padding: 32, maxScale: 1 })}
            />

            <div
              ref={setMinimapContainer}
              data-testid="canvas-minimap"
              className="absolute right-4 bottom-4 overflow-hidden rounded-lg border bg-background/80 shadow-sm"
            />

            {edgeLabelEditor ? (
              <CanvasEdgeLabelEditor
                graph={graphRef.current?.graph ?? null}
                edgeId={edgeLabelEditor.edgeId}
                position={{ x: edgeLabelEditor.x, y: edgeLabelEditor.y }}
                onClose={() => setEdgeLabelEditor(null)}
              />
            ) : null}
          </div>
        </ResizablePanel>

        {rightPanel ? (
          <>
            <ResizableHandle
              withHandle
              id="canvas-right-resize-handle"
              className={cn(RESIZE_HANDLE_CLASS)}
            />
            <ResizablePanel
              id="canvas-right"
              minSize="26%"
              maxSize="60%"
              defaultSize={38}
              className="min-h-0 min-w-0"
            >
              {rightPanel.mode === "library" ? (
                <CanvasLibraryPanel dnd={dnd} onClose={() => setRightPanel(null)} />
              ) : rightPanel.mode === "detail" ? (
                <CanvasDetailPanel
                  key={detailPanelKey}
                  canvasId={canvasId}
                  understandingId={rightPanel.understandingId}
                  onClose={() => setRightPanel(null)}
                  onSwitch={(nextId) => {
                    setRightPanel({ mode: "detail", understandingId: nextId });
                    setDetailPanelKey(nextId);
                  }}
                />
              ) : (
                <CanvasEdgeStylePanel
                  edge={
                    graphRef.current?.graph?.getCellById(rightPanel.edgeId) as
                      | import("@antv/x6").Edge
                      | null
                  }
                  onClose={() => setRightPanel(null)}
                />
              )}
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}
