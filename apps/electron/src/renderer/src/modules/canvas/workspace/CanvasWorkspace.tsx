import { useLatest } from "ahooks";
import { Effect } from "effect";
import { runPromise } from "@renderer/lib/effect-runtime";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "@effect/atom-react";
import {
  CanvasGraph,
  type CanvasDocument,
  type CanvasElementDTO,
  type CanvasGraphHandle,
  type CanvasReferencedCanvasView,
  type CanvasShapeData,
  type CanvasViewport,
} from "@reflecta/ui/canvas";
import { useModal } from "@reflecta/ui/overlays";
import { useNavigateToCanvas } from "@renderer/modules/shared/navigation";
import { ResizablePanel, ResizablePanelGroup } from "@reflecta/ui/components/resizable";
import {
  canvasQueryKeys,
  refreshCanvasDetail,
  useCanvasDetail,
  useReferencedCanvasPreviews,
  useSaveCanvasMutation,
  useUpdateViewportMutation,
} from "../queries";
import { canvasSnapshotAtom, dispatchCanvasAction, provideCanvasEffects } from "../store";
import { CanvasRefPickerModal } from "./CanvasRefPickerModal";
import { CanvasToolbar } from "./CanvasToolbar";
import {
  CanvasEmptyOverlay,
  CanvasSaveBadge,
  CanvasSearchHost,
  CanvasSearchHotkeys,
  CanvasSidePanelHost,
  CanvasToolStrip,
  CanvasZoomDock,
} from "./canvas-chrome";
import { newCanvasRefElement, newTextElement, newUnderstandingElement } from "./element-factory";
import { createDebouncedLatestSaver } from "./debounced-latest-saver";

const SAVE_DEBOUNCE_MS = 800;
const VIEWPORT_SETTLE_MS = 600;

function createElementForDrop(source: CanvasElementDTO): CanvasElementDTO {
  if (source.kind === "text") return newTextElement(source);
  if (source.kind === "understanding" && source.understandingId)
    return newUnderstandingElement(source.understandingId);
  if (source.kind === "canvas_ref" && source.canvasRefId)
    return newCanvasRefElement(source.canvasRefId);
  return source;
}

function onDocumentChange(document: CanvasDocument) {
  dispatchCanvasAction({ type: "document/changed", document });
}

function onViewportChange(viewport: CanvasViewport) {
  dispatchCanvasAction({ type: "viewport/changed", viewport });
}

function onSelectionChange(cellIds: string[]) {
  dispatchCanvasAction({ type: "selection/changed", cellIds });
}

