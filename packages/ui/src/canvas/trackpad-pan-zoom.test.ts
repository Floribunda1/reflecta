import { describe, expect, test } from "vitest";
import { panDelta, zoomFactorFor } from "./trackpad-pan-zoom";

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
