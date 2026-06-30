# Agent 正文内联引用与工具身份边界改造 Implementation Plan

> **给执行 Agent：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。任务用 checkbox（`- [ ]`）跟踪，按任务逐步执行。

**目标：** 在 assistant 正文里显示可点击知识库引用，同时把正文引用展示、工具实体身份、用户内容落库三条协议彻底拆开，避免模型再次把 display reference 当成工具参数。

**架构：** 工具协议只暴露稳定 Reflecta 实体 id。Assistant 正文使用自然语言和对象标题；runtime 根据 session entity catalog 生成结构化 text-span annotation，renderer 把正文中的对应 span 渲染为内联引用。模型不手写任何会话级短号、inline ref 或 title/id 组合；写工具落库前拒绝 Agent-only display token，避免把 chat 协议写进用户内容。

**技术栈：** Electron main process、Pi coding agent tools、TypeScript shared Agent session events、Streamdown renderer、Reflecta domain services、Vitest、Electron E2E fixtures。

---

## 0. 当前真实问题

用户现在碰到的不是“工具调用里要不要用引用”，而是 **assistant 正文里的知识库引用展示不可靠**。

具体表现有三类：

1. **正文没有以用户可读的引用形式展示实体。** Assistant 明明在讲某个 Domain / Understanding / Context，但正文里可能显示裸 id、缺 title 的链接、`#reflecta-wiki/...` 形式的 markdown，或者完全没有内联引用。用户需要的是正文中的实体标题能显示成可点击引用，例如 `# 三观`、`✦ 存在不需要被证明`。
2. **早期让模型手写正文引用会错配。** `[[title#id]]` / `[[type:title#id]]` 这类方案把 title、type、id 的拼装交给模型，模型会把 A 的标题和 B 的 id 拼在一起，导致“看起来可读，但点进去是另一个对象”。
3. **后来的 ref / 短号方案污染了工具身份。** 为了避免 title/id 错配，把真实 id 包进 `[[ref:S1]]`、`[D1]` 或 `[[type:id]]` 后，模型开始把这些 display reference 当成可复用实体身份，传进工具参数，最终造成 tool failed。

还有一个相邻但必须一起修的 UI 状态问题：

4. **用户确认后工具实际失败，前端没有把失败状态和原因展示清楚。** 这会让用户以为“已确认”就是“已执行成功”，但真实状态是 approval 已确认、tool execution failed。UI 必须显示失败和失败原因。

所以本版本要解决的问题不是：

- 让工具接受 `ref`、`[D1]`、`[[...]]`。
- 把引用 chip 放到消息下方绕开正文。
- 再换一种由模型手写的引用 token。

本版本真正要建立的是：

> **正文仍然显示内联引用；引用的真实 id 绑定由 runtime 结构化 annotation 负责；工具参数只使用稳定实体 id；工具执行失败必须在调用记录里显示失败原因。**

## 1. 本版本最终结论

v1.1.16 的最终形态是：**正文里显示引用，但 Agent 不再生成任何聊天引用 token。**

模型只做两件事：

1. 调工具时把稳定实体 id 放进 JSON 参数。
2. 写回复时在需要引用的位置写自然语言和实体标题。

系统做三件事：

1. 只读工具和 selected context 给模型暴露 `id`、`type`、`title/name`。
2. Runtime 把这些实体写进 session entity catalog，并在 assistant turn 完成后为正文里的实体标题生成结构化 text-span annotation。
3. Renderer 用 annotation 把正文中的对应 span 渲染成可点击引用；点击目标来自 catalog，不来自模型正文。

### 1.1 最终 Agent-facing 工具输出

```json
{
  "id": "domain_1",
  "type": "domain",
  "name": "三观"
}
```

不再输出：

```json
{
  "ref": "[[domain:domain_1]]",
  "citation": "D1",
  "domainRef": "[[domain:domain_1]]"
}
```

### 1.2 最终工具调用

```json
{
  "domainId": "domain_1"
}
```

这些全部是错误输入：

```json
{ "domainId": "D1" }
{ "domainId": "[D1]" }
{ "domainId": "[[domain:domain_1]]" }
{ "domainId": "rf_fjxcezk5az" }
```

### 1.3 最终 assistant 正文与 UI

模型写：

```md
这个理解适合放在三观下面。
```

UI 显示为正文内联引用：

```txt
这个理解适合放在 # 三观 下面。
```

其中 `# 三观` 是可点击引用。模型不写：

```md
这个理解适合放在 [D1] 下面。
这个理解适合放在 [[domain:domain_1]] 下面。
```

### 1.4 最终结构化正文引用

Runtime 为 assistant 正文生成 text-span annotation：

```ts
{
  messageId: "assistant_1",
  entity: { type: "domain", id: "domain_1", title: "三观" },
  range: { start: 8, end: 10, quote: "三观" },
  origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
}
```

`range` 是 assistant markdown 源文本里的 JS string offset，`quote` 用来防止错位。Renderer 只在 `text.slice(start, end) === quote` 时渲染内联引用；否则降级为普通文本并记录诊断日志。

### 1.5 最终写入用户内容

写工具落库前拒绝 Agent-only token，例如 `U1`、`[D1]`、`[[ref:*]]`、`[[domain:*]]`。