function CanvasPersistenceRuntime({
  canvasId,
  graphRef,
  refsRef,
  canvasRefsRef,
}: {
  canvasId: string;
  graphRef: RefObject<CanvasGraphHandle | null>;
  refsRef: { readonly current: ReadonlyMap<string, unknown> };
  canvasRefsRef: { readonly current: ReadonlyMap<string, unknown> };
}) {
  const queryClient = useQueryClient();
  const saveCanvas = useSaveCanvasMutation();
  const updateViewport = useUpdateViewportMutation();
  const saveDocumentRef = useLatest(saveCanvas.mutateAsync);
  const saveViewportRef = useLatest(updateViewport.mutateAsync);

  const [documentSaver] = useState(() =>
    createDebouncedLatestSaver({
      delay: SAVE_DEBOUNCE_MS,
      onStatus: (status) => dispatchCanvasAction({ type: "save/status", status }),
      save: (document: CanvasDocument) =>
        runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => saveDocumentRef.current({ canvasId, document }));
            const savedUnderstandingIds = new Set(
              document.elements
                .filter((element) => element.kind === "understanding" && element.understandingId)
                .map((element) => element.understandingId as string),
            );
            const savedCanvasRefIds = new Set(
              document.elements
                .filter((element) => element.kind === "canvas_ref" && element.canvasRefId)
                .map((element) => element.canvasRefId as string),
            );
            const setsDiffer = (left: Set<string>, right: Set<string>) =>
              left.size !== right.size || [...left].some((id) => !right.has(id));
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

  useEffect(() => {
    provideCanvasEffects({
      saveDocument: (document) => documentSaver.schedule(document),
      saveViewport: (viewport) => viewportSaver.schedule(viewport),
      retrySave: () => documentSaver.retry(),
      flushSaves: () => {
        void documentSaver.flush();
        void viewportSaver.flush();
      },
      focusCell: (id) => {
        const graph = graphRef.current?.graph;
        if (!graph) return;
        const cell = graph.getCellById(id);
        if (!cell) return;
        graph.centerCell(cell);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (graph as any).select?.(cell);
      },
    });
    return () => {
      void documentSaver.flush();
      void viewportSaver.flush();
      provideCanvasEffects(null);
      queryClient.removeQueries({ queryKey: canvasQueryKeys.detail(canvasId) });
    };
  }, [canvasId, canvasRefsRef, documentSaver, graphRef, queryClient, refsRef, viewportSaver]);

  return null;
}

const CanvasGraphMount = memo(function CanvasGraphMount({
  canvasId,
  graphRef,
  shapeData,
}: {
  canvasId: string;
  graphRef: RefObject<CanvasGraphHandle | null>;
  shapeData: CanvasShapeData;
}) {
  const snapshot = useAtomValue(canvasSnapshotAtom);
  return (
    <CanvasGraph
      key={canvasId}
      ref={graphRef}
      document={snapshot?.document ?? null}
      viewport={snapshot?.viewport ?? null}
      viewportReady={Boolean(snapshot)}
      canvasId={canvasId}
      shapeData={shapeData}
      createElementForDrop={createElementForDrop}
      onDocumentChange={onDocumentChange}
      onViewportChange={onViewportChange}
      onSelectionChange={onSelectionChange}
      className="absolute inset-0"
    />
  );
});

/**
 * 画布工作区宿主：拉详情、注册副作用运行时、水合快照。
 * 会话态只经 dispatch；chrome 叶子各自订阅切片 atom，避免拖拽重渲染整页。
 */
export function CanvasWorkspace({ canvasId }: { canvasId: string }) {
  const navigateToCanvas = useNavigateToCanvas();
  const { openModal, closeModal } = useModal();
  const { data: detail } = useCanvasDetail(canvasId);
  const canvas = detail?.canvas ?? null;
  const graphRef = useRef<CanvasGraphHandle>(null);

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

  useEffect(() => {
    if (!detail?.canvas) return;
    dispatchCanvasAction({
      type: "document/hydrated",
      document: { elements: detail.elements, edges: detail.edges },
      viewport: detail.canvas.viewport ?? null,
    });
  }, [detail]);

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
        if (element.kind === "understanding" && element.understandingId) {
          dispatchCanvasAction({
            type: "panel/openDetail",
            understandingId: element.understandingId,
          });
        }
      },
    };
  }, [detail, navigateToCanvas, refPreviews]);

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

  return (
    <div
      data-testid="canvas-workspace"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <CanvasPersistenceRuntime
        canvasId={canvasId}
        graphRef={graphRef}
        refsRef={refsRef}
        canvasRefsRef={canvasRefsRef}
      />
      <CanvasSearchHotkeys />
      <CanvasToolbar canvas={canvas} onExportPng={() => void graphRef.current?.exportPng()} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        <ResizablePanel
          id="canvas-main"
          minSize="30%"
          defaultSize={100}
          className="min-h-0 min-w-0"
        >
          <div className="relative flex h-full min-h-0 min-w-0">
            <CanvasGraphMount canvasId={canvasId} graphRef={graphRef} shapeData={shapeData} />
            <CanvasToolStrip graphRef={graphRef} />
            <CanvasSaveBadge />
            <CanvasEmptyOverlay />
            <CanvasZoomDock graphRef={graphRef} />
            <CanvasSearchHost understandingRefs={refsMap} referencedCanvases={canvasRefsMap} />
          </div>
        </ResizablePanel>

        <CanvasSidePanelHost
          canvasId={canvasId}
          graphRef={graphRef}
          onOpenCanvasRefPicker={handleOpenCanvasRefPicker}
        />
      </ResizablePanelGroup>
    </div>
  );
}
