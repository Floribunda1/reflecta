# language: zh-CN
@agent @v1.1.0
功能: Agent 模块
  这份 feature 是 Agent Test Case 的唯一维护载体。
  每个 Scenario 对应一个 Agent test case。
  场景只描述用户路径和产品状态，不表达 unit、integration、E2E 分层。

  @AG-CHAT @AG-CHAT-001
  场景: 新对话发送成功
    假如用户已打开 Agent 页面
    而且 Agent 当前可以正常回复
    当用户创建新对话
    而且用户在输入框输入 hello
    而且用户点击发送
    那么页面出现用户消息 hello
    而且页面显示 Agent 正在回复
    而且最终出现一条 Agent 回复正文
    而且输入框恢复可操作
    而且对话列表出现这条新对话

  @AG-CHAT @AG-CHAT-002
  场景: 回复失败后进入可恢复状态
    假如用户已打开一个新对话
    而且 Agent 第一次回复会失败
    而且 Agent 第二次回复可以完成
    当用户发送 first
    而且用户等待失败状态出现
    而且用户在同一对话继续发送 second
    那么 first 保留为用户消息
    而且界面显示回复失败提示，提示内容包含“回复失败”
    而且输入框保持可操作
    而且 second 可以正常发送
    而且最终出现一条新的 Agent 回复正文
    而且对话进入正常可继续使用状态

  @AG-RUN @AG-RUN-001
  场景: 停止正在生成的回复
    假如用户已打开一个对话
    而且发送消息后 Agent 会进入正在回复状态
    当用户发送一条消息
    而且用户等待停止按钮可点击
    而且用户点击停止
    而且用户等待界面回到可操作状态
    那么界面显示回复已停止状态
    而且当前 Agent 回复不再显示正在回复状态
    而且输入框恢复可用
    而且当前对话进入可继续输入状态
    而且切换到另一个对话再切回后仍显示已停止状态

  @AG-RUN @AG-RUN-002
  场景: 停止对话 A 后对话 B 保持原内容
    假如存在对话 A 和对话 B
    而且对话 A 正在生成回复
    而且对话 B 已有用户消息 B_USER_MESSAGE 和一条 Agent 回复
    当用户打开对话 A
    而且用户在 A 正在回复时切换到对话 B
    而且用户回到对话 A
    而且用户点击停止
    而且用户再次打开对话 B
    那么对话 A 显示已停止的回复状态
    而且对话 B 显示用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
    而且对话 A 的输入框可输入
    而且对话 B 的输入框可输入

  @AG-THREAD @AG-THREAD-001
  场景: 生成回复时切换对话保持各自内容
    假如存在对话 A 和对话 B
    而且 Agent 当前可以完成回复
    而且对话 B 已有用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
    当用户打开对话 A
    而且用户发送 start A
    而且用户在 A 正在回复时切换到对话 B
    而且用户等待对话 A 的回复完成
    而且用户切回对话 A
    那么对话 B 显示用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
    而且对话 B 的输入框可输入
    而且对话 A 显示用户消息“start A”
    而且切回 A 后看到一条已完成的 Agent 回复

  @AG-THREAD @AG-THREAD-002
  场景: 对话历史持久化
    假如用户已打开 Agent 页面
    而且 Agent 可以正常回复
    当用户新建对话
    而且用户发送 remember this
    而且用户等待 Agent 完成回复
    而且用户切换到另一个对话
    而且用户切回原对话
    而且用户重启应用
    而且用户重新打开原对话
    那么原对话仍显示用户消息 remember this
    而且原对话仍显示一条 Agent 回复正文
    而且对话列表中原对话的预览包含 remember this
    而且消息顺序保持用户消息在前、Agent 回复在后

  @AG-THREAD @AG-THREAD-003
  场景: 删除对话后对话列表显示剩余对话
    假如存在对话 A 和对话 B
    而且对话 A 有用户消息 A_USER_MESSAGE 和一条 Agent 回复
    而且对话 B 有用户消息 B_USER_MESSAGE 和一条 Agent 回复
    当用户对对话 A 执行删除
    而且用户查看对话列表
    而且用户打开对话 B
    而且用户重启应用后再次查看列表
    那么对话列表显示对话 B
    而且对话 B 显示用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
    而且重新打开后对话列表状态保持一致

  @AG-MSG @AG-MSG-001
  场景: 编辑用户消息后完成当前回复
    假如对话中已有用户消息 ORIGINAL_USER_MESSAGE
    而且对话中已有一条 Agent 回复
    而且 Agent 可以完成回复
    当用户点击 ORIGINAL_USER_MESSAGE 的编辑入口
    而且用户将内容改为 EDITED_USER_MESSAGE
    而且用户提交编辑
    而且用户等待 Agent 完成回复
    那么用户消息变成 EDITED_USER_MESSAGE
    而且当前对话显示一条完成状态的 Agent 回复
    而且消息顺序仍然是用户消息在前、Agent 回复在后
    而且切换到另一个对话再切回后，仍显示 EDITED_USER_MESSAGE 和完成状态的 Agent 回复

  @AG-MSG @AG-MSG-002
  场景: 重新生成后显示新的当前回复
    假如对话中已有用户消息 REGENERATE_USER_MESSAGE
    而且对话中已有一条 Agent 回复
    而且 Agent 可以完成回复
    当用户对当前 Agent 回复执行重新生成
    而且用户等待 Agent 完成回复
    那么对话中保留一条用户消息 REGENERATE_USER_MESSAGE
    而且当前对话显示一条完成状态的 Agent 回复
    而且消息顺序保持用户消息在前、Agent 回复在后

  @AG-INPUT @AG-INPUT-001
  场景: 选择模型和推理强度后发送
    假如用户已打开 Agent 页面
    而且页面允许选择模型和推理强度
    当用户打开模型菜单
    而且用户记录模型列表第一项的模型显示名称为 M
    而且用户点击模型列表第一项
    而且用户选择推理等级“中推理”
    而且用户发送一条用户消息
    而且用户等待 Agent 回复完成
    那么发送前界面显示已选择 M
    而且发送前界面显示已选择“中推理”
    而且发送过程中界面仍显示 M 和“中推理”
    而且 Agent 回复完成后，界面仍显示 M 和“中推理”
    而且页面出现一条 Agent 回复正文

  @AG-INPUT @AG-INPUT-002
  场景: 选中引用后发送
    假如 seed 数据中存在 Thought「React Server Components」
    而且 seed 数据中存在 Category「React」
    当用户在输入框中选择 Thought「React Server Components」和 Category「React」
    而且用户发送消息
    而且用户查看用户消息和 Agent 回复
    那么用户消息中显示 Thought「React Server Components」
    而且用户消息中显示 Category「React」
    而且 Agent 回复完成后，当前对话进入可继续输入状态

  @AG-INPUT @AG-INPUT-003
  场景: 发送附件后显示附件并完成回复
    假如用户已打开一个对话
    而且测试环境有可上传文件 ATTACHMENT_FILE
    而且附件上传后会显示在用户消息中
    当用户在输入框添加附件 ATTACHMENT_FILE
    而且用户输入请总结这个附件
    而且用户点击发送
    而且用户等待 Agent 回复
    那么用户消息中显示附件 ATTACHMENT_FILE
    而且页面出现一条 Agent 回复正文
    而且附件在用户消息中以 ATTACHMENT_FILE 的文件名显示

  @AG-VIEW @AG-VIEW-001
  场景: 复杂回复按发生顺序显示
    假如对话中有一条复杂 Agent 回复
    而且该回复包含思考摘要
    而且该回复包含查找进度
    而且该回复包含提案卡片
    而且该回复包含最终回复正文
    当用户打开该对话
    而且用户观察消息列表中的 Agent 回复
    那么在同一条 Agent 回复中，从上到下依次显示思考摘要
    而且思考摘要之后显示查找进度
    而且查找进度之后显示提案卡片
    而且提案卡片之后显示最终回复正文

  @AG-VIEW @AG-VIEW-002
  场景: 提案状态可区分
    假如存在一个对话，里面依次包含 5 张提案卡片
    而且候选 Thought，候选标题 CANDIDATE_TITLE_PENDING，状态为待确认
    而且候选 Thought，候选标题 CANDIDATE_TITLE_APPROVED，状态为已确认
    而且候选 Thought，候选标题 CANDIDATE_TITLE_REJECTED，状态为已拒绝
    而且候选 Thought，候选标题 CANDIDATE_TITLE_DONE，状态为完成
    而且候选 Thought，候选标题 CANDIDATE_TITLE_ERROR，状态为出错
    当用户打开该对话
    而且用户观察每个提案卡片
    那么 CANDIDATE_TITLE_PENDING 所在卡片显示“待确认”
    而且 CANDIDATE_TITLE_APPROVED 所在卡片显示“已确认”
    而且 CANDIDATE_TITLE_REJECTED 所在卡片显示“已拒绝”
    而且 CANDIDATE_TITLE_DONE 所在卡片显示“完成”
    而且 CANDIDATE_TITLE_ERROR 所在卡片显示“出错”并显示错误信息

  @AG-TOOL @AG-TOOL-001
  场景: 用户确认候选 Thought 后执行并保留结果
    假如对话中已经出现待确认“候选 Thought”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    而且用户有权限确认该操作
    当用户点击该提案卡片上的确认
    而且用户等待操作结果显示
    那么“候选 Thought”提案卡片可见
    而且卡片中显示候选标题 CANDIDATE_TITLE
    而且点击确认后，该提案状态显示为已确认
    而且界面显示该提案的操作结果
    而且重新打开对话后仍能看到提案和确认状态

  @AG-TOOL @AG-TOOL-002
  场景: 用户拒绝候选 Thought 后保留拒绝结果
    假如对话中已经出现待确认“候选 Thought”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    而且用户有权限拒绝该操作
    当用户点击该提案卡片上的拒绝
    那么“候选 Thought”提案卡片可见
    而且卡片中显示候选标题 CANDIDATE_TITLE
    而且点击拒绝后，该提案状态显示为已拒绝
    而且界面显示该提案的拒绝结果
    而且重新打开对话后仍能看到拒绝状态