本版本不把 assistant 正文文本改写成 markdown wiki link。正文内联引用只存在于结构化 annotation + renderer 层；用户内容层继续使用现有编辑器/server 支持的 canonical Understanding wiki link：`[[标题#understandingId]]`。

### 1.6 工具失败状态

用户确认写工具后，如果执行失败，调用记录必须显示：

```txt
候选修改 Understanding · 执行失败
原因：domainId 必须是稳定 Domain id，不能是短号、wiki ref 或旧 source id。
```

这里的状态拆成两层：

- approval status：用户是否确认。
- execution status：确认后的工具是否成功执行。

`已确认` 不能覆盖 `执行失败`。

### 1.7 一句话验收

看代码和日志时，应该能成立这句话：

> 正文引用显示在 assistant 正文里；引用绑定来自结构化 text-span annotation；`id` 是唯一工具身份；执行失败显示失败状态和原因。

## 2. 背景、时间线和根因

v1.1.12 引入 `[[ref:S1]]` 的动机是正确的：避免模型手写 `[[type:标题#id]]`，从而把 A 的标题和 B 的 id 拼错。

真正出问题的是后续把 Reference 变成了通用 identity token：

- `8d51d988 feat(agent): let read tools use entity refs` 让只读工具接受 `ref` 参数。
- `3855b490 fix(agent): forbid bare entity ref aliases` 在 prompt 中明确要求读取对象时优先把 `[[ref:Sx]]` 作为工具参数 `ref`。
- v1.1.15 虽然把工具参数改回 stable id，但工具输出仍有 `ref` 字段，且 `[[type:id]]` 看起来同时像正文引用和可复用参数。

所以 Agent 被误导不是幻觉，而是接口语义给出了错误策略：看到对象就拿 `ref` 传参。

### 2.1 已踩过的坑

这条链路反复失败过，不能再通过“换一个 token 语法”解决。

| 阶段                          | 方案                                                | 当时想解决的问题                        | 实际坑                                                                                                                |
| ----------------------------- | --------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 早期 typed wiki link          | `[[understanding:标题#id]]` / `[[context:标题#id]]` | 让正文可点击并带 title                  | 模型要同时复制 `type`、`title`、`id`，会把 A 的标题和 B 的 id 拼在一起，导致错引用。                                  |
| v1.1.12 source ref            | `[[ref:S1]]` + session source map                   | 不让模型复制真实 id，避免 title/id 错配 | `S1` 是会话短号；一旦被当成身份协议，就必须依赖 source map，审批、恢复、重放路径容易丢上下文。                        |
| read tools 接受 ref           | 工具 schema 增加 `ref` 参数                         | 让模型不用处理真实 id                   | 这是根本错误：正式告诉模型 display reference 可以当工具参数。后续失败不是模型幻觉，而是它遵守了接口。                 |
| 禁止裸短号                    | 只允许完整 `[[ref:Sx]]`，禁止 `S1`                  | 避免正文出现裸 `S1`                     | 只修了表现，没有修边界；prompt 仍要求把 `[[ref:Sx]]` 传给工具。                                                       |
| v1.1.15 stable id + typed ref | 工具用真实 id，正文用 `[[type:id]]`                 | 去掉 ref 工具参数                       | `ref` 字段仍在模型可见 JSON 中，`[[type:id]]` 缺 title，前端只能显示 id；模型仍会把“正文引用字符串”当可复用对象身份。 |
| v1.1.16 初稿短号 citation     | `[U1]` / `[C1]` / `[D1]`                            | 避免 `ref` 命名污染                     | 这仍然是同一个坑：把会话内短号暴露给模型手写，迟早会回到“正文里直接说 U1/U2”或“把 `[D1]` 塞进工具参数”。              |

### 2.2 本次 review 的结论

我的设计问题是一直默认“模型必须手写某种引用 token”，然后只是在换 token：

```txt
[[type:title#id]] -> [[ref:S1]] -> [[type:id]] -> [U1]
```

这不是架构收敛，而是在同一个浅接口上打补丁。真正的深模块边界应该是：

- 模型负责语义表达和工具选择。
- 工具协议负责稳定实体 id。
- Renderer 负责展示和点击。
- Runtime 负责把工具结果、selected context 和 UI 展示需要的实体 catalog 关联起来。

模型不应该承担“生成可点击链接协议”的职责。但 v1.1.16 的产品目标是正文内联引用，所以正确做法不是取消正文引用，而是把正文引用移到 runtime 生成的结构化 text-span annotation。

## 3. 架构决策

### 3.1 三条协议

| 协议                     | 字段/语法                                           | 使用者                                        | 是否由模型手写          | 是否可传给工具 |
| ------------------------ | --------------------------------------------------- | --------------------------------------------- | ----------------------- | -------------- |
| 工具实体身份             | `id`、`domainId`、`understandingId`、`contextId`    | Pi tools、Reflecta services                   | 是，作为 JSON 工具参数  | 是             |
| Assistant 正文           | 自然语言、对象标题                                  | Agent assistant text                          | 是                      | 否             |
| 正文内联引用 annotation  | `{ messageId, range, entity: { type, id, title } }` | Runtime、Renderer                             | 否                      | 否             |
| 内容 canonical wiki link | `[[标题#understandingId]]`                          | 用户内容、编辑器、server wiki-link extraction | 不由 Agent 聊天协议生成 | 否             |

### 3.2 Agent-facing entity

只读工具和 selected context 给模型的实体形状统一为：

