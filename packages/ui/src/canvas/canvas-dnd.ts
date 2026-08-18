import { Dnd, Graph, Node } from "@antv/x6";
import type { CanvasElementDTO } from "./document";
import { elementToNodeMeta } from "./graph-document";
import { shapeNameForKind } from "./shapes/shape-registry";

/**
 * 拖入创建（M2-1 工具栏 / 库面板 → 画布）：`dnd.start(节点实例, 鼠标事件)`。
 *
 * 每次拖拽前新建节点实例（元素 id 在拖拽时生成，避免重复落点撞 id）；
 * 落点位置 / 入组（embedding 由 X6 处理，父级在 drop 后写回文档）。
 */
export function createCanvasDndNode(element: CanvasElementDTO): Node {
  return Node.create(elementToNodeMeta(element, shapeNameForKind(element.kind)));
}

export function createCanvasDnd(target: Graph): Dnd {
  return new Dnd({
    target,
    // 落点克隆保留 id：维持「元素 id == X6 cell id」零映射（否则边引用元素时 id 错位）
    getDropNode: (draggingNode) => draggingNode.clone({ keepId: true }),
  });
}

export type { Dnd };
