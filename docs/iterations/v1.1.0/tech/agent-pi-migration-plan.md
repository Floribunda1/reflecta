# v1.1.0 Pi Agent 渐进式迁移计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：用真实 Pi Agent + 真实 AI 能力渐进替换当前 AI SDK chat runtime。每个 phase 都必须是一个可用产品切片，不能按 backend/storage/frontend 这种横向模块拆。

## 1. 核心原则

这次迁移只接受纵向切片：

```txt
用户可执行路径
  -> Feature Test Case
  -> E2E / integration / unit 自动化
  -> 前端入口
  -> IPC
  -> Pi Agent runtime
  -> session JSONL
  -> reload 恢复
```

每个 phase 结束时都必须满足：

- 用户能完成一个明确路径。
- 旧路径没有被破坏，或者 Pi 新路径已经完整替代。
- 自动化测试覆盖这个路径。
- 失败时能回滚这一片，不影响其他路径。

## 2. 硬约束

- 全程使用真实 AI 能力接入。runtime、integration、e2e 不允许 fake model、不允许 fake provider、不允许 deterministic model 替代真实模型。
- 可以写 unit test，但 unit test 只测纯规则，例如 reducer、事件排序、JSONL 解析，不接模型。
- AI 自然语言不可控，所以测试不能断言固定回答内容。只断言产品状态：出现回复、回复完成、失败状态、停止状态、tool card、approval card、历史恢复、composer 可用。
- 现有 feature/e2e spec 是产品契约。不能为了迁移通过而改弱场景语义。
- 不迁旧 Agent 历史。v1.1.0 的 Pi 历史从新 session 开始。
- Pi session 固定存到当前 Content Storage Root 下的 `Sessions/` 目录，例如 `<content-storage-root>/Sessions/<session-id>.jsonl`；不能落到 Pi 默认的全局 `~/.pi` session 目录。
- 新 Agent 不再需要当前 DB 对话表；迁移完成时必须新增 v1.1.0 DB migration 删除 `agent_threads`、`agent_messages`、`agent_tool_invocations`、`agent_runs`，不是只停用代码读取。
- 不引入 `AgentViewBuilder`。公共协议只有 `AgentSessionEvent`。
- 清理旧 AI SDK chat runtime 必须等 Pi 主路径全绿后再做。

## 3. TDD 工作方式

每个 phase 都按同一个循环推进：

1. 先写或更新 Feature Test Case，只描述用户操作和可观察结果，不写自动化分层。
2. 选这个 phase 的第一条最小用户路径，写一个失败的 E2E 或 integration test。
3. 只写足够代码让这条测试通过。
4. 如果路径背后有稳定规则，再补一个 unit test，例如 event reduce、JSONL round-trip、approval 状态转换。
5. 接下一条路径，重复 RED -> GREEN。
6. phase 内所有测试通过后再 refactor。

禁止：

- 一次性先写完所有测试。
- 用 mock 内部模块证明“某函数被调用”。
- 为了测试方便改 feature 场景。
- 用 fake AI 让 e2e 稳定。

## 4. 总体目标形态

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

## 5. Phase 0：真实 Pi + 真实 AI 最小闭环

用户状态：现有 Agent 仍走旧 AI SDK runtime，不退化。开发环境新增一条 Pi smoke 路径，用真实 AI key 跑通 Pi session。

新增技术验证：

- Pi smoke integration：开发环境发送一条消息后，能看到一条真实 AI 回复完成。

自动化测试：

- integration：配置 `REFLECTA_E2E_AI_API_KEY` 后，Electron main 通过真实 Pi SDK 创建 session，发送 prompt，收到 assistant text。
- integration：Pi session file 创建在 `<content-storage-root>/Sessions/` 下。
- unit：content storage root 解析规则稳定。

TDD 顺序：

1. RED：写 Pi smoke integration test，真实 AI 未接 Pi 前失败。
2. GREEN：新增最小 Pi adapter，只支持 create session + prompt。
3. RED：写 session file 位置检查。
4. GREEN：把 Pi session root 指到 `<content-storage-root>/Sessions/`。
5. REFRACTOR：收敛 adapter 名称，不扩展 tools、不改前端主链路。