```ts
type AgentFacingEntity = {
  id: string;
  type: "understanding" | "context" | "domain";
  title?: string;
  name?: string;
};
```

规则：

- `id` 是唯一可以放进工具参数的身份。
- `title` / `name` 只用于人读展示。
- 面向模型的 JSON 不再出现 `ref`、`citation`、`domainRef`、`understandingRef`、`contextRef` 这类字段名。
- 如果需要正文内联引用，runtime 从同一份实体对象和 assistant final text 生成 text-span annotation，不能要求模型把某个 token 写进正文。

### 3.3 Session entity catalog

用 entity catalog 取代 source/ref registry 的模型语义：

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

持久事件使用：

```ts
type AgentEntityCatalogUpdated = AgentEventBase & {
  type: "entity.catalog.updated";
  entries: AgentEntityCatalogEntry[];
};
```

Catalog 以 `{type,id}` 为 key，不分配 `S1`、`U1`、`D1` 这类模型可见短号。

### 3.4 Structured text-span annotation

可点击正文引用用结构化 annotation，而不是正文 token：

```ts
type AgentEntityAnnotation = {
  messageId: string;
  entity: {
    type: "understanding" | "context" | "domain";
    id: string;
    title?: string;
  };
  range: {
    start: number;
    end: number;
    quote: string;
  };
  origin:
    | { kind: "selected_context" }
    | { kind: "tool_result"; toolCallId: string; toolName: string };
};
```

生成规则：

- 只对本轮 selected context 和工具结果进入 catalog 的实体生成 annotation。
- 只匹配正文中的实体 `title/name`，不匹配 `id`、短号或旧 ref。
- 跳过 inline code、fenced code 和已有 markdown link。
- 同一个 title 对应多个实体时不自动 annotation，避免错引用。
- `range` 使用 assistant markdown 源文本的 JS string offset，并带 `quote` 二次校验。

Renderer 把 annotation 对应 span 渲染为现有 `WikiLinkChip` 风格的内联引用。v1.1.16 不做 sidecar-only chip，也不让模型手写 inline citation。

旧 `entity.sources.updated` 只通过一次性迁移转换，不在 reducer 和 renderer 长期兼容。

### 3.5 Tool execution state

工具调用 UI 使用同一个 assistant block，但 block 必须同时表达 approval 和 execution：

```ts
type AgentApprovalBlock = {
  kind: "approval";
  approvalState: "pending" | "approved" | "rejected";
  executionState: "not_started" | "running" | "completed" | "failed";
  displayState: "pending_approval" | "rejected" | "running" | "completed" | "failed";
  error?: string;
  executionError?: AgentToolExecutionError;
};
```

Reducer 处理 `approval.resolved` 只更新 `approvalState`；处理 `tool.execution.failed` 才更新 `executionState`、`displayState` 和 `error`。Renderer 展示时以 `displayState === "failed"` 优先，不让 `已确认` 遮住失败。

### 3.6 重新考虑后的实现选择

这次不再从“给模型一个更好的引用 token”出发，而是从职责归属出发：

| 方案                                         | 结论 | 原因                                                                                            |
| -------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| 模型手写 `[[title#id]]` / typed wiki link    | 拒绝 | 这是最早踩坑的方案，会出现 title/id 错配。                                                      |
| 模型手写 `[[ref:S1]]`、`[D1]`、`U1`          | 拒绝 | 会话短号会污染工具参数，也会在正文里泄漏不可读符号。                                            |
| 工具接受 display reference                   | 拒绝 | 正式把展示协议变成身份协议，是 tool failed 的根因。                                             |
| Renderer 看到同名标题就自动链接              | 拒绝 | 前端没有足够上下文判断“这个标题对应哪个实体”，同名时会错链。                                    |
| Runtime 用 catalog 生成 text-span annotation | 采用 | Runtime 同时拥有 assistant final text 和本轮实体 catalog，能在不改正文文本的情况下绑定真实 id。 |

采用方案的边界：

- Runtime 只能为“本轮 selected context / tool result 里出现过，且 title 在正文中唯一匹配”的实体生成 annotation。
- 匹配失败、同名冲突、quote 校验失败时，宁可显示普通正文，也不能生成可能点错的引用。
- Renderer 不负责猜实体，只负责校验 `range.quote` 并渲染 annotation。
- 工具协议完全不知道 annotation 的存在，只接受稳定 id。

## 4. 非目标

- 不让写工具接受短号、`citation`、`ref`、`[[...]]`、`rf_*` 或去掉前缀的 source id。
- 不扩展 server service 去理解 chat display token。
- 不改 Reflecta 数据库实体 id 生成策略。
- 不把 Domain / Context display token 强行写成内容层 wiki link。当前内容层 canonical wiki link 只支持 Understanding link。
- 不做 claim-level evidence validation。
- 不做 sidecar-only 引用展示；本版本目标是 assistant 正文内联引用。
- 不做模型手写 inline citation syntax；inline citation 必须来自 structured text-span annotation。
- 不把 tool failed 伪装成 approval rejected；approval 和 execution 是两个状态。

## 5. 文件结构

### Main process

- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.ts` -> `apps/electron/src/main/services/agent/agent-entity-catalog.ts`
- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts` -> `apps/electron/src/main/services/agent/agent-entity-catalog.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`
- Create: `apps/electron/src/main/services/agent/agent-entity-annotations.ts`
- Create: `apps/electron/src/main/services/agent/agent-entity-annotations.test.ts`

