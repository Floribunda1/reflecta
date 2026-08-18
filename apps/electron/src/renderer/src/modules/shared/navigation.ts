import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 跨模块带参跳转（计划 T2 方案 ①：hash router query + location.state 来源）。
 *
 * 单一入口 `navigateToCanvas({ canvasId, from })`，M6-6（理解详情画布归属）/
 * M3-E（画布引用跳转）/ U4（沉淀接收端）共用；`from` 记录来源路径供「返回」语义
 * （v1 用 location.state 记录，不扩机制）。
 */

export const CANVAS_ROUTE = "/understanding-canvas";
export const CANVAS_ID_QUERY_KEY = "canvas";

export type CanvasEntryParams = {
  /** URL 上带参指定的画布 id（无效 / 缺省为 null） */
  canvasId: string | null;
};

/** 解析 canvas 模块入口参数（?canvas=<id>）；空值归一为 null。 */
export function parseCanvasEntryParams(searchParams: URLSearchParams): CanvasEntryParams {
  const raw = searchParams.get(CANVAS_ID_QUERY_KEY);
  const canvasId = raw && raw.trim() ? raw.trim() : null;
  return { canvasId };
}

export function useNavigateToCanvas() {
  const navigate = useNavigate();
  return useCallback(
    (canvasId: string, from?: string) => {
      const query = `${CANVAS_ID_QUERY_KEY}=${encodeURIComponent(canvasId)}`;
      navigate(`${CANVAS_ROUTE}?${query}`, { state: from ? { from } : undefined });
    },
    [navigate],
  );
}
