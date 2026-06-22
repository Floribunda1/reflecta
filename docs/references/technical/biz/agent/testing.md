# Agent Test Cases

这份文档只定义 Agent 模块的 test case。其他流程另行派生，test case 本身保持独立。期望结果只描述用户应该得到的产品状态。

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

目标：验证用户可以在新对话中发送一条消息，并看到 Agent 的完整回复。

前置条件：

```text
用户已打开 Agent 页面
Agent 当前可以正常回复
```

步骤：

```text
1. 创建新对话
2. 在输入框输入 hello
3. 点击发送
```

期望结果：

```text
页面出现用户消息 hello
页面显示 Agent 正在回复
最终出现 Agent 回复 hello from agent
输入框恢复可操作
对话列表出现这条新对话
```

### AG-CHAT-002 回复失败后进入可恢复状态

ID：AG-CHAT-002

目标：验证一次 Agent 回复失败时，用户会看到可恢复状态，并可以继续发送下一条消息。

前置条件：

```text
用户已打开一个新对话
Agent 第一次回复会失败
Agent 第二次回复可以成功
```

步骤：

```text
1. 发送 first
2. 等待失败状态出现
3. 在同一对话继续发送 second
```

期望结果：

```text
first 保留为用户消息
界面显示回复失败提示，提示内容包含“回复失败”
输入框保持可操作
second 可以正常发送
最终出现 Agent 回复 recovered
对话进入正常可继续使用状态
```

## Suite AG-RUN: 回复控制

### AG-RUN-001 停止正在生成的回复

ID：AG-RUN-001

目标：验证用户停止正在生成的 Agent 回复后，回复停止增长，并且界面恢复可操作。

前置条件：

```text
用户已打开一个对话
Agent 会先显示 partial answer，再继续生成后续内容
```

步骤：

```text
1. 发送一条消息
2. 等待 Agent 回复中出现 partial answer
3. 点击停止
4. 等待界面回到可操作状态
```

期望结果：

```text
当前回复显示 partial answer
界面显示回复已停止状态
输入框恢复可用
当前对话进入可继续输入状态
切换到另一个对话再切回后仍显示 partial answer
```

### AG-RUN-002 停止对话 A 后对话 B 保持原内容

ID：AG-RUN-002

目标：验证用户停止对话 A 的回复后，对话 A 显示已停止状态，对话 B 显示原有内容。

前置条件：

```text
存在对话 A 和对话 B
对话 A 正在生成回复
对话 B 已有用户消息 B question 和 Agent 回复 B answer
```

步骤：

```text
1. 打开对话 A
2. 在 A 正在回复时切换到对话 B
3. 回到对话 A
4. 点击停止
5. 再次打开对话 B
```

期望结果：

```text
对话 A 显示已停止的回复状态
对话 B 显示用户消息 B question 和 Agent 回复 B answer
对话 A 的输入框可输入
对话 B 的输入框可输入
```

## Suite AG-THREAD: 对话隔离

### AG-THREAD-001 生成回复时切换对话保持各自内容

ID：AG-THREAD-001

目标：验证一个对话正在生成回复时切换到另一个对话，对话 A 显示 A 的消息，对话 B 显示 B 的消息。

前置条件：

```text
存在对话 A 和对话 B
对话 A 会先显示 A partial answer，再完成为 A final answer
对话 B 已有用户消息 B question 和 Agent 回复 B answer
```

步骤：

```text
1. 打开对话 A
2. 发送 start A
3. 在 A 正在回复时切换到对话 B
4. 等待对话 A 的回复完成
5. 切回对话 A
```

期望结果：

```text
对话 B 显示用户消息 B question 和 Agent 回复 B answer
对话 B 的输入框可输入
对话 A 显示用户消息 start A
切回 A 后看到 Agent 回复 A final answer
```

### AG-THREAD-002 对话历史持久化

ID：AG-THREAD-002

目标：验证 Agent 回复完成后，对话历史可以在切换并重启后恢复。

前置条件：

```text
用户已打开 Agent 页面
Agent 可以正常回复
```