### Shared typing

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/preload/typings/agent-context.ts`

### Renderer

- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

### Migration

- Create: `scripts/migrations/v1.1.16-agent-entity-catalog.ts`
- Delete after running against provided data roots.

## 6. Task 1: 引入无短号的 AgentEntityCatalog

**Files:**

- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.ts`
- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
- Modify: `apps/electron/src/preload/typings/agent.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/electron/src/main/services/agent/agent-entity-catalog.test.ts` 覆盖按 `{type,id}` upsert 和 title 更新：

```ts
import { describe, expect, test } from "vitest";
import { AgentEntityCatalog } from "./agent-entity-catalog";

describe("AgentEntityCatalog", () => {
  test("upserts entities by stable type and id without allocating short handles", () => {
    const catalog = new AgentEntityCatalog();

    const first = catalog.addEntity(
      { type: "domain", id: "domain_1", title: "旧标题" },
      { kind: "user_context", messageId: "user_1" },
    );
    const second = catalog.addEntity(
      { type: "domain", id: "domain_1", title: "三观" },
      { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
    );

    expect(first.key).toBe("domain:domain_1");
    expect(second.key).toBe("domain:domain_1");
    expect(catalog.snapshot()).toEqual([
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
    ]);
    expect(JSON.stringify(catalog.snapshot())).not.toContain("D1");
    expect(JSON.stringify(catalog.snapshot())).not.toContain("citation");
  });
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-catalog.test.ts
```

Expected: FAIL，因为 `AgentEntityCatalog` 尚未存在。

- [ ] **Step 3: 实现最小 catalog**

将 registry 改成 catalog，核心接口保持小：

```ts
export class AgentEntityCatalog {
  addEntity(entity: AgentContextRef, origin: AgentEntityCatalogOrigin): AgentEntityCatalogEntry;
  decorateToolOutput(toolName: string, toolCallId: string, output: unknown): unknown;
  resolveEntity(type: AgentContextRef["type"], id: string): AgentContextRef | null;
  drainUpdates(): AgentEntityCatalogEntry[];
  snapshot(): AgentEntityCatalogEntry[];
}
```

key 规则：

```ts
function entityCatalogKey(entity: AgentContextRef) {
  return `${entity.type}:${entity.id}`;
}
```

同一个 `{type,id}` 在同一 session 内复用同一个 entry。不要分配 `S1`、`U1`、`D1` 这类模型可见短号。

- [ ] **Step 4: 删除 source/ref 语义**

在 catalog 文件中删除这些概念：

```ts
sourceId;
sourceMarker;
entityRef;
ref;
handle;
citation;
```

替换为：

```ts
key;
entity;
origin;
```

`decorateEntityObject()` 输出：

```ts
{
  ...value,
  id,
  type,
}
```

注意：模型可见 JSON 不包含短号、`ref`、`citation`。可点击展示由 renderer 消费 catalog/annotation 生成。

- [ ] **Step 5: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-catalog.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-entity-catalog.ts apps/electron/src/main/services/agent/agent-entity-catalog.test.ts apps/electron/src/preload/typings/agent.ts
rtk git commit -m "refactor(agent): replace entity sources with catalog"
```

## 7. Task 2: 工具输出删除 ref/citation，只保留 id/type/title

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-entity-catalog.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`

- [ ] **Step 1: 写失败测试**

在 `pi-readonly-tools.test.ts` 中把工具输出期望改为：

```ts
expect(output.details).toEqual({
  candidates: [
    {
      id: "u_1",
      type: "understanding",
      title: "Feedback Loop",
      body: "body",
      matchedContexts: [
        {
          contextId: "ctx_1",
          type: "context",
          title: "一次复盘",
          excerpt: "excerpt",
        },
      ],
    },
  ],
});
```

并加断言：

```ts
expect(JSON.stringify(output.details)).not.toContain('"ref"');
expect(JSON.stringify(output.details)).not.toContain('"citation"');
expect(JSON.stringify(output.details)).not.toContain("[[");
expect(JSON.stringify(output.details)).not.toContain("[U");
expect(JSON.stringify(output.details)).not.toContain("[D");
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: FAIL，因为当前输出仍包含 `ref` 和 `[[type:id]]`。

- [ ] **Step 3: 修改 decorator**

规则：

- 实体对象补 `type`。
- 保留原有稳定 `id` 字段。
- 删除派生的 `domainRef`、`understandingRef`、`contextRef`。
- 删除派生的 `domainRefs`、`understandingRefs`、`contextRefs`。

不要再生成 `[[type:id]]`、`[U1]` 或任何模型可见 display token。

- [ ] **Step 4: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-catalog.test.ts src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-entity-catalog.ts apps/electron/src/main/services/agent/pi-readonly-tools.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
rtk git commit -m "fix(agent): expose entity ids without display refs"
```

## 8. Task 3: Prompt 契约禁止模型手写引用 token

**Files:**

- Modify: `apps/electron/src/preload/typings/agent-context.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`

- [ ] **Step 1: 写失败测试**

在 `pi-prompt.test.ts` 中断言 selected context block 是：

```txt
- type=Domain; id=domain-1; title=React
```

并断言：

