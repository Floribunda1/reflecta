// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentEntityCatalogEntry, AgentReducedMessage } from "@shared/agent";
import { activateChatFindMarker, chatFindMarkers } from "./chat-find-highlight";
import { MessageList } from "./message-list";

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
  entityCatalog,
  onInspectContextRef = vi.fn(),
  findQuery,
}: {
  messages: AgentReducedMessage[];
  entityCatalog: AgentEntityCatalogEntry[];
  onInspectContextRef?: (ref: {
    type: "understanding" | "context";
    id: string;
    title?: string;
  }) => void;
  findQuery?: string;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MessageList
        messages={messages}
        entityCatalog={entityCatalog}
        isBusy={false}
        stoppedMessageId={null}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onApproveTool={vi.fn()}
        onInspectContextRef={onInspectContextRef}
        findQuery={findQuery}
      />,
    );
  });
}

function rerenderMessageList({
  messages,
  entityCatalog,
  findQuery,
}: {
  messages: AgentReducedMessage[];
  entityCatalog: AgentEntityCatalogEntry[];
  findQuery?: string;
}) {
  act(() => {
    root?.render(
      <MessageList
        messages={messages}
        entityCatalog={entityCatalog}
        isBusy={false}
        stoppedMessageId={null}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onApproveTool={vi.fn()}
        findQuery={findQuery}
      />,
    );
  });
}

