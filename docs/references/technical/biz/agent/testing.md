# Agent 测试策略

这份文档定义 Agent 模块重构前应该补哪些测试。目标不是追求覆盖率，而是让自动化流水线能判断：Agent 对用户暴露的行为是否保持不变。

## 核心判断

Agent 的测试先按 QA test case 写行为规格，再给每条规格选择最便宜的自动化层级。

```text
行为跨过 UI、IPC、runtime、持久化边界 -> E2E
行为只验证后端公共接口或前端状态适配 -> integration / unit
行为依赖真实模型质量、工具选择、回答好坏 -> AI eval / nightly，不阻塞普通 PR
```

E2E 不是“所有 case 都用浏览器跑”。E2E 是最贵的执行方式，只用于锁住用户路径和跨层协作。每条重要行为都要有机器可判定的 oracle，但 oracle 不一定都在 E2E。

## 测试边界

公共契约：

- `ChatService` 的 IPC 方法：创建 / 列出 / 切换 / 删除 / 重命名对话，发送消息，取消运行，读取消息。
- `ElectronChatTransport` 消费的 `agent:stream` 分片。
- 用户在 Chat UI 上看到的消息、运行状态、工具确认卡、错误状态和历史对话。
- `AgentRepository` 持久化后的可读取行为。

不要锁内部实现：

- 不断言 `AgentRuntime` 内部先调用哪个 private/helper。
- 不断言 React hook 内部用了几个 state。
- 不断言 repository 内部 SQL 形状。
- 不 mock 项目内部模块来证明某个内部函数被调用。

只 mock 系统边界：

- 模型提供方。
- 时间。
- 文件系统 / Electron 进程边界。
- 外部 API。

## E2E 运行原则

阻塞 CI 的 E2E 必须稳定、确定、可复现。

- 不调用真实 LLM。
- 使用 fake model / fake stream，让测试能稳定产出 text chunk、error、slow stream、tool call。
- 每个 case 使用隔离的 `REFLECTA_CONTENT_STORAGE_ROOT`。
- 断言用户可见行为，不读内部数据库来替代 UI 断言。
- 必要时补稳定 selector，但 selector 名称应该表达用户语义，例如 `agent-message-list`、`agent-stop-button`。

真实模型测试单独放到 eval 或 nightly smoke。它测回答质量，不测普通重构是否破坏产品行为。

## E2E Case

第一批 E2E 应该落在 `apps/electron/e2e/agent-chat.spec.ts` 和 `apps/electron/e2e/agent-thread.spec.ts`。

| ID         | 场景                | 前置条件                                                  | 操作                                             | 期望结果                                                                               |
| ---------- | ------------------- | --------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| AG-E2E-001 | 新对话发送消息成功  | fake model 返回 `hello from agent`                        | 创建新对话，输入 `hello`，发送                   | 页面出现用户消息；出现 assistant 流式状态；最终显示 `hello from agent`；输入框恢复可用 |
| AG-E2E-002 | 模型失败后可恢复    | fake model 第一次返回 error，第二次返回成功文本           | 发送第一条消息触发错误，再发送第二条消息         | 第一条显示用户可理解错误；第二条可以正常完成；页面不白屏、不永久 loading               |
| AG-E2E-003 | 取消响应            | fake model 慢速 streaming                                 | 发送消息后点击停止                               | 停止后不再追加 token；停止按钮消失；输入框恢复可用；刷新后没有半条继续增长的响应       |
| AG-E2E-004 | 切换对话不串线      | 存在 thread A 和 thread B；fake model 对 A 慢速 streaming | 在 A 发送消息，streaming 中切到 B                | B 不显示 A 的消息或 running 状态；A 的后续分片只回到 A；切回 A 后状态一致              |
| AG-E2E-005 | 历史持久化          | fake model 返回成功文本                                   | 发送消息完成，切到另一个对话，再切回来或重启 app | 原对话仍显示完整 user / assistant 消息；标题和预览不丢                                 |
| AG-E2E-006 | 编辑用户消息        | 已有 user message + assistant reply                       | 编辑第一条用户消息并提交                         | 用户消息更新；其后的旧 assistant 内容按产品规则被清掉或重新生成；消息顺序不乱          |
| AG-E2E-007 | 工具确认通过        | fake model 产出一个需要确认的 proposal tool call          | 点击确认                                         | 确认状态可见；工具执行结果可见；Agent 能继续输出最终文本                               |
| AG-E2E-008 | 工具确认拒绝        | fake model 产出一个需要确认的 proposal tool call          | 点击拒绝                                         | 拒绝状态可见；不会执行写入；Agent 能继续或结束，并保留拒绝记录                         |
| AG-E2E-009 | 选中 context 后发送 | 已有 thought/context/category 可被 mention                | 选中 context，发送消息                           | 用户消息显示所选 context；本次请求包含对应 context；最终消息正常完成                   |
| AG-E2E-010 | 归档/删除对话       | 有至少两个对话                                            | 归档或删除当前对话                               | 对话从列表消失；不会影响其他对话；重新打开后仍然消失                                   |