```ts
expect(prompt).toContain("工具参数只能使用 id");
expect(prompt).toContain("聊天正文直接写对象标题或自然语言");
expect(prompt).toContain("不要在正文中写 S1、U1、D1");
expect(prompt).not.toContain("[[ref:");
expect(prompt).not.toContain("[[domain:");
expect(prompt).not.toContain("citation=");
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-prompt.test.ts
```

Expected: FAIL，因为当前 prompt 仍写 `ref`。

- [ ] **Step 3: 改 selected context block**

输出格式：

```txt
用户显式 @ 了这些知识库对象。它们只是轻量引用，不包含完整内容；需要内容时调用对应只读工具读取。
工具参数只能使用 id。聊天正文直接写对象标题或自然语言；不要在正文中写 S1、U1、D1、[[...]] 或任何会话短号。
- type=Understanding; id=understanding-1; title=React Server Components
- type=Domain; id=domain-1; title=React
```

- [ ] **Step 4: 改 system prompt**

替换聊天正文引用段：

```md
## 工具身份和正文表达

Reflecta 工具会返回稳定实体 id、type、title/name。

调用工具时只能使用 `id`、`domainId`、`understandingId`、`contextId` 这些稳定实体 id。

写聊天正文时直接写对象标题或自然语言。不要为了让前端可点击而手写 `S1`、`U1`、`D1`、`[[...]]`、`rf_*` 或任何 display token。

可点击实体展示由 Reflecta runtime 根据 selected context 和工具结果生成，不由你手写正文协议。
```

- [ ] **Step 5: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-prompt.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent-context.ts apps/electron/src/main/services/agent/pi-prompt.test.ts apps/electron/src/main/services/agent/agent-system-prompt.md
rtk git commit -m "fix(agent): stop prompting handwritten entity refs"
```

## 9. Task 4: 生成并渲染正文内联 entity annotation

**Files:**

- Create: `apps/electron/src/main/services/agent/agent-entity-annotations.ts`
- Create: `apps/electron/src/main/services/agent/agent-entity-annotations.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `context-reference.test.ts` 添加：

```ts
test("does not convert session short codes in assistant text", () => {
  expect(referenceMarkdownToLinks("看 [D1]")).toBe("看 [D1]");
  expect(referenceMarkdownToLinks("看 U1")).toBe("看 U1");
});
```

新增 `agent-entity-annotations.test.ts`：

```ts
import { describe, expect, test } from "vitest";
import { buildAgentEntityAnnotations } from "./agent-entity-annotations";

describe("buildAgentEntityAnnotations", () => {
  test("binds catalog entity titles to assistant text spans", () => {
    const annotations = buildAgentEntityAnnotations({
      messageId: "assistant_1",
      text: "这个理解适合放在三观下面。",
      catalog: [
        {
          key: "domain:domain_1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
        },
      ],
    });

    expect(annotations).toEqual([
      {
        messageId: "assistant_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        range: { start: 8, end: 10, quote: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
      },
    ]);
  });

  test("does not annotate ambiguous duplicate titles", () => {
    const annotations = buildAgentEntityAnnotations({
      messageId: "assistant_1",
      text: "放在三观下面。",
      catalog: [
        {
          key: "domain:domain_1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
        },
        {
          key: "domain:domain_2",
          entity: { type: "domain", id: "domain_2", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
        },
      ],
    });

    expect(annotations).toEqual([]);
  });

  test("skips code spans and existing markdown links", () => {
    const catalog = [
      {
        key: "domain:domain_1",
        entity: { type: "domain" as const, id: "domain_1", title: "三观" },
        origin: { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "domain_list" },
      },
    ];

    expect(
      buildAgentEntityAnnotations({
        messageId: "assistant_1",
        text: "代码 `三观` 不标注，[三观](https://example.com) 不重复标注。",
        catalog,
      }),
    ).toEqual([]);
  });
});
```

在 `message-list.test.tsx` 添加结构化 inline annotation 渲染测试：

```tsx
test("renders entity annotations inline in assistant text", () => {
  const entityCatalog = [
    {
      key: "domain:domain_1",
      entity: { type: "domain" as const, id: "domain_1", title: "三观" },
      origin: { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "domain_list" },
    },
  ];

  renderMessageList({
    messages: [{ id: "assistant_1", role: "assistant", content: "放在三观下面。" }],
    entityCatalog,
    entityAnnotations: [
      {
        messageId: "assistant_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        range: { start: 2, end: 4, quote: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
      },
    ],
  });

  const citation = screen.getByRole("button", { name: /三观/ });
  expect(citation).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-annotations.test.ts src/renderer/src/modules/chat/context/context-reference.test.ts src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: FAIL，因为当前还没有 text-span annotation 生成和 inline 渲染。

- [ ] **Step 3: 实现 annotation 生成模块**

新增 `buildAgentEntityAnnotations()`：

```ts
export function buildAgentEntityAnnotations(input: {
  messageId: string;
  text: string;
  catalog: AgentEntityCatalogEntry[];
}): AgentEntityAnnotation[] {
  // implementation lives here; callers only pass final text + catalog.
}
```

规则：

- 只用 catalog 中的 `entity.title` / `entity.name` 匹配正文，不匹配 id。
- 同名实体超过一个时跳过，避免错链。
- 跳过 inline code、fenced code 和 markdown link 范围。
- `range` 使用 assistant markdown 源文本 offset，必须带 `quote`。
- 不解析 `S1`、`U1`、`D1`、`[D1]`、`[[ref:*]]`、`[[type:id]]`。

- [ ] **Step 4: 在 assistant turn 完成时写入 annotations event**

在 `pi-agent-host.ts` 或现有 assistant turn 聚合点：

- 最终 assistant text 确定后调用 `buildAgentEntityAnnotations()`。
- 如果有 annotation，追加 `entity.annotations.updated` 事件。
- 这个步骤不改 assistant text 原文。

- [ ] **Step 5: Renderer inline 渲染**

`AgentMessageContent` 当前已经传 `entitySources`，改名为 `entityCatalog`。新增 `entityAnnotations` 并按 `messageId` 传给 `MarkdownBody`。

Renderer 规则：

- 按 `range.start` 从后往前把正文切成 React nodes，避免 offset 被前一次替换破坏。
- 只有 `value.slice(start, end) === quote` 时渲染 `WikiLinkChip`。
- `quote` 校验失败时渲染原文，不兜底猜测。
- 点击仍复用现有 inspector。

- [ ] **Step 6: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-annotations.test.ts src/renderer/src/modules/chat/context/context-reference.test.ts src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-entity-annotations.ts apps/electron/src/main/services/agent/agent-entity-annotations.test.ts apps/electron/src/renderer/src/modules/chat/context/context-reference.ts apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx
rtk git commit -m "fix(chat): render entity annotations inline"
```

