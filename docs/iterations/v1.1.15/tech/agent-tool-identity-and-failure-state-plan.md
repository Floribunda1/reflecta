# Agent 工具身份、正文引用与失败状态实施计划

> **给执行 Agent：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。任务用 checkbox（`- [ ]`）跟踪，按任务逐步执行。

**目标：** 让 Agent 工具调用只使用 Reflecta 稳定实体 id；让 assistant 正文引用通过现有 `assistant.turn.blocks` 的结构化 parts 渲染；让已批准工具的执行失败成为一等 session、UI 和诊断日志状态。

**架构：** Pi Agent 已经有类似 Vercel AI SDK `UIMessage` 的分层雏形：`assistant.turn.blocks` 是 UI/session truth，模型上下文由 runtime 另行构造。本计划不新建消息系统，只扩展现有 `kind: "text"` block：纯文本继续走 `text`，可点击 Reflecta 实体走 `entity_ref` part，RAG/证据来源走 `source_citation` part。工具协议完全不知道这些 UI parts，只接受稳定实体 id。审批和执行拆成两个事实：`approval.resolved approved=true` 只代表用户允许执行，不代表写入成功。

**技术栈：** Electron main process、Pi coding agent tools、TypeScript shared Agent session events、SQLite-backed Reflecta domain services、Streamdown/React renderer、Vitest、Electron E2E fixtures。

---

## 1. 问题

生产会话 `019f1431-3228-70cf-8527-89242fc94156` 暴露了三类问题。

第一，Agent 可见的实体身份不一致。只读工具和 prompt 曾暴露会话级 marker，例如 `[[ref:rf_fjxcezk5az]]`；写工具期待真实 domain id，例如 `s11qsWP-wgjU2Jn-0lX3b`。模型尝试把 `rf_fjxcezk5az`、`[[ref:rf_fjxcezk5az]]` 或去掉前缀的值传给工具，最终失败为 `Domain not found`。

第二，正文引用展示和工具身份被混成同一套协议。早期 `[[title#id]]` / `[[type:title#id]]` 让模型同时拼 title 和 id，出现 A title + B id 的错链。后来的 `[[ref:S1]]` / `[D1]` / `[[type:id]]` 虽然想避免错链，但又把 display reference 变成模型会拿去调用工具的身份 token。title 自动匹配也不可行：如果 Domain 叫 `AI`，正文里普通的“AI”会被误链，错误更隐蔽。

第三，已批准写工具的失败不够可见。日志里有 `approval.resolved approved=true`，但真正的写入失败可能只在 Pi 原始 tool result 或内部 block error 里。用户看到的是“已确认”，但真实状态是 approval 已确认、tool execution failed。UI 必须显示“执行失败”和失败原因。

## 2. 社区方案与本地取舍

| 方案                                     | 典型来源                                                         | 它怎么解决问题                                                                                                                                          | 对 Reflecta 的结论                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Provider citation annotations            | OpenAI File Search / Assistants annotations、Anthropic Citations | API 返回正文 block + citation metadata。citation 指向 document/file/page/char range，不靠 title 扫描。                                                  | 思路正确：引用是结构化 metadata。不能原样照搬，因为 Reflecta 引用的是业务实体，不只是文件证据。 |
| Numbered citations `[1]`                 | LlamaIndex CitationQueryEngine、Haystack AnswerBuilder           | `[1]` 是本次回答 retrieved documents/source nodes 的 1-based index；parser 校验 index 是否在当前 sources 范围内。它只表示证据来源，不是数据库实体身份。 | 可用于 `source_citation`，不能用于 `entity_ref`，也不能传给工具。                               |
| UIMessage / ModelMessage 分离            | Vercel AI SDK                                                    | UI message 持久化 parts / metadata / tool result；发给模型前转换成 model messages。UI 协议不反向污染 prompt。                                           | 与 Pi Agent 现有 `assistant.turn.blocks` 对齐。采用这个方向，但复用现有 blocks。                |
| Structured output / schema final answer  | LangChain structured output、provider native structured outputs  | 最终回答按 schema 返回，runtime 校验，失败可 retry；不从自然语言里猜结构。                                                                              | 用于最终 answer parts。                                                                         |
| MCP `structuredContent` / `outputSchema` | Model Context Protocol tools                                     | 工具结果同时有给模型看的 content 和给应用消费的 structuredContent，并可用 schema 校验。                                                                 | 用于只读工具输出和 entity/source catalog；不解决最终正文渲染，但提供 catalog 来源。             |
| Title/entity linker 后处理               | NLP entity linking / naive title matcher                         | 后处理扫描正文，把命中的 title 变链接。                                                                                                                 | 拒绝。宽泛 title、同名、语境都会误链。                                                          |

