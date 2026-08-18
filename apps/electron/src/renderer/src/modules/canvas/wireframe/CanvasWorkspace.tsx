import { Maximize, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useKeyPress, useSize } from "ahooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reflecta/ui/components/button";
import { cn } from "@reflecta/ui/lib/utils";
import type { CanvasDetailDTO, Viewport } from "@reflecta/server";
import { useCanvasWireframeStore, elementSearchTitle } from "./wireframe-store";
import { WIREFRAME_WORLD } from "./wireframe-data";
import { EdgeLayer, RenderedElement } from "./canvas-elements";
import { fitViewport, zoomAt, zoomAtCenter } from "./canvas-geometry";

/**
 * 画布线框 · 无限画布工作区。
 *
 * 线框级交互：空白处拖拽平移 / 滚轮缩放（光标锚点）/ 左下缩放工具 / 右下 minimap /
 * ⌘/Ctrl+F 搜索跳转。元素单击进入右侧详情；canvas_ref 双击跳转目标画布。
 */

export function CanvasWorkspace() {
  const detail = useCanvasWireframeStore((state) =>
    state.selectedCanvasId ? (state.details[state.selectedCanvasId] ?? null) : null,
  );
  const canvasId = useCanvasWireframeStore((state) => state.selectedCanvasId);

  if (!canvasId || !detail) {
    return (
      <div className="flex h-full min-h-0 min-w-0 items-center justify-center text-sm text-muted-foreground">
        尚未选择画布
      </div>
    );
  }

  return <WorkspaceInner key={canvasId} canvasId={canvasId} detail={detail} />;
}

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  fromX: number;
  fromY: number;
} | null;

