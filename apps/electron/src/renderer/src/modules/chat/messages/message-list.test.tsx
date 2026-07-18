// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AgentEntityCatalogEntry, AgentReducedMessage } from "@shared/agent";
import { activateChatFindMarker, chatFindMarkers } from "./chat-find-highlight";
import { MessageList } from "./message-list";

const ipcMocks = vi.hoisted(() => ({
  getUnderstandingById: vi.fn(),
  getContextById: vi.fn(),
  getDomainById: vi.fn(),
}));

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: {
    understanding: { getUnderstandingById: ipcMocks.getUnderstandingById },
    context: { getContextById: ipcMocks.getContextById },
    domain: { getDomainById: ipcMocks.getDomainById },
  },
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let queryClient: QueryClient | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  queryClient = null;
  vi.clearAllMocks();
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
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
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
        />
      </QueryClientProvider>,
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
      <QueryClientProvider client={queryClient!}>
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
        />
      </QueryClientProvider>,
    );
  });
}

async function flushEntityQuery() {
  await act(async () => {
    for (let index = 0; index < 3; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

describe("MessageList entity refs", () => {
  test("collapses completed proposal cards until the user expands them", () => {
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
              output: { exitCode: 0, stdout: "hello", stderr: "" },
              approved: true,
              state: "completed",
              approvalState: "approved",
              executionState: "completed",
              displayState: "completed",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    const card = container?.querySelector('[data-testid="agent-proposal-card"]');
    expect(card?.getAttribute("data-proposal-open")).toBe("false");

    act(() => {
      container
        ?.querySelector('[aria-label="展开候选卡片"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(card?.getAttribute("data-proposal-open")).toBe("true");
  });

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

  test("describes a rejected Bash command as not executed", () => {
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
              title: "确认危险 Bash",
              payload: { command: "sudo true" },
              approved: false,
              state: "rejected",
              approvalState: "rejected",
              executionState: "not_started",
              displayState: "rejected",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });

    const card = container?.querySelector('[data-testid="agent-proposal-card"]');
    expect(card?.textContent).toContain("已拒绝，命令未执行");
    expect(card?.textContent).not.toContain("知识库");
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

  test("renders direct citations with the current entity title", async () => {
    ipcMocks.getDomainById.mockResolvedValue({ id: "domain_1", name: "三观" });
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "这个理解适合放在 [[d:domain_1]] 下面。AI 只是普通文本。",
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "这个理解适合放在 [[d:domain_1]] 下面。AI 只是普通文本。",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });
    expect(container?.textContent).toContain("Domain");
    expect(container?.querySelector('button[data-slot="wiki-link"]')).toBeNull();
    await flushEntityQuery();

    const chips = container?.querySelectorAll('[data-slot="wiki-link"]');
    expect(chips).toHaveLength(1);
    expect(chips?.[0]?.textContent).toContain("三观");
    expect(container?.textContent).toContain("AI 只是普通文本");
    expect(container?.textContent).not.toContain("domain_1");
  });

  test("renders all entity types and opens only inspectable citations", async () => {
    ipcMocks.getUnderstandingById.mockResolvedValue({ id: "u_1", title: "反馈循环" });
    ipcMocks.getContextById.mockResolvedValue({ id: "c_1", title: "一次复盘" });
    ipcMocks.getDomainById.mockResolvedValue({ id: "d_1", name: "产品设计" });
    const onInspectContextRef = vi.fn();
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "[[u:u_1]] [[c:c_1]] [[d:d_1]]",
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "[[u:u_1]] [[c:c_1]] [[d:d_1]]",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
      onInspectContextRef,
    });
    await flushEntityQuery();

    expect(container?.textContent).toContain("反馈循环");
    expect(container?.textContent).toContain("一次复盘");
    expect(container?.textContent).toContain("产品设计");
    const buttons = container?.querySelectorAll<HTMLButtonElement>('button[data-slot="wiki-link"]');
    expect(buttons).toHaveLength(2);
    act(() => buttons?.[0]?.click());
    act(() => buttons?.[1]?.click());
    expect(onInspectContextRef).toHaveBeenNthCalledWith(1, {
      type: "understanding",
      id: "u_1",
      title: "反馈循环",
    });
    expect(onInspectContextRef).toHaveBeenNthCalledWith(2, {
      type: "context",
      id: "c_1",
      title: "一次复盘",
    });
  });

  test("shows empty, missing, and failed entity states without enabling them", async () => {
    ipcMocks.getContextById.mockResolvedValue({ id: "empty", title: "" });
    ipcMocks.getDomainById.mockResolvedValue(null);
    ipcMocks.getUnderstandingById.mockRejectedValue(new Error("offline"));
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "[[c:empty]] [[d:missing]] [[u:failed]]",
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "[[c:empty]] [[d:missing]] [[u:failed]]",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });
    await flushEntityQuery();

    expect(container?.textContent).toContain("未命名 Context");
    expect(container?.textContent).toContain("引用不可用");
    expect(container?.textContent).toContain("引用加载失败");
    expect(container?.querySelectorAll('button[data-slot="wiki-link"]')).toHaveLength(1);
  });

  test("refreshes a historical citation when its title changes", async () => {
    let title = "旧标题";
    ipcMocks.getUnderstandingById.mockImplementation(async () => ({ id: "u_1", title }));
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "参考 [[u:u_1]]",
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "参考 [[u:u_1]]",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });
    await flushEntityQuery();
    expect(container?.textContent).toContain("旧标题");

    title = "新标题";
    await act(async () => {
      await queryClient?.invalidateQueries({
        queryKey: ["entity.display", "understanding", "u_1"],
      });
    });
    await flushEntityQuery();
    expect(container?.textContent).toContain("新标题");
    expect(container?.textContent).not.toContain("旧标题");
  });

  test("renders markdown around direct citation links", async () => {
    ipcMocks.getUnderstandingById.mockResolvedValue({ id: "understanding_1", title: "用户需求" });
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "## 标题\n\n### 小节 [[u:understanding_1]]\n\n- **重点**",
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "## 标题\n\n### 小节 [[u:understanding_1]]\n\n- **重点**",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });
    await flushEntityQuery();

    expect(container?.querySelector("h2")?.textContent).toContain("标题");
    expect(container?.querySelector("h3")?.textContent).toContain("用户需求");
    expect(container?.querySelector('li [data-streamdown="strong"]')?.textContent).toBe("重点");
    expect(container?.querySelector('[data-slot="wiki-link"]')?.textContent).toContain("用户需求");
  });

  test("leaves malformed and code-formatted citation markers as plain text", async () => {
    ipcMocks.getDomainById.mockResolvedValue({ id: "domain_1", name: "三观" });
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "有效 [[d:domain_1]] 未知 [[x:unknown]] `代码 [[d:domain_1]]`\n\n```txt\n[[d:domain_1]]\n```",
          createdAt: "2026-07-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "有效 [[d:domain_1]] 未知 [[x:unknown]] `代码 [[d:domain_1]]`\n\n```txt\n[[d:domain_1]]\n```",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        },
      ],
      entityCatalog: [],
    });
    await flushEntityQuery();

    expect(container?.querySelectorAll('[data-slot="wiki-link"]')).toHaveLength(1);
    expect(container?.textContent).toContain("[[x:unknown]]");
    expect(container?.querySelector("code")?.textContent).toContain("[[d:domain_1]]");
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