退出条件：

- 真实 Pi SDK + 真实 AI prompt 在 Electron main 内跑通。
- 没有 fake model。
- 现有 Agent e2e 不受影响。

## 6. Phase 1：Pi 纯文本新对话可用

用户状态：用户可以创建 Pi-backed session，发送纯文本消息，看到回复，重启后恢复这段对话。旧 Agent 路径可以作为 fallback 暂留。

Test Case：

- `@AG-START-002`：用户发送第一条消息后看到完整回复。
- `@AG-HISTORY-001`：用户重启应用后仍能看到已完成对话。

自动化测试：

- e2e：真实 AI key 下创建 Pi session，发送消息，看到 assistant 回复出现并完成。
- e2e：关闭 app 再打开，恢复同一 Pi session 历史。
- unit：`reduceAgentSession(events)` 合并 text deltas，并且同一组 events reduce 结果稳定。
- integration：`readSessionEvents(sessionId)` 只读取 `Sessions/` 下 Pi JSONL 里的 `reflecta.agent.event`。

TDD 顺序：

1. RED：写 Pi 纯文本发送 e2e，断言回复出现、stop button 消失、composer 可用。
2. GREEN：打通 `AgentCommand.message.send -> PiAgentHost -> real Pi prompt -> agent:event`。
3. RED：写 reload e2e。
4. GREEN：用 Pi custom entry 持久化 `AgentSessionEvent` 并恢复。
5. RED：写 reducer unit test。
6. GREEN：实现最小 reducer，只支持 user/text/run status。

退出条件：

- Pi 新 session 的纯文本聊天可用。
- reload 可恢复。
- 不读取 `agent_messages.parts_json`。
- 不为了 session list 保留 `agent_threads`；session list 从 `Sessions/` 下的 Pi session metadata 派生。

## 7. Phase 2：失败、停止、继续使用可用

用户状态：真实 AI 调用失败后，用户可以继续发送；生成中可以停止；停止/失败后 reload 不会卡住 composer。

Test Case：

- `@AG-START-003`：回复失败后用户可以继续发送消息。
- `@AG-RUN-001`：用户停止正在生成的回复。
- `@AG-RUN-002`：用户停止回复后切换回来仍看到停止状态。

自动化测试：

- e2e：用真实 provider 的无效 key 触发真实认证失败，不用 fake error。
- e2e：恢复有效 key 后同一 session 能继续发送。
- e2e：用真实 AI 长回复 prompt，stop button 出现后点击停止，看到停止状态。
- integration：`run.failed`、`run.cancelled` live event 和 JSONL event shape 完全一致。
- unit：failed/cancelled events reduce 后 composer 状态为可用。

TDD 顺序：

1. RED：写真实无效 key 失败 e2e。
2. GREEN：Pi error 转成 `run.failed`，并清理 active run。
3. RED：写失败后继续发送 e2e。
4. GREEN：保证下一次 `message.send` 不被旧 run 阻塞。
5. RED：写停止 run e2e。
6. GREEN：接 Pi abort/cancel 能力，append `run.cancelled`。
7. RED：写 reducer 状态 unit test。
8. GREEN：补 failed/cancelled reduce 规则。

退出条件：

- 真实 AI 失败路径、停止路径、继续使用路径可用。
- 没有用 fake model 或测试暗号模拟失败。

## 8. Phase 3：上下文、模型选择、附件可用

用户状态：用户可以在 Pi session 里选择 Understanding/Context/Domain 引用，选择模型和推理强度，发送附件，并在历史中看到这些输入。

Test Case：

- `@AG-CONTEXT-001`：用户选中引用后发送消息。
- `@AG-CONTEXT-002`：用户发送附件后看到附件和回复。
- `@AG-CONTEXT-003`：用户选择模型和推理强度后发送消息。
- `@AG-CONTEXT-004`：用户通过 `@` 搜索选择上下文引用。
- `@AG-CONTEXT-005`：用户点击已选择的 Understanding 引用后查看详情。

