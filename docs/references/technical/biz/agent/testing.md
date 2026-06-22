# Agent 测试策略

这份文档定义 Agent 模块重构前的测试设计。顺序固定为：

```text
业务能力 -> 测试套件 -> test case -> 自动化层级 -> 具体测试文件
```

不要先按 E2E / unit 分类写测试。E2E 和 unit 只是执行方式；test case 的来源是 Agent 对用户暴露的行为契约。

## 测试设计模型

Agent 的行为分成 7 个测试套件：

| Suite     | 能力域   | 要保护的行为契约                                     | 默认层级           |
| --------- | -------- | ---------------------------------------------------- | ------------------ |
| AG-CHAT   | 基础对话 | 用户能发送消息、看到响应、失败后继续使用             | E2E                |
| AG-RUN    | 运行控制 | streaming、取消、错误、终止状态不会乱                | E2E + integration  |
| AG-THREAD | 对话隔离 | 切换、持久化、删除、归档不会串状态                   | E2E + unit         |
| AG-MSG    | 消息变更 | 编辑、重新生成不会留下脏历史                         | E2E + integration  |
| AG-INPUT  | 请求输入 | 模型、reasoning、context、附件进入正确请求           | integration + unit |
| AG-VIEW   | 消息呈现 | text、reasoning、tool、proposal 顺序和状态稳定       | unit + component   |
| AG-TOOL   | 工具提案 | approve / reject / output / error 全流程可见且可恢复 | E2E + unit         |

每个 test case 必须包含：

```text
ID
目标
前置条件
步骤
期望结果
自动化层级
落地位置
```

## Suite AG-CHAT: 基础对话

目标：证明用户可以完成最基本的 Agent 对话，并且失败不会把对话界面打坏。

公共 fixture：

```text
使用隔离的 REFLECTA_CONTENT_STORAGE_ROOT
使用 fake model，不调用真实 LLM
fake model 支持 success、error、slow stream 三种脚本
```

### AG-CHAT-001 新对话发送成功

目标：锁住 Agent 的最小可用路径。

前置条件：

```text
当前没有正在运行的 Agent run
fake model 对第一条请求返回文本 hello from agent
```

步骤：

```text
1. 打开 Agent 页面
2. 创建新对话
3. 在输入框输入 hello
4. 点击发送
```

期望结果：

```text
页面出现用户消息 hello
页面进入 assistant 响应中状态
最终出现 assistant 消息 hello from agent
发送按钮 / 输入框恢复可操作
对话列表出现这条对话
```

自动化层级：E2E。

落地位置：`apps/electron/e2e/agent-chat.spec.ts`。

### AG-CHAT-002 模型失败后可继续发送

目标：锁住错误恢复，不让一次失败污染后续对话。

前置条件：

```text
fake model 第一次请求返回 error: provider unavailable
fake model 第二次请求返回文本 recovered
```

步骤：

```text
1. 在新对话发送 first
2. 等待错误状态出现
3. 在同一对话继续发送 second
```

期望结果：

```text
first 保留为用户消息
界面显示可理解错误，不是白屏或无限 loading
second 可以正常发送
最终出现 assistant 消息 recovered
输入框在错误后和恢复后都可操作
```

自动化层级：E2E。

落地位置：`apps/electron/e2e/agent-chat.spec.ts`。

## Suite AG-RUN: 运行控制

目标：证明一次 Agent run 的生命周期可被用户理解和控制。

### AG-RUN-001 取消 slow stream

目标：锁住取消语义，避免取消后继续追加 token。

前置条件：

```text
fake model 返回 slow stream: token-1, token-2, token-3...
```

步骤：

```text
1. 发送一条消息
2. 等待 token-1 出现
3. 点击停止
4. 等待界面回到可操作状态
```

期望结果：

```text
停止后不再追加新的 token
停止按钮消失
输入框恢复可用
当前 thread 不再显示 running 状态
刷新或切换回来后不会继续增长旧响应
```

自动化层级：E2E + integration。

落地位置：

```text
apps/electron/e2e/agent-chat.spec.ts
src/main/services/agent/runtime.test.ts
```

