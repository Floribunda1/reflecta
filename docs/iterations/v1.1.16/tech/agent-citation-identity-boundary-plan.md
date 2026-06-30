# Agent Citation 与工具身份边界改造 Implementation Plan

> **给执行 Agent：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。任务用 checkbox（`- [ ]`）跟踪，按任务逐步执行。

**目标：** 把 Agent 正文引用、工具实体身份、前端可点击链接彻底拆成三条协议，避免模型再次把 display reference 当成工具参数。

**架构：** 工具协议只暴露稳定 Reflecta 实体 id。正文引用使用会话级 citation handle，例如 `[U1]`、`[C1]`、`[D1]`，handle 只能由 runtime 分配。Renderer 通过 session entity catalog 把 handle 解析成 `{ type, id, title }` 后渲染 chip；写工具落库前把 handle 归一化为 Reflecta 内容层现有 canonical wiki link 或普通标题。

**技术栈：** Electron main process、Pi coding agent tools、TypeScript shared Agent session events、Streamdown renderer、Reflecta domain services、Vitest、Electron E2E fixtures。

---

## 1. 背景和根因

v1.1.12 引入 `[[ref:S1]]` 的动机是正确的：避免模型手写 `[[type:标题#id]]`，从而把 A 的标题和 B 的 id 拼错。

真正出问题的是后续把 Reference 变成了通用 identity token：

- `8d51d988 feat(agent): let read tools use entity refs` 让只读工具接受 `ref` 参数。
- `3855b490 fix(agent): forbid bare entity ref aliases` 在 prompt 中明确要求读取对象时优先把 `[[ref:Sx]]` 作为工具参数 `ref`。
- v1.1.15 虽然把工具参数改回 stable id，但工具输出仍有 `ref` 字段，且 `[[type:id]]` 看起来同时像正文引用和可复用参数。

所以 Agent 被误导不是幻觉，而是接口语义给出了错误策略：看到对象就拿 `ref` 传参。

## 2. 架构决策

### 2.1 三条协议

| 协议                     | 字段/语法                                        | 使用者                                        | 是否可传给工具 |
| ------------------------ | ------------------------------------------------ | --------------------------------------------- | -------------- |
| 工具实体身份             | `id`、`domainId`、`understandingId`、`contextId` | Pi tools、Reflecta services                   | 是             |
| 正文 citation            | `[U1]`、`[C1]`、`[D1]`                           | Agent assistant text、Renderer                | 否             |
| 内容 canonical wiki link | `[[标题#understandingId]]`                       | 用户内容、编辑器、server wiki-link extraction | 否             |

### 2.2 Agent-facing entity

只读工具和 selected context 给模型的实体形状统一为：

```ts
type AgentFacingEntity = {
  id: string;
  type: "understanding" | "context" | "domain";
  citation: string;
  title?: string;
  name?: string;
};
```

规则：

- `id` 是唯一可以放进工具参数的身份。
- `citation` 只能出现在聊天正文，不允许出现在工具参数。
- `title` / `name` 只用于人读展示。
- 面向模型的 JSON 不再出现 `ref`、`domainRef`、`understandingRef`、`contextRef` 这类字段名。

### 2.3 Session entity catalog

用 entity catalog 取代 source/ref registry 的模型语义：

```ts
type AgentEntityCatalogEntry = {
  handle: "U1" | "C1" | "D1";
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

旧 `entity.sources.updated` 只通过一次性迁移转换，不在 reducer 和 renderer 长期兼容。

## 3. 非目标

- 不让写工具接受 `citation`、`ref`、`[[...]]`、`rf_*` 或去掉前缀的 source id。
- 不扩展 server service 去理解 chat citation。
- 不改 Reflecta 数据库实体 id 生成策略。
- 不把 Domain / Context citation 强行写成内容层 wiki link。当前内容层 canonical wiki link 只支持 Understanding link。
- 不做 claim-level evidence validation。

## 4. 文件结构

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

## 5. Task 1: 引入 AgentEntityCatalog

**Files:**

- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.ts`
- Rename: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
- Modify: `apps/electron/src/preload/typings/agent.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/electron/src/main/services/agent/agent-entity-catalog.test.ts` 覆盖 handle 分配和 title 更新：

