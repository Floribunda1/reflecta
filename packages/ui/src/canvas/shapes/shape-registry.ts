import { register } from "@antv/x6-react-shape";
import type { CanvasElementKind } from "../document";
import { CanvasCanvasRefCard } from "./CanvasCanvasRefCard";
import { CanvasGroupNode } from "./CanvasGroupNode";
import { CanvasShapeCard } from "./CanvasShapeCard";
import { CanvasTextCard } from "./CanvasTextCard";
import { CanvasUnderstandingCard } from "./CanvasUnderstandingCard";

/**
 * X6 react-shape 注册（模块级副作用）：kind → shape 名 ↔ 渲染组件。
 * effect: ["data"] —— 元素 DTO 变化（文本 / 组名编辑、锁定）时重渲染；
 * 位置 / 尺寸由 X6 SVG transform 处理，不触发 React 重渲。
 */

export const CANVAS_SHAPE_NAMES = {
  understanding: "canvas-understanding",
  text: "canvas-text",
  shape: "canvas-shape",
  group: "canvas-group",
  canvas_ref: "canvas-canvas-ref",
} as const satisfies Record<CanvasElementKind, string>;

export function shapeNameForKind(kind: CanvasElementKind): string {
  return CANVAS_SHAPE_NAMES[kind];
}

register({
  shape: CANVAS_SHAPE_NAMES.understanding,
  component: CanvasUnderstandingCard,
  effect: ["data"],
});
register({ shape: CANVAS_SHAPE_NAMES.text, component: CanvasTextCard, effect: ["data"] });
register({ shape: CANVAS_SHAPE_NAMES.shape, component: CanvasShapeCard, effect: ["data"] });
register({ shape: CANVAS_SHAPE_NAMES.group, component: CanvasGroupNode, effect: ["data"] });
register({
  shape: CANVAS_SHAPE_NAMES.canvas_ref,
  component: CanvasCanvasRefCard,
  effect: ["data"],
});
