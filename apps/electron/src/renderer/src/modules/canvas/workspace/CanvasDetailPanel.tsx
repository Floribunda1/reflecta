import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { UnderstandingDetail } from "../../capture/understanding-detail";
import { refreshCanvasDetail } from "../queries";
import { useCaptureUnderstandingDetail } from "../../capture/queries";

/**
 * 画布详情模式（M6）：复用 Capture UnderstandingDetail（编辑标题 / 正文 / 上下文，
 * M6-2 上下文与 AI 能力免费获得）；右侧单面板两态（库 / 详情互斥，M6-4），
 * 关闭恢复全宽（M6-5）。
 *
 * M6-3 同步：理解保存（updatedAt 变化）→ 失效当前画布 detail → 卡片内容刷新（引用同步）。
 */
export function CanvasDetailPanel({
  canvasId,
  understandingId,
  onClose,
  onSwitch,
}: {
  canvasId: string;
  understandingId: string;
  onClose: () => void;
  /** 详情内 wiki-link 点击 → 切换到另一条理解 */
  onSwitch: (understandingId: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: understanding } = useCaptureUnderstandingDetail(understandingId);

  // M6-3：理解保存 → 刷新画布 detail（卡片全文同步）
  const updatedAt = understanding?.updatedAt;
  useEffect(() => {
    if (updatedAt) void refreshCanvasDetail(queryClient, canvasId);
    // 每个 updatedAt 版本刷新一次；首次挂载也刷新以拉平首次编辑前的引用
  }, [updatedAt, canvasId, queryClient]);

  return (
    <div data-testid="canvas-detail-panel" className="h-full min-h-0 w-full overflow-hidden">
      <UnderstandingDetail
        understandingId={understandingId}
        onClose={onClose}
        onWikiLinkClick={onSwitch}
        onDeleted={() => onClose()}
        onChat={(scope) => {
          // v1：聊理解 → 进入 Agent 模块（画布侧就地 Chat 属 Phase 6 / v1.x）
          navigate("/agent");
          void scope;
        }}
      />
    </div>
  );
}
