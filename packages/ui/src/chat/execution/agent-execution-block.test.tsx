// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { AgentExecutionBlock } from "./agent-execution-block";
import type { AgentExecutionBlockView } from "./types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function block(status: "running" | "done"): AgentExecutionBlockView {
  return {
    kind: "tool-activity",
    activity: {
      id: "tool-1",
      status,
      summary: status === "running" ? "正在读取「stream.ts」" : "读取了「stream.ts」 · offset=1",
      items: [
        {
          id: "tool-1",
          label: "读取文件",
          ...(status === "done"
            ? {
                details: {
                  rows: [
                    {
                      id: "tool-1:row:0",
                      label: "文件",
                      title: "stream.ts",
                      content: { format: "text", value: "DETAIL_CONTENT" },
                    },
                  ],
                },
              }
            : {}),
        },
      ],
    },
  };
}

describe("AgentExecutionBlock", () => {
  test("preserves activity identity from running to terminal snapshot", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<AgentExecutionBlock block={block("running")} />));
    const activity = container?.querySelector('[data-activity-id="tool-1"]');

    act(() => root?.render(<AgentExecutionBlock block={block("done")} />));

    expect(container?.querySelector('[data-activity-id="tool-1"]')).toBe(activity);
    expect(container?.textContent).toContain("读取了「stream.ts」");
  });

  test("renders a tool as one non-expandable status row", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<AgentExecutionBlock block={block("done")} />));

    const activity = container?.querySelector('[data-testid="agent-tool-activity"]');
    expect(activity?.querySelector('[data-slot="agent-tool-target"]')?.textContent).toBe(
      "「stream.ts」",
    );
    expect(
      activity?.querySelector('[data-slot="agent-tool-target"]')?.classList.contains("font-medium"),
    ).toBe(true);
    expect(activity?.querySelector('[data-slot="agent-tool-meta"]')?.textContent).toBe(
      "· offset=1",
    );
    expect(activity?.querySelector(".sr-only")?.textContent).toBe("完成");
    expect(activity?.querySelector("button")).toBeNull();
    expect(activity?.textContent).not.toContain("DETAIL_CONTENT");
  });
});
