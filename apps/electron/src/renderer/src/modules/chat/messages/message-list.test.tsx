// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentEntitySource, AgentReducedMessage } from "@shared/agent";
import { MessageList } from "./message-list";
import type { ChatFindMatch } from "../session/thread-view";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

function renderMessageList({
  messages,
  entitySources,
  onInspectContextRef = vi.fn(),
  findQuery,
  activeFindMatch,
}: {
  messages: AgentReducedMessage[];
  entitySources: AgentEntitySource[];
  onInspectContextRef?: (ref: {
    type: "understanding" | "context";
    id: string;
    title?: string;
  }) => void;
  findQuery?: string;
  activeFindMatch?: ChatFindMatch | null;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MessageList
        messages={messages}
        entitySources={entitySources}
        isBusy={false}
        stoppedMessageId={null}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onApproveTool={vi.fn()}
        onInspectContextRef={onInspectContextRef}
        findQuery={findQuery}
        activeFindMatch={activeFindMatch}
      />,
    );
  });
}

describe("MessageList entity refs", () => {
  test("preserves paragraph breaks in user messages restored from composer content", () => {
    renderMessageList({
      messages: [
        {
          id: "user_1",
          role: "user",
          text: "第一行\n第二行\n第三行",
          createdAt: "2026-06-26T00:00:00.000Z",
          composerContent: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "第一行" }] },
              { type: "paragraph", content: [{ type: "text", text: "第二行" }] },
              { type: "paragraph", content: [{ type: "text", text: "第三行" }] },
            ],
          },
        },
      ],
      entitySources: [],
    });

    const message = container?.querySelector('[data-testid="agent-user-message"]');
    expect(message?.textContent).toBe("第一行\n第二行\n第三行");
  });

  test("highlights the active user message search occurrence", () => {
    renderMessageList({
      messages: [
        {
          id: "user_1",
          role: "user",
          text: "find first and find second",
          createdAt: "2026-06-26T00:00:00.000Z",
        },
      ],
      entitySources: [],
      findQuery: "find",
      activeFindMatch: { messageId: "user_1", matchIndex: 1, role: "user" },
    });

    const marks = container?.querySelectorAll('[data-chat-find-match="true"]');
    expect(marks).toHaveLength(2);
    expect(container?.querySelector('[data-chat-find-active="true"]')?.textContent).toBe("find");
    expect(
      container
        ?.querySelector('[data-chat-find-active="true"]')
        ?.getAttribute("data-chat-find-match-index"),
    ).toBe("1");
  });

  test("highlights the active assistant markdown search occurrence", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "find first and find second",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "find first and **find** second",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entitySources: [],
      findQuery: "find",
      activeFindMatch: { messageId: "assistant_1", matchIndex: 1, role: "assistant" },
    });

    expect(container?.querySelectorAll('[data-chat-find-match="true"]')).toHaveLength(2);
    expect(
      container
        ?.querySelector('[data-chat-find-active="true"]')
        ?.getAttribute("data-chat-find-match-index"),
    ).toBe("1");
  });

  test("keeps search highlights inside rendered wiki chips", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "关联 [[understanding:用户需求#u1]]",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "关联 [[understanding:用户需求#u1]]",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entitySources: [],
      findQuery: "用户",
      activeFindMatch: { messageId: "assistant_1", matchIndex: 0, role: "assistant" },
    });

    const chip = container?.querySelector('[data-slot="wiki-link"]');
    const mark = chip?.querySelector('[data-chat-find-active="true"]');
    expect(mark?.textContent).toBe("用户");
    expect(mark?.getAttribute("class")).toContain("bg-yellow-200");
  });

  test("renders resolved assistant ref markers as clickable context chips", () => {
    const onInspectContextRef = vi.fn();
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "见 [[ref:S1]]",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "见 [[ref:S1]]",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entitySources: [
        {
          sourceId: "S1",
          entity: { type: "context", id: "ctx_1", title: "一次复盘" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
        },
      ],
      onInspectContextRef,
    });

    const chip = container?.querySelector<HTMLButtonElement>('[data-slot="wiki-link"]');
    expect(chip?.textContent).toContain("一次复盘");
    expect(container?.textContent).not.toContain("[[ref:S1]]");

    act(() => chip?.click());

    expect(onInspectContextRef).toHaveBeenCalledWith({
      type: "context",
      id: "ctx_1",
      title: "一次复盘",
    });
  });
});
