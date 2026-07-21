# Agent Structured Message Parts 与正文引用改造 Implementation Plan

> **给执行 Agent：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。任务用 checkbox（`- [ ]`）跟踪，按任务逐步执行。

**Goal:** Assistant 正文能显示可点击 Reflecta 实体引用，同时彻底移除模型手写引用 token、title 自动匹配和工具 `ref` 参数。

**Architecture:** 复用现有 Pi Agent 的 `assistant.turn.blocks` seam，把 `text` block 从纯 string 扩展为可选 structured parts。模型最终回答通过结构化 final-answer adapter 产出 `text/entity_ref` parts；runtime 校验 `entity_ref.entityId` 来自本轮 entity catalog；renderer 从 catalog 取标题并生成内联可点击引用。工具参数只接受稳定实体 id。

**Tech Stack:** Electron main process、Pi coding agent custom tools、TypeScript shared Agent session events、existing assistant turn blocks、Streamdown renderer、Vitest。

---

## 0. 结论

本版本做成这样：

```ts
type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: "understanding" | "context" | "domain";
      entityId: string;
      fallbackText?: string;
    };

type AgentTextBlock = {
  kind: "text";
  text: string;
  parts?: AgentTextPart[];
  createdAt: string;
};
```

渲染例子：

```json
{
  "parts": [
    { "type": "text", "text": "这个理解适合放在" },
    { "type": "entity_ref", "entityType": "domain", "entityId": "domain_1" },
    { "type": "text", "text": "下面。" }
  ]
}
```

UI 显示：

```txt
这个理解适合放在 # 三观 下面。
```

关键规则：

- 不做 title 自动匹配，`AI` 不会因为有同名 Domain 就被自动链接。
- 不让模型手写 `[[...]]`、`[D1]`、`[[ref:*]]`。
- `entity_ref.entityId` 必须来自本轮 selected context / tool result catalog。
- Renderer 只渲染 structured parts，不猜实体。
- `text` 字段继续保留，作为搜索、导出、标题生成、历史兼容的 plain-text fallback。

## 1. 方案来源与适用边界

### 1.1 社区方案横向对比

| 方案                          | 社区/框架                                               | 他们怎么解决问题                                                                                                     | 对 Reflecta 的结论                                                                   |
| ----------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Provider citation annotations | OpenAI File Search / Anthropic Citations                | API 返回 text block + citation metadata，引用不是 title 扫描。                                                       | 适合证据引用思路，但 Reflecta entity 不是 provider document citation，不能原样照搬。 |
| Numbered citations            | LlamaIndex CitationQueryEngine / Haystack AnswerBuilder | `[1]` 是本轮 retrieved documents/source nodes 的 1-based index；parser 把 `[1]` 映射到 source list，超出范围可忽略。 | 可用于“证据来源”，不能用于可操作实体；否则会重演 `[D1]` 污染工具参数。               |
| UIMessage parts               | Vercel AI SDK                                           | UIMessage 是 UI 状态 source of truth；ModelMessage 是发给模型的精简上下文；UI 渲染 `parts`。                         | 最适合 Reflecta：Pi Agent 已有 `assistant.turn.blocks`，直接扩展 text block。        |
| Structured output             | LangChain structured output                             | 最终回答走 schema validation；provider-native 不行就用 tool strategy。                                               | 用于生成 `AgentTextPart[]`，避免解析自然语言。                                       |
| MCP structuredContent         | MCP tools                                               | 工具结果同时有 text content 和 structuredContent/outputSchema。                                                      | 适合作为 entity catalog 来源，不解决最终正文渲染。                                   |
| title/entity linker           | 通用 NLP/entity linking                                 | 后处理扫描文本并链接实体。                                                                                           | 拒绝；`AI`、同名标题、泛词都会误链。                                                 |

### 1.2 我们已经踩过的坑

