import { CanvasGraph } from "./CanvasGraph";
import type { CanvasDocument } from "./document";
import { EMPTY_CANVAS_SHAPE_DATA, type CanvasShapeData } from "./shape-context";

/**
 * 只读画布渲染器（F1 三用组件）：
 * `[[cv:]]` 引用 Modal / draft 提案预览 / artifact 缩略共用——结构化画布数据纯展示，
 * 无写入。交互仅保留查看（平移 / 缩放），编辑与事件桥全部关闭（interacting: false）。
 * 保证「所见即所存」。
 */
export type CanvasReadOnlyViewProps = {
  document: CanvasDocument;
  /** 卡片展示数据（理解卡全文字段 / 画布引用标题 / 删除占位） */
  shapeData?: CanvasShapeData;
  className?: string;
  style?: React.CSSProperties;
};

export function CanvasReadOnlyView({
  document,
  shapeData = EMPTY_CANVAS_SHAPE_DATA,
  className,
  style,
}: CanvasReadOnlyViewProps) {
  return (
    <CanvasGraph
      readonly
      document={document}
      shapeData={shapeData}
      className={className}
      style={style}
    />
  );
}
