import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Library, PanelsTopLeft, Type } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CanvasGraph,
  CanvasZoomControls,
  type CanvasGraphHandle,
  type CanvasReferencedCanvasView,
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
import { Button } from "@reflecta/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reflecta/ui/components/tooltip";
import { RESIZE_HANDLE_CLASS } from "@renderer/modules/shared/layout/layout-constants";
import {
  canvasQueryKeys,
  refreshCanvasDetail,
  useCanvasDetail,
  useReferencedCanvasPreviews,
  useSaveCanvasMutation,
  useUpdateViewportMutation,
} from "../queries";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { documentAtom, readCanvasState, selectionAtom, viewportAtom } from "../store";
import { CanvasDetailPanel } from "./CanvasDetailPanel";
import { CanvasLibraryPanel } from "./CanvasLibraryPanel";
import { CanvasRefPickerModal } from "./CanvasRefPickerModal";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasSearchOverlay, type CanvasSearchIndexItem } from "./CanvasSearchOverlay";
import { newCanvasRefElement, newTextElement } from "./element-factory";
import { setDndElement } from "@reflecta/ui/canvas";
import {
  buildCanvasSearchIndex,
  panelForSelection,
  type CanvasRightPanel,
} from "./canvas-workspace-model";
import { createDebouncedLatestSaver, type SaveStatus } from "./debounced-latest-saver";

const SAVE_DEBOUNCE_MS = 800;
const VIEWPORT_SETTLE_MS = 600;
const DND_MIME = "application/reflecta-canvas-element";

function CanvasTextTool() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="文本"
            data-testid="canvas-tool-dnd-text"
            draggable
            onDragStart={(event) => {
              const element = newTextElement();
              event.dataTransfer.setData(DND_MIME, JSON.stringify(element));
              event.dataTransfer.effectAllowed = "move";
              setDndElement(element);
            }}
            onDragEnd={() => setDndElement(null)}
          />
        }
      >
        <Type size={15} />
      </TooltipTrigger>
      <TooltipContent>文本</TooltipContent>
    </Tooltip>
  );
}

function CanvasUnderstandingTool({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={open ? "secondary" : "ghost"}
            aria-label="理解库"
            data-testid="canvas-toggle-library-button"
            onClick={onClick}
          />
        }
      >
        <Library size={15} />
      </TooltipTrigger>
      <TooltipContent>理解库</TooltipContent>
    </Tooltip>
  );
}

function CanvasEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <Empty>
        <EmptyContent>
          <EmptyMedia variant="icon">
            <PanelsTopLeft />
          </EmptyMedia>
          <EmptyTitle>这张画布还是空的</EmptyTitle>
          <EmptyDescription>从理解库拖入理解，或从工具栏拖入文本</EmptyDescription>
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
    initialDocumentRef.current = {
      elements: detail.elements,
      edges: detail.edges,
    };
  }
  const initialDocument = initialDocumentRef.current;

  const setDocument = useAtomSet(documentAtom);
  const setViewport = useAtomSet(viewportAtom);
  const setSelection = useAtomSet(selectionAtom);
  const currentDocument = useAtomValue(documentAtom);

  const saveCanvas = useSaveCanvasMutation();
  const updateViewport = useUpdateViewportMutation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");

  const graphRef = useRef<CanvasGraphHandle>(null);
  const [rightPanel, setRightPanel] = useState<CanvasRightPanel>(null);
  const libraryOpen = rightPanel?.mode === "library";

  const queryClient = useQueryClient();
  const refsRef = useRef<ReadonlyMap<string, { id: string }>>(new Map());
  refsRef.current = new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref]));
  const saveDocumentRef = useRef(saveCanvas.mutateAsync);
  const saveViewportRef = useRef(updateViewport.mutateAsync);
  saveDocumentRef.current = saveCanvas.mutateAsync;
  saveViewportRef.current = updateViewport.mutateAsync;

  const documentSaverRef = useRef<ReturnType<
    typeof createDebouncedLatestSaver<CanvasDocument>
  > | null>(null);
  if (!documentSaverRef.current) {
    documentSaverRef.current = createDebouncedLatestSaver({
      delay: SAVE_DEBOUNCE_MS,
      onStatus: setSaveStatus,
      save: async (document) => {
        await saveDocumentRef.current({ canvasId, document });
        const missingRef = document.elements.some(
          (element) =>
            element.kind === "understanding" &&
            element.understandingId &&
            !refsRef.current.has(element.understandingId),
        );
        if (missingRef) await refreshCanvasDetail(queryClient, canvasId);
      },
    });
  }

  const viewportSaverRef = useRef<ReturnType<
    typeof createDebouncedLatestSaver<CanvasViewport>
  > | null>(null);
  if (!viewportSaverRef.current) {
    viewportSaverRef.current = createDebouncedLatestSaver({
      delay: VIEWPORT_SETTLE_MS,
      save: (viewport) => saveViewportRef.current({ canvasId, viewport }),
    });
  }

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
      documentSaverRef.current?.schedule(sanitized);
    },
    [setDocument],
  );

  const retrySave = useCallback(() => documentSaverRef.current?.retry(), []);

  const handleViewportChange = useCallback(
    (viewport: CanvasViewport) => {
      setViewport(viewport);
      viewportSaverRef.current?.schedule(viewport);
    },
    [setViewport],
  );

  // 卸载时冲刷未保存的文档 / 视口
  useEffect(
    () => () => {
      void documentSaverRef.current?.flush();
      void viewportSaverRef.current?.flush();
      queryClient.removeQueries({ queryKey: canvasQueryKeys.detail(canvasId) });
    },
    [canvasId, queryClient],
  );

  const refIds = useMemo(() => (detail?.referencedCanvases ?? []).map((ref) => ref.id), [detail]);
  const { data: refPreviews } = useReferencedCanvasPreviews(refIds);

  const shapeData = useMemo<CanvasShapeData>(() => {
    const refMap = new Map<string, CanvasReferencedCanvasView>();
    for (const ref of detail?.referencedCanvases ?? []) {
      const preview = refPreviews?.find((item) => item?.canvas.id === ref.id) ?? null;
      refMap.set(ref.id, {
        ...ref,
        document: preview ? { elements: preview.elements, edges: preview.edges } : undefined,
        shapeData: preview
          ? {
              understandingRefs: new Map(
                (preview.understandingRefs ?? []).map((item) => [item.id, item]),
              ),
              referencedCanvases: new Map(
                (preview.referencedCanvases ?? []).map((item) => [item.id, item]),
              ),
            }
          : undefined,
      });
    }
    return {
      understandingRefs: new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref])),
      referencedCanvases: refMap,
      onCanvasRefClick: (targetCanvasId) => navigateToCanvas(targetCanvasId),
      onCellAction: (action) => {
        if (action.type === "delete-group") graphRef.current?.deleteGroup(action.nodeId);
        else if (action.type === "ungroup") graphRef.current?.ungroupSelection([action.nodeId]);
        else if (action.type === "delete-element") graphRef.current?.deleteElement(action.nodeId);
        else graphRef.current?.deleteEdge(action.edgeId);
      },
      onElementEdit: (element) => {
        if (element.kind === "understanding" && element.understandingId)
          setRightPanel({ mode: "detail", understandingId: element.understandingId });
      },
    };
  }, [detail, refPreviews, navigateToCanvas]);

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
      setRightPanel((current) =>
        panelForSelection(cellIds, readCanvasState(documentAtom), current),
      );
    },
    [setSelection],
  );

  const [detailPanelKey, setDetailPanelKey] = useState<string>("");
  const elementCount = useAtomValue(documentAtom).elements.length;

  // 搜索（M2-6）：⌘/Ctrl+F 打开浮层；选中结果定位到节点。
  const [searchOpen, setSearchOpen] = useState(false);
  const onSelectSearchResult = useCallback((id: string) => {
    setSearchOpen(false);
    const graph = graphRef.current?.graph;
    if (!graph) return;
    const node = graph.getNode(id);
    if (node)
      graph.fitView({
        nodes: [{ id }],
        padding: 0.5,
        maxZoom: 1.5,
        duration: 300,
      });
    const edge = graph.getEdge(id);
    if (edge) {
      graph.setEdges((edges) => edges.map((item) => ({ ...item, selected: item.id === id })));
      graph.fitView({
        nodes: [{ id: edge.source }, { id: edge.target }],
        padding: 0.5,
        duration: 300,
      });
    }
  }, []);

  const searchIndex = useMemo<CanvasSearchIndexItem[]>(
    () =>
      buildCanvasSearchIndex(
        currentDocument,
        new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref])),
        new Map((detail?.referencedCanvases ?? []).map((ref) => [ref.id, ref])),
      ),
    [currentDocument, detail],
  );

  // 搜索与组快捷键：只拦截产品明确承诺的组合键。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen((open) => !open);
        return;
      }
      if (meta && event.key.toLowerCase() === "g") {
        event.preventDefault();
        const doc = readCanvasState(documentAtom);
        const selected = readCanvasState(selectionAtom);
        const selectedGroups = selected.filter((id) =>
          doc.elements.some((element) => element.id === id && element.kind === "group"),
        );
        if (event.shiftKey) graphRef.current?.ungroupSelection(selectedGroups);
        else {
          graphRef.current?.groupSelection(
            selected.filter((id) => doc.elements.some((element) => element.id === id)),
          );
        }
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
      <CanvasToolbar canvas={canvas} onExportPng={() => void graphRef.current?.exportPng()} />

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
              viewportReady={!isLoading && Boolean(detail?.canvas)}
              canvasId={canvasId}
              shapeData={shapeData}
              onDocumentChange={handleDocumentChange}
              onViewportChange={handleViewportChange}
              onSelectionChange={handleSelectionChange}
              className="absolute inset-0"
            />

            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm">
              <CanvasTextTool />
              <CanvasUnderstandingTool
                open={libraryOpen}
                onClick={() =>
                  setRightPanel(rightPanel?.mode === "library" ? null : { mode: "library" })
                }
              />
            </div>

            {saveStatus === "error" ? (
              <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-md border border-destructive/30 bg-background px-3 py-2 text-xs text-destructive shadow-sm">
                <span>画布保存失败，修改仍未保存</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void retrySave()}>
                  重试
                </Button>
              </div>
            ) : saveStatus === "dirty" || saveStatus === "saving" ? (
              <div className="absolute right-3 top-3 z-20 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
                未保存
              </div>
            ) : null}

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
                <CanvasLibraryPanel
                  onClose={() => setRightPanel(null)}
                  onOpenCanvasRefPicker={handleOpenCanvasRefPicker}
                />
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
              ) : null}
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}