第一轮重构前先实现 P0：

```text
AG-E2E-001 发送成功
AG-E2E-002 失败可恢复
AG-E2E-003 取消响应
AG-E2E-004 切换对话不串线
AG-E2E-005 历史持久化
AG-E2E-006 编辑消息
```

工具确认和 context 如果本轮重构会碰到，就加入 P0；否则先作为 P1。

## Integration / Unit Case

这些 case 不需要浏览器。它们应该落在 `src/main/services/agent/*.test.ts`、`src/renderer/src/modules/chat/session/*.test.ts`、`src/renderer/src/modules/chat/messages/*.test.tsx`。

| ID         | 行为                                                                         | 推荐层级           | 推荐位置                                                                |
| ---------- | ---------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| AG-INT-001 | `sendMessage` 创建 run，先保存请求快照，完成后保存最终快照                   | integration        | `src/main/services/agent/runtime.test.ts`                               |
| AG-INT-002 | `cancel` 将 active run 结束为 cancelled，并发出 abort chunk                  | integration        | `src/main/services/agent/runtime.test.ts`                               |
| AG-INT-003 | stream error 映射为用户可读错误 chunk                                        | unit               | `src/main/services/agent/error.test.ts`                                 |
| AG-INT-004 | 编辑已有 user message 会截断后续消息                                         | integration        | `src/main/services/agent/repository.test.ts`                            |
| AG-INT-005 | `replaceMessages` 失败时不留下半写入消息                                     | integration        | `src/main/services/agent/repository.test.ts`                            |
| AG-INT-006 | selected context 只把用户选中的 refs 拼入 prompt                             | unit / integration | `src/main/services/agent/context.test.ts`                               |
| AG-INT-007 | provider/model 选择错误时返回可理解错误或 fallback                           | unit               | `src/main/services/agent/model.test.ts`                                 |
| AG-INT-008 | OpenAI-compatible provider 不支持 file part 时降级为附件提示文本             | unit               | `src/main/services/agent/runtime.test.ts`                               |
| AG-INT-009 | denied tool approval 转成 provider 可接受的 tool result                      | unit               | `src/main/services/agent/runtime.test.ts`                               |
| AG-INT-010 | thread cache 更新只影响目标 thread                                           | unit               | `src/renderer/src/modules/chat/session/query-cache.test.ts`             |
| AG-INT-011 | 切换 thread 时 chat registry 保留各自运行状态                                | integration        | `src/renderer/src/modules/chat/session/chat-registry.test.ts`           |
| AG-INT-012 | `ElectronChatTransport` 只消费匹配 requestId 的 stream chunk                 | unit               | `src/renderer/src/modules/chat/session/electron-chat-transport.test.ts` |
| AG-INT-013 | transport 收到 error chunk 后关闭 listener 并抛出错误                        | unit               | `src/renderer/src/modules/chat/session/electron-chat-transport.test.ts` |
| AG-INT-014 | `buildAgentTurnView` 保持 text / reasoning / tool 的原始顺序                 | unit               | `src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`        |
| AG-INT-015 | proposal tool 的 pending / approved / rejected / output / error 状态都能渲染 | unit / component   | `src/renderer/src/modules/chat/messages/message-list.test.tsx`          |

## Bug 回归测试规则

发现 bug 后先补一条最小可复现 test case，再修。

```text
跨 UI、IPC、持久化或运行状态 -> 新增 E2E regression
纯转换规则、排序、cache、错误映射 -> 新增 unit/integration regression
两者都有 -> E2E 锁用户路径，unit/integration 锁根因规则
```

命名格式：

```text
regression: switching threads keeps stream updates scoped to their source thread
regression: editing a user message removes stale downstream assistant content
regression: failed model run leaves the composer usable
```

不要为同一个 bug 写一组矩阵。先写一条会失败的最短 case。以后同类问题重复出现，再提升为通用规则测试。

## 重构前检查

开始重构 Agent 前，至少有：

- P0 E2E 全部通过。
- 本次会触碰的 public behavior 有 integration / unit 覆盖。
- fake model 能覆盖 success、error、slow stream、tool proposal 四种流。
- 真实 LLM 不在阻塞 PR 的 E2E 路径里。

重构过程中，每改一块只跑相关最小集合；合并前再跑：

```bash
bun run --cwd apps/electron test:main
bun run --cwd apps/electron test:renderer
bun run --cwd apps/electron test:e2e
```