| 历史方案                             | 原本想解决什么                    | 实际问题                                          |
| ------------------------------------ | --------------------------------- | ------------------------------------------------- |
| `[[title#id]]` / `[[type:title#id]]` | 正文可点击且带标题                | 模型会把 A title 和 B id 拼错。                   |
| `[[ref:S1]]`                         | 不暴露真实 id，避免 title/id 错配 | `ref` 变成通用 identity，恢复/审批/重放路径脆弱。 |
| 工具接受 `ref`                       | 模型不用处理真实 id               | 这是根因错误：展示协议污染工具身份。              |
| `[[type:id]]`                        | 去掉 `ref` 工具参数               | 正文显示裸 id；模型仍会把正文引用字符串当参数。   |
| `[U1]` / `[D1]`                      | 更短的 citation                   | 还是会话短号，会进入正文或工具参数。              |
| title 自动匹配                       | 不让模型输出结构                  | 宽标题如 `AI` 会被误链。                          |
| sidecar chip                         | 安全显示实体                      | 不满足正文内联引用。                              |

### 1.3 本版本不做什么

- 不做 provider document citation。
- 不做 numbered source citation。
- 不做 title matcher。
- 不引入新的全局 message system。
- 不让写工具接受任何 display token。

## 2. 现有代码 seam

Pi Agent 已经有 UIMessage-like 结构：

- `AgentAssistantTurn.blocks`：`apps/electron/src/preload/typings/agent.ts`
- `AgentRunAccumulator`：把 live text/tool/approval events fold 成 blocks。
- `AgentMessageContent`：renderer 按 block 渲染。
- `buildAgentTurnView`：把 persisted blocks 转成 UI view blocks。

因此本计划只扩展 existing text block，不新增 parallel message abstraction。

## 3. Target Model

### 3.1 Entity catalog

工具和 selected context 输出统一进入 catalog：

```ts
type AgentEntityCatalogEntry = {
  key: string;
  entity: {
    type: "understanding" | "context" | "domain";
    id: string;
    title?: string;
  };
  origin:
    | { kind: "user_context"; messageId: string }
    | { kind: "tool_result"; toolCallId: string; toolName: string };
};
```

Catalog key 是 `${type}:${id}`。面向模型的工具输出只暴露 `id/type/title`，不暴露 `ref/citation/sourceId`。

### 3.2 Text parts

```ts
type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: AgentContextRef["type"];
      entityId: string;
      fallbackText?: string;
    };
```

`fallbackText` 只在 entity 缺失时显示为普通文本；正常渲染时 title 必须来自 catalog。

### 3.3 Final answer adapter

优先使用 Pi SDK / provider 的 structured output 能力。若当前 Pi SDK 没有 native response schema，则使用 internal final-answer tool strategy：

```ts
type ReflectaFinalAnswerInput = {
  parts: AgentTextPart[];
};
```

这个 internal tool 是结构化输出 adapter：

- 不显示为用户可见 tool call。
- 不进入 tool activity list。
- 只把 validated parts 追加为 `kind: "text"` block。
- 如果模型直接输出普通 text，则按旧逻辑显示普通 text，不生成实体引用。

### 3.4 Validation

```ts
function normalizeAgentTextParts(
  parts: AgentTextPart[],
  catalog: AgentEntityCatalogEntry[],
): { text: string; parts: AgentTextPart[] };
```

规则：

- `text` part 原样保留。
- `entity_ref` 必须能在 catalog 中找到同 type/id。
- 找到时保留 `entity_ref`，plain `text` 用 catalog title 拼出。
- 找不到时降级为 `{ type: "text", text: fallbackText || "" }`，并记录 diagnostic log。
- 不从 `fallbackText` 或 catalog title 反向匹配正文。

### 3.5 One-time migration scope

迁移仍然是一次性脚本，跑完删除脚本；运行时代码不保留旧 `entity.sources.updated`、`[[ref:*]]`、`[[type:id]]`、`domainRef` parser。

迁移分两类数据：

