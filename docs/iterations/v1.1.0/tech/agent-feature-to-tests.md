# Reflecta 1.1.0 Agent Feature 场景怎么落到自动化测试

> 日期：2026-06-22
>
> 状态：Draft
>
> 范围：说明 `apps/electron/e2e/agent/features/*.feature` 里的用户场景，应该怎么变成代码里的 E2E、backend integration、renderer test、unit test。

## 1. 一句话

Feature 写的是：

```txt
用户做了什么，最后应该看到什么。
```

自动化测试要做的是：

```txt
用成本最低的代码测试，证明这些用户可见结果真的成立。
```

一个 scenario 不等于一个 E2E，也不等于一个 unit test。

一个 scenario 可以由几种测试一起证明。

## 2. 先看用户结果，再决定测试层

写自动化测试时，不要从 E2E 或 unit 开始想。

先看 scenario 里的 `那么 / 而且`：

```gherkin
那么页面应该显示用户消息 hello
而且页面应该显示 Agent 正在回复
而且最终应该出现一条 Agent 回复正文
而且输入框应该恢复可操作
而且对话列表应该出现这条新对话
```

然后逐条问：

```txt
这个结果必须打开真实 Electron 窗口才能证明吗？
这个结果必须经过 main/renderer IPC 才能证明吗？
这个结果必须重启应用才能证明吗？
这个结果只是后端 command -> view 的结果吗？
这个结果只是给定 view 后的前端渲染吗？
这个结果只是纯函数转换或状态判断吗？
```

答案决定测试层。

## 3. E2E 只测真实应用链路

E2E 只负责这些低层测试证明不了的东西：

- 真实 Electron 窗口能打开。
- 用户能在真实 UI 输入、点击、切换。
- renderer 到 main process 的 IPC 真的连通。
- 应用关闭再打开后，用户还能看到恢复后的状态。
- 文件上传、拖拽、系统窗口这类真实 UI 行为。

E2E 不负责：

- 覆盖所有消息状态。
- 覆盖所有提案状态。
- 覆盖所有 DTO 映射。
- 验证 AI 具体回复内容。
- 验证每个 tool 参数分支。

E2E 应该使用 fake AI / fake model runtime，不要打真实模型。

## 4. Backend Integration 测 Agent 后端链路

Backend integration 负责证明：

- `sendMessage` 能创建或更新 session。
- fake AI 回复能进入 session。
- tool / proposal / approval 的结果能写入 session。
- session 能被重新读出。
- 后端能返回前端需要的 view。

它应该尽量跑真实 Reflecta 后端代码，只 fake 系统边界：

- fake AI provider。
- fake model stream。
- clock / random。
- 必要时 fake Pi runtime 最外层。

不要 mock Reflecta 自己的内部模块来证明 Agent 行为。

## 5. Renderer Test 测前端展示

Renderer test 负责证明：

- 给定 view，页面显示用户消息。
- 给定 view，页面显示 Agent 回复、loading、失败、停止。
- 给定 view，页面显示引用、附件、提案卡片。
- 用户点击按钮后，前端发出正确 command。

Renderer test 不读 JSONL，不跑 Agent loop，不调用模型。

输入应该是固定 fixture。

## 6. Unit Test 测纯逻辑

Unit test 只测便宜、稳定、确定的东西：

- session entry -> view 的纯转换。
- proposal status -> 显示状态的映射。
- approval policy。
- command validation。
- 输入数据 normalization。

如果一个测试需要真实窗口、IPC、DB、文件系统或模型，它就不是 unit test。

## 7. 例子：AG-START-002

Scenario:

```txt
用户发送第一条消息后看到完整回复
```

E2E 测：

```txt
真实 Electron 窗口打开 Agent 页面
用户输入 hello 并点击发送
页面最终出现一条 fake Agent 回复
```

Backend integration 测：

