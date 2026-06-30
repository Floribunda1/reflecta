# Agent 工具身份与失败状态实施计划

> **给执行 Agent：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。任务用 checkbox（`- [ ]`）跟踪，按任务逐步执行。

**目标：** 让 Agent 工具调用直接使用 Reflecta 稳定实体 id，并把已批准工具的执行失败变成一等的 session、UI 和诊断日志状态。

**架构：** 工具协议里的身份就是 Reflecta service 当前使用的稳定实体 id。聊天 ref 只保留为展示和导航语法，不再是需要在工具调用中传来传去的隐藏别名。工具审批和工具执行拆成两类事实，`approval.resolved` 永远不代表工具已经成功。

**技术栈：** Electron main process、Pi coding agent tools、TypeScript shared Agent session events、SQLite-backed Reflecta domain services、Vitest、Electron E2E fixtures。

---

## 1. 问题

生产会话 `019f1431-3228-70cf-8527-89242fc94156` 暴露了两个耦合问题。

第一，Agent 可见的实体身份不一致。只读工具和 prompt 暴露的是会话级 marker，例如 `[[ref:rf_fjxcezk5az]]`；写工具期待的却是真实 domain id，例如 `s11qsWP-wgjU2Jn-0lX3b`。模型依次尝试了 `rf_fjxcezk5az`、`[[ref:rf_fjxcezk5az]]` 和 `fjxcezk5az`，全部失败为 `Domain not found`。

第二，已批准写工具的失败不够可见。日志里有 `approval.resolved approved=true`，但真正的写入失败主要保存在 Pi 原始 `toolResult` 消息里。session 数据足够人工排查，但产品事件模型没有把“工具执行失败”清楚表达出来。

截图里的用户可见症状是同一个问题在 UI 层的表现：用户确认后，候选修改卡片停留在“已确认”，但后续 `understanding_update` 实际失败了。这里的“已确认”只能表示用户批准，不应该作为卡片终态；一旦执行失败，同一张卡片必须变成“执行失败”，并展示失败原因，例如 `Domain not found: rf_fjxcezk5az`。

## 2. 架构决策

Agent 工具协议使用稳定 Reflecta 实体 id。

```json
{
  "id": "s11qsWP-wgjU2Jn-0lX3b",
  "type": "domain",
  "ref": "[[domain:s11qsWP-wgjU2Jn-0lX3b]]",
  "name": "三观"
}
```

工具调用继续使用 id 字段：

```json
{
  "title": "面对负面情绪：先减法，后加法",
  "body": "...",
  "domainIds": ["s11qsWP-wgjU2Jn-0lX3b"]
}
```

`ref` 只用于聊天正文和 renderer 导航：

```md
这个理解适合放在 [[domain:s11qsWP-wgjU2Jn-0lX3b]]。
```

Agent runtime 仍然可以保存轻量 session metadata，用于渲染 title、恢复历史消息和点击跳转。但这层 metadata 不再承担身份翻译。模型可见的输出里不应该再出现会被误认为实体 id 的 `rf_*` source id。

## 3. 非目标

- 不新增 `domainRefs`、`understandingRef`、`contextRef` 作为写工具参数。
- 不让 server domain services 认识聊天 ref 语法。
- 不继续把 `rf_*` source id 作为面向模型的实体身份。
- 不做 claim-level citation 或 evidence verification。
- 不修改 Reflecta 的数据库 id 生成策略，除非后续 import/export 需求证明当前随机 id 不够用。

## 4. 目标模型

### 4.1 实体输出形状

所有返回实体的 Agent-facing 工具输出都应该暴露：

```ts
type AgentFacingEntity = {
  id: string;
  type: "understanding" | "context" | "domain";
  ref: string;
  title?: string;
  name?: string;
};
```

规则：

- `id` 是稳定 Reflecta 实体 id，可以直接传给写工具和 service。
- `ref` 是根据 `type` 和 `id` 派生出的 renderer 语法。
- `title` / `name` 只用于展示。
- 工具原有字段尽量保留，但面向模型的输出不能再剥掉 raw `id`。

### 4.2 聊天 ref 语法

使用带类型、带真实 id 的 ref：

```txt
[[understanding:w6mEdXcCtuVAWdLlgvBXs]]
[[context:ctx_id_here]]
[[domain:s11qsWP-wgjU2Jn-0lX3b]]
```

Renderer 行为：

