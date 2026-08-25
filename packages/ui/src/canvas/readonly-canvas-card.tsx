import { lazy, Suspense } from "react";
import { cn } from "../lib/utils";
import { Skeleton } from "../components/skeleton";
import type { CanvasDocument } from "@reflecta/shared";
import type { CanvasShapeData, CanvasUnderstandingRefView } from "./shape-context";

// 重型 X6 只读图 lazy 引入：单测跑在 ESM 环境，X6 CJS lib 载入会炸；
// 且只在实际渲染时才需要 X6。Suspense fallback 作为「好看的加载」占位。
const CanvasReadOnlyView = lazy(() =>
  import("./CanvasReadOnlyView").then((m) => ({ default: m.CanvasReadOnlyView })),
);

/** 模拟画布最终图布局的骨架：若干 pulsing 卡片节点，表达「结构正在成形」。 */
function CanvasViewSkeleton() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-md border border-border bg-muted/30"
      data-testid="canvas-view-skeleton"
      aria-hidden="true"
    >
      <Skeleton className="absolute left-[6%] top-[12%] h-14 w-36 rounded-md" />
      <Skeleton className="absolute left-[42%] top-[4%] h-14 w-40 rounded-md" />
      <Skeleton className="absolute left-[63%] top-[36%] h-14 w-32 rounded-md" />
      <Skeleton className="absolute left-[18%] top-[60%] h-14 w-36 rounded-md" />
      <Skeleton className="absolute left-[52%] top-[72%] h-14 w-40 rounded-md" />
      <Skeleton className="absolute left-[74%] top-[66%] h-12 w-28 rounded-md" />
      {/* 极简连接线，暗示节点之间的关系 */}
      <div className="absolute left-[38%] top-[22%] h-px w-28 -rotate-12 bg-border" />
      <div className="absolute left-[52%] top-[46%] h-px w-24 rotate-45 bg-border" />
      <div className="absolute left-[72%] top-[82%] h-px w-28 -rotate-6 bg-border" />
    </div>
  );
}

function canvasShapeData(
  understandingRefs: ReadonlyMap<string, CanvasUnderstandingRefView> | undefined,
  understandingTitles: ReadonlyArray<{ id: string; title: string }> | undefined,
): CanvasShapeData {
  // 引用展示数据（消息层实时 hydration）优先；不足时用 output 冻结的标题兜底，
  // 保证实体已被删除 / 重命名时引用卡仍有可读标签。
  const refs = new Map(understandingRefs);
  for (const title of understandingTitles ?? []) {
    if (!refs.has(title.id)) {
      refs.set(title.id, { id: title.id, title: title.title ?? null, body: "", deleted: false });
    }
  }
  return { understandingRefs: refs, referencedCanvases: new Map() };
}

export type ReadOnlyCanvasCardProps = {
  document: CanvasDocument;
  /** 引用理解的展示数据（优先，实时 hydration）。 */
  understandingRefs?: ReadonlyMap<string, CanvasUnderstandingRefView>;
  /** output / payload 冻结的引用标题（兜底，实体删除 / 重命名时仍有可读标签）。 */
  understandingTitles?: ReadonlyArray<{ id: string; title: string }>;
  /** false → 折叠占位，不挂载 X6（避免在 0 / 裁剪尺寸里初始化图的闪烁与损坏）。 */
  mounted?: boolean;
  className?: string;
};

/** 只读画布文档卡：封装 shape hydration + lazy X6 挂载 + 加载骨架 + 折叠策略。 */
export function ReadOnlyCanvasCard({
  document,
  understandingRefs,
  understandingTitles,
  mounted = true,
  className,
}: ReadOnlyCanvasCardProps) {
  const shapeData = canvasShapeData(understandingRefs, understandingTitles);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-muted/30",
        className,
      )}
    >
      {mounted ? (
        <Suspense fallback={<CanvasViewSkeleton />}>
          <CanvasReadOnlyView
            document={document}
            shapeData={shapeData}
            showZoomControls
            className="h-full min-h-0"
          />
        </Suspense>
      ) : null}
    </div>
  );
}
