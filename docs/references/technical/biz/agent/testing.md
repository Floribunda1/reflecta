# Agent 测试策略

这份文档定义 Agent 模块重构前应该补哪些测试。写法顺序是：先写 test case，再决定哪些落到 E2E、哪些落到 integration / unit、哪些进入 AI eval。

## 写法顺序

先把 Agent 当成一个黑盒产品功能，写 QA-style test case：

```text
ID
能力
场景
前置条件
操作步骤
期望结果
优先级
自动化层级
落地测试文件
```

自动化层级是 test case 的属性，不是测试设计的起点。

```text
行为跨过 UI、IPC、runtime、持久化边界 -> E2E
行为只验证后端公共接口或前端状态适配 -> integration / unit
行为依赖真实模型质量、工具选择、回答好坏 -> AI eval / nightly，不阻塞普通 PR
```

E2E 不是“所有 case 都用浏览器跑”。自动化流水线需要的是每条重要行为都有机器可判定的 oracle；oracle 不一定都在 E2E。

## Test Case Catalog

P0 是重构 Agent 前必须有自动化保护的行为。P1 在本轮重构碰到时补；否则等真实 bug 或对应功能改动时补。

| ID        | 优先级 | 能力         | 场景                                                 | 前置条件                                                  | 操作步骤                                       | 期望结果                                                                                 | 自动化层级         | 落地测试                                                                                                  |
| --------- | ------ | ------------ | ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| AG-TC-001 | P0     | 发送消息     | 新对话发送消息成功                                   | fake model 返回 `hello from agent`                        | 创建新对话；输入 `hello`；发送                 | 页面出现用户消息；显示 assistant 响应中状态；最终显示 `hello from agent`；输入框恢复可用 | E2E                | `apps/electron/e2e/agent-chat.spec.ts`                                                                    |
| AG-TC-002 | P0     | 发送消息     | 模型失败后可恢复                                     | fake model 第一次返回 error，第二次返回成功文本           | 发送第一条消息触发错误；再发送第二条消息       | 第一条显示用户可理解错误；第二条正常完成；页面不白屏、不永久 loading                     | E2E                | `apps/electron/e2e/agent-chat.spec.ts`                                                                    |
| AG-TC-003 | P0     | 运行控制     | 取消响应                                             | fake model 慢速 streaming                                 | 发送消息；响应中点击停止                       | 停止后不再追加 token；停止按钮消失；输入框恢复可用                                       | E2E                | `apps/electron/e2e/agent-chat.spec.ts`                                                                    |
| AG-TC-004 | P0     | 对话切换     | streaming 时切换对话不串线                           | 存在 thread A 和 thread B；fake model 对 A 慢速 streaming | 在 A 发送消息；streaming 中切到 B；再切回 A    | B 不显示 A 的消息或 running 状态；A 的后续分片只回到 A；切回 A 后状态一致                | E2E                | `apps/electron/e2e/agent-thread.spec.ts`                                                                  |
| AG-TC-005 | P0     | 历史持久化   | 对话历史可恢复                                       | fake model 返回成功文本                                   | 发送消息完成；切到另一个对话；切回来或重启 app | 原对话仍显示完整 user / assistant 消息；标题和预览不丢                                   | E2E                | `apps/electron/e2e/agent-thread.spec.ts`                                                                  |
| AG-TC-006 | P0     | 编辑消息     | 编辑用户消息后不会保留脏回复                         | 已有 user message + assistant reply                       | 编辑第一条用户消息并提交                       | 用户消息更新；其后的旧 assistant 内容按产品规则被清掉或重新生成；消息顺序不乱            | E2E + integration  | `apps/electron/e2e/agent-thread.spec.ts`；`src/main/services/agent/repository.test.ts`                    |
| AG-TC-007 | P0     | 请求构造     | 发送请求包含消息、模型、reasoning、context metadata  | 给定用户消息、模型选择、reasoning、context refs           | 调用发送入口                                   | 后端收到稳定的请求快照；字段不丢失；无效字段被忽略或规范化                               | unit / integration | `src/renderer/src/modules/chat/session/electron-chat-transport.test.ts`                                   |
| AG-TC-008 | P0     | 流处理       | stream chunk 只进入对应 request                      | 同时存在两个 requestId 的 stream chunk                    | transport 收到交错 chunk                       | 只消费当前 requestId 的 chunk；其他 chunk 不影响当前消息                                 | unit               | `src/renderer/src/modules/chat/session/electron-chat-transport.test.ts`                                   |
| AG-TC-009 | P0     | 持久化       | 保存最终消息时不留下半写入状态                       | repository 写入过程中失败                                 | 调用消息替换                                   | 已有消息保持一致；不会出现半条新消息                                                     | integration        | `src/main/services/agent/repository.test.ts`                                                              |
| AG-TC-010 | P0     | 错误显示     | provider / network / config 错误变成用户可读文案     | 给定常见错误对象                                          | 格式化错误                                     | 返回可行动的错误文案，不暴露无意义 stack                                                 | unit               | `src/main/services/agent/error.test.ts`                                                                   |
| AG-TC-011 | P0     | 消息视图     | reasoning、tool、text 的顺序稳定                     | 给定交错 message parts                                    | 构造 Agent turn view                           | UI 区块顺序和原始 part 顺序一致；不会把工具和文本错位                                    | unit               | `src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`                                          |
| AG-TC-012 | P0     | 对话缓存     | 更新一个 thread 不污染其他 thread                    | Query cache 中有 A/B 两个 thread                          | 替换 A 的消息或标题                            | 只有 A 的 cache 被更新；B 不变                                                           | unit               | `src/renderer/src/modules/chat/session/query-cache.test.ts`                                               |
| AG-TC-013 | P1     | 工具确认     | 用户确认 proposal 后继续执行                         | fake model 产出需要确认的 proposal tool call              | 点击确认                                       | 确认状态可见；工具执行结果可见；Agent 继续输出最终文本                                   | E2E + component    | `apps/electron/e2e/agent-tools.spec.ts`；`src/renderer/src/modules/chat/messages/message-list.test.tsx`   |
| AG-TC-014 | P1     | 工具拒绝     | 用户拒绝 proposal 后不执行写入                       | fake model 产出需要确认的 proposal tool call              | 点击拒绝                                       | 拒绝状态可见；不会执行写入；Agent 保留拒绝记录                                           | E2E + unit         | `apps/electron/e2e/agent-tools.spec.ts`；`src/main/services/agent/runtime.test.ts`                        |
| AG-TC-015 | P1     | Context      | 选中 context 后发送                                  | 已有 thought/context/category 可被 mention                | 选中 context；发送消息                         | 用户消息显示所选 context；本次请求包含对应 context；最终消息正常完成                     | E2E + unit         | `apps/electron/e2e/agent-context.spec.ts`；`src/main/services/agent/context.test.ts`                      |
| AG-TC-016 | P1     | 附件         | 不支持 native file part 的 provider 使用附件提示文本 | 给定 file part 和 OpenAI-compatible provider              | 构造 model messages                            | file part 被降级为可读附件提示；不会丢失 attachment id                                   | unit               | `src/main/services/agent/runtime.test.ts`                                                                 |
| AG-TC-017 | P1     | 标题         | 新对话标题从第一条用户消息生成                       | 新对话标题为 `新对话`                                     | 发送第一条用户消息                             | thread 标题更新为可读预览；用户手动改过标题后不覆盖                                      | integration / unit | `src/main/services/agent/repository.test.ts`；`src/renderer/src/modules/chat/session/query-cache.test.ts` |
| AG-TC-018 | P1     | 对话管理     | 归档 / 删除对话                                      | 有至少两个对话                                            | 归档或删除当前对话                             | 目标对话从列表消失；其他对话不受影响；重新打开后状态一致                                 | E2E                | `apps/electron/e2e/agent-thread.spec.ts`                                                                  |
| AG-TC-019 | P1     | 重新生成     | 重新生成 assistant 回复                              | 已有 user + assistant 消息                                | 对 assistant 执行 regenerate                   | 旧回复按产品规则替换；thread 顺序不乱；不会重复 user 消息                                | E2E / integration  | `apps/electron/e2e/agent-chat.spec.ts`                                                                    |
| AG-TC-020 | P1     | 真实模型质量 | Agent 能根据上下文回答并选择合理工具                 | 配置真实 provider；准备固定数据集                         | 跑固定 prompt 集合                             | 输出满足 eval rubric；不作为普通 PR 阻塞项                                               | AI eval / nightly  | later                                                                                                     |