```ts
import { describe, expect, test } from "vitest";
import { AgentEntityCatalog } from "./agent-entity-catalog";

describe("AgentEntityCatalog", () => {
  test("allocates typed citation handles and updates titles", () => {
    const catalog = new AgentEntityCatalog();

    const first = catalog.addEntity(
      { type: "domain", id: "domain_1", title: "旧标题" },
      { kind: "user_context", messageId: "user_1" },
    );
    const second = catalog.addEntity(
      { type: "domain", id: "domain_1", title: "三观" },
      { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
    );

    expect(first.handle).toBe("D1");
    expect(second.handle).toBe("D1");
    expect(catalog.snapshot()).toEqual([
      {
        handle: "D1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
    ]);
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
  drainUpdates(): AgentEntityCatalogEntry[];
  snapshot(): AgentEntityCatalogEntry[];
}
```

handle 分配规则：

```ts
const HANDLE_PREFIX = {
  understanding: "U",
  context: "C",
  domain: "D",
} as const;
```

同一个 `{type,id}` 在同一 session 内复用同一个 handle。新实体按类型独立递增，例如 `U1`、`U2`、`D1`。

- [ ] **Step 4: 删除 source/ref 语义**

在 catalog 文件中删除这些概念：

```ts
sourceId;
sourceMarker;
entityRef;
ref;
```

替换为：

```ts
handle;
citation;
```

`decorateEntityObject()` 输出：

```ts
{
  ...value,
  id,
  type,
  citation: entry.handle,
}
```

注意：模型可见字符串是 `[U1]`，但 JSON 字段值保存裸 handle `U1` 更清楚。Prompt 中显示时再包成 `[U1]`。

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

