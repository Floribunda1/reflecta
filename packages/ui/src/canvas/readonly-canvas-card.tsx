import { lazy, Suspense, useEffect, useState } from "react";
import { m, MotionConfig } from "motion/react";
import { cn } from "../lib/utils";
import type { CanvasDocument } from "@reflecta/shared";
import type {
  CanvasReferencedCanvasView,
  CanvasShapeData,
  CanvasUnderstandingRefView,
} from "./shape-context";

// 重型 X6 只读图 lazy 引入：单测跑在 ESM 环境，X6 CJS lib 载入会炸；
// 且只在实际渲染时才需要 X6。Suspense fallback 作为「好看的加载」占位。
const CanvasReadOnlyView = lazy(() =>
  import("./CanvasReadOnlyView").then((m) => ({ default: m.CanvasReadOnlyView })),
);

/** AI artifact 生成期加载态（Claude "Generating" 范式，framer motion 驱动）：
 * pulsing 光点 + 高光文字 + 不定态进度条，居中适配不同尺寸画布容器。 */
export function ReadOnlyCanvasSkeleton() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-border bg-muted/30"
        data-testid="canvas-view-skeleton"
        aria-hidden="true"
      >
        {/* pulsing 光点：暗示「生成中」 */}
        <m.span
          className="block h-2.5 w-2.5 rounded-full bg-accent"
          animate={{ scale: [1, 1.6, 1], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* 高光文字（复用项目 shimmer-text 令牌） */}
        <p className="shimmer-text text-sm font-medium">正在生成分析画布…</p>
        {/* 不定态进度条：光带往复扫过 */}
        <div className="relative mt-1 h-1 w-44 overflow-hidden rounded-full bg-muted">
          <m.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-accent"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </MotionConfig>
  );
}

function canvasShapeData(
  understandingRefs: ReadonlyMap<string, CanvasUnderstandingRefView> | undefined,
  understandingTitles: ReadonlyArray<{ id: string; title: string }> | undefined,
  referencedCanvases: ReadonlyMap<string, CanvasReferencedCanvasView> | undefined,
  onCanvasRefClick: ((canvasId: string) => void) | undefined,
): CanvasShapeData {
  // 引用展示数据（消息层实时 hydration）优先；不足时用 output 冻结的标题兜底，
  // 保证实体已被删除 / 重命名时引用卡仍有可读标签。
  const refs = new Map(understandingRefs);
  for (const title of understandingTitles ?? []) {
    if (!refs.has(title.id)) {
      refs.set(title.id, { id: title.id, title: title.title ?? null, body: "", deleted: false });
    }
  }
  return {
    understandingRefs: refs,
    referencedCanvases: referencedCanvases ?? new Map(),
    ...(onCanvasRefClick ? { onCanvasRefClick } : {}),
  };
}

export type ReadOnlyCanvasCardProps = {
  document: CanvasDocument;
  /** 引用理解的展示数据（优先，实时 hydration）。 */
  understandingRefs?: ReadonlyMap<string, CanvasUnderstandingRefView>;
  /** output / payload 冻结的引用标题（兜底，实体删除 / 重命名时仍有可读标签）。 */
  understandingTitles?: ReadonlyArray<{ id: string; title: string }>;
  /** 引用画布的展示数据（画布引用卡内嵌预览 / 删除占位）。 */
  referencedCanvases?: ReadonlyMap<string, CanvasReferencedCanvasView>;
  /** 画布引用卡点击跳转（如 inspector 需要在对话内打开目标画布）。 */
  onCanvasRefClick?: (canvasId: string) => void;
  /** false → 折叠占位，不挂载 X6（避免在 0 / 裁剪尺寸里初始化图的闪烁与损坏）。 */
  mounted?: boolean;
  className?: string;
};

/** 只读画布文档卡：封装 shape hydration + lazy X6 挂载 + 加载骨架 + 折叠策略。
 * 全屏与 Understanding 的 focus 模式同理——同一实例用 CSS 拉满视口（fixed inset-0），
 * 不重建图；X6 autoResize 跟随容器尺寸，进入全屏后自动适应视图。 */
export function ReadOnlyCanvasCard({
  document,
  understandingRefs,
  understandingTitles,
  referencedCanvases,
  onCanvasRefClick,
  mounted = true,
  className,
}: ReadOnlyCanvasCardProps) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const shapeData = canvasShapeData(
    understandingRefs,
    understandingTitles,
    referencedCanvases,
    onCanvasRefClick,
  );
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-muted/30",
        fullscreen
          ? "fixed inset-0 z-50 h-auto overflow-hidden rounded-none border-0 bg-background"
          : className,
      )}
    >
      {mounted ? (
        <Suspense fallback={<ReadOnlyCanvasSkeleton />}>
          <CanvasReadOnlyView
            document={document}
            shapeData={shapeData}
            showZoomControls
            fullscreen={fullscreen}
            onFullscreenChange={setFullscreen}
            className="h-full min-h-0"
          />
        </Suspense>
      ) : null}
    </div>
  );
}