| 数据位置                                                               | 是否迁移 | 规则                                                                                                                 |
| ---------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Pi session custom event `entity.sources.updated`                       | 必迁     | 转成 `entity.catalog.updated`，以 `${type}:${id}` 为 key；删除 `sourceId`。                                          |
| Pi session `assistant.turn.blocks[].kind === "text"`                   | 必迁     | 把可解析旧引用改成 plain text + `parts`；不可解析旧引用改成 plain text。                                             |
| Pi session `assistant.turn.text`                                       | 必迁     | 同步为迁移后的 plain text，保证搜索/导出/标题生成稳定。                                                              |
| Pi session `tool.completed.output` / `tool.execution.completed.output` | 必迁     | 深度删除 model-facing `ref/citation/*Ref/*Refs/sourceId` 字段；保留 `id/type/title/name`。                           |
| Pi session approval block `output` / `payload`                         | 部分迁移 | `output` 按 tool output 规则清理；`payload` 是历史审批审计记录，只清理明显的 display-only 派生字段，不改用户输入值。 |
| `user.message.contextRefs`                                             | 不迁     | 已经是稳定 `{type,id,title}`，保留。                                                                                 |
| `composerContent` mention attrs                                        | 不迁     | mention id 已经是 `type:id`，属于编辑器结构，不是 agent display token。                                              |
| 历史普通 assistant text 没有旧引用                                     | 不迁     | 不补 `parts`，继续走 plain markdown fallback。                                                                       |
| 知识库实体表 `reflecta.db`                                             | 审计守卫 | 只查实体正文是否被 Agent-only token 污染；当前 `reflecta-prod` 全库 0 命中，因此 v1.1.16 不迁移知识库正文。          |

旧引用迁移规则：

| 旧形式                                          | 需要什么上下文                              | 迁移结果                                                                      |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| `[[ref:S1]]` / `[[ref:rf_x]]`                   | 同 session 的旧 source map                  | 文本替换为 entity title；生成 `entity_ref` part。                             |
| `[[understanding:id]]`                          | session catalog 或全库 understanding lookup | 有 title 时转 `entity_ref`；无 title 时转 plain `id` 并计入 unresolved。      |
| `[[context:id]]` / `[[domain:id]]`              | session catalog 或全库 entity lookup        | 有 title/name 时转 `entity_ref`；无 title 时转 plain `id` 并计入 unresolved。 |
| `[U1]` / `[D1]` / `U1` / `D1`                   | 无可靠 source map                           | 不猜，转 plain text，计入 unresolved-short-handle。                           |
| `[[title#understandingId]]` canonical wiki link | 内容层合法格式                              | 不迁。                                                                        |

知识库内容不进入本次默认迁移。它只做审计守卫：

- 审计 `reflecta.db` 的 `domains.name`、`understandings.title/body`、`contexts.title/content`、`conversations.title/last_message_preview`，再用 `.dump` 做全库兜底扫描。
- 查找 `[[ref:*]]`、`[[understanding:id]]`、`[[context:id]]`、`[[domain:id]]`、`#reflecta-wiki/*`、`[U1]/[C1]/[D1]/[S1]`。
- 当前 `<projectRoot>/.local/reflecta-prod/reflecta.db` 扫描结果为 0 命中，所以不需要迁移知识库正文。
- 如果其他环境审计非 0，不在运行时加兼容；单独生成 report，再做一次性清理脚本，清完删除脚本。

## 4. Files

### Shared typing

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/preload/typings/agent-context.ts`

### Main process

- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.ts` -> `apps/electron/src/main/services/agent/agent-entity-catalog.ts`
- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts` -> `apps/electron/src/main/services/agent/agent-entity-catalog.test.ts`
- Create: `apps/electron/src/main/services/agent/agent-text-parts.ts`
- Create: `apps/electron/src/main/services/agent/agent-text-parts.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-run-accumulator.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

### Renderer

- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

### Migration

- Create then delete after run: `scripts/migrations/v1.1.16-agent-entity-parts.ts`
- Create then delete after run: `scripts/migrations/v1.1.16-agent-entity-parts.test.ts`

## 5. Task 1: Extend text blocks with parts

**Files:**

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

- [ ] **Step 1: Write failing reducer test**

```ts
test("preserves structured assistant text parts", () => {
  const session = reduceAgentSession([
    {
      id: "evt_1",
      type: "assistant.turn",
      sessionId: "session_1",
      runId: "run_1",
      messageId: "assistant_1",
      createdAt: "2026-07-01T00:00:00.000Z",
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

  expect(session.messages[0]?.blocks?.[0]).toMatchObject({
    kind: "text",
    parts: [
      { type: "text", text: "这个理解适合放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
      { type: "text", text: "下面。" },
    ],
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: FAIL because text block type has no `parts`.

- [ ] **Step 3: Update shared type**

```ts
export type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: AgentContextRef["type"];
      entityId: string;
      fallbackText?: string;
    };
```

Extend the `kind: "text"` block:

```ts
| {
    kind: "text";
    text: string;
    parts?: AgentTextPart[];
    createdAt: string;
  }
```

- [ ] **Step 4: Run test**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts
rtk git commit -m "feat(agent): support structured text parts"
```

## 6. Task 2: Replace source/ref registry with entity catalog

**Files:**

- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.ts`
- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`

- [ ] **Step 1: Write catalog test**

```ts
test("catalog stores stable entity ids without display refs", () => {
  const catalog = new AgentEntityCatalog();

  catalog.addEntity(
    { type: "domain", id: "domain_1", title: "三观" },
    { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
  );

  expect(catalog.snapshot()).toEqual([
    {
      key: "domain:domain_1",
      entity: { type: "domain", id: "domain_1", title: "三观" },
      origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
    },
  ]);
  expect(JSON.stringify(catalog.snapshot())).not.toContain("ref");
  expect(JSON.stringify(catalog.snapshot())).not.toContain("D1");
});
```

- [ ] **Step 2: Remove model-facing ref fields**

Tool output may contain:

```json
{ "id": "domain_1", "type": "domain", "title": "三观" }
```

Tool output must not contain:

```json
{ "ref": "[[domain:domain_1]]", "citation": "D1", "domainRef": "[[domain:domain_1]]" }
```

