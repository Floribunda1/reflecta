// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import { edgeStyleToX6 } from "./edge-style";

describe("edgeStyleToX6（M4-7 样式映射）", () => {
  test("默认样式 → 直线 + 实线 + 中粗 + 灰 + 箭头", () => {
    const x6 = edgeStyleToX6(null);
    expect(x6.connector?.name).toBe("normal");
    expect(x6.attrs?.line?.strokeWidth).toBe(2.5);
    expect(x6.attrs?.line?.strokeDasharray).toBe("none");
  });

  test("curve → smooth connector", () => {
    expect(edgeStyleToX6({ routing: "curve" }).connector?.name).toBe("smooth");
  });

  test("orthogonal → manhattan router", () => {
    expect(edgeStyleToX6({ routing: "orthogonal" }).router?.name).toBe("manhattan");
  });

  test("dashed / dotted 线型 → dasharray", () => {
    expect(edgeStyleToX6({ lineStyle: "dashed" }).attrs?.line?.strokeDasharray).toBe("5 5");
    expect(edgeStyleToX6({ lineStyle: "dotted" }).attrs?.line?.strokeDasharray).toBe("2 2");
  });

  test("颜色色板映射（避免魔法色值）", () => {
    expect(edgeStyleToX6({ color: "blue" }).attrs?.line?.stroke).toBe("#3b82f6");
    expect(edgeStyleToX6({ color: "default" }).attrs?.line?.stroke).toBe("#94a3b8");
  });

  test("arrowhead none → 无 targetMarker; block → 内置 block marker", () => {
    expect(edgeStyleToX6({ arrowhead: "none" }).attrs?.line?.targetMarker).toBeUndefined();
    expect(edgeStyleToX6({ arrowhead: "block" }).attrs?.line?.targetMarker).toBe("block");
  });
});
