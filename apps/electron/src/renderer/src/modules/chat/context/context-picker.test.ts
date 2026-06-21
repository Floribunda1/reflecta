// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { nextContextPickerIndex } from "./context-picker";
import { ContextPicker } from "./context-picker";
import type { ContextCandidate } from "./context-mention-lookup";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const candidates: ContextCandidate[] = [
  { type: "thought", id: "thought-1", title: "One" },
  { type: "context", id: "context-1", title: "Two" },
  { type: "category", id: "category-1", title: "Three" },
];

const noop = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

function renderPicker(activeIndex: number) {
  return React.createElement(ContextPicker, {
    candidates,
    query: "",
    onQueryChange: noop,
    onSelect: noop,
    onCancel: noop,
    showInput: false,
    activeIndex,
  });
}

describe("nextContextPickerIndex", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  const scrollIntoView = vi.fn();

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    noop.mockClear();
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  test("moves through candidates with wrapping", () => {
    expect(nextContextPickerIndex(0, 3, 1)).toBe(1);
    expect(nextContextPickerIndex(2, 3, 1)).toBe(0);
    expect(nextContextPickerIndex(0, 3, -1)).toBe(2);
  });

  test("keeps empty lists at zero", () => {
    expect(nextContextPickerIndex(4, 0, 1)).toBe(0);
  });

  test("keeps a single selected command item", () => {
    Element.prototype.scrollIntoView = scrollIntoView;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(renderPicker(2));
    });

    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-selected="true"]')?.textContent).toContain("Three");
  });

  test("scrolls the active item into view", () => {
    Element.prototype.scrollIntoView = scrollIntoView;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(renderPicker(0));
    });
    scrollIntoView.mockClear();

    act(() => {
      root?.render(renderPicker(2));
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});
