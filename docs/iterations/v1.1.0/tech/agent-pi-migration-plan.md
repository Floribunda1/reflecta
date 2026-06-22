# v1.1.0 Pi Agent 渐进式迁移计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：把当前 AI SDK chat runtime 渐进替换成 Pi Agent。每个 phase 都必须留下一个可用产品状态，不能按 backend/storage/frontend 这种横向模块拆。

## 1. 上一版计划的问题

上一版 phase 切错了。

它把迁移拆成了 shared model、storage、runtime、tools、IPC、frontend、e2e、cleanup。这是按模块切，不是按可用产品切。问题是中间 phase 会出现“某个模块完成了，但用户不能完成任何新的完整路径”的状态。

正确切法是纵向切片：

```txt
一个用户路径
  -> 前端入口
  -> IPC command/event
  -> Pi runtime
  -> storage
  -> reload 恢复
  -> e2e 验证
```

每个 phase 都必须回答：

- 用户现在能完成什么路径？
- 老路径是否仍可用？
- 这个 phase 的自动化验收是什么？
- 如果失败，能不能只回滚这个 phase？

## 2. 不可妥协的规则

- 不改弱现有 feature/e2e spec。测试是产品契约，不是迁移工具。
- 不用 fake host 冒充 Pi。fake model 可以有，但必须跑在真实 Pi SDK loop 后面。
- 每个 phase 结束后 app 都能用；要么旧 Agent 仍完整可用，要么 Pi slice 已经完整可用。
- 不迁旧 Agent 历史。v1.1.0 的 Pi 历史从新 session 开始。
- 不引入 `AgentViewBuilder`。公共协议只有 `AgentSessionEvent`。
- 清理旧 AI SDK chat runtime 必须等 Pi 主路径可用后再做。

## 3. 最终目标形态

```txt
Renderer
  -> AgentCommand
  -> AgentService
  -> PiAgentHost
      -> Pi SDK session / prompt / resume / tools / skills
      -> ReflectaToolBridge
      -> appendCustomEntry("reflecta.agent.event", AgentSessionEvent)
  -> agent:event
  -> Renderer AgentSessionEvent[]
  -> reduceAgentSession(events)
```

Pi 负责 loop、session、resume、skills、tool 调用机制。Reflecta 负责事件模型、工具语义、approval、UI。

## 4. Phase 0：真实 Pi 最小路径，不切主链路

用户状态：现有 Agent 仍然完全走旧 AI SDK runtime，产品不退化。

新增可用路径：开发环境里能通过一个最小 Pi harness 创建 Pi session，发送一条 prompt，拿到 assistant text，并在 Reflecta content storage 下看到 Pi session 文件。

这一 phase 只证明一件事：Electron main 里真实 Pi SDK 能跑。不能改前端主流程，不能删旧代码。

要做：

- 加真实 Pi dependency/API adapter。
- 新增最小 `PiAgentHost` spike，调用真实 Pi session/prompt API。
- fake model 只作为 Pi 的 model 输入，不能绕过 Pi loop。
- session root 指向 Reflecta content storage。

验收：

- integration test：Pi prompt 返回 assistant text。
- integration test：Pi session file 出现在 Reflecta content storage 下。
- 现有 `bun run --filter '@reflecta/electron' test` 通过。

## 5. Phase 1：Pi 纯文本新对话

用户状态：用户可以创建一个新的 Pi-backed Agent session，发送纯文本消息，看到回复，重启后能恢复这段对话。旧 Agent 路径仍可保留作为 fallback。

这是第一个真正的产品切片。它必须同时打通 UI、IPC、Pi runtime、JSONL custom event、reload。

要做：

- 新增 `AgentSessionEvent`、`AgentCommand`、`reduceAgentSession(events)`。
- `message.send` 经过真实 Pi prompt。
- Pi text callback append `assistant.text.delta`，同时 emit `agent:event`。
- `readSessionEvents(sessionId)` 从 Pi JSONL custom entries 读 history。
- 前端只在 Pi session 页面读取 events 并 render text turns。
- e2e fixture 开始支持 seed Pi custom events，但不改现有 spec 语义。

验收：

- e2e：用户创建 Pi session，发送第一条纯文本消息，看到完整回复。
- e2e：重启 app 后仍能看到 user message 和 assistant reply。
- unit：同一组 `AgentSessionEvent[]` reduce 后结果稳定。
- grep：Pi 新路径不读取 `agent_messages.parts_json`。

## 6. Phase 2：失败、停止、重试仍可用

用户状态：Pi session 不只是 happy path；失败后能继续发，生成中能停止，停止/失败后 reload 不会卡死输入框。

这一步补的是 runtime 可用性的底线，不加 tools。

要做：

- Pi model error 转成 `run.failed`。
- `run.cancel` abort 当前 Pi run，append `run.cancelled`。
- app restart 时未完成 run 进入 cancelled 或 failed，不 resume 半截 stream。
- 前端 composer 状态完全来自 events。

验收：

- e2e：回复失败后同一 session 可以继续发送。
- e2e：用户停止正在生成的回复后看到停止状态，composer 可用。
- e2e：停止后切走再切回，状态仍正确。
- integration：emit 的 failed/cancelled event 和 JSONL 里的 event shape 一致。

