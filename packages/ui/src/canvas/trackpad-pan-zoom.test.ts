// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { applyWheelToInnerScroll, panDelta, zoomFactorFor } from "./trackpad-pan-zoom";

describe("zoomFactorFor", () => {
  test("向下/远离滚动（delta 正）→ zoom out（因子 < 1）", () => {
    expect(zoomFactorFor(10)).toBeLessThan(1);
    expect(zoomFactorFor(1)).toBeLessThan(1);
  });
  test("向上/靠近滚动（delta 负）→ zoom in（因子 > 1）", () => {
    expect(zoomFactorFor(-10)).toBeGreaterThan(1);
  });
  test("clamp 到 ±10：鼠标大 delta（如 120）不再放大单步", () => {
    expect(zoomFactorFor(120)).toBe(zoomFactorFor(10));
    expect(zoomFactorFor(-500)).toBe(zoomFactorFor(-10));
  });
  test("0 不缩放", () => {
    expect(zoomFactorFor(0)).toBe(1);
  });
});

describe("panDelta", () => {
  test("滚动下（dy>0）→ 内容上移（ty 减小）", () => {
    expect(panDelta(0, 10)).toEqual({ tx: 0, ty: -10 });
  });
  test("向右滚动（dx>0）→ 内容左移（tx 减小）", () => {
    expect(panDelta(5, 0)).toEqual({ tx: -5, ty: 0 });
  });
  test("双向独立叠加", () => {
    expect(panDelta(3, -4)).toEqual({ tx: -3, ty: 4 });
  });
});

function mountCard(opts: {
  selected: boolean;
  scrollTop?: number;
  clientHeight?: number;
  scrollHeight?: number;
}) {
  const card = document.createElement("div");
  card.setAttribute("data-testid", "canvas-understanding-card");
  if (opts.selected) card.setAttribute("data-canvas-selected", "true");
  const title = document.createElement("div");
  title.className = "card-title";
  const scroller = document.createElement("div");
  scroller.className = "nowheel";
  let scrollTop = opts.scrollTop ?? 0;
  let scrollLeft = 0;
  Object.defineProperties(scroller, {
    scrollTop: {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
      configurable: true,
    },
    scrollLeft: {
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
      configurable: true,
    },
    clientHeight: { configurable: true, value: opts.clientHeight ?? 80 },
    scrollHeight: { configurable: true, value: opts.scrollHeight ?? 400 },
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 200 },
  });
  const body = document.createElement("p");
  scroller.append(body);
  card.append(title, scroller);
  document.body.append(card);
  return { card, title, scroller, body };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("applyWheelToInnerScroll", () => {
  test("未选中卡片：滚轮不消费，交给画布平移", () => {
    const { body, scroller } = mountCard({ selected: false });
    expect(applyWheelToInnerScroll({ target: body }, 0, 40)).toBe(false);
    expect(scroller.scrollTop).toBe(0);
  });

  test("选中且内容溢出：光标在卡片正文上，滚轮滚卡片而不是画布", () => {
    const { body, scroller } = mountCard({ selected: true, scrollTop: 0 });
    expect(applyWheelToInnerScroll({ target: body }, 0, 40)).toBe(true);
    expect(scroller.scrollTop).toBe(40);
  });

  test("选中且内容溢出：光标在标题上，同样滚卡片 overflow", () => {
    const { title, scroller } = mountCard({ selected: true, scrollTop: 10 });
    expect(applyWheelToInnerScroll({ target: title }, 0, 24)).toBe(true);
    expect(scroller.scrollTop).toBe(34);
  });

  test("已经滚到尽头：仍然消费，不让画布平移", () => {
    const { body } = mountCard({
      selected: true,
      scrollTop: 320,
      clientHeight: 80,
      scrollHeight: 400,
    });
    expect(applyWheelToInnerScroll({ target: body }, 0, 40)).toBe(true);
  });

  test("Cmd/Ctrl+滚轮留给画布缩放，不滚卡片", () => {
    const { body, scroller } = mountCard({ selected: true });
    expect(applyWheelToInnerScroll({ target: body, metaKey: true }, 0, 40)).toBe(false);
    expect(applyWheelToInnerScroll({ target: body, ctrlKey: true }, 0, 40)).toBe(false);
    expect(scroller.scrollTop).toBe(0);
  });
});