## 10. Task 5: 写工具参数 preflight 拒绝短号/ref

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **Step 1: 写失败测试**

在 `pi-write-tools.test.ts` 添加：

```ts
test.each(["D1", "[D1]", "[[domain:domain_1]]", "rf_fjxcezk5az"])(
  "rejects display tokens in domain id fields: %s",
  async (domainId) => {
    await expect(
      executePiApprovedTool("domain_update", { domainId, name: "New name" }),
    ).rejects.toThrow("domainId 必须是稳定 Domain id");
  },
);

test("rejects wiki refs in understanding id fields", async () => {
  await expect(
    executePiApprovedTool("understanding_update", {
      understandingId: "[[understanding:u_1]]",
      body: "new body",
    }),
  ).rejects.toThrow("understandingId 必须是稳定 Understanding id");
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-write-tools.test.ts
```

Expected: FAIL，因为当前 `requiredString()` 不区分 id 与 display token。

- [ ] **Step 3: 实现 id 校验**

新增：

```ts
const SHORT_HANDLE_PATTERN = /^\[?(U|C|D|S)\d+\]?$/;
const WIKI_REF_PATTERN = /^\[\[[^\]]+\]\]$/;
const LEGACY_SOURCE_ID_PATTERN = /^rf_[A-Za-z0-9_-]+$/;

function requiredEntityId(
  payload: Record<string, unknown>,
  field: string,
  label: "Understanding" | "Context" | "Domain",
): string {
  const value = requiredString(payload, field);
  if (
    SHORT_HANDLE_PATTERN.test(value) ||
    WIKI_REF_PATTERN.test(value) ||
    LEGACY_SOURCE_ID_PATTERN.test(value)
  ) {
    throw new Error(`${field} 必须是稳定 ${label} id，不能是短号、wiki ref 或旧 source id。`);
  }
  return value;
}
```

把 `understandingId`、`contextId`、`domainId`、`parentId`、`domainIds` 统一走这个校验。

- [ ] **Step 4: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-write-tools.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts
rtk git commit -m "fix(agent): reject display tokens in write tool ids"
```

## 11. Task 6: 落库前拒绝 Agent-only display token

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **Step 1: 写失败测试**

在 `pi-write-tools.test.ts` 添加：

```ts
test.each(["参考 U1", "参考 [U1]", "参考 [[domain:domain_1]]", "参考 [[ref:rf_1]]"])(
  "rejects agent-only display tokens before persisting body: %s",
  async (body) => {
    await expect(
      executePiApprovedTool("understanding_create", {
        title: "New",
        body,
        domainIds: ["domain_1"],
      }),
    ).rejects.toThrow("候选正文包含 Agent-only 引用 token");
    expect(services.createUnderstanding).not.toHaveBeenCalled();
  },
);

test("allows display-looking text inside code spans", async () => {
  services.createUnderstanding.mockResolvedValue({ id: "created_1" });

  await executePiApprovedTool("understanding_create", {
    title: "New",
    body: "示例代码 `U1` 不应被当成引用。",
    domainIds: ["domain_1"],
  });

  expect(services.createUnderstanding).toHaveBeenCalled();
});
```

- [ ] **Step 2: 实现 markdown guard**

规则：

- `understanding_create.body`
- `understanding_update.body`
- `understanding_update.after.body`
- `context_create.content`
- `context_update.content`

这些字段执行 guard。

guard 行为：

- 普通正文中的 `S1`、`U1`、`D1`、`[U1]`、`[[ref:*]]`、`[[type:id]]` 拒绝写入。
- inline code 和 fenced code 内保持原文本
- 错误要进入 `tool.execution.failed`，UI 显示“候选正文包含 Agent-only 引用 token，请改成对象标题或 canonical wiki link。”

- [ ] **Step 3: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-write-tools.test.ts src/main/services/agent/pi-agent-host.test.ts
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts
rtk git commit -m "fix(agent): reject display tokens before writes"
```

