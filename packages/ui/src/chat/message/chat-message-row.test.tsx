// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ChatMessageRow } from "./chat-message-row";
import type { ChatMessageRowView } from "./types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

function render(row: ChatMessageRowView, query?: string) {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => {
    root?.render(<ChatMessageRow row={row} search={query ? { query } : undefined} />);
  });
  return container;
}

function streamingRow(markdown: string, done = false): ChatMessageRowView {
  return {
    message: {
      kind: "assistant",
      id: "assistant-1",
      status: done ? "done" : "streaming",
      blocks: [
        {
          kind: "text",
          id: "assistant-1:text:0",
          status: done ? "done" : "streaming",
          markdown,
        },
      ],
    },
  };
}

describe("ChatMessageRow", () => {
  test("keeps rendered markdown visible when a long response grows", async () => {
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
    const markdown = (count: number) =>
      Array.from({ length: count }, (_, index) => `# section ${index}`).join("\n");
    const first = render(streamingRow(markdown(41), true));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    render(streamingRow(`${markdown(41)}\n`, true));
    expect(first.textContent).toContain("section 40");
    const next = render(streamingRow(markdown(42), true));

    expect(next.textContent).toContain("section 40");
  });

  test("preserves row and block identity across streaming snapshots", () => {
    const first = render(streamingRow("正在生成"));
    const row = first.querySelector('[data-agent-message-id="assistant-1"]');
    const block = first.querySelector('[data-block-id="assistant-1:text:0"]');

    const next = render(streamingRow("正在生成 **完整内容**", true));

    expect(next.querySelector('[data-agent-message-id="assistant-1"]')).toBe(row);
    expect(next.querySelector('[data-block-id="assistant-1:text:0"]')).toBe(block);
    expect(next.textContent).toContain("完整内容");
  });

  test("uses the streaming response itself as the working signal without a trailing loading row", () => {
    const next = render(streamingRow("正在生成"));

    expect(next.querySelector('[data-testid="agent-running-placeholder"]')).toBeNull();
  });

  test("renders search markers without changing block identity", () => {
    const first = render(streamingRow("流式内容，继续流式"));
    const block = first.querySelector('[data-block-id="assistant-1:text:0"]');
    const next = render(streamingRow("流式内容，继续流式"), "流式");

    expect(next.querySelector('[data-block-id="assistant-1:text:0"]')).toBe(block);
    expect(next.querySelectorAll('[data-chat-find-match="true"]')).toHaveLength(2);
  });

  test("renders entity mentions where they occur in user message content", () => {
    const next = render({
      message: {
        kind: "user",
        id: "user-1",
        content: [
          { kind: "text", text: "Before " },
          {
            kind: "entity",
            entity: { type: "understanding", id: "u-1", label: "First idea" },
          },
          { kind: "text", text: " after" },
        ],
      },
    });

    expect(next.querySelector('[data-testid="agent-user-message"]')?.textContent).toBe(
      "Before ✦ First idea after",
    );
  });

  test("emits message actions without performing workflow side effects", () => {
    const onAction = vi.fn();
    const row: ChatMessageRowView = {
      message: { kind: "user", id: "user-1", text: "hello" },
      enabledActions: ["copy", "edit"],
    };
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
    act(() => root?.render(<ChatMessageRow row={row} onAction={onAction} />));
    act(() => container?.querySelector<HTMLButtonElement>('[title="编辑并重发"]')?.click());

    expect(onAction).toHaveBeenCalledWith({ messageId: "user-1", type: "edit" });
  });

  test("keeps a single completed activity expandable while the agent still owns the turn", () => {
    const next = render({
      message: {
        kind: "assistant",
        id: "assistant-1",
        status: "streaming",
        blocks: [
          {
            kind: "tool-activity",
            activity: {
              id: "tool-1",
              toolName: "read",
              status: "done",
              summary: "读取了「journal.md」",
              items: [
                {
                  id: "tool-1:item",
                  label: "读取了「journal.md」",
                  details: {
                    rows: [
                      {
                        id: "tool-1:content",
                        content: { format: "text", value: "只在展开后显示的文件内容" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(next.textContent).not.toContain("只在展开后显示的文件内容");
    act(() =>
      next
        .querySelector<HTMLButtonElement>('[data-testid="agent-activity-group-trigger"]')
        ?.click(),
    );
    act(() =>
      next.querySelector<HTMLButtonElement>('[data-testid="agent-tool-activity"] button')?.click(),
    );
    expect(next.textContent).toContain("只在展开后显示的文件内容");
    expect(next.querySelector('[data-slot="agent-working-indicator"]')).not.toBeNull();
    expect(next.querySelector('[data-testid="agent-running-placeholder"]')).not.toBeNull();
  });

  test("hands ownership to the user while an approval is pending", () => {
    const next = render({
      message: {
        kind: "assistant",
        id: "assistant-1",
        status: "streaming",
        blocks: [
          {
            kind: "proposal",
            proposal: {
              id: "proposal-1",
              kind: "bash",
              title: "执行 Bash",
              lifecycle: "pending",
              decisionEnabled: true,
              content: { command: "bun test" },
            },
          },
        ],
      },
    });

    expect(next.querySelector('[data-slot="agent-working-indicator"]')).toBeNull();
    expect(next.querySelector('[data-testid="agent-running-placeholder"]')).toBeNull();
  });
});
