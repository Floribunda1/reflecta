# Agent Test Cases

这份文档只定义 Agent 模块的 test case。其他流程另行派生，不能反过来污染 test case 本身。

每个 test case 只包含：

```text
ID
目标
前置条件
步骤
期望结果
```

## Suite AG-CHAT: 基础对话

### AG-CHAT-001 新对话发送成功

ID：AG-CHAT-001

目标：验证用户可以在新对话中发送一条消息，并看到 Agent 的完整响应。

前置条件：

```text
当前没有正在运行的 Agent run
模型返回文本 hello from agent
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

### AG-CHAT-002 模型失败后可继续发送

ID：AG-CHAT-002

目标：验证一次模型失败不会破坏当前对话，用户可以继续发送下一条消息。

前置条件：

```text
第一次模型请求返回错误 provider unavailable
第二次模型请求返回文本 recovered
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
界面显示可理解错误
界面不是白屏或无限 loading
second 可以正常发送
最终出现 assistant 消息 recovered
输入框在错误后和恢复后都可操作
```

## Suite AG-RUN: 运行控制

### AG-RUN-001 取消 slow stream

ID：AG-RUN-001

目标：验证用户取消正在响应的 Agent run 后，当前响应停止并且界面恢复可操作。

前置条件：

```text
模型返回 slow stream: token-1, token-2, token-3...
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

### AG-RUN-002 stream terminal chunk 只结束当前请求

ID：AG-RUN-002

目标：验证 finish / abort / error 只影响对应 request，不会影响其他正在运行或已存在的请求。

前置条件：

```text
存在 request A 和 request B
当前正在消费 request A
```

步骤：

```text
1. 发送 request B 的 text chunk
2. 发送 request A 的 text chunk
3. 发送 request A 的 finish / abort / error
```

期望结果：

```text
request B 的 chunk 被忽略
request A 的 text chunk 被消费
finish 会正常关闭当前 stream
abort 会关闭当前 stream 且不显示失败错误
error 会关闭当前 stream 并产生用户可见错误
后续请求不会收到当前请求遗留的事件
```

## Suite AG-THREAD: 对话隔离

### AG-THREAD-001 streaming 时切换对话不串线

ID：AG-THREAD-001

目标：验证一个对话 streaming 时切换到另一个对话，不会把消息或运行状态串到错误的对话。

前置条件：

```text
存在 thread A 和 thread B
thread A 的模型响应是 slow stream
thread B 有自己的历史消息
```

步骤：

```text
1. 打开 thread A
2. 发送消息 start A
3. 在 A streaming 时切换到 thread B
4. 等待 A 的 stream 继续产出 chunk
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

### AG-THREAD-002 对话历史持久化

ID：AG-THREAD-002

目标：验证 Agent 响应完成后，对话历史可以在切换或重启后恢复。

前置条件：

```text
模型返回文本 persisted answer
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

### AG-THREAD-003 删除或归档只影响目标对话

ID：AG-THREAD-003

目标：验证删除或归档一个对话时，不会影响其他对话。

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

## Suite AG-MSG: 消息变更

### AG-MSG-001 编辑用户消息会清理后续回复

ID：AG-MSG-001

目标：验证编辑历史用户消息后，不会保留与新问题不匹配的旧 assistant 回复。

前置条件：

```text
thread 中已有：
user: old question
assistant: old answer
模型对 edited question 返回 new answer
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

### AG-MSG-002 重新生成不会重复用户消息

ID：AG-MSG-002

目标：验证重新生成 assistant 回复时，不会重复创建对应的用户消息。

前置条件：

```text
thread 中已有：
user: question
assistant: first answer
模型对 regenerate 返回 second answer
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

## Suite AG-INPUT: 请求输入

### AG-INPUT-001 发送请求保留模型和 reasoning

ID：AG-INPUT-001

目标：验证用户选择的模型和 reasoning level 会进入本次 Agent 请求。

前置条件：

```text
用户选择 providerId=model-provider
用户选择 modelId=model-a
用户选择 reasoningLevel=medium
```

步骤：

```text
1. 发送一条用户消息
2. 观察本次 Agent 请求的输入
```

期望结果：

```text
请求 threadId 正确
请求 messages 是发送时的消息快照
请求 modelSelection.providerId 为 model-provider
请求 modelSelection.modelId 为 model-a
请求 reasoningLevel 为 medium
无效 reasoningLevel 不会进入请求
```

### AG-INPUT-002 选中 context 后只注入选中项

ID：AG-INPUT-002

目标：验证 Agent 请求只包含用户明确选中的 context，不包含未选中的隐藏内容。

前置条件：

```text
用户选中 thought T1 和 category C1
系统中还存在未选中的 thought T2
```

步骤：

```text
1. 构造带 contextRefs metadata 的用户消息
2. 发送消息
3. 观察本次 Agent 请求中的 context block
```

期望结果：

```text
context block 包含 T1 和 C1
context block 不包含 T2
超过数量上限时按规则截断
缺失或不可读的 ref 不会让整次发送失败
```

### AG-INPUT-003 不支持 native file part 时降级附件提示

ID：AG-INPUT-003

目标：验证不支持 native file part 的模型仍能收到可读的附件引用。

前置条件：

```text
消息中包含 file part
当前 provider 不支持 native file part
```

步骤：

```text
1. 发送包含附件的消息
2. 观察本次模型输入
```

期望结果：

```text
file part 被替换为文本附件提示
提示包含 filename、mediaType、attachmentId
不会返回 base64 或丢失附件引用
支持 native file part 的 provider 仍保留 native file part
```

## Suite AG-VIEW: 消息呈现

### AG-VIEW-001 保持 message parts 的用户可见顺序

ID：AG-VIEW-001

目标：验证 Agent Turn 中 reasoning、工具活动、文本和 proposal 的用户可见顺序稳定。

前置条件：

```text
assistant message parts 顺序为：
reasoning -> tool lookup -> text -> tool proposal -> text
```

步骤：

```text
1. 打开包含该 assistant message 的对话
2. 观察消息列表中的 Agent Turn
```

期望结果：

```text
reasoning 显示在第一个文本前
lookup 工具活动不跨过 text 被合并
proposal card 出现在原始位置
最后的 text 仍在 proposal 后面
```

### AG-VIEW-002 proposal 状态可区分

ID：AG-VIEW-002

目标：验证 proposal 的 pending、approved、rejected、output、error 状态在界面上可区分。

前置条件：

```text
存在 5 种 proposal 状态：
pending
approval responded approved
approval responded rejected
output available
error
```

步骤：

```text
1. 打开包含这些 proposal 状态的对话
2. 观察每个 proposal 的显示状态
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

## Suite AG-TOOL: 工具提案

### AG-TOOL-001 用户确认 proposal 后执行并继续

ID：AG-TOOL-001

目标：验证用户确认 proposal 后，工具会执行，结果会显示，Agent 可以继续输出。

前置条件：

```text
模型先产出 proposal tool call
用户确认后工具返回 success output
模型继续返回 final answer
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

### AG-TOOL-002 用户拒绝 proposal 后不执行写入

ID：AG-TOOL-002

目标：验证用户拒绝 proposal 后，对应写入动作不会发生，拒绝状态会保留。

前置条件：

```text
模型先产出 proposal tool call
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