本计划采用：

```txt
现有 assistant.turn.blocks
  -> text block 增加 parts
  -> entity_ref 表示 Reflecta 实体
  -> source_citation 表示 RAG/证据 source
  -> renderer 只渲染结构化 part，不扫描 title
```

## 3. 架构决策

### 3.1 工具身份

工具参数只接受 Reflecta 稳定实体 id：

```json
{
  "title": "面对负面情绪：先减法，后加法",
  "body": "...",
  "domainIds": ["s11qsWP-wgjU2Jn-0lX3b"]
}
```

只读工具和 selected context 面向模型暴露实体 catalog：

```ts
type AgentFacingEntity = {
  id: string;
  type: "understanding" | "context" | "domain";
  title?: string;
  name?: string;
};
```

规则：

- `id` 是唯一可传给工具的实体身份。
- `title` / `name` 只用于人读展示。
- 面向模型的工具输出不再包含 `ref`、`domainRef`、`understandingRef`、`contextRef`、`citation`、`rf_*` source id。
- 写工具明确拒绝 `[[...]]`、`[D1]`、`U1`、`rf_*`。

### 3.2 Assistant text block parts

复用现有 `AgentReducedAssistantBlock`，只扩展 text block。

当前形态：

```ts
type AgentTextBlock = {
  kind: "text";
  text: string;
  createdAt: string;
};
```

目标形态：

```ts
type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: "understanding" | "context" | "domain";
      entityId: string;
    }
  | {
      type: "source_citation";
      sourceIndex: number;
    };

type AgentTextBlock = {
  kind: "text";
  text: string;
  parts?: AgentTextPart[];
  createdAt: string;
};
```

`text` 是 fallback / search / export 用的 plain text。`parts` 是 UI 渲染真相。

示例：

