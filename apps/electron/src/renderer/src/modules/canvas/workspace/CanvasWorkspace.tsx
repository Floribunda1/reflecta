import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelsTopLeft } from "lucide-react";
import { debounce } from "lodash-es";
import { useQueryClient } from "@tanstack/react-query";
import {
  CanvasGraph,
  CanvasZoomControls,
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
import { CanvasLibraryPanel } from "./CanvasLibraryPanel";
import { CanvasRefPickerModal } from "./CanvasRefPickerModal";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasSearchOverlay, type CanvasSearchIndexItem } from "./CanvasSearchOverlay";
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
 * 画布工作区：无限画布（React Flow）+ 左下控制 + 右下缩略图 + 空态 + 库 / 详情面板；
 * 事件桥 → zustand 镜像 + 防抖 saveCanvas / viewport settle 提交。
 */
export function CanvasWorkspace({ canvasId }: { canvasId: string }) {
  const navigateToCanvas = useNavigateToCanvas();
  const { openModal, closeModal } = useModal();
  const { data: detail, isLoading } = useCanvasDetail(canvasId);
  const canvas = detail?.canvas ?? null;

  // 初始文档：仅取首次详情；切换画布由 key 重挂载
  const initialDocumentRef = useRef<CanvasDocument | null>(null);
  if (!initialDocumentRef.current && detail) {
    initialDocumentRef.current = { elements: detail.elements, edges: detail.edges };
  }
  const initialDocument = initialDocumentRef.current;

  const setDocument = useCanvasStore((state) => state.setDocument);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setSelection = useCanvasStore((state) => state.setSelection);

  const saveCanvas = useSaveCanvasMutation();
  const updateViewport = useUpdateViewportMutation();
  const saveRef = useRef<ReturnType<typeof debounce> | undefined>(undefined);

  const graphRef = useRef<CanvasGraphHandle>(null);
  const [rightPanel, setRightPanel] = useState<
    { mode: "library" } | { mode: "detail"; understandingId: string } | null
  >(null);
  const libraryOpen = rightPanel?.mode === "library";

  const queryClient = useQueryClient();
  const refsRef = useRef<ReadonlyMap<string, { id: string }>>(new Map());
  refsRef.current = new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref]));

  // 事件桥 → 镜像 + 防抖保存
  const handleDocumentChange = useCallback(
    (document: CanvasDocument) => {
      // 只保留端点均为真实元素的边，避免服务端校验失败
      const elementIds = new Set(document.elements.map((element) => element.id));
      const edges = document.edges.filter(
        (edge) => elementIds.has(edge.sourceElementId) && elementIds.has(edge.targetElementId),
      );
      const sanitized = edges.length === document.edges.length ? document : { ...document, edges };
      setDocument(sanitized);
      if (!saveRef.current) {
        saveRef.current = debounce(async (doc: CanvasDocument) => {
          try {
            const res = await saveCanvas.mutateAsync({ canvasId, document: doc });
            void res;
            const missingRef = doc.elements.some(
              (element) =>
                element.kind === "understanding" &&
                element.understandingId &&
                !refsRef.current.has(element.understandingId),
            );
            if (missingRef) await refreshCanvasDetail(queryClient, canvasId);
          } catch {
            // 下次变更会再保存
          }
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

  // 卸载时冲刷未保存的文档 / 视口
  useEffect(
    () => () => {
      saveRef.current?.flush();
      viewportSaveRef.current?.flush();
      queryClient.removeQueries({ queryKey: canvasQueryKeys.detail(canvasId) });
    },
    [canvasId, queryClient],
  );

  const shapeData = useMemo<CanvasShapeData>(
    () => ({
      understandingRefs: new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref])),
      referencedCanvases: new Map((detail?.referencedCanvases ?? []).map((ref) => [ref.id, ref])),
      onCanvasRefClick: (targetCanvasId) => navigateToCanvas(targetCanvasId),
    }),
    [detail, navigateToCanvas],
  );

  // 画布引用卡创建：选目标画布 → 经 handle 命令式落卡
  const handleOpenCanvasRefPicker = useCallback(() => {
    openModal(
      <CanvasRefPickerModal
        excludeCanvasId={canvasId}
        onClose={closeModal}
        onPick={(target) => {
          closeModal();
          graphRef.current?.addElement(newCanvasRefElement(target.id));
        }}
      />,
      { title: "引用画布", widthClassName: "max-w-md" },
    );
  }, [canvasId, closeModal, openModal]);

  // 选中变化 → 联动：理解卡 → 详情面板；其它 → 关闭（库保持由“理解库”按钮控制）
  const handleSelectionChange = useCallback(
    (cellIds: string[]) => {
      setSelection(cellIds);
      if (cellIds.length === 1) {
        const id = cellIds[0];
        const element = useCanvasStore.getState().document.elements.find((el) => el.id === id);
        if (element?.kind === "understanding" && element.understandingId) {
          setRightPanel({ mode: "detail", understandingId: element.understandingId });
          return;
        }
      }
      setRightPanel((prev) => (prev && prev.mode !== "library" ? null : prev));
    },
    [setSelection],
  );

  const [detailPanelKey, setDetailPanelKey] = useState<string>("");
  const elementCount = useCanvasStore((state) => state.document.elements.length);

  // 搜索（M2-6）：⌘/Ctrl+F 打开浮层；选中结果定位到节点。
  const [searchOpen, setSearchOpen] = useState(false);
  const onSelectSearchResult = useCallback((id: string) => {
    setSearchOpen(false);
    const graph = graphRef.current?.graph;
    if (!graph) return;
    const node = graph.getNode(id);
    if (node) graph.fitView({ nodes: [{ id }], padding: 0.5, maxZoom: 1.5, duration: 300 });
  }, []);

  const searchIndex = useMemo<CanvasSearchIndexItem[]>(() => {
    const doc = useCanvasStore.getState().document;
    const items: CanvasSearchIndexItem[] = [];
    for (const el of doc.elements) {
      if (el.kind === "text") items.push({ id: el.id, kind: el.kind, text: el.props.text });
      else if (el.kind === "group") items.push({ id: el.id, kind: el.kind, text: el.props.label });
      else if (el.kind === "understanding" && el.understandingId) {
        const ref = detail?.understandingRefs?.find((r) => r.id === el.understandingId);
        items.push({ id: el.id, kind: el.kind, text: ref?.title ?? "" });
      } else if (el.kind === "canvas_ref" && el.canvasRefId) {
        const ref = detail?.referencedCanvases?.find((c) => c.id === el.canvasRefId);
        items.push({ id: el.id, kind: el.kind, text: ref?.title ?? "" });
      }
    }
    for (const edge of doc.edges) {
      if (edge.label) items.push({ id: edge.id, kind: "edge", text: edge.label });
    }
    return items.filter((x) => x.text.trim().length > 0);
  }, [detail]);

  // 搜索快捷键（M2-6）：⌘/Ctrl+F / ⌘/Ctrl+K。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
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
              className="absolute inset-0"
            />

            {!isLoading && detail && elementCount === 0 ? <CanvasEmptyState /> : null}

            <CanvasZoomControls
              className="absolute bottom-4 left-4"
              onZoomIn={() => graphRef.current?.graph?.zoomIn()}
              onZoomOut={() => graphRef.current?.graph?.zoomOut()}
              onFit={() => graphRef.current?.graph?.fitView({ padding: 0.2, maxZoom: 1 })}
            />

            {searchOpen ? (
              <CanvasSearchOverlay
                index={searchIndex}
                onSelect={onSelectSearchResult}
                onClose={() => setSearchOpen(false)}
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
                <CanvasLibraryPanel onClose={() => setRightPanel(null)} />
              ) : (
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
              )}
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}
