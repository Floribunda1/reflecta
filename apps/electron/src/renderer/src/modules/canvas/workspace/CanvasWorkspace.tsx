import { useLatest } from "ahooks";
import { Effect } from "effect";
import { runPromise } from "@renderer/lib/effect-runtime";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CanvasEmptyState,
  CanvasGraph,
  CanvasSaveStatus,
  CanvasSearchOverlay,
  CanvasTextTool,
  CanvasUnderstandingTool,
  CanvasZoomControls,
  type CanvasDocument,
  type CanvasElementDTO,
  type CanvasGraphHandle,
  type CanvasReferencedCanvasView,
  type CanvasSearchIndexItem,
  type CanvasShapeData,
  type CanvasViewport,
} from "@reflecta/ui/canvas";
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
  useReferencedCanvasPreviews,
  useSaveCanvasMutation,
  useUpdateViewportMutation,
} from "../queries";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  documentAtom,
  readCanvasState,
  selectionAtom,
  viewportAtom,
  canvasIsEmptyAtom,
} from "../store";
import { CanvasDetailPanel } from "./CanvasDetailPanel";
import { CanvasLibraryPanel } from "./CanvasLibraryPanel";
import { CanvasRefPickerModal } from "./CanvasRefPickerModal";
import { CanvasToolbar } from "./CanvasToolbar";
import { newCanvasRefElement, newTextElement, newUnderstandingElement } from "./element-factory";
import {
  buildCanvasSearchIndex,
  panelForSelection,
  type CanvasRightPanel,
} from "./canvas-workspace-model";
import { createDebouncedLatestSaver, type SaveStatus } from "./debounced-latest-saver";

const SAVE_DEBOUNCE_MS = 800;
const VIEWPORT_SETTLE_MS = 600;

function CanvasWorkspaceSidePanel({
  canvasId,
  rightPanel,
  detailPanelKey,
  onClose,
  onOpenCanvasRefPicker,
  onStartDragUnderstanding,
  onPickUnderstanding,
  onSwitchDetail,
}: {
  canvasId: string;
  rightPanel: CanvasRightPanel;
  detailPanelKey: string;
  onClose: () => void;
  onOpenCanvasRefPicker: () => void;
  onStartDragUnderstanding: (id: string, e: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
  onSwitchDetail: (understandingId: string) => void;
}) {
  if (!rightPanel) return null;
  return (
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
            onClose={onClose}
            onOpenCanvasRefPicker={onOpenCanvasRefPicker}
            onStartDragUnderstanding={onStartDragUnderstanding}
            onPickUnderstanding={onPickUnderstanding}
          />
        ) : rightPanel.mode === "detail" ? (
          <CanvasDetailPanel
            key={detailPanelKey}
            canvasId={canvasId}
            understandingId={rightPanel.understandingId}
            onClose={onClose}
            onSwitch={(nextId) => onSwitchDetail(nextId)}
          />
        ) : null}
      </ResizablePanel>
    </>
  );
}

function useCanvasWorkspaceHotkeys(setSearchOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSearchOpen]);
}

/**
 * 画布工作区：无限画布（React Flow）+ 左下控制 + 右下缩略图 + 空态 + 库 / 详情面板；
 * 事件桥 → atoms 镜像 + 防抖 saveCanvas / viewport settle 提交。
 */
