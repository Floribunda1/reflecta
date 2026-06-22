# v1.1.0 Pi Agent 迁移计划

> 日期：2026-06-22
>
> 状态：Draft
>
> 目标：把当前 AI SDK chat runtime 替换成 Pi Agent，同时避免造出第二套消息模型，或者造一个只是名字像 Pi 的假 runtime。

## 1. 差距复盘

已经回滚的那版实现，不是真正的 Pi Agent 迁移。

| 范围     | 实际做了什么                                           | 差距                                                                      |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Runtime  | 用 deterministic `PiAgentHost` runner 替换了 runtime。 | 没有调用 Pi SDK、Pi session、Pi loop、Pi resume、Pi tools。               |
| Storage  | 手写了类似 Pi JSONL 的 custom records。                | 没有证明它和 Pi session API 或真实 Pi JSONL entry 兼容。                  |
| Tests    | 用 fake output 把 event/UI 链路跑绿。                  | 缺 Pi SDK integration test；还短暂削弱过一个 e2e 场景语义，这不应该发生。 |
| Tools    | 把 tool 代码往 plain spec 方向改。                     | 没有通过 Pi 注册 tool，也没有证明 approval continuation 能通过 Pi 跑。    |
| Frontend | 移除了 AI SDK transport，并让前端直接消费 events。     | 这发生在真实后端边界存在之前，掩盖了 Pi integration 缺失。                |
| Cleanup  | 移除了 `@ai-sdk/react`。                               | 清理只能发生在真实 Pi 主链路跑绿之后。                                    |

结论：正确迁移必须从 Pi 边界开始，不是从 UI 开始。

## 2. 不可妥协的约束

- 现有 feature/e2e spec 是产品契约。不能为了迁移通过而改弱场景语义。
- fake model output 可以用于稳定自动化，但必须挂在真实 Pi SDK adapter 后面，不能替代 Pi。
- 生产 host 必须先调用 Pi Agent API，然后才能开始移除前端 runtime。
- 不保留 `AgentViewBuilder`，不做后端 DTO 投影，不恢复旧 `agent_messages.parts_json` 历史。
- 后端、IPC、前端、fixture、Reflecta Pi custom entries 共用同一个公开模型：`AgentSessionEvent`。
- v1.1.0 不迁移旧 Agent 历史。

## 3. 目标形态

```txt
Renderer
  -> AgentCommand
  -> AgentService
  -> PiAgentHost
      -> Pi SDK session / prompt / resume / tools / skills
      -> ReflectaToolBridge
      -> AgentSessionLog appendCustomEntry("reflecta.agent.event", event)
  -> IPC agent:event
  -> Renderer AgentSessionEvent[]
  -> reduceAgentSession(events)
```

Pi 负责 loop 和 session 机制。Reflecta 负责事件语义、工具含义、approval 和 UI。

## 4. 阶段计划

### Phase 0：Pi SDK Spike

目标：证明 Reflecta 能在 Electron main 进程里打开 Pi session，并通过 Pi 跑一次 prompt。模型可以是 deterministic，但 Pi 不能是假的。

要做：

- 加入真实 Pi dependency/API adapter。
- 做一个最小 `PiAgentHost` spike，调用 Pi session/prompt API。
- deterministic model/provider 只能作为 Pi 输入，不能替代 Pi loop。
- session 存在 Reflecta content storage root 下，不用全局 Pi 状态。

先写测试：

- integration test：prompt 经过 Pi 后能产出 assistant text。
- storage check：Pi 在 Reflecta storage 下创建/打开预期 session file。

退出条件：

- production code path 已经调用 Pi SDK。
- 不改前端。

### Phase 1：Canonical Shared Events

目标：引入 `@shared/agent`，但先不改 runtime 行为。

要做：

- 新增 `AgentSessionEvent`、`AgentCommand`、`AgentSessionSummary`。
- 新增 `reduceAgentSession(events)`。
- 后端 event history 没跑通之前，先让现有 UI 继续工作。

先写测试：

- `@shared/agent` 不 import `ai`。
- reducer 合并 text delta，保持 reasoning/tool/proposal/text 顺序，处理 approval 状态，并让 failed/cancelled run 后 composer 可用。

退出条件：

- shared model 存在并有测试。
- 还不迁 UI。

### Phase 2：Pi SessionLog

目标：Pi session file 成为新 Agent 唯一历史来源。

要做：

- 用 `AgentSessionLog` 包住 Pi session custom entry API。
- `appendEvent(event)` 写 `reflecta.agent.event`。
- `readSessionEvents(sessionId)` 只读 Reflecta custom entries。
- 如有需要，`agent_threads` 只做 session list metadata。

先写测试：

- append/read event 完全 round-trip。
- restart 后读回同一组 event。
- malformed 和非 Reflecta entries 被忽略。
- 新 Agent history 没有代码路径读取 `agent_messages`。

退出条件：

- history restore 来自 Pi JSONL custom entries。

