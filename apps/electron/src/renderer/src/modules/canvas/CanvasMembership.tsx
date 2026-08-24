import { UnderstandingCanvasMembership } from "@reflecta/ui/capture";
import { useCanvasListByUnderstanding } from "./queries";
import { useNavigateToCanvas } from "@renderer/modules/shared/navigation";

/**
 * 画布归属区块（M6-6）：Capture 理解详情展示「出现于 N 张画布」，
 * 点击跳转画布模块打开指定画布（navigateToCanvas，T2 带参跳转）。
 */
export function CanvasMembership({ understandingId }: { understandingId: string }) {
  const { data: canvases } = useCanvasListByUnderstanding(understandingId);
  const navigateToCanvas = useNavigateToCanvas();

  if (!canvases || canvases.length === 0) return null;

  return <UnderstandingCanvasMembership canvases={canvases} onOpen={navigateToCanvas} />;
}