## E2E 落地

第一批 E2E 只实现 P0 中必须跨 UI 的 case：

```text
AG-TC-001 发送成功
AG-TC-002 失败可恢复
AG-TC-003 取消响应
AG-TC-004 切换对话不串线
AG-TC-005 历史持久化
AG-TC-006 编辑消息
```

E2E 运行要求：

- 不调用真实 LLM。
- 使用 fake model / fake stream，让测试稳定产出 success、error、slow stream。
- 每个 case 使用隔离的 `REFLECTA_CONTENT_STORAGE_ROOT`。
- 断言用户可见行为，不读内部数据库来替代 UI 断言。
- 必要时补稳定 selector，例如 `agent-message-list`、`agent-stop-button`。

工具确认和 context 如果本轮重构会碰到，就把 `AG-TC-013`、`AG-TC-014`、`AG-TC-015` 提到 P0。

## Integration / Unit 落地

这些测试服务于同一批 test case，只是执行层级更便宜。

| Test Case | 要锁住的规则                                                                | 推荐位置                                                                |
| --------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| AG-TC-006 | 编辑已有 user message 会截断后续消息                                        | `src/main/services/agent/repository.test.ts`                            |
| AG-TC-007 | 请求 body 只保留合法 modelSelection / reasoningLevel                        | `src/renderer/src/modules/chat/session/electron-chat-transport.test.ts` |
| AG-TC-008 | transport 只消费匹配 requestId 的 chunk；error chunk 会关闭 listener 并抛错 | `src/renderer/src/modules/chat/session/electron-chat-transport.test.ts` |
| AG-TC-009 | `replaceMessages` 事务失败时不留下半写入消息                                | `src/main/services/agent/repository.test.ts`                            |
| AG-TC-010 | `formatAgentError` 覆盖 missing config、provider 404、network failure       | `src/main/services/agent/error.test.ts`                                 |
| AG-TC-011 | `buildAgentTurnView` 保持 text / reasoning / tool 顺序和状态                | `src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`        |
| AG-TC-012 | thread cache 更新只影响目标 thread                                          | `src/renderer/src/modules/chat/session/query-cache.test.ts`             |
| AG-TC-014 | denied approval 转成 provider 可接受的 tool result                          | `src/main/services/agent/runtime.test.ts`                               |
| AG-TC-015 | selected context 只把用户选中的 refs 拼入 prompt                            | `src/main/services/agent/context.test.ts`                               |
| AG-TC-016 | OpenAI-compatible provider 的 file part 降级规则稳定                        | `src/main/services/agent/runtime.test.ts`                               |
| AG-TC-017 | 标题更新规则不会覆盖用户自定义标题                                          | `src/main/services/agent/repository.test.ts`                            |

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

- P0 test case 都有自动化落点。
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
