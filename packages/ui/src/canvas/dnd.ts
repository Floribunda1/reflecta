import type { CanvasElementDTO } from "./document";

/**
 * HTML5 DnD 的 dataTransfer.getData() 只在 drop 阶段可读，dragover 时只有
 * dataTransfer.types 可读，读不到 payload。因此拖入预览所需的尺寸 / 颜色 / kind
 * 由拖拽源（工具栏 / 理解库）在 dragstart 时写入此暂存，画布在 dragover 时读取。
 * drop 后 / 拖拽取消时由源清除。单一画布工作区场景下模块级暂存足够。
 */
let pendingElement: CanvasElementDTO | null = null;

export function setDndElement(element: CanvasElementDTO | null): void {
  pendingElement = element;
}

export function getDndElement(): CanvasElementDTO | null {
  return pendingElement;
}