步骤：

```text
1. 新建对话
2. 发送 remember this
3. 等待 Agent 完成回复 persisted answer
4. 切换到另一个对话
5. 切回原对话
6. 重启应用
7. 重新打开原对话
```

期望结果：

```text
原对话仍显示用户消息 remember this
原对话仍显示 Agent 回复 persisted answer
对话列表中原对话的预览包含 remember this
消息顺序保持用户消息在前、Agent 回复在后
```

### AG-THREAD-003 删除对话后对话列表显示剩余对话

ID：AG-THREAD-003

目标：验证删除一个对话后，对话列表显示剩余对话，剩余对话内容可打开查看。

前置条件：

```text
存在对话 A 和对话 B
对话 A 有用户消息 A question 和 Agent 回复 A answer
对话 B 有用户消息 B question 和 Agent 回复 B answer
```

步骤：

```text
1. 对对话 A 执行删除
2. 查看对话列表
3. 打开对话 B
4. 重启应用后再次查看列表
```

期望结果：

```text
对话列表显示对话 B
对话 B 显示用户消息 B question 和 Agent 回复 B answer
重新打开后对话列表状态保持一致
```

## Suite AG-MSG: 消息变更

### AG-MSG-001 编辑用户消息后显示新的有效回复

ID：AG-MSG-001

目标：验证编辑历史用户消息后，当前对话显示与新问题匹配的 Agent 回复。

前置条件：

```text
对话中已有：
用户消息 old question
Agent 回复 old answer
Agent 可以对 edited question 回复 new answer
```

步骤：

```text
1. 点击 old question 的编辑入口
2. 将内容改为 edited question
3. 提交编辑
4. 等待 Agent 完成新回复
```

期望结果：

```text
用户消息变成 edited question
当前有效 Agent 回复为 new answer
消息顺序仍然是用户消息在前、Agent 回复在后
切换到另一个对话再切回后，仍显示 edited question 和 new answer
```

### AG-MSG-002 重新生成后显示新的当前回复

ID：AG-MSG-002

目标：验证重新生成 Agent 回复后，当前对话显示一条用户消息和新的当前回复。

前置条件：

```text
对话中已有：
用户消息 question
Agent 回复 first answer
Agent 可以重新回复 second answer
```

步骤：

```text
1. 对 first answer 执行重新生成
2. 等待 Agent 完成新回复
```

期望结果：

```text
对话中保留一条用户消息 question
second answer 成为当前 Agent 回复
消息顺序保持用户消息在前、Agent 回复在后
```

## Suite AG-INPUT: 输入与上下文

### AG-INPUT-001 选择模型和推理强度后发送

ID：AG-INPUT-001

目标：验证用户在发送前选择模型和推理强度后，界面清楚呈现这次回复使用的设置。

前置条件：

```text
用户已打开 Agent 页面
页面允许选择模型和推理强度
```

步骤：

```text
1. 选择模型 model-a
2. 选择推理强度 medium
3. 发送一条用户消息
4. 等待 Agent 回复完成
```

期望结果：

```text
发送前界面显示已选择 model-a
发送前界面显示已选择 medium
发送过程中界面仍显示 model-a 和 medium
Agent 回复完成后，界面仍显示 model-a 和 medium
Agent 回复正文显示完成
```

### AG-INPUT-002 选中资料后发送

ID：AG-INPUT-002

目标：验证用户选中的资料会随本次消息一起进入对话语境，并在用户消息中清楚呈现。

前置条件：

```text
存在资料 T1《旅行计划》、资料 C1《预算约束》、资料 T2《健身计划》
用户只选中 T1《旅行计划》和 C1《预算约束》
T1《旅行计划》和 C1《预算约束》都可被使用
```

步骤：

```text
1. 在输入框中选择 T1《旅行计划》和 C1《预算约束》
2. 发送消息
3. 查看用户消息和 Agent 回复
```

期望结果：

```text
用户消息中能看到已选择 T1《旅行计划》和 C1《预算约束》
用户消息中的资料引用与发送前选择一致
Agent 回复同时提到旅行计划和预算约束
```

