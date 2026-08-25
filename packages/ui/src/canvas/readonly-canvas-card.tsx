import { lazy, Suspense, useEffect, useState } from "react";
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

/** AI artifact 生成期骨架：移植 AFFiNE ArtifactSkeleton 的纯 CSS 呼吸线条（无 motion 依赖），
 * 线宽循环伸缩表达「生成中」，居中显示以适配不同尺寸的画布容器。 */
export function ReadOnlyCanvasSkeleton() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30"
      data-testid="canvas-view-skeleton"
      aria-hidden="true"
    >
      <div className="artifact-skeleton relative h-[200px] w-[250px]">
        <div className="artifact-line artifact-line-1" />
        <div className="artifact-line artifact-line-2" />
        <div className="artifact-line artifact-line-3" />
        <div className="artifact-line artifact-line-4" />
        <div className="artifact-line artifact-line-5" />
        <div className="artifact-line artifact-line-6" />
      </div>
    </div>
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
