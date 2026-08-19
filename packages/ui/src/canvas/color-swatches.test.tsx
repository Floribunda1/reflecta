// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CanvasColorSwatches } from "./color-swatches";

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

describe("CanvasColorSwatches", () => {
  test("paints color on the inner chip so toggle hover cannot cover it", () => {
    const onChange = vi.fn();
    act(() => root.render(<CanvasColorSwatches value="#3b82f6" onChange={onChange} allowClear />));
    const swatch = container.querySelector<HTMLElement>('[aria-label="#3b82f6"]')!;
    const chip = swatch.querySelector("span")!;
    expect(chip.style.backgroundColor).toBe("#3b82f6");
    expect(swatch.style.backgroundColor).toBe("");
    expect(chip.className).toContain("group-hover/toggle:ring-foreground");
    act(() => swatch.click());
    expect(onChange).not.toHaveBeenCalled();
    act(() => container.querySelector<HTMLElement>('[aria-label="#22c55e"]')!.click());
    expect(onChange).toHaveBeenCalledWith("#22c55e");
    act(() => container.querySelector<HTMLElement>('[aria-label="清除颜色"]')!.click());
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