export function CanvasWorkspace({ canvasId }: { canvasId: string }) {
  const navigateToCanvas = useNavigateToCanvas();
  const { openModal, closeModal } = useModal();
  const { data: detail, isLoading } = useCanvasDetail(canvasId);
  const canvas = detail?.canvas ?? null;

  // 初始文档：仅取首次详情；切换画布由 key 重挂载
  const [initialDocument, setInitialDocument] = useState<CanvasDocument | null>(null);
  // 初始视口：同样仅取首次详情并冻结。保存后 invalidateCanvasDetail 重拉带来的 viewport
  // 变化不回灌实时画布（CanvasGraph 只在挂载时恢复一次），避免视图被拽回旧位置。
  const [initialViewport, setInitialViewport] = useState<CanvasViewport | null>(null);
  if (initialDocument === null && detail) {
    setInitialDocument({
      elements: detail.elements,
      edges: detail.edges,
    });
    setInitialViewport(detail.canvas?.viewport ?? null);
  }

  const setDocument = useAtomSet(documentAtom);
  const setViewport = useAtomSet(viewportAtom);
  const documentSeededRef = useRef(false);
  // 切换画布：重置初始文档/视口/原子 seed 门控。CanvasWorkspace 实例可能被复用
  // （非 key 重挂载），state 不会随 canvasId 自动清空；不重置会把上一张画布的
  // 文档泄漏到新画布（渲染旧内容、保存写回错误画布）。
  useEffect(() => {
    setInitialDocument(null);
    setInitialViewport(null);
    documentSeededRef.current = false;
  }, [canvasId, setInitialDocument, setInitialViewport]);
  // 首次加载：把详情同步进 documentAtom（在 effect 中做，避免渲染期写 atom 触发
  // “Cannot update a component while rendering a different component” 警告），
  // 搜索 / 面板路由才能基于当前文档工作
  useEffect(() => {
    if (
      initialDocument !== null &&
      !documentSeededRef.current &&
      readCanvasState(documentAtom).elements.length === 0
    ) {
      setDocument(initialDocument);
      documentSeededRef.current = true;
    }
  }, [initialDocument, setDocument]);
  const setSelection = useAtomSet(selectionAtom);

  const saveCanvas = useSaveCanvasMutation();
  const updateViewport = useUpdateViewportMutation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");

  const graphRef = useRef<CanvasGraphHandle>(null);
  const [rightPanel, setRightPanel] = useState<CanvasRightPanel>(null);
  const libraryOpen = rightPanel?.mode === "library";

  const queryClient = useQueryClient();
  // 仅在保存回调查引用集合：useMemo 避免每渲染重建 Map，useLatest 保持回调内读到最新值
  const refsMap = useMemo(
    () => new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref])),
    [detail],
  );
  const canvasRefsMap = useMemo(
    () => new Map((detail?.referencedCanvases ?? []).map((ref) => [ref.id, ref])),
    [detail],
  );
  const refsRef = useLatest(refsMap);
  const canvasRefsRef = useLatest(canvasRefsMap);
  const saveDocumentRef = useLatest(saveCanvas.mutateAsync);
  const saveViewportRef = useLatest(updateViewport.mutateAsync);

  const [documentSaver] = useState(() =>
    createDebouncedLatestSaver({
      delay: SAVE_DEBOUNCE_MS,
      onStatus: setSaveStatus,
      // save 是 Effect 程序（跑在 AppRuntime）：先落库，引用集合变化时按需刷新 detail。
      save: (document: CanvasDocument) =>
        runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => saveDocumentRef.current({ canvasId, document }));
            // 只在引用集合真变了（新增/移除理解或画布引用）才刷新 detail 补全正文预览；
            // 普通内容/位置编辑不重拉，避免保存后回灌详情扰动实时视图。
            const savedUnderstandingIds = new Set(
              document.elements
                .filter((e) => e.kind === "understanding" && e.understandingId)
                .map((e) => e.understandingId as string),
            );
            const savedCanvasRefIds = new Set(
              document.elements
                .filter((e) => e.kind === "canvas_ref" && e.canvasRefId)
                .map((e) => e.canvasRefId as string),
            );
            const setsDiffer = (a: Set<string>, b: Set<string>) =>
              a.size !== b.size || [...a].some((id) => !b.has(id));
            if (
              setsDiffer(savedUnderstandingIds, new Set(refsRef.current.keys())) ||
              setsDiffer(savedCanvasRefIds, new Set(canvasRefsRef.current.keys()))
            ) {
              yield* Effect.promise(() => refreshCanvasDetail(queryClient, canvasId));
            }
          }),
        ),
    }),
  );

  const [viewportSaver] = useState(() =>
    createDebouncedLatestSaver({
      delay: VIEWPORT_SETTLE_MS,
      save: (viewport: CanvasViewport) => saveViewportRef.current({ canvasId, viewport }),
    }),
  );

  // 事件桥 → 镜像 + 防抖保存
  const handleDocumentChange = useCallback(
    (document: CanvasDocument) => {
      // 元素按 id 去重 + 只保留端点均为真实元素的边，避免重复 key 渲染 / 服务端校验失败。
      // ponytail: 去重只是兜底，上游疑似 X6 dnd 双加同 id 节点；若日志仍现重复 key 应修 addElement。
      const elementIds = new Set<string>();
      const elements = document.elements.filter((element) => {
        if (elementIds.has(element.id)) return false;
        elementIds.add(element.id);
        return true;
      });
      const edges = document.edges.filter(
        (edge) => elementIds.has(edge.sourceElementId) && elementIds.has(edge.targetElementId),
      );
      const sanitized =
        elements.length === document.elements.length && edges.length === document.edges.length
          ? document
          : { elements, edges };
      setDocument(sanitized);
      documentSaver.schedule(sanitized);
    },
    [documentSaver, setDocument],
  );

  const retrySave = useCallback(() => documentSaver.retry(), [documentSaver]);

  const handleViewportChange = useCallback(
    (viewport: CanvasViewport) => {
      setViewport(viewport);
      viewportSaver.schedule(viewport);
    },
    [setViewport, viewportSaver],
  );

  // 卸载时冲刷未保存的文档 / 视口
  useEffect(
    () => () => {
      void documentSaver.flush();
      void viewportSaver.flush();
      queryClient.removeQueries({ queryKey: canvasQueryKeys.detail(canvasId) });
    },
    [canvasId, documentSaver, queryClient, viewportSaver],
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
  const isEmpty = useAtomValue(canvasIsEmptyAtom);

  // 搜索（M2-6）：⌘/Ctrl+F 打开浮层；选中结果定位到节点。
  // 索引在打开瞬间从 store 快照构建（命令式读，不订阅 documentAtom——否则每次
  // 图变更都会重渲染整个 Workspace）。
  const [searchOpen, setSearchOpen] = useState(false);
  const onSelectSearchResult = useCallback((id: string) => {
    setSearchOpen(false);
    const graph = graphRef.current?.graph;
    if (!graph) return;
    const cell = graph.getCellById(id);
    if (!cell) return;
    graph.centerCell(cell);
    // 选中结果（节点或边），让右侧面板 / 视觉选中态联动
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (graph as any).select?.(cell);
  }, []);

  const searchIndex = useMemo<CanvasSearchIndexItem[]>(
    () =>
      searchOpen
        ? buildCanvasSearchIndex(
            readCanvasState(documentAtom),
            new Map((detail?.understandingRefs ?? []).map((ref) => [ref.id, ref])),
            new Map((detail?.referencedCanvases ?? []).map((ref) => [ref.id, ref])),
          )
        : [],
    [searchOpen, detail],
  );

  // 稳定引用：CanvasGraph 已 memo，内联箭头会让 memo 失效
  const createElementForDrop = useCallback((source: CanvasElementDTO) => {
    if (source.kind === "text") return newTextElement(source);
    if (source.kind === "understanding" && source.understandingId)
      return newUnderstandingElement(source.understandingId);
    if (source.kind === "canvas_ref" && source.canvasRefId)
      return newCanvasRefElement(source.canvasRefId);
    return source;
  }, []);

  useCanvasWorkspaceHotkeys(setSearchOpen);

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
              viewport={initialViewport}
              viewportReady={!isLoading && Boolean(detail?.canvas)}
              canvasId={canvasId}
              shapeData={shapeData}
              createElementForDrop={createElementForDrop}
              onDocumentChange={handleDocumentChange}
              onViewportChange={handleViewportChange}
              onSelectionChange={handleSelectionChange}
              className="absolute inset-0"
            />

            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm">
              <CanvasTextTool
                onStartDrag={(e) => {
                  graphRef.current?.startDrag(newTextElement({ width: 220, height: 120 }), e);
                }}
                onClick={() => {
                  const text = newTextElement();
                  text.x = 120;
                  text.y = 120;
                  graphRef.current?.addElement(text);
                }}
              />
              <CanvasUnderstandingTool
                open={libraryOpen}
                onClick={() => setRightPanel(libraryOpen ? null : { mode: "library" })}
              />
            </div>

            <CanvasSaveStatus saveStatus={saveStatus} onRetry={() => void retrySave()} />

            {!isLoading && detail && isEmpty ? <CanvasEmptyState /> : null}

            <CanvasZoomControls
              className="absolute bottom-4 left-4"
              onZoomIn={() => graphRef.current?.zoomIn()}
              onZoomOut={() => graphRef.current?.zoomOut()}
              onFit={() => graphRef.current?.fitView()}
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

        <CanvasWorkspaceSidePanel
          canvasId={canvasId}
          rightPanel={rightPanel}
          detailPanelKey={detailPanelKey}
          onClose={() => setRightPanel(null)}
          onOpenCanvasRefPicker={handleOpenCanvasRefPicker}
          onStartDragUnderstanding={(id, e) =>
            graphRef.current?.startDrag(newUnderstandingElement(id), e)
          }
          onPickUnderstanding={(id) => graphRef.current?.addElement(newUnderstandingElement(id))}
          onSwitchDetail={(nextId) => {
            setRightPanel({ mode: "detail", understandingId: nextId });
            setDetailPanelKey(nextId);
          }}
        />
      </ResizablePanelGroup>
    </div>
  );
}