- [ ] **Step 3: Run tests**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-catalog.test.ts src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/electron/src/main/services/agent apps/electron/src/preload/typings/agent.ts
rtk git commit -m "refactor(agent): replace entity refs with catalog"
```

## 7. Task 3: Normalize final answer parts

**Files:**

- Create: `apps/electron/src/main/services/agent/agent-text-parts.ts`
- Create: `apps/electron/src/main/services/agent/agent-text-parts.test.ts`

- [ ] **Step 1: Write failing unit test**

```ts
test("normalizes entity refs from catalog without title matching", () => {
  const result = normalizeAgentTextParts(
    [
      { type: "text", text: "这个理解适合放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
      { type: "text", text: "下面。AI 只是普通文本。" },
    ],
    [
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
      {
        key: "domain:domain_ai",
        entity: { type: "domain", id: "domain_ai", title: "AI" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ],
  );

  expect(result.text).toBe("这个理解适合放在三观下面。AI 只是普通文本。");
  expect(result.parts).toEqual([
    { type: "text", text: "这个理解适合放在" },
    { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
    { type: "text", text: "下面。AI 只是普通文本。" },
  ]);
});
```

- [ ] **Step 2: Write missing entity test**

```ts
test("downgrades missing entity refs to fallback text", () => {
  const result = normalizeAgentTextParts(
    [{ type: "entity_ref", entityType: "domain", entityId: "missing", fallbackText: "三观" }],
    [],
  );

  expect(result).toEqual({ text: "三观", parts: [{ type: "text", text: "三观" }] });
});
```

- [ ] **Step 3: Implement minimal normalizer**

Rules:

- Build a map from `catalog.key`.
- Text parts append directly.
- Valid entity refs append `catalog.entity.title ?? fallbackText ?? entityId` to plain text and keep the entity part.
- Invalid entity refs become text fallback.
- No title scanning.

- [ ] **Step 4: Run tests**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-text-parts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-text-parts.ts apps/electron/src/main/services/agent/agent-text-parts.test.ts
rtk git commit -m "feat(agent): normalize structured text parts"
```

## 8. Task 4: Add internal final-answer adapter

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/agent-run-accumulator.ts`
- Modify: `apps/electron/src/main/services/agent/agent-run-accumulator.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`

- [ ] **Step 1: Write accumulator test**

```ts
test("converts internal final answer tool output into a text block with parts", () => {
  const accumulator = new AgentRunAccumulator();

  accumulator.appendFinalAnswer({
    id: "evt_1",
    sessionId: "session_1",
    runId: "run_1",
    messageId: "assistant_1",
    createdAt: "2026-07-01T00:00:00.000Z",
    parts: [
      { type: "text", text: "放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
      { type: "text", text: "下面。" },
    ],
    text: "放在三观下面。",
  });

  expect(
    accumulator.toAssistantTurn({
      id: "turn_1",
      type: "assistant.turn",
      sessionId: "session_1",
      runId: "run_1",
      messageId: "assistant_1",
      createdAt: "2026-07-01T00:00:00.000Z",
    }).blocks,
  ).toEqual([
    {
      kind: "text",
      text: "放在三观下面。",
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
        { type: "text", text: "下面。" },
      ],
      createdAt: "2026-07-01T00:00:00.000Z",
    },
  ]);
});
```

- [ ] **Step 2: Implement adapter seam**

Add an internal final-answer adapter with this input:

```ts
type ReflectaFinalAnswerInput = {
  parts: AgentTextPart[];
};
```

When the model calls this adapter:

- Validate with `normalizeAgentTextParts(parts, active.entityCatalog.snapshot())`.
- Append a `kind: "text"` block with `text` and `parts`.
- Do not emit a visible tool block.
- If the model emits ordinary assistant text, keep the existing text path as fallback.

- [ ] **Step 3: Prompt update**

Add to `agent-system-prompt.md`:

```md
## Final answer rendering

When your final answer needs to reference a Reflecta entity from selected context or tool results, return it through the structured final-answer format.

Use `text` parts for normal prose.
Use `entity_ref` parts only for specific Reflecta entities returned in the current turn.
Never write `[[...]]`, `[D1]`, `U1`, `ref`, or source ids in the visible text.
Do not create entity refs by title. If the entity was not returned in this turn, write plain text.
```

- [ ] **Step 4: Run tests**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-run-accumulator.test.ts src/main/services/agent/pi-agent-host.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-run-accumulator.ts apps/electron/src/main/services/agent/agent-run-accumulator.test.ts apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/agent-system-prompt.md
rtk git commit -m "feat(agent): add structured final answer parts"
```

## 9. Task 5: Render entity parts inline

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`

- [ ] **Step 1: Write renderer test**

```tsx
test("renders entity_ref text parts as inline entity links", () => {
  renderMessageList({
    entityCatalog: [
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ],
    messages: [
      {
        id: "assistant_1",
        role: "assistant",
        text: "这个理解适合放在三观下面。",
        createdAt: "2026-07-01T00:00:00.000Z",
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
    ],
  });

  expect(screen.getByRole("button", { name: /三观/ })).toBeInTheDocument();
  expect(screen.getByText(/AI 时代/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement renderer**

Rules:

- If a text block has `parts`, render parts.
- `text` parts render through existing markdown path.
- `entity_ref` parts render using existing wiki/entity link UI with title from catalog.
- Missing entity refs render `fallbackText` as plain text.
- If a text block has no `parts`, keep current Streamdown markdown rendering.

- [ ] **Step 3: Run renderer tests**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/messages/message-list.test.tsx src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx
rtk git commit -m "feat(chat): render structured entity text parts"
```

## 10. Task 6: Reject display tokens in write tools

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **Step 1: Write guard tests**

```ts
test.each(["D1", "[D1]", "[[domain:domain_1]]", "rf_fjxcezk5az"])(
  "rejects display tokens in domain id fields: %s",
  async (domainId) => {
    await expect(
      executePiApprovedTool("domain_update", { domainId, name: "New name" }),
    ).rejects.toThrow("domainId 必须是稳定 Domain id");
  },
);
```

- [ ] **Step 2: Implement shared id guard**

Reject:

- `S1`, `U1`, `C1`, `D1`
- `[S1]`, `[U1]`, `[C1]`, `[D1]`
- `[[...]]`
- `rf_*`

- [ ] **Step 3: Run tests**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-write-tools.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts
rtk git commit -m "fix(agent): reject display tokens in write ids"
```

## 11. Task 7: Show approved execution failures

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`

- [ ] **Step 1: Write reducer/UI tests**

Cover this state:

```ts
{
  kind: "approval",
  approved: true,
  approvalState: "approved",
  executionState: "failed",
  displayState: "failed",
  state: "failed",
  error: "domainId 必须是稳定 Domain id"
}
```

UI must show `执行失败` and the error message, not only `已确认`.

- [ ] **Step 2: Fix display priority**

Display priority:

```ts
failed > completed > rejected > pending_approval > approved;
```

- [ ] **Step 3: Run tests**

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx
rtk git commit -m "fix(chat): show approved tool execution failures"
```

## 12. Task 8: One-time migration

**Files:**

- Create: `scripts/migrations/v1.1.16-agent-entity-parts.ts`
- Create: `scripts/migrations/v1.1.16-agent-entity-parts.test.ts`
- Delete after successful migration.

- [ ] **Step 1: Write migration**

Input roots:

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts ./.local/reflecta-prod
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts ./.local/reflecta-test
```

Script interface:

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts [--dry-run] [--report <path>] <content-storage-root>
```

Session event migration rules:

- Find Pi session files under `<root>/Sessions`.
- Do not scan or rewrite `<root>/Sessions.backup-*`, `<root>/assets`, or `<root>/.pi-agent`.
- Only rewrite `custom` entries whose `customType` is `reflecta.agent.event`.
- `entity.sources.updated` -> `entity.catalog.updated`.
- Build a per-session source map from old `sourceId` to `{type,id,title}`.
- Rewrite every `assistant.turn`:
  - `blocks[].kind === "text"`: replace old refs with title/plain fallback and add `parts`.
  - `assistant.turn.text`: recompute from text blocks.
  - `blocks[].kind === "approval"`: clean `output` fields that came from tool output; keep historical `payload` inputs.
- Rewrite `tool.completed.output` and `tool.execution.completed.output` by deleting `ref/citation/sourceId/*Ref/*Refs` fields recursively.
- If a text block already has `parts`, skip it.
- If an event is already `entity.catalog.updated`, skip it.

Knowledge DB audit guard:

- Open `<root>/reflecta.db` when it exists.
- Audit `domains.name`, `understandings.title/body`, `contexts.title/content`, `conversations.title/last_message_preview`.
- Also scan SQLite `.dump` for `[[ref:*]]`, `[[understanding:*]]`, `[[context:*]]`, `[[domain:*]]`, `#reflecta-wiki/*`, and short handles `[U1]/[C1]/[D1]/[S1]`.
- If audit hits are 0, do nothing to knowledge content.
- If audit hits are non-zero, stop and write a report. Do not silently rewrite user content in the session migration script.

Idempotency:

- Running the script twice produces no second rewrite.
- A file is written only when its normalized JSON/text differs.
- The report always includes counters and unresolved locations.

- [ ] **Step 2: Dry run**

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts --dry-run --report /tmp/reflecta-v1.1.16-prod-migration.json ./.local/reflecta-prod
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts --dry-run --report /tmp/reflecta-v1.1.16-test-migration.json ./.local/reflecta-test
```

Expected counters:

```txt
session files scanned: N
entity.sources.updated migrated: N
assistant text refs rewritten to parts: N
tool outputs cleaned: N
knowledge files scanned: N
knowledge refs migrated: N
unresolved refs reported: N
```

- [ ] **Step 3: Add temporary migration unit test**

Create `scripts/migrations/v1.1.16-agent-entity-parts.test.ts`:

```ts
const migrated = migrateSessionEvents([
  {
    type: "entity.sources.updated",
    sources: [
      {
        sourceId: "S1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ],
  },
  {
    type: "assistant.turn",
    text: "放在 [[ref:S1]] 下面。",
    blocks: [
      { kind: "text", text: "放在 [[ref:S1]] 下面。", createdAt: "2026-07-01T00:00:00.000Z" },
    ],
  },
]);

expect(migrated.events).toMatchObject([
  {
    type: "entity.catalog.updated",
    entries: [
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
      },
    ],
  },
  {
    type: "assistant.turn",
    text: "放在 三观 下面。",
    blocks: [
      {
        kind: "text",
        text: "放在 三观 下面。",
        parts: [
          { type: "text", text: "放在 " },
          { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
          { type: "text", text: " 下面。" },
        ],
      },
    ],
  },
]);
```

Run:

```bash
rtk bun test scripts/migrations/v1.1.16-agent-entity-parts.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run migration, inspect reports, delete script/test, commit**

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts --report /tmp/reflecta-v1.1.16-prod-migration.json ./.local/reflecta-prod
rtk bun scripts/migrations/v1.1.16-agent-entity-parts.ts --report /tmp/reflecta-v1.1.16-test-migration.json ./.local/reflecta-test
rtk rm scripts/migrations/v1.1.16-agent-entity-parts.ts
rtk rm scripts/migrations/v1.1.16-agent-entity-parts.test.ts
rtk git add apps/electron/src scripts docs/iterations/v1.1.16
rtk git commit -m "chore(agent): migrate entity refs to text parts"
```

## 13. Task 9: Final verification and release patch

**Files:**

- Release metadata files changed by project release command.

- [ ] **Step 1: Focused tests**

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
rtk bun run typecheck
```

Expected: PASS.

- [ ] **Step 2: Manual smoke**

Verify:

- Entity refs render inline from parts.
- Plain word `AI` does not auto-link.
- Tool args reject `D1`, `[D1]`, `[[...]]`, `rf_*`.
- Approved tool execution failure shows `执行失败` and reason.
- Old sessions still show readable plain text after migration.

- [ ] **Step 3: Release patch**

Run the existing project patch release command for v1.1.16.

- [ ] **Step 4: Commit**

```bash
rtk git add .
rtk git commit -m "chore(release): v1.1.16"
```

## 14. Acceptance Criteria

- Assistant 正文内联引用来自 `AgentTextPart.entity_ref`。
- Renderer 不做 title matching。
- `AI` 这类普通词不会因为同名 Domain 自动变引用。
- 模型不可见任何 `ref` / `D1` / `[[...]]` display identity。
- 工具参数只接受稳定实体 id。
- approved-but-failed tool execution 显示失败状态和原因。
- 历史数据一次性迁移，运行时不保留旧 ref parser。

## 15. Self-review

- 覆盖过去踩坑：title/id 错配、ref 污染工具、短号泄漏、title matcher 误链、sidecar 不满足正文引用。
- 复用现有 seam：`assistant.turn.blocks`、`AgentRunAccumulator`、renderer block view。
- 不新增依赖，不新增 parallel message framework。
