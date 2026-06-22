# Agent Test Cases

这份文档只定义 Agent 模块的 test case。其他流程另行派生，test case 本身保持独立。期望结果只描述用户应该得到的产品状态。涉及 Agent 回复时，只校验用户可见状态，不指定模型生成的具体文本。

具体数据名称只有在来自 seed 数据时才直接写出；其他测试数据使用大写代指，执行前从 seed 或 fixture 绑定。

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
最终出现一条 Agent 回复正文
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
Agent 第二次回复可以完成
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
最终出现一条新的 Agent 回复正文
对话进入正常可继续使用状态
```

## Suite AG-RUN: 回复控制

### AG-RUN-001 停止正在生成的回复

ID：AG-RUN-001

目标：验证用户停止正在生成的 Agent 回复后，当前对话显示已停止状态，并且界面恢复可操作。

前置条件：

```text
用户已打开一个对话
发送消息后 Agent 会进入正在回复状态
```

步骤：

```text
1. 发送一条消息
2. 等待停止按钮可点击
3. 点击停止
4. 等待界面回到可操作状态
```

期望结果：

```text
界面显示回复已停止状态
当前 Agent 回复不再显示正在回复状态
输入框恢复可用
当前对话进入可继续输入状态
切换到另一个对话再切回后仍显示已停止状态
```

### AG-RUN-002 停止对话 A 后对话 B 保持原内容

ID：AG-RUN-002

目标：验证用户停止对话 A 的回复后，对话 A 显示已停止状态，对话 B 显示原有内容。

前置条件：

```text
存在对话 A 和对话 B
对话 A 正在生成回复
对话 B 已有用户消息 B_USER_MESSAGE 和一条 Agent 回复
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
对话 B 显示用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
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
Agent 当前可以完成回复
对话 B 已有用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
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
对话 B 显示用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
对话 B 的输入框可输入
对话 A 显示用户消息“start A”
切回 A 后看到一条已完成的 Agent 回复
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
3. 等待 Agent 完成回复
4. 切换到另一个对话
5. 切回原对话
6. 重启应用
7. 重新打开原对话
```

期望结果：

```text
原对话仍显示用户消息 remember this
原对话仍显示一条 Agent 回复正文
对话列表中原对话的预览包含 remember this
消息顺序保持用户消息在前、Agent 回复在后
```

### AG-THREAD-003 删除对话后对话列表显示剩余对话

ID：AG-THREAD-003

目标：验证删除一个对话后，对话列表显示剩余对话，剩余对话内容可打开查看。

前置条件：

```text
存在对话 A 和对话 B
对话 A 有用户消息 A_USER_MESSAGE 和一条 Agent 回复
对话 B 有用户消息 B_USER_MESSAGE 和一条 Agent 回复
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
对话 B 显示用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
重新打开后对话列表状态保持一致
```

## Suite AG-MSG: 消息变更

### AG-MSG-001 编辑用户消息后完成当前回复

ID：AG-MSG-001

目标：验证编辑历史用户消息后，当前对话显示编辑后的用户消息和完成状态的 Agent 回复。

前置条件：

```text
对话中已有：
用户消息 ORIGINAL_USER_MESSAGE
一条 Agent 回复
Agent 可以完成回复
```

步骤：

```text
1. 点击 ORIGINAL_USER_MESSAGE 的编辑入口
2. 将内容改为 EDITED_USER_MESSAGE
3. 提交编辑
4. 等待 Agent 完成回复
```

期望结果：

```text
用户消息变成 EDITED_USER_MESSAGE
当前对话显示一条完成状态的 Agent 回复
消息顺序仍然是用户消息在前、Agent 回复在后
切换到另一个对话再切回后，仍显示 EDITED_USER_MESSAGE 和完成状态的 Agent 回复
```

### AG-MSG-002 重新生成后显示新的当前回复

ID：AG-MSG-002

目标：验证重新生成 Agent 回复后，当前对话显示一条用户消息和新的当前回复。

前置条件：

```text
对话中已有：
用户消息 REGENERATE_USER_MESSAGE
一条 Agent 回复
Agent 可以完成回复
```

步骤：

```text
1. 对当前 Agent 回复执行重新生成
2. 等待 Agent 完成回复
```

期望结果：

```text
对话中保留一条用户消息 REGENERATE_USER_MESSAGE
当前对话显示一条完成状态的 Agent 回复
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
1. 打开模型菜单
2. 记录模型列表第一项的模型显示名称为 M
3. 点击模型列表第一项
4. 选择推理等级“中推理”
5. 发送一条用户消息
6. 等待 Agent 回复完成
```

期望结果：

```text
发送前界面显示已选择 M
发送前界面显示已选择“中推理”
发送过程中界面仍显示 M 和“中推理”
Agent 回复完成后，界面仍显示 M 和“中推理”
页面出现一条 Agent 回复正文
```

### AG-INPUT-002 选中引用后发送

ID：AG-INPUT-002

目标：验证用户选中的引用会随本次消息一起进入对话，并在用户消息中清楚呈现。

前置条件：

```text
seed 数据中存在 Thought「React Server Components」
seed 数据中存在 Category「React」
```

步骤：

```text
1. 在输入框中选择 Thought「React Server Components」和 Category「React」
2. 发送消息
3. 查看用户消息和 Agent 回复
```

期望结果：

```text
用户消息中显示 Thought「React Server Components」
用户消息中显示 Category「React」
Agent 回复完成后，当前对话进入可继续输入状态
```

### AG-INPUT-003 发送附件后显示附件并完成回复

ID：AG-INPUT-003

目标：验证用户发送附件后，用户消息中显示该附件，并且 Agent 完成一次回复。

前置条件：

```text
用户已打开一个对话
测试环境有可上传文件 ATTACHMENT_FILE
附件上传后会显示在用户消息中
```

步骤：

```text
1. 在输入框添加附件 ATTACHMENT_FILE
2. 输入请总结这个附件
3. 点击发送
4. 等待 Agent 回复
```

期望结果：

```text
用户消息中显示附件 ATTACHMENT_FILE
页面出现一条 Agent 回复正文
附件在用户消息中以 ATTACHMENT_FILE 的文件名显示
```

## Suite AG-VIEW: 消息呈现

### AG-VIEW-001 复杂回复按发生顺序显示

ID：AG-VIEW-001

目标：验证一条已经存在的复杂 Agent 回复中，思考摘要、查找进度、提案和最终回复正文按指定顺序显示。

前置条件：

```text
对话中有一条复杂 Agent 回复
该回复包含：
思考摘要
查找进度
提案卡片
最终回复正文
```

步骤：

```text
1. 打开该对话
2. 观察消息列表中的 Agent 回复
```

期望结果：

```text
在同一条 Agent 回复中，从上到下依次显示：
1. 思考摘要
2. 查找进度
3. 提案卡片
4. 最终回复正文
```

### AG-VIEW-002 提案状态可区分

ID：AG-VIEW-002

目标：验证提案的待确认、已确认、已拒绝、已完成、失败状态在界面上可区分。

前置条件：

```text
存在一个对话，里面依次包含 5 张提案卡片：
候选 Thought，候选标题 CANDIDATE_TITLE_PENDING，状态为待确认
候选 Thought，候选标题 CANDIDATE_TITLE_APPROVED，状态为已确认
候选 Thought，候选标题 CANDIDATE_TITLE_REJECTED，状态为已拒绝
候选 Thought，候选标题 CANDIDATE_TITLE_DONE，状态为完成
候选 Thought，候选标题 CANDIDATE_TITLE_ERROR，状态为出错
```

步骤：

```text
1. 打开该对话
2. 观察每个提案卡片
```

期望结果：

```text
CANDIDATE_TITLE_PENDING 所在卡片显示“待确认”
CANDIDATE_TITLE_APPROVED 所在卡片显示“已确认”
CANDIDATE_TITLE_REJECTED 所在卡片显示“已拒绝”
CANDIDATE_TITLE_DONE 所在卡片显示“完成”
CANDIDATE_TITLE_ERROR 所在卡片显示“出错”并显示错误信息
```

## Suite AG-TOOL: 提案操作

### AG-TOOL-001 用户确认候选 Thought 后执行并保留结果

ID：AG-TOOL-001

目标：验证用户确认提案后，对应操作会执行，结果会显示并保留。

前置条件：

```text
对话中已经出现待确认“候选 Thought”提案卡片
该卡片的候选标题为 CANDIDATE_TITLE
用户有权限确认该操作
```

步骤：

```text
1. 点击该提案卡片上的确认
2. 等待操作结果显示
```

期望结果：

```text
“候选 Thought”提案卡片可见
卡片中显示候选标题 CANDIDATE_TITLE
点击确认后，该提案状态显示为已确认
界面显示该提案的操作结果
重新打开对话后仍能看到提案和确认状态
```

### AG-TOOL-002 用户拒绝候选 Thought 后保留拒绝结果

ID：AG-TOOL-002

目标：验证用户拒绝提案后，界面保留拒绝结果。

前置条件：

```text
对话中已经出现待确认“候选 Thought”提案卡片
该卡片的候选标题为 CANDIDATE_TITLE
用户有权限拒绝该操作
```

步骤：

```text
1. 点击该提案卡片上的拒绝
```

期望结果：

```text
“候选 Thought”提案卡片可见
卡片中显示候选标题 CANDIDATE_TITLE
点击拒绝后，该提案状态显示为已拒绝
界面显示该提案的拒绝结果
重新打开对话后仍能看到拒绝状态
```
