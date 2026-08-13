// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AgentExecutionBlock } from "./agent-execution-block";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

class ImmediateIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);

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
  vi.useRealTimers();
});

function triggerText() {
  return container?.querySelector('[data-testid="agent-reasoning"] button')?.textContent ?? "";
}

test("shows a live thinking label while reasoning streams", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-23T00:00:03.200Z"));
  act(() => {
    root!.render(
      <AgentExecutionBlock
        block={{
          kind: "reasoning",
          reasoning: {
            id: "r-stream",
            status: "streaming",
            markdown: "先核对现场数据。",
            createdAt: "2026-06-23T00:00:00.000Z",
          },
        }}
      />,
    );
  });
  act(() => {
    vi.advanceTimersByTime(100);
  });

  expect(triggerText()).toContain("正在思考...");
  expect(triggerText()).toMatch(/\d+(\.\d+)?s/);
  expect(container?.querySelector('[data-slot="agent-working-indicator"]')).not.toBeNull();
  vi.useRealTimers();
});

test("shows thought duration after reasoning completes", () => {
  act(() => {
    root!.render(
      <AgentExecutionBlock
        block={{
          kind: "reasoning",
          reasoning: {
            id: "r-done",
            status: "done",
            markdown: "先核对现场数据。",
            createdAt: "2026-06-23T00:00:00.000Z",
          },
        }}
        endedAt="2026-06-23T00:00:04.500Z"
      />,
    );
  });

  expect(triggerText()).toContain("思考了");
  expect(triggerText()).toContain("4.5s");
  expect(triggerText()).not.toContain("先核对现场数据");
});
