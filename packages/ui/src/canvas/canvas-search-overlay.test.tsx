// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CanvasSearchOverlay } from "./canvas-search-overlay";
import { typicalSearchIndex } from "./canvas-story-fixtures";

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

function renderOverlay(overrides: Partial<Parameters<typeof CanvasSearchOverlay>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  act(() =>
    root.render(
      <CanvasSearchOverlay
        index={typicalSearchIndex}
        onSelect={onSelect}
        onClose={onClose}
        {...overrides}
      />,
    ),
  );
  return { onSelect, onClose };
}

describe("CanvasSearchOverlay", () => {
  test("opens as a dialog and lists canvas items", () => {
    renderOverlay();
    expect(document.querySelector("[data-slot='dialog-content']")).not.toBeNull();
    expect(document.querySelector('[data-testid="canvas-search-overlay"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="canvas-search-input"]')).not.toBeNull();
    const results = [...document.querySelectorAll('[data-testid="canvas-search-result"]')].map(
      (node) => node.textContent ?? "",
    );
    expect(results.some((text) => text.includes("夜班观察"))).toBe(true);
    expect(results.some((text) => text.includes("夜班联调画布"))).toBe(true);
  });

  test("selecting a result reports that item id", () => {
    const { onSelect } = renderOverlay();
    const result = [...document.querySelectorAll('[data-testid="canvas-search-result"]')].find(
      (node) => node.textContent?.includes("夜班观察"),
    );
    expect(result).toBeDefined();
    act(() => (result as HTMLElement).click());
    expect(onSelect).toHaveBeenCalledWith("el-group");
  });

  test("closing the dialog reports onClose", () => {
    const { onClose } = renderOverlay();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
