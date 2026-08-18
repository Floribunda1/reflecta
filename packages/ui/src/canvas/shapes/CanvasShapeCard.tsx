import type { Node } from "@antv/x6";
import type { CanvasElementDTO } from "../document";
import { CARD_BASE_CLASS, selectedCardClass } from "./shared";

/** 图形（M3-C）：矩形 / 圆形；纯展示，支持移动 / 缩放 / 删除。 */
export function CanvasShapeCard({ node }: { node: Node }) {
  const element = node.getData<CanvasElementDTO>();
  const shapeType = element.kind === "shape" ? element.props.shapeType : "rect";

  return (
    <div
      data-testid="canvas-shape-card"
      data-shape-type={shapeType}
      className={`${CARD_BASE_CLASS} ${selectedCardClass(false)} ${
        shapeType === "circle" ? "rounded-full" : "rounded-md"
      } bg-muted/40`}
    />
  );
}