## 7. Phase 3：上下文和附件可用

用户状态：用户可以在 Pi session 里选择 Thought/Context/Category 引用，发送附件，并在消息历史里看到这些输入；reload 后仍然存在。

这一步让 Pi session 能覆盖真实工作输入，而不只是空聊天。

要做：

- `user.message` event 携带 `contextRefs`、`attachments`、`composerContent`。
- Pi prompt 构造时注入选中的 Reflecta context。
- 附件读取走 Pi builtin 或 Reflecta tool bridge，但必须经过 Pi tool 机制。
- 前端继续从 events 渲染 refs 和 attachments。

验收：

- e2e：选择引用后发送消息，用户消息显示引用，assistant 能回复。
- e2e：发送附件后历史里能看到附件和回复。
- e2e：reload 后 refs/attachments 仍显示。
- unit：context prompt 构造不依赖 AI SDK message parts。

## 8. Phase 4：只读工具可用

用户状态：用户可以让 Pi Agent 搜索/读取 Reflecta 知识库，并看到 tool activity 和最终回复。没有 mutation，没有 approval。

这一步只做 read/search/list/get，避免一上来碰写入和审批。

要做：

- 把 read/search/list/get 工具做成 Reflecta tool specs。
- 通过 Pi tool API 注册。
- Pi tool callbacks 转成 `tool.started` / `tool.completed` / `tool.failed` events。
- UI 直接渲染 tool activity block。

验收：

- e2e：复杂回复按 reasoning -> tool -> final text 顺序显示。
- e2e：用户展开 tool activity 能看到工具标题和结果详情。
- integration：只读 tool 不产生 approval。
- unit：tool event reduce 后顺序稳定。

## 9. Phase 5：写入工具和 Approval 可用

用户状态：用户可以收到候选变更卡片，确认后写入知识库，拒绝后不写入；reload 后 pending approval 仍能处理。

这是 mutation 的完整纵向切片。

要做：

- write/delete/bash 工具先 append `approval.requested`，不执行 mutation。
- approve 后通过 Pi continuation 或 Pi tool resume 执行一次 mutation。
- reject 后 append `approval.resolved(rejected)`，不执行 mutation。
- mutation 成功 append `tool.completed`，失败 append `tool.failed`。
- UI 的 pending/approved/rejected/failed 全部来自 events。

验收：

- e2e：pending proposal 有确认/拒绝按钮。
- e2e：确认后看到已确认/已写入。
- e2e：拒绝后看到已拒绝/未写入。
- e2e：离开再回来仍能处理 pending approval。
- integration：approve 只 mutation 一次，reject 永不 mutation。

## 10. Phase 6：多 session、编辑、重新生成可用

用户状态：Pi session 覆盖日常会话操作：多 session 切换不串状态，编辑历史消息会截断后续回复，重新生成只替换当前回复。

这一步把 Pi session 从“能聊天”推进到“能日常使用”。

要做：

- session list 用 `AgentSessionSummary`，内容仍从 Pi events 恢复。
- edit/regenerate 通过追加新的 canonical events 表达，不读旧 message table。
- 前端当前 session cache 只接收匹配 session 的 `agent:event`。

验收：

- e2e：对话 A 正在回复时切到 B，不影响 B。
- e2e：切回 A 能看到 A 的内容。
- e2e：编辑历史消息后看到新的当前回复。
- e2e：重新生成后看到新的当前回复。
- e2e：删除一个 session 后仍能查看剩余 session。

## 11. Phase 7：Pi 成为默认 Agent runtime

用户状态：新建 Agent session 默认使用 Pi。旧 AI SDK runtime 不再是新主链路，但可以只保留为短期 fallback 或直接删除。

这一步才是真正 cutover。

要做：

- `AgentService` 新 command/query 全部走 Pi host。
- 前端删除新主链路里的 `useChat`、chat transport、AI SDK parts parsing。
- fixture seed 改成 Pi JSONL custom events。
- 真实 AI smoke 保留一条，默认 skip；主 e2e 继续用可控模型。

验收：

- 完整 e2e suite 通过，且不改弱 feature 语义。
- `bun run --filter '@reflecta/electron' typecheck` 通过。
- `bun run --filter '@reflecta/electron' test` 通过。
- `bun run --cwd apps/electron test:e2e` 通过。

## 12. Phase 8：删除旧 runtime

用户状态：产品行为不变，只是仓库里不再有两套 Agent runtime。

这是 cleanup，不是功能 phase。只能在 Phase 7 通过后做。

删除：

- `@ai-sdk/react`。
- AI SDK chat transport。
- AI SDK UI message persistence tests。
- 只服务 AI SDK message conversion 的 helpers。
- fixture 对 `agent_messages.parts_json` 的写入。

验收：

```bash
rg "useChat|ChatTransport|UIMessageChunk|toUIMessageStream|AgentChatMessage = UIMessage|agent:stream|parts_json" apps/electron/src apps/electron/e2e
```

没有新主链路命中。

## 13. 停止规则

如果 Phase 0 不能证明真实 Pi SDK prompt/session 路径存在，就停止。不要改 frontend，不要改 storage，不要用 fake host 继续推进。
