import type { CanvasElementDTO, Viewport } from "@reflecta/server";

/**
 * 画布线框 · 视口 / 几何数学（纯函数，便于单测与复用）。
 * 模型：screen = world * zoom + (viewport.x, viewport.y)；
 * CSS 变换 `translate(viewport.x, viewport.y) scale(zoom)`（transform-origin: 0 0）。
 */
export type WorldRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;

export function elementRect(element: CanvasElementDTO): WorldRect {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

export function worldToScreenX(worldX: number, viewport: Viewport): number {
  return worldX * viewport.zoom + viewport.x;
}

export function worldToScreenY(worldY: number, viewport: Viewport): number {
  return worldY * viewport.zoom + viewport.y;
}

export function screenToWorldX(screenX: number, viewport: Viewport): number {
  return (screenX - viewport.x) / viewport.zoom;
}

export function screenToWorldY(screenY: number, viewport: Viewport): number {
  return (screenY - viewport.y) / viewport.zoom;
}

/** 以屏幕点 (cx, cy) 为锚缩放：保持光标下的世界点不动。 */
export function zoomAt(cx: number, cy: number, zoom: number, viewport: Viewport): Viewport {
  const zoomed = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const wx = screenToWorldX(cx, viewport);
  const wy = screenToWorldY(cy, viewport);
  return { x: cx - wx * zoomed, y: cy - wy * zoomed, zoom: zoomed };
}

export function zoomAtCenter(
  zoom: number,
  viewport: Viewport,
  containerW: number,
  containerH: number,
): Viewport {
  return zoomAt(containerW / 2, containerH / 2, zoom, viewport);
}

/** 所有元素（含组内子元素）的外接矩形。 */
export function contentBounds(
  elements: readonly CanvasElementDTO[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of elements) {
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(maxX, element.x + element.width);
    maxY = Math.max(maxY, element.y + element.height);
  }
  return { minX, minY, maxX, maxY };
}

/** 计算「适应内容」视口：内容居中，缩放取最小方向，上限 1.25x。 */
export function fitViewport(
  containerW: number,
  containerH: number,
  elements: readonly CanvasElementDTO[],
): Viewport {
  const bounds = contentBounds(elements);
  if (!bounds) return { x: 40, y: 40, zoom: 1 };
  const padding = 120;
  const availW = Math.max(containerW - padding * 2, 120);
  const availH = Math.max(containerH - padding * 2, 120);
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const zoom = Math.min(availW / contentW, availH / contentH, 1.25, MAX_ZOOM);
  const x = (containerW - contentW * zoom) / 2 - bounds.minX * zoom;
  const y = (containerH - contentH * zoom) / 2 - bounds.minY * zoom;
  return { x, y, zoom };
}

/** 从点 from 指向矩形 rect 中心，取该射线与 rect 边框的交点（连线端点不藏进卡片）。 */
export function rectBorderPoint(
  rect: WorldRect,
  from: { x: number; y: number },
): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = cx - from.x;
  const dy = cy - from.y;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  // 参数化：|dx*t| = halfW 或 |dy*t| = halfH，取较小的 t（先到边）
  const t = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy),
  );
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/** 连线两端锚点：源矩形边框 → 目标矩形边框（沿中心连线方向）。 */
export function edgeAnchors(
  source: WorldRect,
  target: WorldRect,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const start = rectBorderPoint(source, targetCenter);
  const end = rectBorderPoint(target, sourceCenter);
  return { start, end };
}

/** 曲线连线：二次贝塞尔，控制点在中点 + 垂直于连线方向的偏移。 */
export function curvePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  bend = 0.35,
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const mx = start.x + dx / 2;
  const my = start.y + dy / 2;
  const ox = -dy * bend;
  const oy = dx * bend;
  return `M ${start.x} ${start.y} Q ${mx + ox} ${my + oy} ${end.x} ${end.y}`;
}