### AG-INPUT-003 发送可用附件后得到附件总结

ID：AG-INPUT-003

目标：验证用户发送可用附件后，Agent 回复会围绕该附件内容作答。

前置条件：

```text
用户已打开一个对话
用户准备了附件 trip-notes.txt
trip-notes.txt 可被 Agent 使用
```

步骤：

```text
1. 在输入框添加附件 trip-notes.txt
2. 输入请总结这个附件
3. 点击发送
4. 等待 Agent 回复
```

期望结果：

```text
用户消息中显示附件 trip-notes.txt
Agent 回复包含对 trip-notes.txt 的总结
附件在用户消息中以可识别名称和状态显示
```

## Suite AG-VIEW: 消息呈现

### AG-VIEW-001 复杂回复按发生顺序显示

ID：AG-VIEW-001

目标：验证 Agent 回复中包含思考摘要、查找进度、提案和最终文字时，用户看到的顺序符合实际发生顺序。

前置条件：

```text
对话中有一条复杂 Agent 回复
该回复包含：
思考摘要“正在理解你的问题”
查找进度“找到 3 条相关资料”
提案卡片“创建想法《读书笔记》”
最终文字“我建议先整理这 3 条资料”
```

步骤：

```text
1. 打开该对话
2. 观察消息列表中的 Agent 回复
```

期望结果：

```text
在同一条 Agent 回复中，从上到下依次显示：
1. 思考摘要“正在理解你的问题”
2. 查找进度“找到 3 条相关资料”
3. 提案卡片“创建想法《读书笔记》”
4. 最终文字“我建议先整理这 3 条资料”
```

### AG-VIEW-002 提案状态可区分

ID：AG-VIEW-002

目标：验证提案的待确认、已确认、已拒绝、已完成、失败状态在界面上可区分。

前置条件：

```text
存在一个对话，里面依次包含 5 张提案卡片：
待确认提案“创建想法《A》”
已确认提案“创建想法《B》”
已拒绝提案“创建想法《C》”
已完成提案“创建想法《D》”
失败提案“创建想法《E》”
```

步骤：

```text
1. 打开该对话
2. 观察每个提案卡片
```

期望结果：

```text
“创建想法《A》”显示待确认状态
“创建想法《B》”显示已确认状态
“创建想法《C》”显示已拒绝状态
“创建想法《D》”显示已完成结果
“创建想法《E》”显示失败原因
```

## Suite AG-TOOL: 提案操作

### AG-TOOL-001 用户确认提案后执行并继续

ID：AG-TOOL-001

目标：验证用户确认提案后，对应操作会执行，结果会显示，Agent 可以继续回复。

前置条件：

```text
Agent 会提出“创建想法《读书笔记》”提案
Agent 确认后会回复“已创建读书笔记”
用户有权限确认该操作
```

步骤：

```text
1. 发送会触发提案的消息
2. 等待“创建想法《读书笔记》”提案卡片出现
3. 点击确认
4. 等待操作结果和 Agent 后续回复
```

期望结果：

```text
“创建想法《读书笔记》”提案卡片可见
点击确认后，该提案状态变为已确认
界面显示“创建想法《读书笔记》”的操作结果
最终 Agent 回复包含“已创建读书笔记”
重新打开对话后仍能看到提案和确认状态
```

### AG-TOOL-002 用户拒绝提案后保留拒绝结果

ID：AG-TOOL-002

目标：验证用户拒绝提案后，界面保留拒绝结果，并展示后续 Agent 说明。

前置条件：

```text
Agent 会提出“创建想法《读书笔记》”提案
用户有权限拒绝该操作
```

步骤：

```text
1. 发送会触发提案的消息
2. 等待“创建想法《读书笔记》”提案卡片出现
3. 点击拒绝
```

期望结果：

```text
“创建想法《读书笔记》”提案状态变为已拒绝
界面显示该提案的拒绝结果
Agent 后续说明包含“已拒绝”
重新打开对话后仍能看到拒绝状态
```
