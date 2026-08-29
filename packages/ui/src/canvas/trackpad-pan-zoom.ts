import type { Graph } from "@antv/x6";
import { WheelGestures, type WheelEventState } from "wheel-gestures";

/**
 * Figma 惯例的触控板/滚轮交互：
 *   双指滚动 / 滚轮     → 平移
 *   捏合 / Cmd(⌘)+滚动  → 缩放（光标处为锚点）
 *   光标在已选中卡片内且卡片还能沿该方向滚 → 滚卡片 overflow，不平移画布
 * 内部用 wheel-gestures 归一化 deltaMode（像素/行/页），并接管 wheel 事件，
 * 关掉 X6 内置 mousewheel（它把一切 wheel 当缩放，正是触控板卡顿/异常的来源）。
 *
 * 不耦合主逻辑：插件只通过 graph.translate / graph.zoom 改动视口，
 * 视口外传仍走 CanvasGraph 已有的 `graph.on("translate", emitViewport)`；
 * 程序化 translate 会正常触发 translate 事件，绕开 X6 #4391（触控板不自发事件）。
 */

/** 捏合缩放因子：触控板捏合 delta 仅 0.5~3，鼠标 Cmd+滚轮可达 100+，
 *  统一 clamp 到 ±10 再算连续因子，两者手感一致（鼠标不会飞，捏合不会顿）。 */
export function zoomFactorFor(deltaY: number): number {
  const clamped = Math.max(-10, Math.min(10, deltaY));
  return Math.pow(2, -clamped * 0.01);
}

/** 平移增量：视口随 delta 方向移动（滚动下 → 视口下移 → 内容上移 → translate 减小）。 */
export function panDelta(dx: number, dy: number): { tx: number; ty: number } {
  return { tx: -dx || 0, ty: -dy || 0 };
}

const SELECTED_CARD = "[data-canvas-selected='true']";
const INNER_SCROLL = ".nowheel";

/** 已选中卡片内、还能沿 (dx, dy) 方向滚的 overflow 容器；找不到则画布应接管滚轮。 */
function selectedCardScrollTarget(
  target: EventTarget | null,
  dx: number,
  dy: number,
): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const card = target.closest(SELECTED_CARD);
  if (!(card instanceof HTMLElement)) return null;
  const scroller = card.querySelector<HTMLElement>(INNER_SCROLL);
  if (!scroller) return null;
  return canScrollAlongDelta(scroller, dx, dy) ? scroller : null;
}

/** 把滚轮交给已选中卡片的 overflow 区。消费了则返回 true，调用方不应再平移画布。 */
export function applyWheelToInnerScroll(
  event: { target?: EventTarget | null; ctrlKey?: boolean; metaKey?: boolean },
  dx: number,
  dy: number,
): boolean {
  if (event.ctrlKey || event.metaKey) return false;
  const scroller = selectedCardScrollTarget(event.target ?? null, dx, dy);
  if (!scroller) return false;
  scroller.scrollTop += dy;
  scroller.scrollLeft += dx;
  return true;
}

function canScrollAlongDelta(el: HTMLElement, dx: number, dy: number): boolean {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absY >= absX) {
    if (dy > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    if (dy < 0) return el.scrollTop > 0;
    return false;
  }
  if (dx > 0) return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  if (dx < 0) return el.scrollLeft > 0;
  return false;
}

type TrackpadPanZoomLike = {
  name: string;
  init: (graph: Graph) => void;
  dispose: () => void;
};

export function trackpadPanZoomPlugin(): TrackpadPanZoomLike {
  let wg: ReturnType<typeof WheelGestures> | undefined;
  let unobserve: (() => void) | undefined;
  let off: (() => void) | undefined;

  return {
    name: "trackpad",
    init(graph: Graph) {
      // 内置 mousewheel 把滚轮当缩放（Google Maps 风格），与 Figma 惯例冲突 → 关掉
      graph.disableMouseWheel();

      // reverseSign:[false,false,false]：不要反转 x/y（wheel-gestures 默认会取反，会跟我们
      // 按原生 wheel sign 写的 pan/zoom 方向冲突）
      wg = WheelGestures({ preventWheelAction: true, reverseSign: [false, false, false] });
      unobserve = wg.observe(graph.container);
      off = wg.on("wheel", (s) => {
        const [dx, dy] = s.axisDelta; // wheel-gestures 已归一化 deltaMode
        if (applyWheelToInnerScroll(s.event, dx, dy)) return;
        if (s.event.ctrlKey || s.event.metaKey) {
          zoomAt(graph, s, dy);
        } else {
          panBy(graph, dx, dy);
        }
      });
    },
    dispose() {
      off?.();
      unobserve?.();
      wg?.disconnect();
      wg = undefined;
      unobserve = undefined;
      off = undefined;
    },
  };
}

function zoomAt(graph: Graph, s: WheelEventState, deltaY: number) {
  const e = s.event as WheelEvent; // 真实 DOM 事件自带坐标
  // 光标为锚点，坐标系要与 x6 内置 mousewheel 一致：非 scroller 用 clientToGraph
  const hasScroller = !!graph.getPlugin("scroller");
  const point = { x: e.clientX, y: e.clientY };
  const center = hasScroller ? graph.clientToLocal(point) : graph.clientToGraph(point);
  graph.zoom(graph.zoom() * zoomFactorFor(deltaY), { absolute: true, center });
}

function panBy(graph: Graph, dx: number, dy: number) {
  const { tx, ty } = panDelta(dx, dy);
  const t = graph.translate();
  graph.translate(t.tx + tx, t.ty + ty);
}