### AG-RUN-002 stream terminal chunk 只结束当前请求

目标：锁住 transport 对 finish / abort / error 的处理。

前置条件：

```text
存在 request A 和 request B
transport 正在消费 request A
```

步骤：

```text
1. 向 agent:stream 发送 request B 的 text chunk
2. 向 agent:stream 发送 request A 的 text chunk
3. 向 agent:stream 发送 request A 的 finish / abort / error
```

期望结果：

```text
request B 的 chunk 被忽略
request A 的 text chunk 被消费
finish 会正常关闭 stream
abort 会关闭 stream 且不抛用户错误
error 会关闭 stream 并产生用户可见错误
listener 被清理，不泄漏到后续请求
```

自动化层级：unit。

落地位置：`src/renderer/src/modules/chat/session/electron-chat-transport.test.ts`。

## Suite AG-THREAD: 对话隔离

目标：证明多个 thread 之间的消息、running 状态、缓存和持久化互不污染。

### AG-THREAD-001 streaming 时切换对话不串线

目标：锁住最容易在重构中断掉的跨 thread 行为。

前置条件：

```text
存在 thread A 和 thread B
fake model 对 thread A 返回 slow stream
thread B 有自己的历史消息
```

步骤：

```text
1. 打开 thread A
2. 发送消息 start A
3. 在 A streaming 时切换到 thread B
4. 等待 A 的 fake stream 继续产出 chunk
5. 切回 thread A
```

期望结果：

```text
thread B 不显示 start A
thread B 不显示 A 的 assistant token
thread B 的输入状态按 B 自己的状态显示
A 的后续 chunk 只追加到 A
切回 A 后能看到 A 的完整运行结果或仍在运行状态
```

自动化层级：E2E。

落地位置：`apps/electron/e2e/agent-thread.spec.ts`。

### AG-THREAD-002 对话历史持久化

目标：锁住完成后的 thread snapshot。

前置条件：

```text
fake model 返回文本 persisted answer
```

步骤：

```text
1. 新建 thread
2. 发送 remember this
3. 等待 assistant 完成
4. 切换到另一个 thread
5. 切回原 thread，或重启 app 后重新打开原 thread
```

期望结果：

```text
原 thread 仍显示用户消息 remember this
原 thread 仍显示 assistant 消息 persisted answer
对话标题 / 预览不丢
消息顺序保持 user -> assistant
```

自动化层级：E2E + repository integration。

落地位置：

```text
apps/electron/e2e/agent-thread.spec.ts
src/main/services/agent/repository.test.ts
```

### AG-THREAD-003 删除或归档只影响目标对话

目标：锁住对话管理的隔离性。

前置条件：

```text
存在 thread A 和 thread B
两个 thread 都有历史消息
```

步骤：

```text
1. 对 thread A 执行删除或归档
2. 查看对话列表
3. 打开 thread B
4. 重启或重新加载后再次查看列表
```

期望结果：

```text
thread A 从可见列表消失
thread B 仍然存在
thread B 的消息不变
重新打开后 thread A 仍不可见
```

自动化层级：E2E。

落地位置：`apps/electron/e2e/agent-thread.spec.ts`。

## Suite AG-MSG: 消息变更

目标：证明编辑、重新生成这类历史变更不会留下 stale assistant 内容。

### AG-MSG-001 编辑用户消息会清理后续回复

目标：锁住编辑消息的产品语义。

前置条件：

```text
thread 中已有：
user: old question
assistant: old answer
fake model 对 edited question 返回 new answer
```

步骤：

```text
1. 点击 old question 的编辑入口
2. 将内容改为 edited question
3. 提交编辑
4. 等待新响应完成
```

期望结果：

```text
用户消息变成 edited question
old answer 不再作为有效后续回复显示
最终出现 new answer
消息顺序仍然是 user -> assistant
切换 thread 或刷新后结果一致
```

自动化层级：E2E + repository integration。

落地位置：

```text
apps/electron/e2e/agent-thread.spec.ts
src/main/services/agent/repository.test.ts
```

