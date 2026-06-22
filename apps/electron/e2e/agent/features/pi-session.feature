# language: zh-CN
@agent @v1.1.0 @pi_runtime
功能: 用户使用 Pi-backed Agent 对话
  用户需要能在 Pi Agent runtime 下完成纯文本对话，并从 Pi JSONL session 恢复历史。

  @P0 @happy_path @AG-PI-START-001
  场景: 用户在 Pi-backed session 中发送第一条消息
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户输入 hello
    而且用户发送消息
    那么页面应该显示用户消息 hello
    而且页面应该显示 Agent 正在回复
    而且最终应该出现一条 Agent 回复正文
    而且输入框应该恢复可操作
    而且对话列表应该出现这条新对话

  @P0 @recovery @AG-PI-HISTORY-001
  场景: 用户重启后恢复 Pi-backed session 历史
    假如用户已经用 Pi Agent runtime 完成一轮对话
    当用户关闭并重新打开 Reflecta 应用
    而且用户重新进入 Agent 页面
    而且用户打开原对话
    那么原对话应该仍显示用户消息
    而且原对话应该仍显示一条 Agent 回复正文
    而且输入框应该可操作

  @P0 @failure @AG-PI-FAILURE-001
  场景: 回复失败后用户可以继续发送消息
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且当前 AI key 无效
    当用户发送消息 first
    那么页面应该显示回复失败
    而且输入框应该恢复可操作
    当用户改回有效 AI key
    而且用户发送消息 second
    那么最终应该出现一条 Agent 回复正文
    而且页面应该仍显示用户消息 first
    而且页面应该显示用户消息 second
    而且输入框应该可操作

  @P0 @control @AG-PI-RUN-001
  场景: 用户停止 Pi-backed session 中正在生成的回复
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户发送一个长回复请求
    而且用户点击停止
    那么页面应该显示已停止
    而且停止按钮应该消失
    而且输入框应该可操作

  @P0 @control @AG-PI-RUN-002
  场景: 用户停止回复后切换回来仍看到停止状态
    假如用户已经用 Pi Agent runtime 停止了一条正在生成的回复
    当用户创建另一个新对话
    而且用户切回原对话
    那么页面应该仍显示已停止
    而且输入框应该可操作

  @P0 @context @AG-PI-CONTEXT-001
  场景: 用户在 Pi-backed session 中选择引用后发送消息
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户选择 Thought 引用 React Server Components
    而且用户选择 Category 引用 React
    而且用户发送消息 请比较这两个引用
    那么页面应该显示用户选择的两个引用
    而且最终应该出现一条 Agent 回复正文
    而且输入框应该可操作

  @P0 @attachment @AG-PI-ATTACHMENT-001
  场景: 用户在 Pi-backed session 中发送附件后重启仍能看到附件
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户上传一个附件
    而且用户发送消息 请总结这个附件
    那么页面应该显示这个附件
    而且最终应该出现一条 Agent 回复正文
    当用户关闭并重新打开 Reflecta 应用
    而且用户打开原对话
    那么原对话应该仍显示这个附件
    而且输入框应该可操作

  @P0 @model @AG-PI-MODEL-001
  场景: 用户在 Pi-backed session 中选择模型和推理强度后发送消息
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户选择一个模型
    而且用户选择中推理
    而且用户发送消息 请用一句话回复 model selection e2e
    那么模型菜单应该显示所选模型
    而且模型菜单应该显示中推理
    而且最终应该出现一条 Agent 回复正文

  @P0 @result @AG-PI-TOOL-READ-001
  场景: 用户在 Pi-backed session 中使用只读知识库工具
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 seed 数据中存在 Thought「React Server Components」
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户要求 Agent 使用知识库搜索工具查找 React Server Components
    那么页面应该显示工具活动
    而且最终应该出现一条 Agent 回复正文
    当用户展开工具活动
    那么页面应该显示工具标题
    而且输入框应该可操作

  @P0 @proposal @AG-PI-PROPOSAL-REJECT-001
  场景: 用户拒绝 Pi-backed session 中的候选 Thought
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户要求 Agent 提出一个候选 Thought
    那么页面应该显示待确认的候选 Thought 卡片
    当用户点击拒绝
    那么该候选 Thought 卡片应该显示已拒绝
    而且界面应该显示未写入知识库
    而且知识库中不应该出现该候选 Thought

  @P0 @proposal @AG-PI-PROPOSAL-APPROVE-001
  场景: 用户确认 Pi-backed session 中的候选 Thought
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户要求 Agent 提出一个候选 Thought
    那么页面应该显示待确认的候选 Thought 卡片
    当用户点击确认
    那么该候选 Thought 卡片应该显示已确认
    而且界面应该显示已写入结果
    而且知识库中应该出现该候选 Thought

  @P0 @proposal @AG-PI-PROPOSAL-CATEGORY-001
  场景: 用户确认 Pi-backed session 中的候选 Category
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户要求 Agent 提出一个候选 Category
    那么页面应该显示待确认的候选 Category 卡片
    当用户点击确认
    那么该候选 Category 卡片应该显示已确认
    而且界面应该显示已写入结果
    而且知识库中应该出现该候选 Category

  @P0 @proposal @recovery @AG-PI-PROPOSAL-RELOAD-001
  场景: 用户重启后仍能处理等待确认的候选 Thought
    假如用户已经用 Pi Agent runtime 进入 Agent 页面
    而且 Agent 已经提出一个待确认的候选 Thought
    当用户关闭并重新打开 Reflecta 应用
    而且用户重新进入 Agent 页面
    而且用户打开原对话
    那么页面应该仍显示待确认的候选 Thought 卡片
    当用户点击拒绝
    那么该候选 Thought 卡片应该显示已拒绝
    而且知识库中不应该出现该候选 Thought