## 12. Task 7: 工具确认后执行失败必须显示失败原因

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`

- [ ] **Step 1: 写 reducer 失败优先测试**

在 `agent-reducer.test.ts` 添加：

```ts
test("keeps approved approval but displays execution failure", () => {
  const base = {
    sessionId: "session_1",
    runId: "run_1",
    messageId: "assistant_1",
    toolCallId: "tool_1",
    toolName: "understanding_update",
  };

  const session = reduceAgentSession([
    {
      id: "evt_1",
      type: "approval.requested",
      createdAt: "2026-06-30T00:00:00.000Z",
      approvalId: "approval_1",
      title: "候选修改 Understanding",
      ...base,
    },
    {
      id: "evt_2",
      type: "approval.resolved",
      createdAt: "2026-06-30T00:00:01.000Z",
      approvalId: "approval_1",
      approved: true,
      ...base,
    },
    {
      id: "evt_3",
      type: "tool.execution.failed",
      createdAt: "2026-06-30T00:00:02.000Z",
      error: { message: "domainId 必须是稳定 Domain id" },
      ...base,
    },
  ]);

  const approval = session.messages[0]?.blocks?.find((block) => block.kind === "approval");
  expect(approval).toMatchObject({
    kind: "approval",
    approved: true,
    approvalState: "approved",
    executionState: "failed",
    displayState: "failed",
    state: "failed",
    error: "domainId 必须是稳定 Domain id",
  });
});
```

- [ ] **Step 2: 写 UI 展示测试**

在 `message-list.test.tsx` 添加：

```tsx
test("shows execution failure reason after approval was confirmed", () => {
  renderMessageList({
    messages: [
      {
        id: "assistant_1",
        role: "assistant",
        text: "",
        blocks: [
          {
            kind: "approval",
            approvalId: "approval_1",
            toolCallId: "tool_1",
            toolName: "understanding_update",
            title: "候选修改 Understanding",
            approved: true,
            state: "failed",
            approvalState: "approved",
            executionState: "failed",
            displayState: "failed",
            error: "domainId 必须是稳定 Domain id",
            executionError: { message: "domainId 必须是稳定 Domain id" },
            createdAt: "2026-06-30T00:00:00.000Z",
          },
        ],
      },
    ],
  });

  expect(screen.getByText("执行失败")).toBeInTheDocument();
  expect(screen.getByText("domainId 必须是稳定 Domain id")).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: FAIL，如果 UI 当前只显示 `已确认` 而不显示失败原因。

- [ ] **Step 4: 修 renderer 状态文案**

在 approval block 渲染中按优先级展示：

```ts
if (block.displayState === "failed") return "执行失败";
if (block.displayState === "completed") return "已执行";
if (block.displayState === "pending_approval") return "待确认";
if (block.displayState === "rejected") return "已拒绝";
return "已确认";
```

失败时显示：

```tsx
{
  block.displayState === "failed" && block.error ? (
    <p className="text-destructive">{block.error}</p>
  ) : null;
}
```

- [ ] **Step 5: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx
rtk git commit -m "fix(chat): show approved tool execution failures"
```

## 13. Task 8: Session reducer 改用 entity catalog 和 annotations

**Files:**

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- Modify: reducer logic in `apps/electron/src/preload/typings/agent.ts`

- [ ] **Step 1: 写失败测试**

在 `agent-reducer.test.ts` 添加：

```ts
test("reduces entity catalog updates by key", () => {
  const session = reduceAgentSession([
    {
      id: "evt_1",
      type: "entity.catalog.updated",
      sessionId: "session_1",
      createdAt: "2026-06-30T00:00:00.000Z",
      entries: [
        {
          key: "domain:domain_1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
        },
      ],
    },
  ]);

  expect(session.entityCatalog).toEqual([
    {
      key: "domain:domain_1",
      entity: { type: "domain", id: "domain_1", title: "三观" },
      origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
    },
  ]);
});

test("reduces entity annotations by message", () => {
  const session = reduceAgentSession([
    {
      id: "evt_1",
      type: "entity.annotations.updated",
      sessionId: "session_1",
      createdAt: "2026-06-30T00:00:00.000Z",
      annotations: [
        {
          messageId: "assistant_1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          range: { start: 2, end: 4, quote: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
        },
      ],
    },
  ]);

  expect(session.entityAnnotations).toHaveLength(1);
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: FAIL，因为 session 仍是 `entitySources`。

- [ ] **Step 3: 修改 shared type**

`AgentReducedSession` 字段改为：

```ts
entityCatalog: AgentEntityCatalogEntry[];
entityAnnotations: AgentEntityAnnotation[];
```

删除或迁移：

```ts
entitySources;
AgentEntitySource;
AgentEntitySourcesUpdated;
```

- [ ] **Step 4: 运行相关测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts src/renderer/src/modules/chat/session/thread-view.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/session/thread-view.test.ts
rtk git commit -m "refactor(agent): reduce entity catalog annotations"
```

## 14. Task 9: 一次性迁移历史 session

**Files:**

- Create: `scripts/migrations/v1.1.16-agent-entity-catalog.ts`
- Modify: session log fixtures if needed
- Delete: `scripts/migrations/v1.1.16-agent-entity-catalog.ts` after production/test migration succeeds

- [ ] **Step 1: 写迁移脚本**

脚本接收 content storage root：

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-catalog.ts <projectRoot>/.local/reflecta-prod
rtk bun scripts/migrations/v1.1.16-agent-entity-catalog.ts <projectRoot>/.local/reflecta-test
```

迁移规则：

- `entity.sources.updated` -> `entity.catalog.updated`
- `source.entity.type + source.entity.id` 相同的对象复用同一个 catalog entry
- 不分配新短号
- assistant text 中能通过同 session source map 解析的旧 `[[ref:*]]` 改写为对象 title 文本，并为该 message 增加带 `range` 的 `entity.annotations.updated`
- assistant text 中旧 `[[type:id]]` 如果同 session catalog 有匹配，改写为对象 title 文本，并为该 message 增加带 `range` 的 annotation
- 无法解析的旧 ref 保留普通文本，不生成运行时兼容逻辑
- 重复执行脚本不重复追加事件

- [ ] **Step 2: Dry run**

Run:

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-catalog.ts --dry-run <projectRoot>/.local/reflecta-prod
rtk bun scripts/migrations/v1.1.16-agent-entity-catalog.ts --dry-run <projectRoot>/.local/reflecta-test
```

Expected output:

```txt
entity.sources.updated migrated: N
assistant refs rewritten: N
unresolved refs kept as text: N
duplicate catalog events skipped: N
```

- [ ] **Step 3: Run migration**

Run:

```bash
rtk bun scripts/migrations/v1.1.16-agent-entity-catalog.ts <projectRoot>/.local/reflecta-prod
rtk bun scripts/migrations/v1.1.16-agent-entity-catalog.ts <projectRoot>/.local/reflecta-test
```

Expected: both commands exit 0 and print the same counters without dry-run.

- [ ] **Step 4: 删除迁移脚本**

```bash
rtk rm scripts/migrations/v1.1.16-agent-entity-catalog.ts
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src scripts/migrations docs/iterations/v1.1.16
rtk git commit -m "chore(agent): migrate session entity catalogs"
```

## 15. Task 10: 全局清理 ref 命名

**Files:**

- Modify files found by grep

- [ ] **Step 1: 扫描残留**

Run:

```bash
rtk rg -n "\\bref\\b|Ref\\b|\\[\\[ref:|entitySources|sourceId|rf_" apps/electron/src docs/iterations/v1.1.16
```

允许保留的位置：

- 非 Agent 的 React `ref`。
- 历史文档中作为背景解释的 `[[ref:*]]`。
- `reflecta-wiki` renderer 内部 URL prefix。

不允许保留的位置：

- Agent tool schema。
- Agent-facing JSON 字段。
- Agent prompt。
- Renderer 短号 resolver。

- [ ] **Step 2: 删除运行时兼容**

删除这些行为：

- parse `[[ref:*]]`
- parse `[[type:id]]` 作为新的 Agent 正文协议
- parse `U1` / `[U1]` / `D1` / `[D1]` 作为新的 Agent 正文协议
- tool 参数接受 `ref`
- model-facing output 暴露 `ref`

- [ ] **Step 3: 运行全量验证**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
rtk bun run typecheck
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
rtk git add apps/electron/src docs/iterations/v1.1.16
rtk git commit -m "refactor(agent): remove ref protocol leftovers"
```

## 16. Task 11: Release patch

**Files:**

- Modify release metadata according to the existing release script output.

- [ ] **Step 1: Run focused e2e or smoke**

Run the smallest existing Agent smoke that covers:

- selected context appears in prompt with `id` and title, without short handles
- read tool output contains `id`, `type`, and title, without `ref` / `citation`
- assistant text does not convert `D1` / `[D1]`
- entity annotations render inline citations in assistant text
- write tool rejects `D1` / `[D1]` in `domainId`
- approved write failure displays `tool.execution.failed`

Command:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
```

- [ ] **Step 2: Release**

Run the project release patch command used for v1.1.15.

Expected:

- version becomes `v1.1.16`
- changelog or release metadata mentions Agent annotation / tool identity boundary

- [ ] **Step 3: Commit**

```bash
rtk git add .
rtk git commit -m "chore(release): v1.1.16"
```

## 17. 验收标准

- Agent prompt 和 tool schema 中不再出现“把 ref 传给工具”的表达。
- Agent-facing JSON 中不再出现 `ref` 字段。
- 工具参数中传 `U1`、`[U1]`、`[D1]`、`[[...]]`、`rf_*` 会失败，并展示清楚原因。
- Assistant 正文中的 `U1`、`[U1]`、`D1`、`[D1]` 不会被当成引用自动转换。
- Assistant 正文中的实体标题会被结构化 annotation 渲染成内联可点击引用。
- inline code 和 fenced code 内 display-looking text 不被误判。
- 写工具落库前不会把 `U1` / `[U1]` 这类 Agent-only token 存进用户内容。
- 历史 session 通过一次性迁移处理，运行时不保留旧 ref 兼容 parser。
- 用户确认后工具执行失败时，调用记录显示 `执行失败` 和失败原因，不只显示 `已确认`。

## 18. 自检

- 覆盖范围：计划覆盖 catalog、tool output、prompt、inline renderer annotations、write preflight、markdown guard、tool execution failure display、session migration、ref cleanup。
- 命名一致性：模型可见字段不使用 `ref` / `citation`；工具身份统一使用 `id`。
- 风险控制：不改 server service id 策略，不改编辑器 canonical wiki-link 基础设施。