- 按 `type + id` resolve。
- 实体存在时，渲染为现有 clickable entity chip。
- 实体不存在时，渲染为 disabled/plain text。
- 不根据 title 猜目标实体。

### 4.3 Prompt 契约

把当前 `[[ref:...]]` 契约替换为：

```txt
Reflecta 工具会返回稳定实体 id。工具调用时必须原样使用这些 id。

写聊天正文时，使用工具结果或 selected context 里返回的 `ref` 字段。
不要发明 id。不要使用没有在当前对话、selected context 或工具结果里出现过的 id。
```

这样模型只需要记住一条简单规则：工具参数用 `id`，正文引用用 `ref`。

## 5. 工具失败状态模型

审批和执行是两个事实。

```txt
approval.requested
approval.resolved approved=true
tool.execution.started
tool.execution.completed | tool.execution.failed
```

`approval.resolved approved=true` 只表示：

```txt
用户允许工具执行。
```

它不表示：

```txt
写入已经成功。
```

### 5.1 Session Events

为已批准工具执行新增 durable semantic events。失败原因必须在事件里结构化传递到 renderer，不能要求前端反查 Pi 原始消息。

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

这些事件需要持久化，因为已批准写入可能发生在用户命令之后，也必须能在没有当前 streaming response 的情况下恢复。

### 5.2 Assistant Turn Blocks

UI 上仍然应该显示一张连贯的工具/候选卡片。Reducer 内部要保留 approval state 和 execution state 两个维度，再推导最终展示状态：

```ts
type AgentToolApprovalState = "pending" | "approved" | "rejected";
type AgentToolExecutionState = "not_started" | "running" | "completed" | "failed";
type AgentToolDisplayState = "pending_approval" | "rejected" | "running" | "completed" | "failed";
```

Block 形状应表达这两个事实：

```ts
type AgentToolBlock = {
  kind: "approval";
  toolCallId: string;
  toolName: string;
  approvalState: AgentToolApprovalState;
  executionState: AgentToolExecutionState;
  displayState: AgentToolDisplayState;
  error?: AgentToolExecutionError;
};
```

展示层只消费 `displayState` 和 `error.message`，不要重新解释 raw events。

派生规则：

```ts
function deriveDisplayState(block: AgentToolBlock): AgentToolDisplayState {
  if (block.approvalState === "rejected") return "rejected";
  if (block.approvalState === "pending") return "pending_approval";
  if (block.executionState === "failed") return "failed";
  if (block.executionState === "completed") return "completed";
  return "running";
}
```

映射：

- `approval.requested` -> `pending_approval`
- `approval.resolved approved=false` -> `rejected`
- `approval.resolved approved=true` -> `approvalState=approved`，但不作为最终成功状态
- `tool.execution.started` -> `executionState=running`
- `tool.execution.completed` -> `executionState=completed`
- `tool.execution.failed` -> `executionState=failed`

UI 文案要求：

- `pending_approval`：显示当前确认控件。
- `rejected`：显示“已拒绝”。
- `running`：显示“执行中”。
- `completed`：显示“已完成”或当前业务已有的成功文案。
- `failed`：显示“执行失败”，并在卡片内展示 `error.message`。

`approvalState=approved` 可以作为辅助信息展示，但只要 `displayState=failed`，卡片主状态和右上角状态都不能继续显示“已确认”。

### 5.3 诊断日志

每个 `tool.execution.failed` 都必须写入诊断日志：

```json
{
  "event": "agent.tool.execution.failed",
  "scope": "agent",
  "context": {
    "sessionId": "...",
    "runId": "...",
    "messageId": "...",
    "toolCallId": "..."
  },
  "attrs": {
    "toolName": "understanding_update",
    "error": {
      "message": "Domain not found: s11qs..."
    }
  }
}
```

目标排查路径：

```txt
diagnostic log -> session event -> assistant turn block
```

而不是：

```txt
raw Pi message -> grep toolResult text
```

## 6. 文件结构

需要修改：

- `apps/electron/src/main/services/agent/agent-entity-sources.ts`
  - 停止把实体 `id` 替换成 session-scoped `ref`。
  - 根据真实 id 生成 typed chat refs。
  - 只保留 renderer/session replay 仍然需要的展示 metadata helper。
