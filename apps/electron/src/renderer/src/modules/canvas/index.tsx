import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { parseCanvasEntryParams } from "@renderer/modules/shared/navigation";
import { useRailMenu } from "@renderer/modules/shared/layout/rail-menu-context";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@reflecta/ui/components/empty";
import { PanelsTopLeft } from "lucide-react";
import { CanvasListPanel } from "./list/CanvasListPage";
import { CanvasEntryPage } from "./entry/CanvasEntryPage";

function CanvasRailMenu({ canvasId }: { canvasId: string | null }) {
  const railMenu = useMemo(() => <CanvasListPanel selectedCanvasId={canvasId} />, [canvasId]);
  useRailMenu("canvas", railMenu);
  return null;
}

export function CanvasPage() {
  const [searchParams] = useSearchParams();
  const { canvasId } = parseCanvasEntryParams(searchParams);

  return (
    <>
      <CanvasRailMenu canvasId={canvasId} />
      {canvasId ? (
        <CanvasEntryPage canvasId={canvasId} />
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
