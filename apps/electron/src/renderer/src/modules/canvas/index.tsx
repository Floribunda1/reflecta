import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Atom } from "effect/unstable/reactivity";
import { useAtomValue } from "@effect/atom-react";
import { parseCanvasEntryParams } from "@renderer/modules/shared/navigation";
import { runAtom } from "@renderer/lib/atoms";
import { useRailMenu } from "@renderer/modules/shared/layout/rail-menu-context";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@reflecta/ui/components/empty";
import { PanelsTopLeft } from "lucide-react";
import { CanvasListPanel } from "./list/CanvasListPage";
import { CanvasEntryPage } from "./entry/CanvasEntryPage";
import { useCanvasList } from "./queries";
import { lastSelectedCanvasIdAtom } from "./store";

function CanvasRailMenu({ canvasId }: { canvasId: string | null }) {
  const railMenu = useMemo(() => <CanvasListPanel selectedCanvasId={canvasId} />, [canvasId]);
  useRailMenu("canvas", railMenu);
  return null;
}

export function CanvasPage() {
  const [searchParams] = useSearchParams();
  const { canvasId } = parseCanvasEntryParams(searchParams);
  const { data: canvases, isLoading } = useCanvasList();
  const lastSelectedCanvasId = useAtomValue(lastSelectedCanvasIdAtom);
  const canvasIds = useMemo(() => new Set((canvases ?? []).map((canvas) => canvas.id)), [canvases]);

  // 记住本次打开的画布（覆盖列表点击 / 外部带参跳转等所有入口）。
  useEffect(() => {
    if (canvasId) runAtom(Atom.set(lastSelectedCanvasIdAtom, canvasId));
  }, [canvasId]);

  // URL 无参进入画布模块时，恢复上次选择的画布；列表解析后校验仍存在，已删则清除记忆。
  const restoredCanvasId =
    canvasId ??
    (lastSelectedCanvasId && canvasIds.has(lastSelectedCanvasId) ? lastSelectedCanvasId : null);
  useEffect(() => {
    if (canvasId || isLoading) return;
    if (lastSelectedCanvasId && !canvasIds.has(lastSelectedCanvasId)) {
      runAtom(Atom.set(lastSelectedCanvasIdAtom, null));
    }
  }, [canvasId, isLoading, lastSelectedCanvasId, canvasIds]);

  return (
    <>
      <CanvasRailMenu canvasId={restoredCanvasId} />
      {restoredCanvasId ? (
        <CanvasEntryPage canvasId={restoredCanvasId} />
      ) : (
        <div data-testid="canvas-page" className="flex h-full min-h-0 flex-col bg-background">
          <div className="flex h-12 shrink-0 items-center border-b px-4 text-sm font-medium">
            画布
          </div>
          <Empty className="flex-1">
            <EmptyContent>
              <EmptyMedia variant="icon">
                <PanelsTopLeft />
              </EmptyMedia>
              <EmptyTitle>选择一张画布</EmptyTitle>
            </EmptyContent>
          </Empty>
        </div>
      )}
    </>
  );
}