自动化测试：

- e2e：真实 AI 回复出现并完成，不断言回复具体内容。
- e2e：用户消息显示引用和附件；reload 后仍显示。
- integration：Pi prompt 输入包含选中的 Reflecta context，不依赖 AI SDK message parts。
- unit：context refs 到 prompt block 的转换规则稳定。

TDD 顺序：

1. RED：写引用发送 e2e。
2. GREEN：`user.message` event 携带 `contextRefs`，Pi prompt 注入 context。
3. RED：写附件发送 e2e。
4. GREEN：附件经 Pi builtin 或 Reflecta tool bridge 进入 Pi prompt/tool path。
5. RED：写模型/推理强度 e2e。
6. GREEN：把选择传入 Pi model config。
7. RED：写 context prompt unit test。
8. GREEN：实现最小转换规则。

退出条件：

- 真实 AI Pi session 覆盖上下文、附件、模型选择。

## 9. Phase 4：只读工具可用

用户状态：用户可以让 Pi Agent 搜索/读取 Reflecta 知识库，并看到 reasoning、tool activity、最终回复的顺序。

Test Case：

- `@AG-RESULT-001`：用户查看复杂回复时内容按发生顺序显示。
- `@AG-RESULT-003`：用户展开思考过程和工具活动查看详情。
- `@AG-RESULT-004`：用户点击 Agent 回复中的知识库引用后查看详情。

自动化测试：

- e2e：用真实 AI prompt 要求搜索/查看知识库；断言出现 tool activity 和最终回复完成。
- e2e：展开 tool activity 后能看到工具标题和结果详情。
- integration：Pi 真实 tool call 转成 `tool.started` / `tool.completed` / `tool.failed`。
- integration：只读 tool 不产生 `approval.requested`。
- unit：tool events reduce 后顺序稳定。

TDD 顺序：

1. RED：写真实 AI 触发只读 tool 的 integration test。
2. GREEN：通过 Pi tool API 注册 read/search/list/get specs。
3. RED：写 tool activity e2e。
4. GREEN：Pi tool callbacks append/emit canonical events，UI 渲染 activity。
5. RED：写 tool ordering unit test。
6. GREEN：补 reducer ordering。

退出条件：

- 只读工具完整经过真实 Pi tool path。
- 不使用 fake tool result 绕过模型。

## 10. Phase 5：写入工具和 Approval 可用

用户状态：用户可以收到候选变更卡片，确认后写入知识库，拒绝后不写入；reload 后 pending approval 仍能处理。

Test Case：

- `@AG-PROPOSAL-001`：用户确认候选 Understanding 后看到执行结果。
- `@AG-PROPOSAL-002`：用户拒绝候选 Understanding 后看到拒绝结果。
- `@AG-PROPOSAL-003`：用户重新打开对话后仍能看到提案处理结果。
- `@AG-HISTORY-003`：用户离开后仍可处理等待确认的提案。
- `@AG-RESULT-002`：用户可以区分提案的不同状态。

自动化测试：

- e2e：真实 AI 触发候选 Understanding proposal，显示 pending approval card。
- e2e：确认后看到已确认/已写入。
- e2e：拒绝后看到已拒绝/未写入。
- e2e：reload 后 pending approval 仍可确认/拒绝。
- integration：approve 只执行一次 mutation。
- integration：reject 永不执行 mutation。
- unit：approval requested/resolved events reduce 成 pending/approved/rejected/failed。

TDD 顺序：

1. RED：写真实 AI 触发 proposal 的 e2e。
2. GREEN：write/delete/bash tool 先 append `approval.requested`，不 mutation。
3. RED：写 approve e2e 和 integration。
4. GREEN：approve 通过 Pi continuation/resume 执行一次 mutation。
5. RED：写 reject e2e 和 integration。
6. GREEN：reject append resolved，不 mutation。
7. RED：写 approval reducer unit test。
8. GREEN：补 approval 状态 reduce。

退出条件：

- 写入工具、approval、reload pending approval 都可用。
- 所有 mutation 都由真实 Pi tool path 触发。

