import { useSearchParams } from "react-router-dom";
import { parseCanvasEntryParams } from "@renderer/modules/shared/navigation";
import { CanvasListPage } from "./list/CanvasListPage";
import { CanvasEntryPage } from "./entry/CanvasEntryPage";

/**
 * 画布模块入口（/understanding-canvas）。
 *
 * 统一解析 `?canvas=<id>`（计划 T2）：带参 → 打开指定画布（编辑模式，Phase 1
 * 起为工作区；当前为入口占位）；无参 → 画布列表。返回列表 = 清除查询参数。
 */
export function CanvasPage() {
  const [searchParams] = useSearchParams();
  const { canvasId } = parseCanvasEntryParams(searchParams);

  if (canvasId) return <CanvasEntryPage canvasId={canvasId} />;
  return <CanvasListPage />;
}
