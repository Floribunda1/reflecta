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
  test("preserves row and block identity across streaming snapshots", () => {
    const first = render(streamingRow("正在生成"));
    const row = first.querySelector('[data-agent-message-id="assistant-1"]');
    const block = first.querySelector('[data-block-id="assistant-1:text:0"]');

    const next = render(streamingRow("正在生成 **完整内容**", true));

    expect(next.querySelector('[data-agent-message-id="assistant-1"]')).toBe(row);
    expect(next.querySelector('[data-block-id="assistant-1:text:0"]')).toBe(block);
    expect(next.textContent).toContain("完整内容");
  });

  test("renders search markers without changing block identity", () => {
    const first = render(streamingRow("流式内容，继续流式"));
    const block = first.querySelector('[data-block-id="assistant-1:text:0"]');
    const next = render(streamingRow("流式内容，继续流式"), "流式");

    expect(next.querySelector('[data-block-id="assistant-1:text:0"]')).toBe(block);
    expect(next.querySelectorAll('[data-chat-find-match="true"]')).toHaveLength(2);
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

  test("keeps a continuous working signal between completed agent steps", () => {
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
              items: [],
            },
          },
        ],
      },
    });

    expect(next.querySelector('[data-testid="agent-activity-group"]')).not.toBeNull();
    expect(next.querySelector('[data-slot="agent-working-indicator"]')).not.toBeNull();
    expect(next.querySelector('[data-testid="agent-running-placeholder"]')).toBeNull();
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
