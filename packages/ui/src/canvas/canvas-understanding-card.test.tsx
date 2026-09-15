// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { CanvasUnderstandingCard } from "./canvas-cards";

/** happy-dom 不提供 ResizeObserver：只截获回调，用来验证「量到的高度回报给画布」这条线。 */
const observers = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
}));

class FakeResizeObserver {
  constructor(private readonly callback: () => void) {}
  observe() {
    observers.callbacks.push(this.callback);
  }
  disconnect() {
    observers.callbacks = observers.callbacks.filter((item) => item !== this.callback);
  }
  unobserve() {}
}
globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  observers.callbacks = [];
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

const longTitle = "一个很长很长的理解标题：折叠之后仍然应该完整显示，不能被截断";

/** 正文渲染交给调用方注入：单测不拉起真实 Markdown 渲染链。 */
const PlainMarkdown = ({ value }: { value: string }) => <span>{value}</span>;

function card(overrides: Partial<Parameters<typeof CanvasUnderstandingCard>[0]> = {}) {
  return (
    <CanvasUnderstandingCard
      id="u1"
      title={longTitle}
      body="正文详情正文详情"
      renderMarkdown={PlainMarkdown}
      {...overrides}
    />
  );
}

test("展开态显示正文与折叠按钮，按钮表达展开状态", () => {
  const next = render(card({ onToggleCollapse: () => undefined }));
  const toggle = next.querySelector<HTMLButtonElement>(
    '[data-testid="canvas-understanding-collapse"]',
  );
  expect(
    next.querySelector<HTMLElement>('[data-testid="canvas-understanding-card"]')?.dataset.collapsed,
  ).toBe("false");
  expect(toggle?.tagName).toBe("BUTTON");
  expect(toggle?.getAttribute("type")).toBe("button");
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  expect(next.textContent).toContain("正文详情正文详情");
});

test("折叠态只留完整标题与展开按钮，正文隐藏", () => {
  const onToggleCollapse = vi.fn();
  const next = render(card({ collapsed: true, onToggleCollapse }));
  const toggle = next.querySelector<HTMLButtonElement>(
    '[data-testid="canvas-understanding-collapse"]',
  );
  expect(
    next.querySelector<HTMLElement>('[data-testid="canvas-understanding-card"]')?.dataset.collapsed,
  ).toBe("true");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  expect(toggle?.getAttribute("aria-label")).toBe("展开理解详情");
  // 长标题完整可见（换行而不是截断）
  const title = next.querySelector<HTMLElement>('[data-testid="canvas-understanding-card"] span');
  expect(title?.textContent).toBe(longTitle);
  expect(title?.className).not.toContain("truncate");
  // 正文隐藏
  expect(next.textContent).not.toContain("正文详情正文详情");

  act(() => toggle?.click());
  expect(onToggleCollapse).toHaveBeenCalledTimes(1);
});

test("折叠时把量到的标题行高度（含边框）回报给画布", () => {
  const onCollapsedHeightChange = vi.fn();
  const next = render(card({ collapsed: true, onCollapsedHeightChange }));
  const header = next.querySelector<HTMLElement>('[data-testid="canvas-understanding-card"] > div');
  expect(header).not.toBeNull();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    height: 37,
  } as DOMRect);
  act(() => observers.callbacks.forEach((callback) => callback()));
  expect(onCollapsedHeightChange).toHaveBeenCalledWith(39);
});

test("没有折叠回调的理解卡不出现折叠按钮", () => {
  const next = render(card());
  expect(next.querySelector('[data-testid="canvas-understanding-collapse"]')).toBeNull();
});