### Phase 3：Runtime Vertical Slice

目标：一条消息真实经过 Pi，并且 live event 和 persisted event 是同一个 shape。

要做：

- `message.send` append `run.started` 和 `user.message`。
- Pi callbacks 转成 `assistant.text.delta`、`assistant.reasoning.delta`、tool events 和 terminal run events。
- `appendAndEmit(event)` 是唯一 live stream 路径。
- `run.cancel` abort 当前 Pi run，并 append `run.cancelled`。

先写测试：

- integration：fake model 经过真实 Pi，产出 `run.started -> user.message -> assistant.text.delta -> run.completed`。
- failure：model error append `run.failed`，下一条消息仍可发送。
- cancel：active Pi run abort，并 append `run.cancelled`。
- shape：emit 的 event 和 persist 的 event 完全一致。

退出条件：

- 后端 event runtime 是真实 Pi-backed。
- 这一步跑绿前，前端可以继续旧 UI。

### Phase 4：Tools 和 Approval

目标：使用 Pi tools，同时保留 Reflecta approval 语义。

要做：

- 把现有 tools 转成 Reflecta plain tool specs。
- 通过 Pi tool API 注册 specs。
- read/search/list/get 直接执行。
- write/delete/bash 先 append `approval.requested`，不执行 mutation。
- approve 执行一次 mutation，并 append `approval.resolved` + `tool.completed`。
- reject append `approval.resolved`，不执行 mutation。

先写测试：

- read tool 不需要 approval。
- write tool pending 时不调用 domain mutation。
- approve 只调用一次 mutation。
- reject 永不 mutation。
- mutation error 变成 `tool.failed`。

退出条件：

- Approval 是 event-driven 且 Pi-backed。

### Phase 5：IPC Cutover

目标：IPC 只传 shared events 和 commands。

要做：

- 新增 `readSessionEvents(sessionId)`。
- 新增 `sendAgentCommand(command)`。
- emit `agent:event`。
- 移除新主链路对 `agent:stream`、AI SDK chunks、message array inputs 的使用。

先写测试：

- IPC service 把 command delegate 给 `PiAgentHost`。
- `readSessionEvents` 返回 canonical events。
- IPC payload 不包含 raw Pi entries，也不包含 AI SDK chunks。

退出条件：

- 后端 API 是 event-only。

### Phase 6：Frontend Cutover

目标：renderer 只负责读 events、订阅 events、发 commands。

要做：

- 新增 `useAgentSessionEvents(sessionId)`。
- 新增 `useAgentSessionState(sessionId)`，内部用 `reduceAgentSession`。
- 新增 `useAgentCommands(sessionId)`。
- 替换 `useChat` 和 chat transport。
- 渲染 `AgentSessionState.turns`。

先写测试：

- 收到 `agent:event` 后只更新匹配 session。
- failed/cancelled run 后 composer 恢复可用。
- approve/reject 等 event 回来，不在本地伪造 canonical state。

退出条件：

- UI 不再解析 AI SDK parts。

### Phase 7：Fixture 和 E2E Migration

目标：保留 feature 语义，只替换 fixture 的底层存储方式。

要做：

- 现有 e2e specs 保持用户路径断言不变。
- fixture helpers 可以保留旧名字，但写 Pi JSONL Reflecta events。
- 真实 AI smoke 保留一条，默认 skip。

测试：

- 完整现有 e2e suite 以不削弱行为的方式通过。
- seeded completed sessions 从 Pi JSONL 恢复。
- pending approval reload 后仍可处理。

退出条件：

- 产品路径仍被覆盖，现在历史来源改成 event history。

### Phase 8：Cleanup

目标：真实 Pi 主链路跑绿后，再删除旧 runtime。

删除：

- `@ai-sdk/react`。
- AI SDK chat transport。
- AI SDK UI message persistence tests。
- 只服务于 AI SDK message conversion 的 old runtime helpers。
- fixture 对 `agent_messages.parts_json` 的写入。

暂时保留：

- 如果 Pi 仍复用现有 provider credentials，可以保留 AI model/provider adapter code。

退出条件：

- `rg "useChat|ChatTransport|UIMessageChunk|toUIMessageStream|AgentChatMessage = UIMessage|agent:stream|parts_json"` 没有新主链路命中。

## 5. 验证命令

每个改代码的 phase 都要跑：

```bash
bun run --filter '@reflecta/electron' typecheck
bun run --filter '@reflecta/electron' test
```

迁移验收前跑：

```bash
bun run --cwd apps/electron test:e2e
rg "useChat|ChatTransport|UIMessageChunk|toUIMessageStream|AgentChatMessage = UIMessage|agent:stream|parts_json" apps/electron/src apps/electron/e2e
```

## 6. 停止规则

如果 Phase 0 不能证明 Electron main 里存在真实 Pi SDK prompt/session 路径，就停止。不要围绕 fake host 重写前端、storage 或测试。
