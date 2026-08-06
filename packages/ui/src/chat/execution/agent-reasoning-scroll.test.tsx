// @vitest-environment happy-dom
// Reasoning (Thinking) block scroll behavior: capped height with internal
// scroll, auto-follow to the bottom while streaming, and pause/resume based
// on whether the user scrolled away from the bottom.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { AgentExecutionBlock } from "./agent-execution-block";
import type { AgentExecutionBlockView } from "./types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

class ImmediateIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);

function reasoningBlock(markdown: string, streaming = true): AgentExecutionBlockView {
  return {
    kind: "reasoning",
    reasoning: { id: "r1", status: streaming ? "streaming" : "done", markdown },
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function renderBlock(block: AgentExecutionBlockView) {
  act(() => root!.render(<AgentExecutionBlock block={block} />));
}

function openReasoning() {
  act(() => {
    container?.querySelector<HTMLButtonElement>('[data-testid="agent-reasoning"] button')?.click();
  });
}

function scroller(): HTMLElement | null {
  return container?.querySelector<HTMLElement>('[data-testid="agent-reasoning-scroll"]') ?? null;
}

// happy-dom has no layout, so pin the measured metrics the scroll logic reads.
function mockLayout(element: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
}

function scrollTo(element: HTMLElement, scrollTop: number) {
  element.scrollTop = scrollTop;
  act(() => {
    element.dispatchEvent(new Event("scroll"));
  });
}

test("caps expanded reasoning height and enables internal scrolling", () => {
  renderBlock(reasoningBlock("## Plan\n\n详细分析用户意图，先检查现有实现。"));
  openReasoning();
  const element = scroller();
  expect(element).not.toBeNull();
  expect(element?.className).toContain("max-h-96");
  expect(element?.className).toContain("overflow-y-auto");
});

test("sticks to the bottom while streaming and pauses when scrolled up", () => {
  renderBlock(reasoningBlock("第一段"));
  openReasoning();
  const element = scroller()!;
  mockLayout(element, 600, 200);
  element.scrollTop = 0;

  // New token arrives while expanded → follow to the bottom.
  renderBlock(reasoningBlock("第一段，新的 token"));
  expect(element.scrollTop).toBe(600);

  // User scrolls up → pause following; streaming must not yank the viewport.
  mockLayout(element, 800, 200);
  scrollTo(element, 120);
  renderBlock(reasoningBlock("第一段，新的 token，继续输出"));
  expect(element.scrollTop).toBe(120);

  // User returns to the bottom → resume following.
  mockLayout(element, 900, 200);
  scrollTo(element, 700); // 900 - 700 - 200 = 0, within threshold
  renderBlock(reasoningBlock("第一段，新的 token，继续输出，更多内容"));
  expect(element.scrollTop).toBe(900);
});
