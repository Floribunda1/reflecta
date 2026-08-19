// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { canvasPaintColor, CanvasColorSwatches } from "./color-swatches";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("canvasPaintColor", () => {
  test("maps chart tokens to CSS variables and keeps legacy hex", () => {
    expect(canvasPaintColor("chart-3")).toBe("var(--chart-3)");
    expect(canvasPaintColor("#123456")).toBe("#123456");
    expect(canvasPaintColor(undefined)).toBeUndefined();
  });
});

describe("CanvasColorSwatches", () => {
  test("paints chart tokens on the inner chip so toggle hover cannot cover it", () => {
    const onChange = vi.fn();
    act(() => root.render(<CanvasColorSwatches value="chart-1" onChange={onChange} allowClear />));
    const swatch = container.querySelector<HTMLElement>('[aria-label="chart-1"]')!;
    const chip = swatch.querySelector("span")!;
    expect(chip.className).toContain("bg-chart-1");
    expect(swatch.style.backgroundColor).toBe("");
    act(() => swatch.click());
    expect(onChange).not.toHaveBeenCalled();
    act(() => container.querySelector<HTMLElement>('[aria-label="chart-2"]')!.click());
    expect(onChange).toHaveBeenCalledWith("chart-2");
    act(() => container.querySelector<HTMLElement>('[aria-label="清除颜色"]')!.click());
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