function WorkspaceInner({ canvasId, detail }: { canvasId: string; detail: CanvasDetailDTO }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useCanvasWireframeStore((state) => state.viewports[canvasId]) ?? {
    x: 0,
    y: 0,
    zoom: 1,
  };
  const setViewport = useCanvasWireframeStore((state) => state.setViewport);
  const fitted = useCanvasWireframeStore((state) => state.fittedCanvasIds.includes(canvasId));
  const markFitted = useCanvasWireframeStore((state) => state.markFitted);
  const selectedElementId = useCanvasWireframeStore((state) => state.selectedElementId);
  const selectElement = useCanvasWireframeStore((state) => state.selectElement);
  const clearSelection = useCanvasWireframeStore((state) => state.clearSelection);
  const selectCanvas = useCanvasWireframeStore((state) => state.selectCanvas);
  const searchOpen = useCanvasWireframeStore((state) => state.searchOpen);
  const setSearchOpen = useCanvasWireframeStore((state) => state.setSearchOpen);

  const size = useSize(containerRef);
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<DragState>(null);
  const movedRef = useRef(false);

  const topLevelElements = detail.elements.filter((element) => element.parentId === null);

  // ── auto-fit：每个画布首次打开时把内容适配到视口 ──────────────────────────
  useEffect(() => {
    if (fitted || !size || size.width <= 0 || size.height <= 0) return;
    if (detail.elements.length === 0) {
      markFitted(canvasId);
      return;
    }
    setViewport(canvasId, fitViewport(size.width, size.height, detail.elements));
    markFitted(canvasId);
  }, [canvasId, fitted, size, detail.elements, markFitted, setViewport]);

  // ── 滚轮缩放（光标锚点）——原生监听，避免 React 被动事件无法 preventDefault ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * 0.0016);
      setViewport(canvasId, zoomAt(cx, cy, viewport.zoom * factor, viewport));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [canvasId, viewport, setViewport]);

  // ── 空白处拖拽平移（pointer capture 到容器） ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
      setViewport(canvasId, { x: drag.fromX + dx, y: drag.fromY + dy, zoom: viewport.zoom });
    };
    const onPointerUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setIsPanning(false);
    };
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    return () => {
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    };
  }, [canvasId, viewport.zoom, setViewport]);

  const handleBackgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // 元素都是 <button>；按钮上按下不触发平移（点击/拖拽语义留给元素自身）
    if ((event.target as HTMLElement).closest("button")) return;
    movedRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      fromX: viewport.x,
      fromY: viewport.y,
    };
    setIsPanning(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    clearSelection();
  };

  const zoomAroundCenter = (factor: number) =>
    setViewport(
      canvasId,
      zoomAtCenter(viewport.zoom * factor, viewport, size?.width ?? 0, size?.height ?? 0),
    );

  const handleJumpCanvas = (targetId: string) => {
    if (!targetId) return;
    selectCanvas(targetId);
    toast.success("已跳转到关联画布（线框演示）");
  };

  /** 搜索跳转：居中目标元素并选中（右侧进入详情） */
  const focusSearchHit = (elementId: string) => {
    const element = detail.elements.find((item) => item.id === elementId);
    if (!element || !size) return;
    const cx = size.width / 2 - (element.x + element.width / 2) * viewport.zoom;
    const cy = size.height / 2 - (element.y + element.height / 2) * viewport.zoom;
    setViewport(canvasId, { x: cx, y: cy, zoom: viewport.zoom });
    selectElement(canvasId, elementId);
    setSearchOpen(false);
  };

  useKeyPress(["meta.f", "ctrl.f"], () => setSearchOpen(!searchOpen), { exactMatch: true });
  useKeyPress("esc", () => setSearchOpen(false), { exactMatch: true });

  const gridBackground = [
    `radial-gradient(circle, color-mix(in srgb, var(--foreground) 13%, transparent) 1px, transparent 1.3px)`,
    `radial-gradient(circle, color-mix(in srgb, var(--foreground) 10%, transparent) 1px, transparent 1.5px)`,
  ].join(",");

  return (
    <div
      ref={containerRef}
      data-testid="canvas-wireframe-workspace"
      className={cn(
        "relative h-full min-h-0 min-w-0 overflow-hidden bg-muted/25 select-none",
        isPanning && "cursor-grabbing",
      )}
      onPointerDown={handleBackgroundPointerDown}
      onClick={handleCanvasClick}
    >
      {/* 世界层：网格 + 连线 + 元素（统一按视口 transform） */}
      <div
        className="absolute top-0 left-0 cursor-grab"
        style={{
          width: WIREFRAME_WORLD.width,
          height: WIREFRAME_WORLD.height,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          backgroundImage: gridBackground,
          backgroundSize: `${24 / viewport.zoom}px ${24 / viewport.zoom}px, ${120 / viewport.zoom}px ${120 / viewport.zoom}px`,
          willChange: "transform",
        }}
      >
        <EdgeLayer detail={detail} selectedElementId={selectedElementId} />
        {topLevelElements.map((element) => (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              zIndex: element.zIndex + 1,
            }}
          >
            <RenderedElement
              canvasId={canvasId}
              element={element}
              detail={detail}
              selected={element.id === selectedElementId}
              selectedElementId={selectedElementId}
              onSelect={(elementId) => selectElement(canvasId, elementId)}
              onJumpCanvas={handleJumpCanvas}
            />
          </div>
        ))}
      </div>

      {detail.elements.length === 0 ? <EmptyCanvasHint /> : null}

      {/* 画布 chrome：左下缩放 / 右下 minimap / ⌘F 搜索（不随画布缩放） */}
      <ZoomControls
        zoom={viewport.zoom}
        onZoomIn={() => zoomAroundCenter(1.2)}
        onZoomOut={() => zoomAroundCenter(1 / 1.2)}
        onFit={() =>
          setViewport(canvasId, fitViewport(size?.width ?? 0, size?.height ?? 0, detail.elements))
        }
        onSearch={() => setSearchOpen(true)}
      />
      <Minimap
        detail={detail}
        viewport={viewport}
        containerSize={size}
        onJump={(next) => setViewport(canvasId, next)}
      />

      {searchOpen ? (
        <SearchOverlay
          detail={detail}
          onPick={focusSearchHit}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  );
}

function EmptyCanvasHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-lg border border-dashed bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground shadow-sm">
        空白画布 · 从右侧素材库点击条目预览，或与 AI 协作沉淀（v1.x）
      </div>
    </div>
  );
}