describe("MessageList entity refs", () => {
  test("shows approved tool execution failures instead of confirmed state", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "",
          runId: "run_1",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "approval",
              approvalId: "approval_tool_1",
              toolCallId: "tool_1",
              toolName: "bash",
              title: "执行 Bash",
              payload: { command: "printf hello" },
              approved: true,
              state: "failed",
              error: "Domain not found: domain_1",
              approvalState: "approved",
              executionState: "failed",
              displayState: "failed",
              executionError: { message: "Domain not found: domain_1" },
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    const card = container?.querySelector('[data-testid="agent-proposal-card"]');
    expect(card?.textContent).toContain("执行失败");
    expect(card?.textContent).toContain("Domain not found: domain_1");
    expect(card?.textContent).not.toContain("已确认");
  });

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
      entityCatalog: [],
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
      entityCatalog: [],
      findQuery: "find",
    });

    const marks = container?.querySelectorAll('[data-chat-find-match="true"]');
    expect(marks).toHaveLength(2);
    activateChatFindMarker(container, { messageId: "user_1", matchIndex: 1 });
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
      entityCatalog: [],
      findQuery: "find",
    });

    expect(container?.querySelectorAll('[data-chat-find-match="true"]')).toHaveLength(2);
    activateChatFindMarker(container, { messageId: "assistant_1", matchIndex: 1 });
    expect(
      container
        ?.querySelector('[data-chat-find-active="true"]')
        ?.getAttribute("data-chat-find-match-index"),
    ).toBe("1");
  });

  test("adds assistant search highlights after messages already rendered", () => {
    const messages: AgentReducedMessage[] = [
      {
        id: "assistant_1",
        role: "assistant",
        text: "用户先出现，用户再出现",
        createdAt: "2026-06-26T00:00:00.000Z",
        blocks: [
          {
            kind: "text",
            text: "用户先出现，用户再出现",
            createdAt: "2026-06-26T00:00:00.000Z",
          },
        ],
      },
    ];

    renderMessageList({ messages, entityCatalog: [] });
    expect(container?.querySelector('[data-chat-find-match="true"]')).toBeNull();

    rerenderMessageList({
      messages,
      entityCatalog: [],
      findQuery: "用户",
    });

    expect(container?.querySelectorAll('[data-chat-find-match="true"]')).toHaveLength(2);
  });

  test("reads search matches in rendered DOM order", () => {
    container = document.createElement("div");
    container.innerHTML = `
      <mark data-chat-find-match="true" data-chat-find-message-id="message_2" data-chat-find-match-index="0"></mark>
      <mark data-chat-find-match="true" data-chat-find-message-id="message_1" data-chat-find-match-index="3"></mark>
    `;

    expect(chatFindMarkers(container)).toEqual([
      { messageId: "message_2", matchIndex: 0 },
      { messageId: "message_1", matchIndex: 3 },
    ]);
  });

  test("keeps search highlights inside rendered wiki chips", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "关联 [[用户需求#u1]]",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "关联 [[用户需求#u1]]",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
      findQuery: "用户",
    });

    const chip = container?.querySelector('[data-slot="wiki-link"]');
    activateChatFindMarker(container, { messageId: "assistant_1", matchIndex: 0 });
    const mark = chip?.querySelector('[data-chat-find-active="true"]');
    expect(mark?.textContent).toBe("用户");
    expect(mark?.getAttribute("data-chat-find-match")).toBe("true");
  });

  test("does not render typed assistant entity refs from plain markdown", () => {
    const onInspectContextRef = vi.fn();
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "见 [[context:ctx_1]]",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "见 [[context:ctx_1]]",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
      onInspectContextRef,
    });

    const chip = container?.querySelector<HTMLButtonElement>('[data-slot="wiki-link"]');
    expect(chip).toBeNull();
    expect(container?.textContent).toContain("[[context:ctx_1]]");
    expect(onInspectContextRef).not.toHaveBeenCalled();
  });

  test("renders valid numbered citations as inline Reflecta links", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "这个理解适合放在三观下面 [1]。AI 只是普通文本。",
          createdAt: "2026-07-01T00:00:00.000Z",
          citationSources: [
            {
              index: 1,
              entity: { type: "domain", id: "domain_1", title: "三观" },
              origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
            },
          ],
          blocks: [
            {
              kind: "text",
              text: "这个理解适合放在三观下面 [1]。AI 只是普通文本。",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    const chips = container?.querySelectorAll('[data-slot="wiki-link"]');
    expect(chips).toHaveLength(1);
    expect(chips?.[0]?.textContent).toContain("三观");
    expect(container?.textContent).toContain("AI 只是普通文本");
    expect(container?.textContent).not.toContain("domain_1");
  });

  test("renders markdown around numbered citation links", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "## 标题\n\n### 小节 [2]\n\n- **重点**",
          createdAt: "2026-07-01T00:00:00.000Z",
          citationSources: [
            {
              index: 2,
              entity: { type: "understanding", id: "understanding_1", title: "用户需求" },
              origin: {
                kind: "tool_result",
                toolCallId: "tool_1",
                toolName: "understanding_search",
              },
            },
          ],
          blocks: [
            {
              kind: "text",
              text: "## 标题\n\n### 小节 [2]\n\n- **重点**",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    expect(container?.querySelector("h2")?.textContent).toContain("标题");
    expect(container?.querySelector("h3")?.textContent).toContain("用户需求");
    expect(container?.querySelector('li [data-streamdown="strong"]')?.textContent).toBe("重点");
    expect(container?.querySelector('[data-slot="wiki-link"]')?.textContent).toContain("用户需求");
  });

  test("leaves unknown and code-formatted citation markers as plain text", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "有效 [1] 未知 [999] `代码 [1]`\n\n```txt\n[1]\n```",
          createdAt: "2026-07-01T00:00:00.000Z",
          citationSources: [
            {
              index: 1,
              entity: { type: "domain", id: "domain_1", title: "三观" },
              origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
            },
          ],
          blocks: [
            {
              kind: "text",
              text: "有效 [1] 未知 [999] `代码 [1]`\n\n```txt\n[1]\n```",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    expect(container?.querySelectorAll('[data-slot="wiki-link"]')).toHaveLength(1);
    expect(container?.textContent).toContain("[999]");
    expect(container?.querySelector("code")?.textContent).toContain("[1]");
  });

  test("leaves raw legacy entity ref strings as plain text", () => {
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: '放在三观下面 <entity_ref type="domain" entityId="domain_ai" />',
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: '放在三观下面 <entity_ref type="domain" entityId="domain_ai" />',
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    expect(container?.querySelector('[data-slot="wiki-link"]')).toBeNull();
    expect(container?.textContent).toContain("<entity_ref");
    expect(container?.textContent).toContain("domain_ai");
  });
});