### AG-MSG-002 重新生成不会重复用户消息

目标：锁住 regenerate 的历史替换语义。

前置条件：

```text
thread 中已有：
user: question
assistant: first answer
fake model 对 regenerate 返回 second answer
```

步骤：

```text
1. 对 assistant 消息执行重新生成
2. 等待新响应完成
```

期望结果：

```text
用户消息 question 只出现一次
first answer 被替换或按产品规则标记为非当前
second answer 成为当前 assistant 回复
消息顺序不乱
```

自动化层级：E2E 或 integration。本轮不改 regenerate 时可先不做 P0。

落地位置：`apps/electron/e2e/agent-chat.spec.ts`。

## Suite AG-INPUT: 请求输入

目标：证明前端选择的模型、reasoning、context、附件能稳定进入模型请求，且无效输入不会污染请求。

### AG-INPUT-001 发送请求保留模型和 reasoning

目标：锁住 `ElectronChatTransport` 对请求 body 的规范化。

前置条件：

```text
用户选择 providerId=model-provider
用户选择 modelId=model-a
用户选择 reasoningLevel=medium
```

步骤：

```text
1. 调用 transport.sendMessages
2. 捕获发给 IPC 的 SendAgentMessageInput
```

期望结果：

```text
input.threadId 正确
input.messages 是发送时的消息快照
input.modelSelection.providerId 为 model-provider
input.modelSelection.modelId 为 model-a
input.reasoningLevel 为 medium
无效 reasoningLevel 不会进入 input
```

自动化层级：unit。

落地位置：`src/renderer/src/modules/chat/session/electron-chat-transport.test.ts`。

### AG-INPUT-002 选中 context 后只注入选中项

目标：锁住 context prompt 的边界，避免隐藏内容泄漏。

前置条件：

```text
用户选中 thought T1 和 category C1
系统中还存在未选中的 thought T2
```

步骤：

```text
1. 构造带 contextRefs metadata 的用户消息
2. 调用 selected context block 构造逻辑
```

期望结果：

```text
prompt block 包含 T1 和 C1
prompt block 不包含 T2
超过数量上限时按规则截断
缺失或不可读的 ref 不会让整次发送失败
```

自动化层级：unit / integration。

落地位置：`src/main/services/agent/context.test.ts`。

### AG-INPUT-003 不支持 native file part 时降级附件提示

目标：锁住不同 provider 的附件兼容行为。

前置条件：

```text
消息中包含 file part
provider 是 OpenAI-compatible provider
```

步骤：

```text
1. 调用 model message 构造逻辑
```

期望结果：

```text
file part 被替换为文本附件提示
提示包含 filename、mediaType、attachmentId
不会返回 base64 或丢失附件引用
OpenAI provider 仍保留 native file part
```

自动化层级：unit。

落地位置：`src/main/services/agent/runtime.test.ts`。

## Suite AG-VIEW: 消息呈现

目标：证明 Agent Turn 的可读性稳定，尤其是 reasoning、工具活动、文本、proposal 的顺序和状态。

### AG-VIEW-001 保持 message parts 的用户可见顺序

目标：锁住 Turn Renderer 的核心契约。

前置条件：

```text
assistant message parts 顺序为：
reasoning -> tool lookup -> text -> tool proposal -> text
```

步骤：

```text
1. 调用 buildAgentTurnView
2. 渲染 MessageList
```

期望结果：

```text
reasoning 显示在第一个文本前
lookup 工具活动不跨过 text 被合并
proposal card 出现在原始位置
最后的 text 仍在 proposal 后面
```

自动化层级：unit + component。

落地位置：

```text
src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
src/renderer/src/modules/chat/messages/message-list.test.tsx
```

### AG-VIEW-002 proposal 状态可区分

目标：锁住 approve / reject / pending / output / error 的可读性。

前置条件：

```text
构造 5 种 proposal tool part：
pending
approval responded approved
approval responded rejected
output available
error
```

步骤：

```text
1. 渲染 MessageList
```

期望结果：

