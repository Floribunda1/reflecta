# v1.1.12 Agent Session Canonical Log 技术计划

> 日期：2026-06-26
>
> 状态：Draft
>
> 目标：把 `Sessions/*.jsonl` 从“流式事件流水账”升级为“单文件 canonical transcript”，在不摘要 tool / reasoning / 正文内容的前提下，大幅减少 session 文件体积，并保持应用历史读取、Markdown 导出和 AI 读取原始材料的能力。

## 1. 结论

当前 `Sessions/*.jsonl` 同时承担了两个角色：

- live UI transport：逐 token 记录 `assistant.text.delta` / `assistant.reasoning.delta`。
- durable session transcript：长期保存用户消息、Agent 回答、tool 输入输出和 usage。

这两个角色混在一个持久化文件里，会让 session 文件膨胀。一次长对话中，几十条真实消息会变成几万行 delta event。

v1.1.12 的干净方向是分离语义，不分离文件：

```text
Pi runtime stream
  -> live event: 只发给当前 renderer，用于流式显示
  -> RunAccumulator: 聚合 reasoning / tool / text
  -> canonical event: run 完成后写入同一个 Sessions/*.jsonl
```

session 仍然只有一个文件，但文件里保存的是完整 turn，不保存逐 token 传输碎片。

一句话：

```text
保留 reasoning 内容；不保留 reasoning delta。
保留最终回答内容；不保留 text delta。
保留 tool result 全文；不摘要、不外链。
```

## 2. 目标和非目标

目标：

- `Sessions/*.jsonl` 仍然是单文件 source of truth。
- 恢复历史对话时能看到 reasoning、tool、final answer。
- Markdown 导出可以从同一份 session 文件生成完整 transcript。
- AI 可以直接读取 session 文件作为原始材料。
- 不再长期保存 `assistant.text.delta` 和 `assistant.reasoning.delta` 碎片。
- 旧 session 通过一次性脚本迁移为 canonical format。

非目标：

- 不 gzip session 文件。
- 不把 tool result 存到外部 blob。
- 不对 tool result 做摘要或截断。
- 不把 compact summary 当作原始 transcript。
- 不保留历史对话逐字播放效果。
- 不为了兼容旧 reader 写“单条 full delta”这种假事件。
- 不在新应用运行时兼容旧 delta session 格式。
- 不在 app 启动或打开 session 时自动 lazy migration。

## 3. Canonical Session Schema

新增 canonical event，而不是继续把 delta 当持久化协议。`AgentSessionEvent` 表示 durable session event；delta 类事件改成 runtime-only live event，不再属于 session 文件的稳定格式。

```ts
type AgentAssistantTurn = AgentEventBase & {
  type: "assistant.turn";
  runId: string;
  messageId: string;
  blocks: AgentAssistantTurnBlock[];
  text: string;
  usage?: AgentUsage;
  model?: AgentModelSelection;
  stopReason?: string;
};

type AgentAssistantTurnBlock =
  | {
      kind: "reasoning";
      text: string;
      createdAt: string;
    }
  | {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output?: unknown;
      error?: string;
      state: "completed" | "failed";
      createdAt: string;
    }
  | {
      kind: "text";
      text: string;
      createdAt: string;
    };
```

第一版不需要新增复杂 envelope。继续使用现有 Pi session JSONL entry：

```json
{
  "type": "custom",
  "customType": "reflecta.agent.event",
  "data": {
    "type": "assistant.turn",
    "sessionId": "...",
    "runId": "...",
    "messageId": "...",
    "blocks": [],
    "text": "完整最终回答"
  }
}
```

保留现有事件：

- `run.started`
- `run.completed`
- `run.failed`
- `run.cancelled`
- `user.message`
- `approval.requested`
- `approval.resolved`

`tool.started` / `tool.completed` 不再作为长期必需事件；它们进入 `assistant.turn.blocks`。如果当前运行失败，需要保留已发生 tool 结果，则在失败前写一个 `assistant.turn` 或新增 `assistant.partial.turn`，第一版可以先只处理成功 run。

`approval.requested` / `approval.resolved` 继续作为 durable semantic event 保留。它们不是 token-level transport 噪声，而且涉及用户决策和 pending 状态恢复；第一版不把 approval 折进 `assistant.turn`，避免同一 approval 在 reducer 里显示两次。

删除 durable session schema 中的事件：

- `assistant.text.delta`
- `assistant.reasoning.delta`
- `tool.started`
- `tool.completed`
- `tool.failed`

这些事件可以继续存在于 `AgentLiveEvent`，只用于当前 run 的流式 UI。

## 4. Module Interface

新增一个深模块：`AgentRunAccumulator`。

外部 Interface：

```ts
type AgentRunAccumulator = {
  append(event: LiveAgentRunEvent): void;
  toAssistantTurn(args: {
    sessionId: string;
    runId: string;
    messageId: string;
    createdAt: string;
    usage?: AgentUsage;
    model?: AgentModelSelection;
    stopReason?: string;
  }): AgentAssistantTurn;
};
```

它隐藏的实现：

- 合并连续 reasoning delta。
- 合并连续 text delta。
- 按 source order 保留 reasoning / tool / text block 顺序。
- 把 `tool.started` + `tool.completed` 归约成一个 tool block。
- 保留 tool input / output 全文。
- 生成 `text` 字段，方便列表、导出和 AI 读取。

调用方只需要知道：

```text
runtime event in -> assistant.turn out
```

## 5. Runtime Flow

### 5.1 当前 flow

当前 `PiAgentHost.sendMessage()` 在 subscribe 里收到 delta 后直接：

```text
append session event
emit renderer event
```

这会把所有 delta 写入 `Sessions/*.jsonl`。