- `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
  - 返回带 `id` 和 typed `ref` 的实体输出。
  - 对已经支持 `ref` 入参的只读工具，临时保留 legacy resolve。
- `apps/electron/src/main/services/agent/pi-write-tools.ts`
  - 保持 `understandingId`、`domainIds`、`contextId`、`domainId` 为真实 id 字段。
  - 更新参数描述，明确这些字段来自工具返回的稳定 id。
  - 不接受 `[[ref:...]]` 作为写工具输入。
- `apps/electron/src/main/services/agent/pi-agent-host.ts`
  - 围绕已批准工具执行发出 durable `tool.execution.*` 事件。
  - 像现在一样把执行结果返回给 Pi。
  - 把 thrown error 规范化为 `AgentToolExecutionError`。
- `apps/electron/src/preload/typings/agent.ts`
  - 增加 `tool.execution.started/completed/failed` 事件类型。
  - 增加 `AgentToolExecutionError`、approval state、execution state 和 display state 类型。
- `apps/electron/src/preload/typings/agent-context.ts`
  - selected context 文本里输出真实 id 和 typed refs。
- `apps/electron/src/main/services/agent/agent-system-prompt.md`
  - 把 `[[ref:...]]` 契约替换成稳定 id + typed chat ref 契约。
- `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
  - 更新 expected output，保留 `id`。
- `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
  - 覆盖只读工具输出 `id` 和 `ref`。
- `apps/electron/src/main/services/agent/pi-write-tools.test.ts`
  - 覆盖工具描述和真实 id pass-through。
- `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
  - 覆盖已批准工具成功和失败的事件序列。
- `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
  - 覆盖恢复已批准但执行失败的工具，并断言 block 不停留在“已确认”状态。
- `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`
  - 覆盖失败卡片展示“执行失败”和失败原因。
- `apps/electron/e2e/agent/pi-session.spec.ts`
  - 覆盖生产风格 failed write 展示 failed state，而不是只展示 approval resolved。

## 7. 实施任务

### 任务 1: 文档化并类型化新的工具身份契约

**文件：**

- 修改：`apps/electron/src/main/services/agent/agent-system-prompt.md`
- 修改：`apps/electron/src/preload/typings/agent.ts`
- 测试：`apps/electron/src/main/services/agent/agent-entity-sources.test.ts`

- [ ] **步骤 1: 更新 system prompt 契约**

把聊天 ref 段落替换成等价内容：

```md
## Reflecta Entity Identity

Reflecta 工具会返回稳定实体 id。工具调用时必须原样使用这些 id。

写聊天正文时，使用工具结果或 selected context 里返回的 `ref` 字段。
不要发明 id。不要使用没有在当前对话、selected context 或工具结果里出现过的 id。

正确工具输入：
`domainIds: ["s11qsWP-wgjU2Jn-0lX3b"]`

正确聊天正文：
`[[domain:s11qsWP-wgjU2Jn-0lX3b]]`

错误：
`[[ref:rf_fjxcezk5az]]`、`rf_fjxcezk5az`、只写标题、或猜测出来的 id。
```

- [ ] **步骤 2: 增加 shared event types**

在 `apps/electron/src/preload/typings/agent.ts` 增加 `AgentToolExecutionStarted`、`AgentToolExecutionCompleted`、`AgentToolExecutionFailed`，并纳入 session event union。

- [ ] **步骤 3: 运行 typecheck**

运行：

```bash
pnpm --filter @reflecta/electron typecheck
```

预期：如果仓库已有 type error，则只允许看到既有错误；否则 PASS。

- [ ] **步骤 4: 提交**

```bash
git add apps/electron/src/main/services/agent/agent-system-prompt.md apps/electron/src/preload/typings/agent.ts
git commit -m "docs: define agent entity identity contract"
```

### 任务 2: 在面向模型的工具输出里保留真实实体 id

**文件：**

- 修改：`apps/electron/src/main/services/agent/agent-entity-sources.ts`
- 修改：`apps/electron/src/main/services/agent/pi-readonly-tools.ts`
- 测试：`apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
- 测试：`apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`

- [ ] **步骤 1: 为 decorated output 写失败测试**

更新测试，让 decorated `domain_list` item 保留 `id` 并得到 typed `ref`：

```ts
expect(decorated).toEqual({
  domains: [
    {
      id: "domain_1",
      ref: "[[domain:domain_1]]",
      name: "三观",
      parentId: null,
    },
  ],
});
```

对于 `understanding_get`，期望输出保留：