```text
pending 显示待确认操作
approved 显示已确认结果
rejected 显示已拒绝结果
output 显示执行结果
error 显示错误状态
五种状态不会被渲染成同一个普通工具活动
```

自动化层级：component。

落地位置：`src/renderer/src/modules/chat/messages/message-list.test.tsx`。

## Suite AG-TOOL: 工具提案

目标：证明需要用户确认的写入类工具不会绕过确认，并且确认结果能回到 Agent。

### AG-TOOL-001 用户确认 proposal 后执行并继续

目标：锁住 approve path。

前置条件：

```text
fake model 先产出 proposal tool call
用户确认后 fake tool 返回 success output
fake model 继续返回 final answer
```

步骤：

```text
1. 发送触发 proposal 的消息
2. 等待 proposal card 出现
3. 点击确认
4. 等待工具结果和最终回答
```

期望结果：

```text
proposal card 可见
点击确认后状态变为已确认或执行中
工具输出可见
最终 assistant 文本可见
持久化历史中保留 proposal 和确认状态
```

自动化层级：E2E + component。

落地位置：

```text
apps/electron/e2e/agent-tools.spec.ts
src/renderer/src/modules/chat/messages/message-list.test.tsx
```

### AG-TOOL-002 用户拒绝 proposal 后不执行写入

目标：锁住 reject path。

前置条件：

```text
fake model 先产出 proposal tool call
proposal 对应一个写入动作
```

步骤：

```text
1. 发送触发 proposal 的消息
2. 等待 proposal card 出现
3. 点击拒绝
```

期望结果：

```text
proposal 状态变为已拒绝
写入动作没有发生
Agent 可以继续解释或结束
拒绝状态可被重新加载后看到
provider 消息转换时 rejected approval 不会导致模型请求格式错误
```

自动化层级：E2E + unit。

落地位置：

```text
apps/electron/e2e/agent-tools.spec.ts
src/main/services/agent/runtime.test.ts
```

## P0 自动化范围

重构 Agent 前，先落这些 P0 case：

| Case          | 层级               | 原因                 |
| ------------- | ------------------ | -------------------- |
| AG-CHAT-001   | E2E                | 最小可用路径         |
| AG-CHAT-002   | E2E                | 错误恢复             |
| AG-RUN-001    | E2E + integration  | 取消和 run lifecycle |
| AG-RUN-002    | unit               | stream request 隔离  |
| AG-THREAD-001 | E2E                | 切换对话不串线       |
| AG-THREAD-002 | E2E + integration  | 历史持久化           |
| AG-MSG-001    | E2E + integration  | 编辑消息不留脏历史   |
| AG-INPUT-001  | unit               | 请求参数稳定         |
| AG-INPUT-002  | unit / integration | context 注入边界     |
| AG-VIEW-001   | unit + component   | 消息顺序可读性       |

工具确认如果本轮重构会碰到，就把 `AG-TOOL-001` 和 `AG-TOOL-002` 提到 P0；否则先放 P1。

## Bug 回归规则

发现 bug 后，不先写“覆盖更多”的测试，先把 bug 归入一个 suite，再补一条最小 case。

```text
切换对话串线 -> AG-THREAD
编辑后旧回复还在 -> AG-MSG
取消后继续追加 token -> AG-RUN
context 泄漏或缺失 -> AG-INPUT
proposal 状态显示错 -> AG-VIEW 或 AG-TOOL
```

命名格式：

```text
regression: AG-THREAD keeps slow stream chunks scoped to their source thread
regression: AG-MSG editing a user message removes stale assistant content
regression: AG-RUN failed model run leaves the composer usable
```

## 重构前检查

开始重构 Agent 前，至少满足：

```text
P0 case 都有自动化落点
P0 E2E 全部通过
本次会触碰的 public behavior 有 integration / unit 覆盖
fake model 能覆盖 success、error、slow stream、tool proposal
真实 LLM 不在阻塞 PR 的 E2E 路径里
```

合并前跑：

```bash
bun run --cwd apps/electron test:main
bun run --cwd apps/electron test:renderer
bun run --cwd apps/electron test:e2e
```