### 5.2 目标 flow

改成两个入口：

```text
emitLive(event)
appendSession(event)
```

规则：

- `assistant.text.delta`：只 `emitLive()`，同时写入 `AgentRunAccumulator`。
- `assistant.reasoning.delta`：只 `emitLive()`，同时写入 `AgentRunAccumulator`。
- `tool.started`：`emitLive()`，同时写入 accumulator。
- `tool.completed` / `tool.failed`：`emitLive()`，同时写入 accumulator。
- `approval.requested` / `approval.resolved`：继续 `appendSession()`，同时 `emitLive()`。
- `user.message`：立即 `appendSession()`，避免用户输入因崩溃丢失。
- `run.started` / `run.failed` / `run.cancelled`：继续 `appendSession()`。
- run 成功结束时：先 `appendSession(assistant.turn)`，再 `appendSession(run.completed)`。

Renderer 在当前运行中继续吃 live event，所以流式体验不变。应用重启后只读取 session 文件里的 canonical event，所以历史恢复不依赖 delta。

## 6. Reader / Reducer Contract

`reduceAgentSessionEvent()` 增加 `assistant.turn` 分支：

```text
assistant.turn
  -> upsert one assistant message
  -> message.text = event.text
  -> message.blocks = event.blocks
```

新 reader 不兼容旧 delta session。旧 session 必须先跑 migration script。

读取策略：

- 新 session：主要由 `assistant.turn` 还原。
- 迁移后 session：由 `assistant.turn` 还原。
- 未迁移旧 session：明确报错，提示先运行 migration script。

当前运行中的流式 UI 不走 durable session reader。它从 `AgentLiveEvent` 更新正在生成的 pending turn，run 完成后由 `assistant.turn` 替换成稳定 transcript。

## 7. Migration

不做自动 migration。新增一个一次性手动脚本，等用户指定文件或目录后执行：

```ts
canonicalizeAgentSessionFile(sessionFile: string): CanonicalizeResult;
canonicalizeAgentSessions(targetPath: string): CanonicalizeSummary;
```

步骤：

1. `targetPath` 可以是单个 `.jsonl` 文件，也可以是 `Sessions/` 目录。
2. 只处理 `customType === "reflecta.agent.event"` 的 Reflecta events。
3. 按 `runId + assistant messageId` 聚合：
   - reasoning delta
   - text delta
   - tool started/completed/failed
4. 在对应 `run.completed` 前插入一条 `assistant.turn`。
5. 删除被归约的 delta / tool event。
6. 保留 `session`、`model_change`、`thinking_level_change`、`user.message`、`approval.*`、`run.*`。
7. 原子写回同一个文件。

迁移必须是幂等的：

- 文件里已经有 `assistant.turn` 的 run，不重复生成。
- 没有 `run.completed` 的活跃 run 不迁移。
- 无法识别的 entry 原样保留。

产品路径：

```text
用户给出旧 session 文件或 Sessions 目录
  -> 运行 migration script
  -> 新应用只读取 canonical session
```

不把 migration 放进 app 启动流程，也不在 session reader 里塞兼容分支。

## 8. Tests

新增或更新最少测试：

- `AgentRunAccumulator` unit test：reasoning delta + tool + text delta 归约成 blocks，tool output 全文保留。
- `reduceAgentSession` unit test：`assistant.turn` 还原出完整 message。
- `pi-session-log` integration test：迁移后文件不包含 `assistant.text.delta` / `assistant.reasoning.delta`，但 reducer state 不变。
- e2e fixture 更新：新 seeded session 使用 `assistant.turn`。

不需要新增大套测试框架；这里是一条数据归约路径，三个小测试就够。

## 9. Rollout

### Phase 1: Add Canonical Event Read Support

- 在 shared agent typings 增加 `AgentAssistantTurn`。
- Reducer 支持 `assistant.turn`。
- 从 durable `AgentSessionEvent` 中移除 delta / tool runtime event。

### Phase 2: Add Run Accumulator

- 新增 `AgentRunAccumulator`。
- 用现有 reducer tests 的事件顺序覆盖 reasoning / tool / text 混排。

### Phase 3: Change New Writes

- `PiAgentHost` 区分 live emit 和 session append。
- run 过程中 delta 只给 renderer，不落盘。
- run 完成时写 `assistant.turn`。

### Phase 4: Add Manual Migration Script

- 新增 script：输入单个 `.jsonl` 或 `Sessions/` 目录。
- 迁移只处理 completed run。
- 原子写回原 session 文件。

### Phase 5: Update Export / Fixtures

- Markdown 导出读取 canonical reducer state。
- 更新 e2e seeded session。
- 不保留旧 session 运行时兼容测试；只保留 migration 测试。

## 10. Acceptance Criteria

- 新产生的长对话 session 文件不再包含 `assistant.text.delta` 和 `assistant.reasoning.delta`。
- 新 session 和迁移后的历史对话都能显示 reasoning、tool result、final answer。
- Tool result 在 session 文件中保留全文。
- Markdown 导出能导出 reasoning / tool / answer。
- 旧 session 经手动 migration 后 UI 状态和迁移前一致。
- 未迁移旧 session 在新应用中明确提示需要先运行 migration script。
- 对一份包含 50 轮对话的 session，行数接近真实事件数，而不是 token 数。

## 11. Open Questions

- 失败 run 是否需要保存 partial assistant turn。第一版可以先不做，等真实需求出现。
- usage / model / stopReason 当前主要存在 Pi 原生 message entry 里，是否要同步进 `assistant.turn`。如果读取成本低，应该同步，方便导出和 AI 读取。
- approval 是否也应该折进 `assistant.turn`。第一版先不折，因为它是低频语义事件，不是 session 膨胀来源。