```json
{
  "kind": "text",
  "text": "这个理解适合放在三观下面。",
  "parts": [
    { "type": "text", "text": "这个理解适合放在" },
    { "type": "entity_ref", "entityType": "domain", "entityId": "s11qsWP-wgjU2Jn-0lX3b" },
    { "type": "text", "text": "下面。" }
  ],
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

Renderer 显示：

```txt
这个理解适合放在 # 三观 下面。
```

关键规则：

- `entity_ref` 的 label 从 entity catalog 查，不相信模型 label。
- `entityId` 必须出现在本轮 selected context 或 tool result catalog；否则 runtime 拒绝该 part 或降级成普通文本。
- 不根据正文 title 自动匹配实体。
- 不解析 `[[domain:id]]`、`[D1]`、`U1` 作为新正文引用协议。
- `source_citation` 只引用本次回答的 sources，不表示 Reflecta 实体，不允许作为工具参数。

### 3.3 Numbered citations 的位置

Numbered citations 只用于证据来源：

```ts
type AgentSourceCatalogEntry = {
  index: number; // 1-based, scoped to one assistant answer
  title?: string;
  excerpt?: string;
  origin: { kind: "tool_result"; toolCallId: string; toolName: string };
};
```

正文 part：

```json
{ "type": "source_citation", "sourceIndex": 1 }
```

约束：

- `sourceIndex` 只在当前 answer 内有效。
- `sourceIndex` 必须存在于当前 answer source catalog。
- UI 可以渲染为 `[1]` 并打开 source/chunk。
- 工具参数不接受 `[1]`。
- `source_citation` 不能替代 `entity_ref`。

### 3.4 Prompt / final answer contract

Prompt 不再要求模型手写聊天 ref。最终回答走 schema：

```json
{
  "parts": [
    { "type": "text", "text": "这个理解适合放在" },
    { "type": "entity_ref", "entityType": "domain", "entityId": "s11qsWP-wgjU2Jn-0lX3b" },
    { "type": "text", "text": "下面。" }
  ]
}
```

如果底层 Pi SDK 暂时只能 streaming text，则第一阶段保留 streaming text；最终 `assistant.turn` 落盘时要求结构化 final answer。无法拿到结构化 final answer 时，落盘为普通 text block，不做 title matcher。

### 3.5 工具失败状态

审批和执行是两个事实：

```txt
approval.requested
approval.resolved approved=true
tool.execution.started
tool.execution.completed | tool.execution.failed
```

`approval.resolved approved=true` 只表示用户允许执行，不表示写入成功。

Session events：

```ts
type AgentToolExecutionError = {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

type AgentToolExecutionStarted = AgentEventBase & {
  type: "tool.execution.started";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

type AgentToolExecutionCompleted = AgentEventBase & {
  type: "tool.execution.completed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  output?: unknown;
};

type AgentToolExecutionFailed = AgentEventBase & {
  type: "tool.execution.failed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  error: AgentToolExecutionError;
};
```

Approval block 保留两维状态：

```ts
type AgentToolApprovalState = "pending" | "approved" | "rejected";
type AgentToolExecutionState = "not_started" | "running" | "completed" | "failed";
type AgentToolDisplayState = "pending_approval" | "rejected" | "running" | "completed" | "failed";
```

UI 主状态使用 `displayState`。只要 `displayState === "failed"`，主 badge 显示“执行失败”，并展示 `error.message`；不能继续显示“已确认”作为终态。

## 4. 非目标

- 不让工具接受 `ref`、`[[...]]`、`[D1]`、`U1`、`rf_*`。
- 不做 title 自动匹配。
- 不新增独立 UIMessage 系统；复用现有 `assistant.turn.blocks`。
- 不让 numbered citation 表示可操作实体。
- 不长期保留旧 `[[ref:*]]` runtime resolver；历史数据一次性迁移。
- 不修改 Reflecta 数据库 id 生成策略。

## 5. 文件结构

需要修改：

- `apps/electron/src/preload/typings/agent.ts`
  - 增加 `AgentTextPart`。
  - 扩展 `kind: "text"` block 的 `parts?: AgentTextPart[]`。
  - 增加 `tool.execution.*` event types 和 execution state types。
- `apps/electron/src/main/services/agent/agent-run-accumulator.ts`
  - 保留 streaming text block。
  - final turn 支持结构化 text parts。
- `apps/electron/src/main/services/agent/pi-agent-host.ts`
  - 构造 entity/source catalog。
  - 校验 structured final answer parts。
  - 发出 durable `tool.execution.*` events。
- `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
  - 面向模型输出稳定实体 id，不输出 `ref` / `rf_*`。
- `apps/electron/src/main/services/agent/pi-write-tools.ts`
  - 参数描述强调 stable id。
  - 校验并拒绝 UI/display tokens。
- `apps/electron/src/main/services/agent/agent-system-prompt.md`
  - 删除手写 ref 契约。
  - 增加 final answer parts 契约。
- `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
  - `MarkdownBody` 支持 `parts` 渲染。
  - `entity_ref` 读取 catalog title 渲染 chip/link。
  - `source_citation` 渲染 numbered source link。
- `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
  - 合并 text blocks 时保留 parts。
  - 失败工具卡片显示 execution failed。
- `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`
- `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
- `apps/electron/src/main/services/agent/pi-write-tools.test.ts`
- `apps/electron/e2e/agent/pi-session.spec.ts`

## 6. 实施任务

### 任务 1: 类型化 text block parts 和执行状态

**文件：**

- 修改：`apps/electron/src/preload/typings/agent.ts`
- 测试：`apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

- [ ] **步骤 1: 添加 text part 类型**

在 `apps/electron/src/preload/typings/agent.ts` 添加：

```ts
export type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: AgentContextRef["type"];
      entityId: string;
    }
  | {
      type: "source_citation";
      sourceIndex: number;
    };
```

把 text block 改成：

```ts
| {
    kind: "text";
    text: string;
    parts?: AgentTextPart[];
    createdAt: string;
  };
```

- [ ] **步骤 2: 添加 execution event types**

在同一文件增加 `AgentToolExecutionStarted`、`AgentToolExecutionCompleted`、`AgentToolExecutionFailed`，并加入 `AgentSessionEvent`。

- [ ] **步骤 3: 写 reducer 测试**

在 `agent-reducer.test.ts` 添加：

```ts
test("keeps structured text parts on assistant turn", () => {
  const state = reduceAgentSession([
    {
      id: "evt_1",
      sessionId: "session_1",
      runId: "run_1",
      createdAt: "2026-07-01T00:00:00.000Z",
      type: "assistant.turn",
      messageId: "assistant_1",
      text: "这个理解适合放在三观下面。",
      blocks: [
        {
          kind: "text",
          text: "这个理解适合放在三观下面。",
          parts: [
            { type: "text", text: "这个理解适合放在" },
            { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
            { type: "text", text: "下面。" },
          ],
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    },
  ]);

  expect(state.messages[0]?.blocks?.[0]).toMatchObject({
    kind: "text",
    parts: [
      { type: "text", text: "这个理解适合放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
      { type: "text", text: "下面。" },
    ],
  });
});
```

- [ ] **步骤 4: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: PASS after types and reducer preserve `parts`.

- [ ] **步骤 5: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts
rtk git commit -m "feat(agent): type structured text parts"
```

### 任务 2: 工具输出只暴露 stable id，删除 ref 诱导

**文件：**

- 修改：`apps/electron/src/main/services/agent/agent-entity-sources.ts`
- 修改：`apps/electron/src/main/services/agent/pi-readonly-tools.ts`
- 测试：`apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
- 测试：`apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`

- [ ] **步骤 1: 写失败测试**

更新 read-only tool expected output：

```ts
expect(output.details).toEqual({
  domains: [
    {
      id: "domain_1",
      type: "domain",
      name: "三观",
      parentId: null,
    },
  ],
});

expect(JSON.stringify(output.details)).not.toContain('"ref"');
expect(JSON.stringify(output.details)).not.toContain("[[");
expect(JSON.stringify(output.details)).not.toContain("rf_");
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-sources.test.ts src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: FAIL if current output still contains `ref` / `[[...]]`.

- [ ] **步骤 3: 修改 decoration 行为**

规则：

- 保留真实 `id`。
- 添加 `type`。
- 删除模型可见 `ref`、`domainRef`、`understandingRef`、`contextRef`、`domainRefs`。
- 不暴露 `sourceId` / `rf_*`。

- [ ] **步骤 4: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-sources.test.ts src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: PASS.

- [ ] **步骤 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-entity-sources.ts apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
rtk git commit -m "fix(agent): expose entity ids without chat refs"
```

### 任务 3: Final answer parts 契约和校验

**文件：**

- 修改：`apps/electron/src/main/services/agent/agent-system-prompt.md`
- 修改：`apps/electron/src/main/services/agent/pi-agent-host.ts`
- 测试：`apps/electron/src/main/services/agent/pi-agent-host.test.ts`

- [ ] **步骤 1: 更新 prompt**

替换手写 ref 说明：

```md
## Final Answer Format

最终回答必须表达为 message parts：

- text：普通正文。
- entity_ref：引用 Reflecta 实体。entityId 必须来自本轮 selected context 或工具结果。
- source_citation：引用本轮回答的证据来源，只能使用当前 sources 的 1-based index。

不要在正文里手写 `[[...]]`、`[D1]`、`U1`、`rf_*`。
不要用标题猜实体。引用实体时输出 entity_ref。
工具调用参数只能使用稳定实体 id。
```

- [ ] **步骤 2: 增加校验测试**

在 `pi-agent-host.test.ts` 添加：

```ts
test("rejects entity_ref parts outside the current entity catalog", async () => {
  await expect(
    validateAssistantTextParts(
      [{ type: "entity_ref", entityType: "domain", entityId: "missing_domain" }],
      { entities: [{ type: "domain", id: "domain_1", title: "三观" }], sources: [] },
    ),
  ).rejects.toThrow("entity_ref entityId is not in the current catalog");
});
```

- [ ] **步骤 3: 实现最小校验函数**

接口：

```ts
function validateAssistantTextParts(
  parts: AgentTextPart[],
  catalog: {
    entities: Array<{ type: AgentContextRef["type"]; id: string; title?: string }>;
    sources: Array<{ index: number }>;
  },
): AgentTextPart[] {
  // Reject entity_ref not found by type + id.
  // Reject source_citation index not found.
  // Return parts unchanged when valid.
}
```

- [ ] **步骤 4: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-agent-host.test.ts
```

Expected: PASS.

- [ ] **步骤 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-system-prompt.md apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts
rtk git commit -m "feat(agent): validate structured final answer refs"
```

### 任务 4: Renderer 按 parts 渲染正文引用

**文件：**

- 修改：`apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- 修改：`apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- 测试：`apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- 测试：`apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`

- [ ] **步骤 1: 写 UI 测试**

```tsx
test("renders entity_ref parts without title matching", () => {
  renderMessageList({
    entitySources: [
      {
        sourceId: "source_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
      },
    ],
    messages: [
      {
        id: "assistant_1",
        role: "assistant",
        text: "AI 时代，这个理解适合放在三观下面。",
        blocks: [
          {
            kind: "text",
            text: "AI 时代，这个理解适合放在三观下面。",
            parts: [
              { type: "text", text: "AI 时代，这个理解适合放在" },
              { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
              { type: "text", text: "下面。" },
            ],
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
    ],
  });

  expect(screen.getByText("AI 时代，这个理解适合放在")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /三观/ })).toBeInTheDocument();
});

test("does not auto-link plain text that matches a broad entity title", () => {
  renderMessageList({
    entitySources: [
      {
        sourceId: "source_1",
        entity: { type: "domain", id: "domain_ai", title: "AI" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
      },
    ],
    messages: [
      {
        id: "assistant_1",
        role: "assistant",
        text: "AI 时代会有很多变化。",
        blocks: [
          {
            kind: "text",
            text: "AI 时代会有很多变化。",
            parts: [{ type: "text", text: "AI 时代会有很多变化。" }],
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
    ],
  });

  expect(screen.queryByRole("button", { name: /AI/ })).not.toBeInTheDocument();
});
```

- [ ] **步骤 2: 实现 parts renderer**

规则：

- `parts` 存在时，按 parts 渲染；不存在时继续渲染 markdown `text`。
- `entity_ref` 通过 `{type,id}` 查 entity catalog title，渲染现有 entity chip。
- 找不到 entity 时渲染 plain fallback，例如 `[missing domain:domain_1]`，并记录 diagnostic。
- `source_citation` 渲染为 `[n]` source link。
- 不调用 title matcher。

- [ ] **步骤 3: 保留 turn view parts**

`buildAgentTurnView()` 合并相邻 text block 时，如果任一 block 有 `parts`，输出 text block 也保留拼接后的 parts。

- [ ] **步骤 4: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/messages/message-list.test.tsx src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

Expected: PASS.

- [ ] **步骤 5: Commit**

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
rtk git commit -m "feat(chat): render structured assistant references"
```

### 任务 5: 写工具输入拒绝 UI/display tokens

**文件：**

- 修改：`apps/electron/src/main/services/agent/pi-write-tools.ts`
- 测试：`apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **步骤 1: 写失败测试**

```ts
test.each(["D1", "[D1]", "[[domain:domain_1]]", "rf_fjxcezk5az", "[1]"])(
  "rejects display tokens in domain id fields: %s",
  async (domainId) => {
    await expect(
      executePiApprovedTool("domain_update", { domainId, name: "New name" }),
    ).rejects.toThrow("domainId must be a stable Domain id");
  },
);
```

- [ ] **步骤 2: 实现 id preflight**

拒绝：

```ts
/^\[?(U|C|D|S)\d+\]?$/
/^\[\d+\]$/
/^\[\[[^\]]+\]\]$/
/^rf_[A-Za-z0-9_-]+$/
```

- [ ] **步骤 3: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-write-tools.test.ts
```

Expected: PASS.

- [ ] **步骤 4: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts
rtk git commit -m "fix(agent): reject display refs in tool ids"
```

### 任务 6: Durable approved tool execution events

**文件：**

- 修改：`apps/electron/src/main/services/agent/pi-agent-host.ts`
- 修改：`apps/electron/src/main/services/agent/pi-session-log.ts`
- 测试：`apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- 测试：`apps/electron/src/main/services/agent/pi-session-log.test.ts`

- [ ] **步骤 1: 编写成功序列测试**

Approve pending write tool，断言 session events 包含：

```ts
expect(eventTypes).toEqual(
  expect.arrayContaining([
    "approval.resolved",
    "tool.execution.started",
    "tool.execution.completed",
  ]),
);
```

- [ ] **步骤 2: 编写失败序列测试**

Mock approved tool 抛出：

```ts
new Error("Domain not found: domain_1");
```

断言：

```ts
expect(eventTypes).toEqual(
  expect.arrayContaining(["approval.resolved", "tool.execution.started", "tool.execution.failed"]),
);
expect(failedEvent.error).toEqual({ message: "Domain not found: domain_1" });
```

- [ ] **步骤 3: 发出 execution events**

在 approve path：

- append `approval.resolved approved=true`
- append `tool.execution.started`
- execute approved tool
- success append `tool.execution.completed`
- failure normalize error and append `tool.execution.failed`

- [ ] **步骤 4: 诊断日志**

`tool.execution.failed` mirror 到 diagnostic log：

```json
{
  "event": "agent.tool.execution.failed",
  "attrs": {
    "toolName": "understanding_update",
    "error.message": "Domain not found: domain_1"
  }
}
```

- [ ] **步骤 5: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-agent-host.test.ts src/main/services/agent/pi-session-log.test.ts
```

Expected: PASS.

- [ ] **步骤 6: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-session-log.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts
rtk git commit -m "fix(agent): persist approved tool execution failures"
```

### 任务 7: 正确渲染已批准但执行失败的工具

**文件：**

- 修改：`apps/electron/src/preload/typings/agent.ts`
- 修改：`apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- 修改：`apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- 测试：`apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`

- [ ] **步骤 1: 写 reducer test**

给定：

```ts
[
  { type: "approval.requested", toolName: "understanding_update", toolCallId: "tool_1" },
  { type: "approval.resolved", approved: true, toolCallId: "tool_1" },
  { type: "tool.execution.started", toolName: "understanding_update", toolCallId: "tool_1" },
  {
    type: "tool.execution.failed",
    toolName: "understanding_update",
    toolCallId: "tool_1",
    error: { message: "Domain not found: domain_1" },
  },
];
```

断言 reduced approval block：

```ts
{
  kind: "approval",
  approvalState: "approved",
  executionState: "failed",
  displayState: "failed",
  error: "Domain not found: domain_1"
}
```

- [ ] **步骤 2: 写 view test**

断言卡片显示“执行失败”和 `Domain not found: domain_1`。主状态不能显示“已确认”。

- [ ] **步骤 3: 更新 reducer 和 view**

处理 `tool.execution.started/completed/failed`，通过 `toolCallId` 更新 approval block。View 只消费 `displayState` 和 `error`。

- [ ] **步骤 4: 运行测试**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

Expected: PASS.

- [ ] **步骤 5: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
rtk git commit -m "fix(chat): show failed approved tools"
```

### 任务 8: E2E fixture 和历史迁移

**文件：**

- 修改：`apps/electron/e2e/agent/agent-fixture-store.ts`
- 修改：`apps/electron/e2e/agent/pi-session.spec.ts`
- 临时脚本：一次性迁移 `<projectRoot>/.local/reflecta-prod` 和 `<projectRoot>/.local/reflecta-test`，迁移后删除。

- [ ] **步骤 1: 添加 E2E fixture**

事件序列：

```txt
approval.requested
approval.resolved approved=true
tool.execution.started
tool.execution.failed error.message="Domain not found: rf_fjxcezk5az"
```

断言 UI 显示“执行失败”，不以“已确认”为终态。

- [ ] **步骤 2: 一次性迁移历史 session**

迁移规则：

- raw `toolResult.isError === true` 且能按 `toolCallId` 匹配 approval 的，补 `tool.execution.failed`。
- 已批准但缺 `tool.execution.started` 的，补 started。
- 带 error 但旧 snapshot 是 completed 的 block，改成 canonical failed state。
- 旧 `[[ref:*]]` 不再做运行时 resolver；能无歧义转成 plain title 的转成普通文本，不能的保持普通文本。

- [ ] **步骤 3: 验证**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
rtk bun --cwd apps/electron e2e -- e2e/agent/pi-session.spec.ts
```

Expected: PASS.

- [ ] **步骤 4: Commit**

```bash
rtk git add apps/electron/e2e/agent/agent-fixture-store.ts apps/electron/e2e/agent/pi-session.spec.ts apps/electron/src docs/iterations/v1.1.15
rtk git commit -m "test(agent): cover structured refs and failed approved tools"
```

## 7. 验证

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
rtk bun --cwd apps/electron typecheck
rtk bun --cwd apps/electron e2e -- e2e/agent/pi-session.spec.ts
```

Expected: PASS.

## 8. 验收标准

- Agent-facing 工具输出包含稳定实体 `id`，不包含 `ref`、`[[...]]`、`rf_*`。
- 写工具只接受稳定实体 id，拒绝 `[[...]]`、`[D1]`、`U1`、`[1]`、`rf_*`。
- Assistant 正文内联实体引用来自 `text.parts[].entity_ref`，不来自 title matching。
- 普通文本 `AI` 不会因为存在同名 Domain 自动变成引用。
- Numbered citation 只作为 `source_citation`，只引用本回答 source，不能作为实体或工具参数。
- `assistant.turn.blocks` 是 UI/session truth；发给模型的上下文不包含 UI 引用协议。
- 批准写工具后，会产生 `approval.resolved`，然后产生明确的 execution state。
- 已批准写工具失败会产生 `tool.execution.failed`、诊断日志和 UI failed state。
- 失败的已批准工具卡片主状态显示“执行失败”，并展示 `error.message`；不能继续以“已确认”作为终态。
- 历史 session 不崩溃；无法迁移的旧 ref 作为普通文本显示，不可点击。

## 9. 自检

- 已删除旧 typed chat ref 作为正文协议的设计。
- 已区分 `entity_ref` 和 `source_citation`。
- 已把方案落到 Pi Agent 现有 `assistant.turn.blocks`，没有新建并行 message 系统。
- 已保留 tool failure state 作为一等状态。
- 任务有文件、测试命令和预期结果。
