// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AgentActivityGroup } from "./agent-activity-group";

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

test("appends a live clock while the activity group is running", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-23T00:00:03.200Z"));
  act(() => {
    root!.render(
      <AgentActivityGroup
        blocks={[
          {
            kind: "reasoning",
            reasoning: {
              id: "r-stream",
              status: "streaming",
              markdown: "先核对现场数据。",
              createdAt: "2026-06-23T00:00:00.000Z",
            },
          },
        ]}
      />,
    );
  });
  act(() => {
    vi.advanceTimersByTime(100);
  });

  const trigger = container?.querySelector('[data-testid="agent-activity-group-trigger"]');
  expect(trigger?.textContent).toContain("思考中");
  expect(trigger?.textContent).toContain("共 1 步");
  expect(trigger?.textContent).toMatch(/\d+(\.\d+)?s/);
  expect(trigger?.querySelector(".font-mono")).not.toBeNull();
});

test("renders completed tool count in mono numerals", () => {
  act(() => {
    root!.render(
      <AgentActivityGroup
        blocks={[
          {
            kind: "reasoning",
            reasoning: {
              id: "r-done",
              status: "done",
              markdown: "已确认边界。",
              createdAt: "2026-06-23T00:00:00.000Z",
            },
          },
          {
            kind: "tool-activity",
            activity: {
              id: "tool-1",
              toolName: "read",
              status: "done",
              summary: "读取了文件",
              items: [],
              createdAt: "2026-06-23T00:00:03.200Z",
            },
          },
        ]}
        endedAt="2026-06-23T00:00:04.000Z"
      />,
    );
  });

  const trigger = container?.querySelector('[data-testid="agent-activity-group-trigger"]');
  expect(trigger?.textContent).toContain("运行了");
  expect(trigger?.textContent).toContain("1");
  expect(trigger?.textContent).toContain("个工具");
  const mono = Array.from(trigger?.querySelectorAll(".font-mono") ?? []).map(
    (node) => node.textContent,
  );
  expect(mono).toContain("1");
  expect(mono.some((text) => text?.includes("s"))).toBe(true);
});
