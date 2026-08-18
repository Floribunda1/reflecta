import { Download, PanelRightClose, PanelRightOpen, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@reflecta/ui/components/badge";
import { Button } from "@reflecta/ui/components/button";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import { useCanvasWireframeStore } from "./wireframe-store";

/**
 * 画布线框 · 顶栏（铺满主区宽度，右侧面板共用的全局栏）。
 * 线框占位：导出/保存用 toast 提示，v1 接真实能力（PNG 导出走系统对话框）。
 */
export function CanvasTopBar() {
  const detail = useCanvasWireframeStore((state) =>
    state.selectedCanvasId ? (state.details[state.selectedCanvasId] ?? null) : null,
  );
  const rightPanelOpen = useCanvasWireframeStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useCanvasWireframeStore((state) => state.setRightPanelOpen);

  return (
    <PageTopBar
      testId="canvas-wireframe-topbar"
      actions={
        <>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={rightPanelOpen ? "收起右侧面板" : "展开右侧面板"}
            title={rightPanelOpen ? "收起右侧面板" : "展开右侧面板"}
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
          >
            {rightPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => toast.info("PNG 导出为线框占位操作（v1 走系统对话框）")}
          >
            <Download size={14} />
            导出 PNG
          </Button>
          <Button type="button" size="sm" onClick={() => toast.success("画布已保存（线框演示）")}>
            <Save size={14} />
            保存
          </Button>
        </>
      }
    >
      <h1 className="min-w-0 truncate text-sm font-medium" title={detail?.canvas.title}>
        {detail?.canvas.title ?? "画布"}
      </h1>
      <Badge
        variant="outline"
        className="shrink-0 text-muted-foreground"
        title="画布模块尚未实现，当前为样式讨论线框"
      >
        线框演示
      </Badge>
      <span className="shrink-0 text-xs text-muted-foreground">
        {detail ? `${detail.elements.length} 元素 · ${detail.edges.length} 连线` : ""}
      </span>
    </PageTopBar>
  );
}