## 11. Phase 6：多 session、编辑、重新生成可用

用户状态：Pi session 覆盖日常会话操作：多 session 切换不串状态，编辑历史消息截断后续回复，重新生成替换当前回复。

Test Case：

- `@AG-CONV-001`：对话 A 正在回复时切换到对话 B 不影响 B。
- `@AG-CONV-002`：对话 A 回复完成后切回 A 可以看到 A 的内容。
- `@AG-CONV-003`：用户删除一个对话后仍可查看剩余对话。
- `@AG-CONV-004`：用户按时间分组查看对话列表。
- `@AG-MESSAGE-001`：用户编辑历史消息后看到新的当前回复。
- `@AG-MESSAGE-002`：用户重新生成回复后看到新的当前回复。

自动化测试：

- e2e：多 session 真实 AI stream 不串状态。
- e2e：编辑历史消息后，旧后续回复不再显示，新回复完成。
- e2e：重新生成后，当前 assistant turn 被新回复替换。
- unit：相同 `messageId` 的新 `user.message` 会截断后续派生 state。
- unit：session summary grouping/sorting 稳定。

TDD 顺序：

1. RED：写多 session 隔离 e2e。
2. GREEN：event subscription/cache 按 sessionId 隔离。
3. RED：写 edit message e2e。
4. GREEN：用 canonical events 表达 edit 后截断。
5. RED：写 regenerate e2e。
6. GREEN：复用同一用户 turn 触发新 run。
7. RED：写 reducer truncate unit test。
8. GREEN：补最小 reduce 规则。

退出条件：

- Pi session 覆盖多 session、编辑、重新生成。

## 12. Phase 7：Pi 成为默认 Agent runtime

用户状态：新建 Agent session 默认使用 Pi。旧 AI SDK runtime 不再是新主链路。

Test Case：

- 现有 `apps/electron/e2e/agent/features/*.feature` 全部保持语义不变。

自动化测试：

- 完整 e2e suite 使用真实 AI key 跑通。
- 真实 AI 能力不足或 key 缺失时，相关 e2e 明确 skip；不能切到 fake model。
- typecheck 和 unit test 全部通过。
- grep 没有新主链路命中 AI SDK chat runtime。

TDD 顺序：

1. RED：把一个现有 P0 feature 切到 Pi 默认路径，确认失败点。
2. GREEN：补齐最小缺口。
3. 按 feature 文件逐个切换，逐个 RED -> GREEN。
4. 最后跑完整 e2e。

退出条件：

```bash
bun run --filter '@reflecta/electron' typecheck
bun run --filter '@reflecta/electron' test
bun run --cwd apps/electron test:e2e
```

全部通过。

## 13. Phase 8：删除旧 runtime

用户状态：产品行为不变，只是仓库里不再有两套 Agent runtime。

这是 cleanup，不是功能 phase。只能在 Phase 7 通过后做。

删除：

- `@ai-sdk/react`。
- AI SDK chat transport。
- AI SDK UI message persistence tests。
- 只服务 AI SDK message conversion 的 helpers。
- fixture 对 `agent_messages.parts_json` 的写入。
- DB schema 和 migration 中的旧 Agent 对话表：`agent_threads`、`agent_messages`、`agent_tool_invocations`、`agent_runs`。

自动化测试：

- typecheck。
- unit test。
- 完整 e2e。
- grep 验收。
- migration 验收：新增 v1.1.0 migration 会 drop 旧 Agent 对话表；新数据库初始化后不再创建旧 Agent 对话表；旧数据库升级后这些表不存在。

验收：

```bash
rg "useChat|ChatTransport|UIMessageChunk|toUIMessageStream|AgentChatMessage = UIMessage|agent:stream|parts_json" apps/electron/src apps/electron/e2e
```

没有新主链路命中。

## 14. 停止规则

如果 Phase 0 不能证明真实 Pi SDK + 真实 AI prompt/session 路径存在，就停止。不要改 frontend，不要改 storage，不要用 fake host 继续推进。
