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

  // 整行 shimmer：状态、分隔点、步数、耗时四段都带 shimmer-text，而非只有「思考中」
  const shimmer = Array.from(trigger?.querySelectorAll(".shimmer-text") ?? []);
  expect(shimmer).toHaveLength(4);
  expect(shimmer.every((node) => (node.textContent ?? "").length > 0)).toBe(true);

  // 耗时前有时钟图标做视觉区分；图标不能进 shimmer span（color: transparent 会隐形）
  const clock = trigger?.querySelector(".lucide-clock");
  expect(clock).not.toBeNull();
  expect(clock?.getAttribute("aria-hidden")).toBe("true");
  expect(clock?.closest(".shimmer-text")).toBeNull();
  const timer = trigger?.querySelector('[role="timer"]');
  expect(timer).not.toBeNull();
  expect(timer?.closest(".shimmer-text")).not.toBeNull();

  // 间距由容器 flex gap 承担（不用文本空格，避免被 white-space 折叠）：running 用 gap-1.5
  const summary = trigger?.querySelector("span.flex.items-center.text-body");
  expect(summary?.className).toContain("gap-1.5");
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

  // 完成态不 shimmer，且保持 gap-0（中文逗号连接不额外拉开间距）
  expect(trigger?.querySelectorAll(".shimmer-text")).toHaveLength(0);
  const summary = trigger?.querySelector("span.flex.items-center.text-body");
  expect(summary?.className).toContain("gap-0");
});