```ts
{
  id: "u_1",
  ref: "[[understanding:u_1]]",
  title: "Feedback Loop",
  body: "body",
  domainIds: ["domain_1"],
  domainRefs: ["[[domain:domain_1]]"]
}
```

- [ ] **步骤 2: 运行聚焦测试，确认失败**

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
```

预期：FAIL，因为当前代码会剥掉 `id` 并输出 `[[ref:...]]`。

- [ ] **步骤 3: 修改 decoration 行为**

在 `AgentEntitySourceRegistry.decorateEntityObject` 里停止移除 `id`。输出：

```ts
return {
  id: String(value.id),
  ref: this.entityRef(type, String(value.id)),
  ...(isRecord(decoratedRest) ? decoratedRest : rest),
};
```

新增：

```ts
private entityRef(type: AgentEntityType, id: string): string {
  return `[[${type}:${id}]]`;
}
```

对 relationship ids，保留原 id 字段，并在有用时添加平行 ref 字段：

```ts
domainIds: ["domain_1"],
domainRefs: ["[[domain:domain_1]]"]
```

- [ ] **步骤 4: 只保留仍然必要的 registry 能力**

如果 registry 不再需要 session-scoped source ids 作为身份层，就把它收窄到 title/display metadata 和向后兼容 helper。不要再把生成的 `rf_*` 暴露给面向模型的工具输出。

- [ ] **步骤 5: 运行测试**

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
```

预期：PASS。

- [ ] **步骤 6: 提交**

```bash
git add apps/electron/src/main/services/agent/agent-entity-sources.ts apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
git commit -m "fix: expose stable entity ids to agent tools"
```

### 任务 3: 写工具输入继续使用真实 id

**文件：**

- 修改：`apps/electron/src/main/services/agent/pi-write-tools.ts`
- 测试：`apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **步骤 1: 为工具描述添加测试**

断言写工具参数描述明确说明使用 Reflecta 工具返回的稳定 id：

```ts
expect(understandingCreate.parameters).toMatchObject({
  properties: {
    domainIds: expect.objectContaining({
      description: expect.stringContaining("stable Domain ids"),
    }),
  },
});
```

- [ ] **步骤 2: 添加 pass-through 测试**

保留当前服务调用真实 id 的行为：

```ts
await execute("tool-call-1", {
  title: "A",
  body: "B",
  domainIds: ["domain_1"],
});

expect(services.createUnderstanding).toHaveBeenCalledWith({
  title: "A",
  body: "B",
  domainIds: ["domain_1"],
});
```

- [ ] **步骤 3: 运行聚焦测试，确认描述缺失导致失败**

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-write-tools.test.ts
```

预期：如果 pass-through 已经正确，只应因为缺少描述而 FAIL。

- [ ] **步骤 4: 更新参数描述**

把 `domainIdsParameter` 改成：

```ts
const domainIdsParameter = Type.Optional(
  Type.Array(Type.String(), {
    description: "Stable Domain ids returned by Reflecta tools. Do not pass chat refs.",
  }),
);
```

对 `understandingId`、`domainId`、`parentId`、`contextId` 添加同类描述。

- [ ] **步骤 5: 运行聚焦测试**

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-write-tools.test.ts
```

预期：PASS。

- [ ] **步骤 6: 提交**

```bash
git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts
git commit -m "fix: clarify write tool id contract"
```

### 任务 4: 新增 durable approved tool execution events

**文件：**

- 修改：`apps/electron/src/main/services/agent/pi-agent-host.ts`
- 修改：`apps/electron/src/main/services/agent/pi-session-log.ts`
- 测试：`apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- 测试：`apps/electron/src/main/services/agent/pi-session-log.test.ts`

- [ ] **步骤 1: 编写成功序列测试**

在 `pi-agent-host.test.ts` 中 approve 一个 pending write tool，并断言 session events 包含：

```ts
expect(eventTypes).toEqual(
  expect.arrayContaining([
    "approval.resolved",
    "tool.execution.started",
    "tool.execution.completed",
  ]),
);
```

断言 `tool.execution.completed.output` 包含 decorated result。

- [ ] **步骤 2: 编写失败序列测试**

Mock `executePiApprovedTool` 抛出：

```ts
new Error("Domain not found: domain_1");
```

断言 events 包含：

```ts
expect(eventTypes).toEqual(
  expect.arrayContaining(["approval.resolved", "tool.execution.started", "tool.execution.failed"]),
);
```