```txt
sendMessage("hello")
  -> fake AI 返回回复
  -> session 记录用户消息和 Agent 回复
  -> readView 返回用户消息、回复、输入框可用状态
```

Renderer test 测：

```txt
给定包含用户消息、回复、输入框可用状态的 view
页面显示 hello
页面显示 Agent 回复
输入框可操作
```

不测：

```txt
不校验 AI 回复的具体自然语言内容。
```

## 8. 例子：AG-HISTORY-001

Scenario:

```txt
用户重启应用后仍能看到已完成对话
```

E2E 测：

```txt
完成一轮对话
关闭并重新打开 Electron
进入 Agent 页面
打开原对话
看到历史用户消息和 Agent 回复
```

Backend integration 测：

```txt
给定已有 session
重新创建 Agent backend
readView(sessionId)
返回同样的用户消息和 Agent 回复
```

Renderer test 测：

```txt
给定恢复后的 view
页面显示历史消息
输入框可操作
```

这里必须有 E2E，因为“关闭并重新打开应用”是用户路径的一部分。

## 9. 例子：AG-RESULT-002

Scenario:

```txt
用户可以区分提案的不同状态
```

这个通常不需要 E2E。

Renderer test 测：

```txt
给定 5 个 proposal fixture：
待确认
已确认
已拒绝
完成
出错

页面分别显示对应状态文案和错误信息。
```

Unit test 可选：

```txt
proposal status -> display label
```

不需要 E2E 的原因：

```txt
真实 Electron 窗口不会给这个状态映射增加额外信心。
```

## 10. 例子：AG-PROPOSAL-001

Scenario:

```txt
用户确认候选 Thought 后看到执行结果
```

E2E 测：

```txt
真实窗口中出现待确认提案
用户点击确认
页面显示已确认和执行结果
```

Backend integration 测：

```txt
approveProposal(proposalId)
  -> 执行 fake/临时 domain write
  -> session 记录已确认和结果
  -> readView 返回已确认 proposal
```

Renderer test 测：

```txt
给定待确认 proposal view
页面显示确认按钮
点击确认后发出 approve command

给定已确认 proposal view
页面显示已确认和结果
```

这类场景至少要有一个 E2E，因为它证明用户按钮到 backend command 的真实链路。

## 11. 第一批自动化测试

先写这些，不要一次把所有 scenario 都自动化完。

E2E：

```txt
@AG-START-002 用户发送第一条消息后看到完整回复
@AG-RUN-001 用户停止正在生成的回复
@AG-CONV-001 对话 A 正在回复时切换到对话 B 不影响 B
@AG-HISTORY-001 用户重启应用后仍能看到已完成对话
@AG-PROPOSAL-001 用户确认候选 Thought 后看到执行结果
```

Backend integration：

```txt
@AG-START-002 sendMessage 生成 session 和 view
@AG-START-003 回复失败后同一对话可继续发送
@AG-RUN-001 stop run 后 session/view 显示停止
@AG-HISTORY-001 已有 session 可恢复 view
@AG-PROPOSAL-001 approve proposal 写入结果
@AG-PROPOSAL-002 reject proposal 写入结果
```

Renderer test：

```txt
消息列表显示用户消息、loading、回复、失败、停止
输入框 enabled/disabled 状态正确
引用和附件显示在用户消息中
proposal 待确认、已确认、已拒绝、完成、出错状态可区分
确认/拒绝按钮发出正确 command
```

Unit test：

```txt
session entries -> view
proposal status -> display label
approval policy
command validation
```

## 12. 最后规则

写每个自动化测试前，只问一句：

```txt
这条用户结果，用哪一层证明最便宜，而且失败时最好定位？
```

能用 unit 证明的，不放 E2E。

能用 renderer test 证明的，不放 E2E。

能用 backend integration 证明的，不放 E2E。

只有真实窗口、IPC、重启、真实用户交互必须参与时，才写 E2E。