// ─── 左下缩放控制 ──────────────────────────────────────────────────────────────

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onSearch,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onSearch: () => void;
}) {
  return (
    <div
      className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-full border bg-background/95 p-1 shadow-sm"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="缩小"
        title="缩小"
        onClick={onZoomOut}
      >
        <ZoomOut size={15} />
      </Button>
      <span className="w-11 text-center text-xs font-medium text-muted-foreground tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="放大"
        title="放大"
        onClick={onZoomIn}
      >
        <ZoomIn size={15} />
      </Button>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="适应内容"
        title="适应内容"
        onClick={onFit}
      >
        <Maximize size={14} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="搜索元素"
        title="搜索元素（⌘/Ctrl+F）"
        onClick={onSearch}
      >
        <Search size={14} />
      </Button>
    </div>
  );
}

// ─── 右下 minimap ──────────────────────────────────────────────────────────────

const MINIMAP_WIDTH = 208;
const MINIMAP_HEIGHT = 128;

function Minimap({
  detail,
  viewport,
  containerSize,
  onJump,
}: {
  detail: CanvasDetailDTO;
  viewport: Viewport;
  containerSize: { width: number; height: number } | undefined;
  onJump: (viewport: Viewport) => void;
}) {
  const scale = MINIMAP_WIDTH / WIREFRAME_WORLD.width;
  const containerW = containerSize?.width ?? 0;
  const containerH = containerSize?.height ?? 0;
  const selectedElementId = useCanvasWireframeStore((state) => state.selectedElementId);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const worldX = (event.clientX - rect.left) / scale;
    const worldY = (event.clientY - rect.top) / scale;
    onJump({
      x: containerW / 2 - worldX * viewport.zoom,
      y: containerH / 2 - worldY * viewport.zoom,
      zoom: viewport.zoom,
    });
  };

  return (
    <div
      className="absolute right-4 bottom-4 overflow-hidden rounded-lg border bg-background/95 shadow-sm"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={handleClick}
      onPointerDown={(event) => event.stopPropagation()}
      title="点击定位"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      {detail.elements.map((element) => (
        <div
          key={element.id}
          className={cn(
            "absolute rounded-[1px]",
            element.id === selectedElementId ? "bg-primary" : "bg-foreground/25",
          )}
          style={{
            left: element.x * scale,
            top: element.y * scale,
            width: Math.max(element.width * scale, 2),
            height: Math.max(element.height * scale, 2),
          }}
        />
      ))}
      {containerW > 0 && containerH > 0 ? (
        <div
          className="absolute border border-primary/70 bg-primary/10"
          style={{
            left: (-viewport.x / viewport.zoom) * scale,
            top: (-viewport.y / viewport.zoom) * scale,
            width: (containerW / viewport.zoom) * scale,
            height: (containerH / viewport.zoom) * scale,
          }}
        />
      ) : null}
    </div>
  );
}

// ─── ⌘/Ctrl+F 搜索浮层 ─────────────────────────────────────────────────────────

function SearchOverlay({
  detail,
  onPick,
  onClose,
}: {
  detail: CanvasDetailDTO;
  onPick: (elementId: string) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const results = keyword.trim()
    ? detail.elements
        .map((element) => ({ element, title: elementSearchTitle(detail, element.id) }))
        .filter(({ title }) => title.toLowerCase().includes(keyword.trim().toLowerCase()))
    : [];

  return (
    <div
      className="absolute top-16 left-1/2 w-[26rem] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-lg"
      data-testid="canvas-wireframe-search-overlay"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search size={15} className="shrink-0 text-muted-foreground" />
        <input
          autoFocus
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="搜索画布元素（标题 / 文本 / 画布引用）…"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          Esc
        </kbd>
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {results.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {keyword.trim() ? "没有匹配的元素" : "输入关键词开始搜索画布元素"}
          </div>
        ) : (
          results.map(({ element, title }) => (
            <button
              key={element.id}
              type="button"
              onClick={() => onPick(element.id)}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1 truncate text-foreground">{title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {element.kind === "understanding"
                  ? "理解"
                  : element.kind === "canvas_ref"
                    ? "画布引用"
                    : element.kind === "group"
                      ? "分组"
                      : element.kind === "text"
                        ? "文本"
                        : "形状"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