## 6. Task 2: 工具输出从 ref 改为 citation

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
      citation: "U1",
      title: "Feedback Loop",
      body: "body",
      matchedContexts: [
        {
          contextId: "ctx_1",
          type: "context",
          citation: "C1",
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
expect(JSON.stringify(output.details)).not.toContain("[[");
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: FAIL，因为当前输出仍包含 `ref` 和 `[[type:id]]`。

- [ ] **Step 3: 修改 decorator**

规则：

- 实体对象补 `type` 和 `citation`。
- 保留原有稳定 `id` 字段。
- `domainRef` -> `domainCitation`
- `understandingRef` -> `understandingCitation`
- `contextRef` -> `contextCitation`
- `domainRefs` -> `domainCitations`
- `understandingRefs` -> `understandingCitations`
- `contextRefs` -> `contextCitations`

不要再生成 `[[type:id]]`。

- [ ] **Step 4: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-entity-catalog.test.ts src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-entity-catalog.ts apps/electron/src/main/services/agent/pi-readonly-tools.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
rtk git commit -m "fix(agent): expose citations separately from ids"
```

## 7. Task 3: Prompt 契约去掉 ref

**Files:**

- Modify: `apps/electron/src/preload/typings/agent-context.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`

- [ ] **Step 1: 写失败测试**

在 `pi-prompt.test.ts` 中断言 selected context block 是：

```txt
- citation=[D1]; type=Domain; id=domain-1; title=React
```

并断言：

```ts
expect(prompt).toContain("工具参数只能使用 id");
expect(prompt).toContain("聊天正文引用只能使用 citation");
expect(prompt).not.toContain("[[ref:");
expect(prompt).not.toContain("[[domain:");
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
工具参数只能使用 id。聊天正文引用只能使用 citation，例如 [U1]。citation 不能作为工具参数。
- citation=[U1]; type=Understanding; id=understanding-1; title=React Server Components
- citation=[D1]; type=Domain; id=domain-1; title=React
```

- [ ] **Step 4: 改 system prompt**

替换聊天正文引用段：

```md
## 工具身份和聊天 citation

Reflecta 工具会返回稳定实体 id 和 citation。

调用工具时只能使用 `id`、`domainId`、`understandingId`、`contextId` 这些稳定实体 id。

写聊天正文引用 Reflecta 对象时，只能使用工具结果或 selected context 中已经出现的 citation，例如 `[U1]`、`[C1]`、`[D1]`。

错误：把 `[U1]`、`[[...]]`、`rf_*` 或 citation 文本放进工具参数。
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
rtk git commit -m "fix(agent): separate prompt citations from tool ids"
```

## 8. Task 4: Renderer 用 catalog 渲染 citation

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `context-reference.test.ts` 添加：

```ts
test("converts known citations outside code spans", () => {
  const catalog = [
    {
      handle: "D1",
      entity: { type: "domain" as const, id: "domain_1", title: "三观" },
      origin: { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "domain_list" },
    },
  ];

  expect(referenceMarkdownToLinks("看 [D1]", catalog)).toContain("三观");
  expect(referenceMarkdownToLinks("看 `[D1]`", catalog)).toBe("看 `[D1]`");
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/context/context-reference.test.ts
```

Expected: FAIL，因为 `referenceMarkdownToLinks` 当前不接 catalog。

- [ ] **Step 3: 实现 citation 转换**

新增：

```ts
const CITATION_PATTERN = /\[(U|C|D)(\d+)\]/g;
```

转换规则：

- 只转换 catalog 中存在的 handle。
- 转换为现有 `wikiHref(title, id, type)`。
- fenced code 和 inline code 内不转换。
- 未知 handle 保持普通文本。

- [ ] **Step 4: 让 MarkdownBody 传 catalog**

`AgentMessageContent` 当前已经传 `entitySources`，改名为 `entityCatalog` 或 `entityEntries`。Renderer 不再忽略第二个参数。

- [ ] **Step 5: 运行 renderer 测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/context/context-reference.test.ts src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/context/context-reference.ts apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx
rtk git commit -m "fix(chat): render agent citations through catalog"
```

## 9. Task 5: 写工具参数 preflight 拒绝 citation/ref

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **Step 1: 写失败测试**

在 `pi-write-tools.test.ts` 添加：

```ts
test("rejects citation handles in id fields", async () => {
  await expect(
    executePiApprovedTool("domain_update", { domainId: "[D1]", name: "New name" }),
  ).rejects.toThrow("domainId 必须是稳定 Domain id，不能是 citation");
});

test("rejects wiki refs in id fields", async () => {
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

Expected: FAIL，因为当前 `requiredString()` 不区分 id 与 citation。

- [ ] **Step 3: 实现 id 校验**

新增：

```ts
const CITATION_HANDLE_PATTERN = /^\[(U|C|D)\d+\]$/;
const WIKI_REF_PATTERN = /^\[\[[^\]]+\]\]$/;
const LEGACY_SOURCE_ID_PATTERN = /^rf_[A-Za-z0-9_-]+$/;

function requiredEntityId(
  payload: Record<string, unknown>,
  field: string,
  label: "Understanding" | "Context" | "Domain",
): string {
  const value = requiredString(payload, field);
  if (
    CITATION_HANDLE_PATTERN.test(value) ||
    WIKI_REF_PATTERN.test(value) ||
    LEGACY_SOURCE_ID_PATTERN.test(value)
  ) {
    throw new Error(`${field} 必须是稳定 ${label} id，不能是 citation、wiki ref 或旧 source id。`);
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
rtk git commit -m "fix(agent): reject citations in write tool ids"
```

## 10. Task 6: 落库前归一化 markdown citation

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **Step 1: 写失败测试**

在 `pi-write-tools.test.ts` 添加：

```ts
test("normalizes understanding citations before persisting markdown fields", async () => {
  services.createUnderstanding.mockResolvedValue({ id: "created_1" });

  await executePiApprovedTool(
    "understanding_create",
    { title: "New", body: "参考 [U1]", domainIds: ["domain_1"] },
    {
      resolveCitation: (handle) =>
        handle === "U1" ? { type: "understanding", id: "u_1", title: "Feedback Loop" } : null,
    },
  );

  expect(services.createUnderstanding).toHaveBeenCalledWith({
    title: "New",
    body: "参考 [[Feedback Loop#u_1]]",
    domainIds: ["domain_1"],
  });
});
```

- [ ] **Step 2: 扩展 executePiApprovedTool options**

签名改为：

```ts
export async function executePiApprovedTool(
  toolName: PiApprovalToolName,
  payload: unknown,
  options: {
    resolveCitation?: (handle: string) => AgentContextRef | null;
  } = {},
): Promise<PiApprovedToolOutput>;
```

- [ ] **Step 3: 实现 markdown 归一化**

规则：

- `understanding_create.body`
- `understanding_update.body`
- `understanding_update.after.body`
- `context_create.content`
- `context_update.content`

这些字段执行归一化。

归一化行为：

- `[U1]` 且 catalog 中存在 Understanding -> `[[title#id]]`
- `[C1]` 或 `[D1]` -> 使用 title 文本，例如 `一次复盘`、`三观`
- 未知 `[X9]` 保持原文本
- inline code 和 fenced code 内保持原文本

- [ ] **Step 4: 从 PiAgentHost 传 catalog resolver**

`executeApprovedTool()` 调用 `executePiApprovedTool()` 时传入：

```ts
resolveCitation: (handle) => active.entityCatalog.resolveHandle(handle);
```

无 active run 的恢复路径用 reduced session catalog 构造 resolver。

- [ ] **Step 5: 运行测试**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-write-tools.test.ts src/main/services/agent/pi-agent-host.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts
rtk git commit -m "fix(agent): normalize citations before writes"
```

## 11. Task 7: Session reducer 改用 entity catalog

**Files:**

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- Modify: reducer logic in `apps/electron/src/preload/typings/agent.ts`

- [ ] **Step 1: 写失败测试**

在 `agent-reducer.test.ts` 添加：

```ts
test("reduces entity catalog updates by handle", () => {
  const session = reduceAgentSession([
    {
      id: "evt_1",
      type: "entity.catalog.updated",
      sessionId: "session_1",
      createdAt: "2026-06-30T00:00:00.000Z",
      entries: [
        {
          handle: "D1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
        },
      ],
    },
  ]);

  expect(session.entityCatalog).toEqual([
    {
      handle: "D1",
      entity: { type: "domain", id: "domain_1", title: "三观" },
      origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
    },
  ]);
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
rtk git commit -m "refactor(agent): reduce entity catalog events"
```

## 12. Task 8: 一次性迁移历史 session

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
- `source.entity.type + source.entity.id` 相同的对象复用同一个 handle
- handle 按类型分配：Understanding `U1`，Context `C1`，Domain `D1`
- assistant text 中能通过同 session source map 解析的旧 `[[ref:*]]` 改写为 `[Ux]` / `[Cx]` / `[Dx]`
- assistant text 中旧 `[[type:id]]` 如果同 session catalog 有匹配，改写为 handle
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

## 13. Task 9: 全局清理 ref 命名

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
- Renderer citation resolver。

- [ ] **Step 2: 删除运行时兼容**

删除这些行为：

- parse `[[ref:*]]`
- parse `[[type:id]]` 作为新的 Agent citation
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

## 14. Task 10: Release patch

**Files:**

- Modify release metadata according to the existing release script output.

- [ ] **Step 1: Run focused e2e or smoke**

Run the smallest existing Agent smoke that covers:

- selected context appears in prompt as citation
- read tool output contains `id` and `citation`
- assistant text `[D1]` renders as title chip
- write tool rejects `[D1]` in `domainId`
- approved write failure displays `tool.execution.failed`

Command:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
```

- [ ] **Step 2: Release**

Run the project release patch command used for v1.1.15.

Expected:

- version becomes `v1.1.16`
- changelog or release metadata mentions Agent citation / tool identity boundary

- [ ] **Step 3: Commit**

```bash
rtk git add .
rtk git commit -m "chore(release): v1.1.16"
```

## 15. 验收标准

- Agent prompt 和 tool schema 中不再出现“把 ref 传给工具”的表达。
- Agent-facing JSON 中不再出现 `ref` 字段。
- 工具参数中传 `[U1]`、`[D1]`、`[[...]]`、`rf_*` 会失败，并展示清楚原因。
- Assistant 正文中的 `[U1]`、`[C1]`、`[D1]` 能渲染成对应 title chip。
- Assistant 正文中的 unknown citation 保持普通文本。
- inline code 和 fenced code 内 citation 不被转换。
- 写工具落库前不会把 `[U1]` 这类 chat citation 存进用户内容。
- 历史 session 通过一次性迁移处理，运行时不保留旧 ref 兼容 parser。

## 16. 自检

- 覆盖范围：计划覆盖 catalog、tool output、prompt、renderer、write preflight、markdown normalization、session migration、ref cleanup。
- 命名一致性：模型可见字段统一使用 `citation`；工具身份统一使用 `id`。
- 风险控制：不改 server service id 策略，不改编辑器 canonical wiki-link 基础设施。