断言：

```ts
expect(failedEvent.error).toEqual({
  message: "Domain not found: domain_1",
});
```

- [ ] **步骤 3: 运行聚焦测试，确认失败**

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-agent-host.test.ts
```

预期：FAIL，因为 `tool.execution.*` events 还不存在。

- [ ] **步骤 4: 围绕 approved tool execution 发事件**

在 `resolveToolApproval` 里，`approval.resolved approved=true` 之后、调用 `executeApprovedTool` 之前 append `tool.execution.started`。

成功时 append `tool.execution.completed`。

失败时把 thrown error 规范化为 `AgentToolExecutionError`，append `tool.execution.failed`，同时继续用 Pi 期望的方式 reject/resolve pending approval，让模型能收到工具错误。

- [ ] **步骤 5: 把 execution failure mirror 到诊断日志**

更新 `pi-session-log.ts` 的 mirror 逻辑，让 `tool.execution.failed` 写入 error-level diagnostic event，包含 `toolName`、`toolCallId`、`error.message`、`error.code` 和 `error.details`。

- [ ] **步骤 6: 运行聚焦测试**

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts
```

预期：PASS。

- [ ] **步骤 7: 提交**

```bash
git add apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-session-log.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts
git commit -m "fix: persist approved tool execution failures"
```

### 任务 5: 正确渲染已批准但执行失败的工具

**文件：**

- 修改：`apps/electron/src/preload/typings/agent.ts`
- 修改：`apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- 修改：`apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- 测试：`apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`

这个任务直接覆盖截图里的问题：用户批准后，卡片不能只显示“已确认”。如果后续 execution event 是失败，同一张候选/工具卡片的主状态必须变成“执行失败”，并展示失败原因。

- [ ] **步骤 1: 为 failed execution 写 reducer test**

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

断言 reduced assistant block 为：

```ts
{
  kind: "approval",
  toolName: "understanding_update",
  approvalState: "approved",
  executionState: "failed",
  displayState: "failed",
  error: { message: "Domain not found: domain_1" }
}
```

- [ ] **步骤 2: 为 failed state 写 view test**

断言工具/候选卡片显示“执行失败”和 `Domain not found: domain_1`。同时断言这张失败卡片的主状态不再显示“已确认”；“已确认”最多只能作为辅助审批历史出现，不能占据右上角终态 badge。

- [ ] **步骤 3: 运行聚焦测试，确认失败**

运行：

```bash
pnpm vitest run apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

预期：FAIL，因为 execution events 还没有被 reduce/render。

- [ ] **步骤 4: 更新 reducer**

处理 `tool.execution.started/completed/failed`，通过 `toolCallId` 匹配已有 approval/tool block，并更新 `approvalState`、`executionState`、`displayState` 和 `error`。

- [ ] **步骤 5: 更新 view labels**

对已批准但执行失败的工具，使用普通 failed tool block 同样的失败视觉处理。右上角 badge 显示“执行失败”，卡片正文显示失败原因。若当前已有展开/复制错误的模式，则复用它。

- [ ] **步骤 6: 运行聚焦测试**

运行：

```bash
pnpm vitest run apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

预期：PASS。

- [ ] **步骤 7: 提交**

```bash
git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
git commit -m "fix: show failed approved tools in agent chat"
```

### 任务 6: 更新 E2E fixtures 和生产回归路径

**文件：**

- 修改：`apps/electron/e2e/agent/agent-fixture-store.ts`
- 修改：`apps/electron/e2e/agent/pi-session.spec.ts`
- 可选修改：`apps/cli/scripts/seed-test-data.ts`

- [ ] **步骤 1: 添加已批准但执行失败的写入 fixture**

创建一条 fixture run，序列为：

```txt
approval.requested -> approval.resolved approved=true -> tool.execution.started -> tool.execution.failed
```

错误使用：

```txt
Domain not found: rf_fjxcezk5az
```

这样既保留真实生产症状，又测试新的状态模型。

- [ ] **步骤 2: 添加 E2E 断言**

断言恢复后的 chat 对已批准 proposal 显示 failed tool state，并包含错误文本。对截图里的回归场景，断言失败的候选修改卡片不以“已确认”作为主状态，而是显示“执行失败”。

- [ ] **步骤 3: 运行 E2E target**

运行：

