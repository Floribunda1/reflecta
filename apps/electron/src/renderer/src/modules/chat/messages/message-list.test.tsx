// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentChatMessage } from "@shared/chat";
import { MessageList } from "./message-list";
import type { InspectableContextRef } from "../context/context-reference";
import type { AgentToolPart } from "./agent-turn-view";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};

function tool(name: string, toolCallId: string, output: Record<string, unknown>): AgentToolPart {
  return {
    type: `tool-${name}`,
    toolCallId,
    state: "output-available",
    input: {},
    output,
  } as AgentToolPart;
}

function approvalTool(
  name: string,
  toolCallId: string,
  input: Record<string, unknown>,
): AgentToolPart {
  return {
    type: `tool-${name}`,
    toolCallId,
    state: "approval-requested",
    input,
    toolMetadata: { kind: "proposal", proposalType: name },
    approval: { id: `approval-${toolCallId}` },
  } as AgentToolPart;
}

function reasoning(text: string): AgentChatMessage["parts"][number] {
  return { type: "reasoning", text, state: "done" };
}

function renderMessageList(
  messages: AgentChatMessage[],
  onInspectContextRef?: (ref: InspectableContextRef) => void,
  { isBusy = false }: { isBusy?: boolean } = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MessageList
        messages={messages}
        isBusy={isBusy}
        stoppedMessageId={null}
        onRetry={noop}
        onEdit={noop}
        onRegenerate={noop}
        onApproveTool={noop}
        onInspectContextRef={onInspectContextRef}
      />,
    );
  });

  return { container, root };
}

