import { describe, expect, test } from "vitest";
import type { AgentReducedAssistantBlock } from "@shared/agent";
import { buildAgentTurnView } from "./agent-turn-view";

function text(text: string): AgentReducedAssistantBlock {
  return { kind: "text", text, createdAt: "2026-06-23T00:00:00.000Z" };
}

function reasoning(text: string): AgentReducedAssistantBlock {
  return { kind: "reasoning", text, createdAt: "2026-06-23T00:00:00.000Z" };
}

function compaction(): AgentReducedAssistantBlock {
  return {
    kind: "context-compaction",
    compaction: {
      id: "compact-1",
      type: "context.compacted",
      sessionId: "session-1",
      runId: "run-1",
      messageId: "assistant-1",
      reason: "overflow",
      summary: "保留当前进度",
      firstKeptEntryId: "entry-kept",
      tokensBefore: 120_000,
      estimatedTokensAfter: 18_000,
      contextWindow: 128_000,
      createdAt: "2026-06-23T00:00:01.000Z",
    },
  };
}

function tool(
  name: string,
  toolCallId: string,
  output: unknown,
  state: "running" | "completed" | "failed" = "completed",
  error?: string,
  input: unknown = {},
): AgentReducedAssistantBlock {
  return {
    kind: "tool",
    toolCallId,
    toolName: name,
    state,
    input,
    output,
    error,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

function proposal(
  name: string,
  toolCallId: string,
  payload: Record<string, unknown>,
  state: "pending" | "approved" | "rejected" | "completed" | "failed" = "pending",
): AgentReducedAssistantBlock {
  const approvalState =
    state === "pending" ? "pending" : state === "rejected" ? "rejected" : "approved";
  const executionState =
    state === "completed"
      ? "completed"
      : state === "failed"
        ? "failed"
        : state === "approved"
          ? "running"
          : "not_started";
  const displayState =
    approvalState === "pending"
      ? "pending_approval"
      : approvalState === "rejected"
        ? "rejected"
        : executionState === "completed"
          ? "completed"
          : executionState === "failed"
            ? "failed"
            : "running";
  return {
    kind: "approval",
    approvalId: `approval-${toolCallId}`,
    toolCallId,
    toolName: name,
    title: name,
    payload,
    approved: state === "approved" || state === "completed",
    state,
    approvalState,
    executionState,
    displayState,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

describe("buildAgentTurnView", () => {
  test("preserves interleaved tool and text order", () => {
    const turn = buildAgentTurnView([
      tool("search", "tool-1", { hits: [{ type: "understanding", understanding: { id: "t1" } }] }),
      reasoning("我先看相关内容"),
      text("first"),
      tool("bash", "tool-2", { exitCode: 0 }),
      text("second"),
    ]);

    expect(turn.blocks.map((block) => block.kind)).toEqual([
      "tool-activity",
      "reasoning",
      "text",
      "tool-activity",
      "text",
    ]);
    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "lookup" },
    });
    expect(turn.blocks[1]).toMatchObject({
      kind: "reasoning",
      reasoning: { text: "我先看相关内容", status: "done" },
    });
    expect(turn.blocks[3]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "other" },
    });
  });

  test("keeps context compaction where it occurred in the turn", () => {
    const turn = buildAgentTurnView([text("压缩前"), compaction(), text("压缩后")]);

    expect(turn.blocks.map((block) => block.kind)).toEqual(["text", "context-compaction", "text"]);
  });

  test("keeps running reasoning content visible", () => {
    const turn = buildAgentTurnView([reasoning("正在比较已有理解")], true);

    expect(turn.blocks).toEqual([
      {
        kind: "reasoning",
        reasoning: { text: "正在比较已有理解", status: "streaming" },
      },
    ]);
  });

  test("marks reasoning done once later tool or text content exists", () => {
    const turn = buildAgentTurnView(
      [
        reasoning("先查找相关内容"),
        tool("search", "tool-1", {
          hits: [{ type: "understanding", understanding: { id: "t1" } }],
        }),
        reasoning("再确认详情"),
        tool("understanding_get", "tool-2", {
          understanding: { id: "t1", title: "Feedback Loop" },
        }),
        text("最终答案开始输出。"),
      ],
      true,
    );

    expect(turn.blocks).toMatchObject([
      { kind: "reasoning", reasoning: { text: "先查找相关内容", status: "done" } },
      { kind: "tool-activity" },
      { kind: "reasoning", reasoning: { text: "再确认详情", status: "done" } },
      { kind: "tool-activity" },
      { kind: "text", text: "最终答案开始输出。" },
    ]);
  });

  test("keeps adjacent tools as separate tool activities", () => {
    const turn = buildAgentTurnView([
      tool("search", "tool-1", {
        hits: [{ type: "understanding", understanding: { id: "t1" } }],
      }),
      tool("understanding_get", "tool-2", { understanding: { id: "t1", title: "A" } }),
      text("answer"),
      tool("context_list", "tool-3", { contexts: [{ id: "c1" }] }),
    ]);

    expect(turn.blocks).toHaveLength(4);
    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        groupType: "lookup",
        items: [expect.objectContaining({ toolName: "search" })],
      },
    });
    expect(turn.blocks[1]).toMatchObject({
      kind: "tool-activity",
      activity: {
        groupType: "lookup",
        items: [expect.objectContaining({ label: "读取了「A」" })],
      },
    });
    expect(turn.blocks[3]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "lookup" },
    });
  });

  test("shows search query and result details in its own tool activity", () => {
    const turn = buildAgentTurnView([
      tool(
        "search",
        "tool-1",
        {
          hits: [
            {
              type: "understanding",
              understanding: { id: "t1", title: "拖延与自我保护" },
              matchedText: "拖延有时是在保护自己",
            },
            { type: "context", context: { id: "c1", title: "复盘片段" }, understandingId: "t1" },
          ],
        },
        "completed",
        undefined,
        { query: "拖延", limit: 5 },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "搜索相关内容",
        status: "done",
        summary: "搜索「拖延」 · 1 条 Understanding / 1 条 Context",
        items: [
          expect.objectContaining({
            label: "搜索「拖延」 · 1 条 Understanding / 1 条 Context",
            status: "done",
            details: {
              meta: [{ label: "查询", value: "拖延" }],
              rows: [
                {
                  label: "Understanding",
                  title: "拖延与自我保护",
                  description: "拖延有时是在保护自己",
                  format: "markdown",
                  meta: [],
                },
                { label: "Context", title: "复盘片段", format: "markdown", meta: [] },
              ],
            },
          }),
        ],
      },
    });
  });

  test("shows concise web access tool lifecycle without duplicating result content", () => {
    const turn = buildAgentTurnView([
      tool("web_search", "tool-1", undefined, "running", undefined, { query: "Pi Agent" }),
      tool("fetch_content", "tool-2", { content: "hidden" }, "completed", undefined, {
        url: "https://example.com/source",
      }),
      tool("get_search_content", "tool-3", { content: "hidden" }, "completed", undefined, {
        responseId: "response-1",
      }),
    ]);

    expect(turn.blocks).toMatchObject([
      {
        kind: "tool-activity",
        activity: {
          groupType: "lookup",
          title: "搜索网页",
          status: "running",
          summary: "正在搜索网页「Pi Agent」",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          groupType: "lookup",
          title: "读取来源",
          status: "done",
          summary: "已读取来源",
          items: [
            expect.objectContaining({
              details: {
                meta: [{ label: "来源", value: "https://example.com/source" }],
                rows: [],
              },
            }),
          ],
        },
      },
      {
        kind: "tool-activity",
        activity: {
          groupType: "lookup",
          title: "读取搜索内容",
          status: "done",
          summary: "已读取搜索内容",
        },
      },
    ]);
  });

  test("shows restored peripheral tool details", () => {
    const turn = buildAgentTurnView([
      tool(
        "attachment_read",
        "tool-1",
        {
          attachmentId: "att-pdf",
          filename: "fixture.pdf",
          kind: "pdf",
          totalPages: 1,
          content: "PDF body",
          truncated: false,
        },
        "completed",
        undefined,
        { attachmentId: "att-pdf" },
      ),
      tool(
        "read",
        "tool-2",
        {
          content: "hello",
          truncated: false,
        },
        "completed",
        undefined,
        { path: "/tmp/note.txt" },
      ),
      tool(
        "bash",
        "tool-3",
        { command: "printf hello", exitCode: 0, stdout: "hello", stderr: "", truncated: false },
        "completed",
        undefined,
        { command: "printf hello" },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        items: [
          expect.objectContaining({
            toolName: "attachment_read",
            details: {
              meta: [],
              rows: [
                {
                  label: "附件内容",
                  title: "fixture.pdf",
                  description: "PDF body",
                  meta: ["PDF 附件", "1 页"],
                },
              ],
            },
          }),
        ],
      },
    });
    expect(turn.blocks[1]).toMatchObject({
      kind: "tool-activity",
      activity: {
        items: [
          expect.objectContaining({
            toolName: "read",
            label: "读取了「note.txt」",
            details: {
              meta: [{ label: "文件", value: "note.txt" }],
              rows: [{ label: "文件内容", title: "note.txt", description: "hello", meta: [] }],
            },
          }),
        ],
      },
    });
    expect(turn.blocks[2]).toMatchObject({
      kind: "tool-activity",
      activity: {
        items: [
          expect.objectContaining({
            toolName: "bash",
            label: "执行了 Bash · printf hello",
            details: {
              meta: [
                { label: "命令", value: "printf hello" },
                { label: "退出码", value: "0" },
              ],
              rows: [
                {
                  label: "stdout",
                  title: "标准输出",
                  description: "hello",
                  format: "pre",
                  meta: [],
                },
              ],
            },
          }),
        ],
      },
    });
  });

  test("summarizes list tools from array outputs", () => {
    const turn = buildAgentTurnView([
      tool("understanding_list", "tool-1", [{ id: "t1" }, { id: "t2" }]),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "列出 Understanding",
        summary: "列出 2 条 Understanding",
        items: [
          expect.objectContaining({
            label: "列出 2 条 Understanding",
            status: "done",
          }),
        ],
      },
    });
  });

  test("summarizes inspected domains by name instead of id", () => {
    const turn = buildAgentTurnView([
      tool(
        "domain_inspect",
        "tool-1",
        {
          domain: { id: "domain-1", name: "三观" },
          understandings: [],
          contexts: [],
        },
        "completed",
        undefined,
        { domainId: "domain-1" },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "查看 Domain",
        summary: "查看了「三观」下的内容",
        items: [expect.objectContaining({ label: "查看了「三观」下的内容" })],
      },
    });
  });

  test("summarizes mixed search hits", () => {
    const turn = buildAgentTurnView([
      tool("search", "tool-1", {
        hits: [
          { type: "understanding", understanding: { id: "t1" } },
          { type: "context", context: { id: "c1" }, understandingId: "t1" },
        ],
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "搜索相关内容",
        summary: "搜索了 1 条 Understanding / 1 条 Context",
        items: [
          expect.objectContaining({
            label: "搜索了 1 条 Understanding / 1 条 Context",
            status: "done",
          }),
        ],
      },
    });
  });

  test("shows retrieval candidates with matched context evidence", () => {
    const turn = buildAgentTurnView([
      tool(
        "retrieve_knowledge",
        "tool-1",
        {
          candidates: [
            {
              id: "u1",
              title: "反馈回路能降低试错代价",
              snippet: "先用小反馈验证判断，再扩大投入。",
              matchedContexts: [
                {
                  contextId: "c1",
                  medium: "experience",
                  title: "一次项目复盘",
                  snippet: "这次失败来自没有及时设检查点。",
                },
              ],
            },
          ],
        },
        "completed",
        undefined,
        { query: "反馈 成本", limit: 3 },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "检索知识",
        summary: "检索「反馈 成本」 · 1 条 Understanding / 1 条 Context 证据",
        items: [
          expect.objectContaining({
            details: {
              meta: [{ label: "查询", value: "反馈 成本" }],
              rows: [
                {
                  label: "Understanding",
                  title: "反馈回路能降低试错代价",
                  description: "先用小反馈验证判断，再扩大投入。",
                  format: "markdown",
                  meta: ["1 条 Context 证据"],
                },
                {
                  label: "Context 证据",
                  title: "一次项目复盘",
                  description: "这次失败来自没有及时设检查点。",
                  format: "markdown",
                  meta: ["类型：实践"],
                },
              ],
            },
          }),
        ],
      },
    });
  });

  test("summarizes graph tool output", () => {
    const turn = buildAgentTurnView([
      tool("graph", "tool-1", {
        nodes: [{ id: "t1" }, { id: "t2" }],
        edges: [{ from: "t1", to: "t2" }],
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "查看关联图",
        summary: "查看了 2 条 Understanding 的关联图",
      },
    });
  });

  test("keeps running and failed tool activity states in thinking", () => {
    const runningTurn = buildAgentTurnView([tool("search", "tool-1", {}, "running")]);
    const failedTurn = buildAgentTurnView([tool("bash", "tool-2", {}, "failed", "Command failed")]);

    expect(runningTurn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        status: "running",
        statusLabel: "运行中",
        items: [expect.objectContaining({ status: "running", statusLabel: "运行中" })],
      },
    });
    expect(failedTurn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        status: "failed",
        statusLabel: "出错",
        summary: "执行 Bash失败",
        items: [
          expect.objectContaining({
            status: "failed",
            statusLabel: "出错",
            label: "执行 Bash失败",
            errorText: "Command failed",
          }),
        ],
      },
    });
  });

  test.each([
    ["understanding_create", "understanding_create", "understanding"],
    ["understanding_update", "understanding_update", "understanding-update"],
    ["understanding_delete", "understanding_delete", "generic"],
    ["domain_create", "domain_create", "generic"],
    ["domain_update", "domain_update", "generic"],
    ["domain_delete", "domain_delete", "generic"],
    ["context_create", "context_create", "context"],
    ["context_update", "context_update", "generic"],
    ["context_delete", "context_delete", "generic"],
  ])("maps %s proposal view metadata", (proposalType, title, renderKind) => {
    const turn = buildAgentTurnView([
      proposal(proposalType, "tool-1", {
        body: "new understanding",
        content: "new context",
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        type: proposalType,
        title,
        status: "pending",
        data: { kind: renderKind },
      },
    });
  });

  test("marks generic proposal content fields as markdown", () => {
    const content = "## 过程指标\n\n- 观察是否更精确";
    const turn = buildAgentTurnView([
      proposal("context_update", "tool-1", {
        contextId: "context-1",
        content,
        reason: "补充推导链路",
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        type: "context_update",
        data: {
          entries: [
            { key: "contextId", value: "context-1" },
            { key: "content", value: content, format: "markdown" },
            { key: "reason", value: "补充推导链路" },
          ],
        },
      },
    });
  });

  test("maps bash proposals to command-focused render data", () => {
    const turn = buildAgentTurnView([
      proposal("bash", "tool-1", {
        command: 'find "<projectRoot>/fixtures/blog/content/posts" -maxdepth 2 -type f | head -200',
        cwd: "<projectRoot>",
        timeoutMs: 30000,
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        type: "bash",
        status: "pending",
        data: {
          kind: "bash",
          command:
            'find "<projectRoot>/fixtures/blog/content/posts" -maxdepth 2 -type f | head -200',
          cwd: "<projectRoot>",
          timeoutMs: 30000,
        },
      },
    });
  });

  test("keeps understanding update domain changes in render data", () => {
    const turn = buildAgentTurnView([
      proposal("understanding_update", "tool-1", {
        understandingId: "understanding-1",
        after: {
          body: "same body",
          domainIds: [],
        },
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        type: "understanding_update",
        data: {
          kind: "understanding-update",
          domainIds: [],
        },
      },
    });
  });

  test("marks proposal previews as streaming input", () => {
    const preview = proposal("understanding_create", "tool-1", {
      title: "Draft",
      body: "Draft body",
    }) as Extract<AgentReducedAssistantBlock, { kind: "approval" }>;
    const turn = buildAgentTurnView([
      {
        ...preview,
        preview: true,
      },
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        type: "understanding_create",
        state: "input-streaming",
        preview: true,
      },
    });
  });

  test("shows completed approval tool results", () => {
    const turn = buildAgentTurnView([
      {
        kind: "approval",
        approvalId: "approval-bash",
        toolCallId: "tool-bash",
        toolName: "bash",
        title: "执行 Bash",
        payload: { command: "printf hello" },
        output: { exitCode: 0, stdout: "hello", stderr: "" },
        approved: true,
        state: "completed",
        approvalState: "approved",
        executionState: "completed",
        displayState: "completed",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        state: "output-available",
        result: {
          meta: [{ label: "退出码", value: "0" }],
          rows: [
            { label: "stdout", title: "标准输出", description: "hello", format: "pre", meta: [] },
          ],
        },
      },
    });
  });

  test("shows approved tool execution failures as proposal errors", () => {
    const turn = buildAgentTurnView([
      {
        kind: "approval",
        approvalId: "approval-tool-1",
        toolCallId: "tool-1",
        toolName: "understanding_update",
        title: "候选修改 Understanding",
        payload: { understandingId: "understanding_1", domainIds: ["domain_1"] },
        approved: true,
        state: "failed",
        error: "Domain not found: domain_1",
        approvalState: "approved",
        executionState: "failed",
        displayState: "failed",
        executionError: { message: "Domain not found: domain_1" },
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        status: "approved",
        state: "output-error",
        errorText: "Domain not found: domain_1",
      },
    });
  });

  test("keeps long bash output folded behind a preview", () => {
    const stdout = Array.from({ length: 24 }, (_, index) => `line ${index + 1}`).join("\n");
    const turn = buildAgentTurnView([
      {
        kind: "approval",
        approvalId: "approval-bash",
        toolCallId: "tool-bash",
        toolName: "bash",
        title: "执行 Bash",
        payload: { command: "printf many-lines" },
        output: { exitCode: 0, stdout, stderr: "" },
        approved: true,
        state: "completed",
        approvalState: "approved",
        executionState: "completed",
        displayState: "completed",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        result: {
          rows: [
            {
              label: "stdout",
              format: "pre",
              description: expect.stringContaining("line 16"),
              fullDescription: stdout,
            },
          ],
        },
      },
    });
    expect(
      turn.blocks[0]?.kind === "proposal"
        ? turn.blocks[0].proposal.result?.rows[0]?.description
        : "",
    ).not.toContain("line 24");
  });

  test("shows completed approval tool result stable ids", () => {
    const turn = buildAgentTurnView([
      {
        kind: "approval",
        approvalId: "approval-tool-1",
        toolCallId: "tool-1",
        toolName: "understanding_create",
        title: "候选 Understanding",
        payload: { title: "A", body: "B" },
        output: { resultRefType: "understanding", resultRefId: "understanding_1" },
        approved: true,
        state: "completed",
        approvalState: "approved",
        executionState: "completed",
        displayState: "completed",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        state: "output-available",
        resultRefId: "understanding_1",
        result: {
          rows: [
            {
              label: "执行结果",
              title: "Understanding 已完成",
              description: "understanding_1",
              meta: [],
            },
          ],
        },
      },
    });
  });
});