```bash
pnpm --filter @reflecta/electron e2e -- apps/electron/e2e/agent/pi-session.spec.ts
```

预期：PASS。

- [ ] **步骤 4: 提交**

```bash
git add apps/electron/e2e/agent/agent-fixture-store.ts apps/electron/e2e/agent/pi-session.spec.ts apps/cli/scripts/seed-test-data.ts
git commit -m "test: cover approved tool execution failure recovery"
```

### 任务 7: 清理 legacy `rf_*` 身份假设

**文件：**

- 修改：`docs/iterations/v1.1.12/tech/agent-entity-link-architecture.md`
- 修改：`docs/iterations/v1.1.12/tech/agent-entity-reference-research.md`
- 修改：`docs/iterations/v1.1.15/README.md`
- 全局搜索：`apps/electron/src/**` 中对 `[[ref:` 和 `sourceId` 的引用

- [ ] **步骤 1: 搜索生成型 source id 假设**

运行：

```bash
rg -n "\\[\\[ref:|sourceId|rf_" apps/electron/src docs/iterations/v1.1.12 docs/iterations/v1.1.15
```

预期：只有向后兼容代码、测试和历史文档保留旧表述。

- [ ] **步骤 2: 标记 v1.1.12 文档已被取代**

在 v1.1.12 entity-link docs 顶部添加：

```md
> Agent 工具身份协议已由 v1.1.15 取代。v1.1.12 的 session-scoped `[[ref:Sx]]` source map 仍可作为历史背景，但 v1.1.15 对面向模型的工具协议使用稳定实体 id。
```

- [ ] **步骤 3: 只在必要位置保留向后兼容 parser**

如果旧 session 日志里包含 `[[ref:rf_*]]`，保留 renderer 兜底逻辑：只有持久化 source map 能 resolve 时才渲染，否则显示为不可解析的普通文本。这个兜底逻辑不能影响新的工具输出。

- [ ] **步骤 4: 提交**

```bash
git add docs/iterations/v1.1.12/tech/agent-entity-link-architecture.md docs/iterations/v1.1.12/tech/agent-entity-reference-research.md docs/iterations/v1.1.15/README.md
git commit -m "docs: supersede session scoped agent refs"
```

## 8. 验证

运行：

```bash
pnpm vitest run apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

预期：PASS。

运行：

```bash
pnpm --filter @reflecta/electron typecheck
```

预期：PASS。

运行：

```bash
pnpm --filter @reflecta/electron e2e -- apps/electron/e2e/agent/pi-session.spec.ts
```

预期：PASS。

## 9. 验收标准

- `domain_list`、`domain_inspect`、`understanding_get`、`understanding_list`、`context_get`、`context_list` 向模型暴露稳定真实 id。
- 写工具继续接受 `understandingId`、`contextId`、`domainId`、`domainIds` 作为真实 id。
- 新的面向模型输出不包含生成的 `rf_*` source ids。
- 聊天正文 ref 使用 typed real-id 格式：`[[domain:<id>]]`、`[[understanding:<id>]]`、`[[context:<id>]]`。
- 批准写工具后，会产生 `approval.resolved`，然后产生明确的 execution state。
- 已批准写工具失败会产生 `tool.execution.failed`、诊断日志和 UI failed state。
- 失败的已批准工具卡片主状态显示“执行失败”，并展示 `error.message`；它不能继续以“已确认”作为终态展示。
- 生产风格 `Domain not found` 失败可以通过 session reducer output 看到，不需要 grep 原始 Pi 消息。
- 历史 session 不崩溃；无法 resolve 的旧 ref 不可点击。

## 10. 自检

需求覆盖：

- 稳定真实 id 替代 `rf_*` 作为工具身份：任务 1、任务 2、任务 3、任务 7 覆盖。
- `ref` 只保留为展示/导航语法：任务 1、任务 2 覆盖。
- tool failed 状态纳入计划：任务 4、任务 5、任务 6 覆盖。
- 截图里的“已确认但实际失败”UI 回归：任务 5、任务 6 覆盖。
- 文档放在 `docs/iterations/v1.1.15`：本文件和 README 已覆盖。

未完成标记检查：

- 任务正文没有遗留未决标记词。
- 每个任务都写明了文件、命令和预期结果。

类型一致性：

- 实体 id 字段保持为 `understandingId`、`contextId`、`domainId`、`domainIds`。
- 新 execution event 名称统一为 `tool.execution.started/completed/failed`。