describe("MessageList", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
  });

  test("renders user context refs inside the user message bubble", () => {
    const rendered = renderMessageList([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "和我聊聊这个笔记相关的内容" }],
        metadata: {
          contextRefs: [
            {
              type: "thought",
              id: "thought-1",
              title: "热爱是高效前进的强驱动力",
            },
          ],
        },
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    const bubble = container.querySelector('[data-slot="user-message-content"]');
    const mention = bubble?.querySelector('[data-slot="user-context-mention"]');

    expect(bubble?.textContent).toContain("和我聊聊这个笔记相关的内容");
    expect(mention?.textContent).toBe("✦ 热爱是高效前进的强驱动力");
  });

  test("renders time below each message", () => {
    const rendered = renderMessageList([
      {
        id: "user-1",
        role: "user",
        createdAt: "2026-06-21T08:07:00",
        parts: [{ type: "text", text: "你好" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        createdAt: "2026-06-21T08:08:00",
        parts: [{ type: "text", text: "你好，有什么可以帮你？" }],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    const times = [...container.querySelectorAll('[data-slot="message-time"]')].map(
      (element) => element.textContent,
    );

    expect(times).toEqual(["6月21日 08:07:00", "6月21日 08:08:00"]);
  });

  test("keeps composer mentions at their inline position", () => {
    const rendered = renderMessageList([
      {
        id: "user-1",
        role: "user",
        parts: [
          {
            type: "text",
            text: "我想知道热爱是高效前进的强驱动力和交易的关系",
          },
        ],
        metadata: {
          contextRefs: [
            {
              type: "thought",
              id: "thought-1",
              title: "热爱是高效前进的强驱动力",
            },
          ],
          composerContent: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "我想知道 " },
                  {
                    type: "mention",
                    attrs: {
                      id: "thought:thought-1",
                      label: "热爱是高效前进的强驱动力",
                    },
                  },
                  { type: "text", text: " 和交易的关系" },
                ],
              },
            ],
          },
        },
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    const bubble = container.querySelector('[data-slot="user-message-content"]');
    const mention = bubble?.querySelector('[data-slot="user-context-mention"]');

    expect(mention?.textContent).toBe("✦ 热爱是高效前进的强驱动力");
    expect(bubble?.textContent).toContain("我想知道 ✦ 热爱是高效前进的强驱动力 和交易的关系");
  });

  test("uses distinct mention icons for each context type", () => {
    const rendered = renderMessageList([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "比较这些内容" }],
        metadata: {
          contextRefs: [
            { type: "thought", id: "thought-1", title: "一个 Thought" },
            { type: "context", id: "context-1", title: "一条 Context" },
            { type: "category", id: "category-1", title: "一个 Category" },
          ],
        },
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    const labels = [...container.querySelectorAll('[data-slot="user-context-mention"]')].map(
      (element) => element.textContent,
    );

    expect(labels).toEqual(["✦ 一个 Thought", "↳ 一条 Context", "# 一个 Category"]);
  });

  test("opens inspector for thought and context mentions only", () => {
    const onInspect = vi.fn();
    const rendered = renderMessageList(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "比较这些内容" }],
          metadata: {
            contextRefs: [
              { type: "thought", id: "thought-1", title: "一个 Thought" },
              { type: "context", id: "context-1", title: "一条 Context" },
              { type: "category", id: "category-1", title: "一个 Category" },
            ],
          },
        },
      ],
      onInspect,
    );
    root = rendered.root;
    container = rendered.container;

    const mentions = [...container.querySelectorAll('[data-slot="user-context-mention"]')];
    act(() => {
      mentions.forEach((mention) => (mention as HTMLElement).click());
    });

    expect(onInspect).toHaveBeenCalledTimes(2);
    expect(onInspect).toHaveBeenNthCalledWith(1, {
      type: "thought",
      id: "thought-1",
      title: "一个 Thought",
    });
    expect(onInspect).toHaveBeenNthCalledWith(2, {
      type: "context",
      id: "context-1",
      title: "一条 Context",
    });
  });

  test("renders assistant wiki links as inspectable inline widgets", () => {
    const onInspect = vi.fn();
    const rendered = renderMessageList(
      [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "可以关联到 [[自信的状态#thought-1]]。",
            },
          ],
        },
      ],
      onInspect,
    );
    root = rendered.root;
    container = rendered.container;

    const wikiLink = container.querySelector('[data-slot="wiki-link"]') as HTMLElement | null;
    act(() => {
      wikiLink?.click();
    });

    expect(container.textContent).not.toContain("[[自信的状态#thought-1]]");
    expect(wikiLink?.textContent).toBe("✦ 自信的状态");
    expect(onInspect).toHaveBeenCalledWith({
      type: "thought",
      id: "thought-1",
      title: "自信的状态",
    });
  });

  test("renders generic proposal tools as approval cards", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          approvalTool("category_delete", "tool-1", {
            categoryId: "category-1",
          }),
        ],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("候选删除 Category");
    expect(container.textContent).toContain("category-1");
    expect(container.textContent).toContain("确认");
  });

  test("renders tool activity from turn view", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [tool("snapshot_project", "tool-1", {})],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("查看了知识库概览");
    expect(container.textContent).not.toContain("查看知识库概览");
  });

  test("renders a thinking placeholder while the assistant turn is empty", () => {
    const rendered = renderMessageList(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "帮我合并重复的笔记" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [],
        },
      ],
      undefined,
      { isBusy: true },
    );
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("正在思考");
    expect(container.textContent).not.toContain("等待模型输出下一步");
  });

  test("does not duplicate completion badges for a single tool activity", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [tool("search_all", "tool-1", { thoughts: [], contexts: [] })],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent?.match(/完成/g)).toHaveLength(1);
  });

  test("renders rejected proposal outcome explicitly", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-category_delete",
            toolCallId: "tool-1",
            state: "output-denied",
            input: { categoryId: "category-1" },
            toolMetadata: { kind: "proposal", proposalType: "category_delete" },
            approval: { id: "approval-tool-1", approved: false },
          } as AgentToolPart,
        ],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("已拒绝，未写入知识库");
    expect(container.textContent).not.toContain("确认拒绝");
  });

  test("renders approved proposal outcome explicitly", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-category_delete",
            toolCallId: "tool-1",
            state: "output-available",
            input: { categoryId: "category-1" },
            output: { resultRefType: "category", resultRefId: "category-1" },
            toolMetadata: { kind: "proposal", proposalType: "category_delete" },
            approval: { id: "approval-tool-1", approved: true },
          } as AgentToolPart,
        ],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("已确认");
    expect(container.textContent).toContain("已写入 category · category-1");
    expect(container.textContent).not.toContain("待确认");
  });

  test("renders approval responded proposal state", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-category_delete",
            toolCallId: "tool-1",
            state: "approval-responded",
            input: { categoryId: "category-1" },
            toolMetadata: { kind: "proposal", proposalType: "category_delete" },
            approval: { id: "approval-tool-1", approved: true },
          } as AgentToolPart,
        ],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("已确认");
    expect(container.textContent).not.toContain("确认拒绝");
  });

  test("renders reasoning in the original assistant part order", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          tool("snapshot_project", "tool-1", {}),
          reasoning("我会先看知识库概览，再组织回答。"),
          { type: "text", text: "这是回答。" },
        ],
      },
    ]);
    root = rendered.root;
    container = rendered.container;
    const view = rendered.container;

    act(() => {
      view
        .querySelectorAll('[data-slot="collapsible-trigger"]')
        .forEach((trigger) => (trigger as HTMLElement).click());
    });

    const content = view.textContent ?? "";
    expect(content.indexOf("查看了知识库概览")).toBeLessThan(content.indexOf("我会先看知识库概览"));
    expect(content.indexOf("我会先看知识库概览")).toBeLessThan(content.indexOf("这是回答"));
  });

  test("collapses reasoning and tool activity by default", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          tool("snapshot_project", "tool-1", {}),
          reasoning("我会先看知识库概览，再组织回答。"),
        ],
      },
    ]);
    root = rendered.root;
    container = rendered.container;

    expect(container.textContent).toContain("查看了知识库概览");
    expect(container.textContent).toContain("思考过程");
    expect(container.textContent).not.toContain("查看知识库概览");
    expect(container.textContent).not.toContain("我会先看知识库概览");
  });

  test("uses a muted compact style for reasoning content", () => {
    const rendered = renderMessageList([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [reasoning("我会先看知识库概览，再组织回答。")],
      },
    ]);
    root = rendered.root;
    container = rendered.container;
    const view = rendered.container;

    act(() => {
      (view.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement | null)?.click();
    });

    const reasoningBody = view.querySelector(
      '[data-slot="agent-reasoning"] .reflecta-chat-markdown',
    );
    expect(reasoningBody?.className).toContain("!text-[13px]");
    expect(reasoningBody?.className).toContain("!text-muted-foreground");
  });
});
