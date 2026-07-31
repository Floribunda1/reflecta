# language: zh-CN
@agent @v1.1.0
功能: 用户组织发送给 Agent 的请求
  用户需要编辑草稿，选择引用、附件、模型和推理强度，并在发送后看到这些上下文被清楚呈现。

  @P0 @context @AG-CONTEXT-001
  场景: 用户选中引用后发送消息
    假如 seed 数据中存在 Understanding「React Server Components」
    而且 seed 数据中存在 Domain「React」
    当用户在输入框中选择 Understanding「React Server Components」和 Domain「React」
    而且用户发送消息
    那么用户消息中应该显示 Understanding「React Server Components」
    而且用户消息中应该显示 Domain「React」
    而且 Agent 回复完成后，当前对话应该进入可继续输入状态

  @P1 @context @AG-CONTEXT-003
  场景: 用户选择模型和推理强度后发送消息
    假如用户已经打开 Agent 页面
    而且页面允许选择模型和推理强度
    当用户打开模型菜单
    而且用户选择模型列表第一项，显示名称记为 M
    而且用户选择推理等级“高推理”
    那么输入区应该显示已选择 M
    而且输入区应该显示已选择“高推理”
    当用户发送一条消息
    那么发送过程中界面应该仍显示 M 和“高推理”
    当用户等待 Agent 回复完成
    那么 Agent 回复完成后界面应该仍显示 M 和“高推理”
    而且页面应该出现一条 Agent 回复正文

  @P1 @context @AG-CONTEXT-004
  场景: 用户通过 @ 搜索选择上下文引用
    假如 seed 数据中存在 Understanding「React Server Components」
    而且 seed 数据中存在 Domain「React」
    当用户在输入框输入 @React
    那么页面应该显示上下文候选列表
    而且候选列表应该包含 Understanding「React Server Components」
    而且候选列表应该包含 Domain「React」
    当用户选择 Understanding「React Server Components」
    那么输入框中应该显示 Understanding「React Server Components」

  @P1 @context @AG-CONTEXT-005
  场景: 用户点击已选择的 Understanding 引用后查看详情
    假如 seed 数据中存在 Understanding「React Server Components」
    而且用户已经在输入框中选择 Understanding「React Server Components」
    当用户点击输入框中的 Understanding「React Server Components」引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Understanding「React Server Components」

  @P1 @context @AG-CONTEXT-009
  场景: 用户通过 @ 搜索后按 Enter 选择上下文引用
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在输入框输入 @React
    而且用户按 Enter
    那么输入框中应该显示 Understanding「React Server Components」
    而且输入框应该继续允许用户编辑当前草稿

  @P1 @context @attachment @AG-CONTEXT-007
  场景: 用户发送可读附件后看到 Agent 使用附件
    假如用户已经打开一个对话
    而且测试环境有可上传文件 ATTACHMENT_FILE
    当用户在输入框添加附件 ATTACHMENT_FILE
    而且用户要求 Agent 读取该附件
    而且用户发送消息
    而且用户展开 Agent 活动
    那么用户消息中应该显示附件 ATTACHMENT_FILE
    而且 Agent 活动中应该显示附件读取记录
    而且页面应该出现一条 Agent 回复正文

  @P0 @lexical @AG-RETRIEVAL-001
  场景: 用户通过关键词搜索找到 Understanding
    假如 seed 数据中存在带唯一关键词的 Understanding
    当用户在 Agent 输入框中搜索该唯一关键词
    那么上下文候选列表应该包含该 Understanding

  @P0 @lexical @AG-RETRIEVAL-002
  场景: 用户通过 @ 搜索只看到词面匹配的上下文
    假如 seed 数据中存在与查询语义相关但没有共同关键词的 Understanding
    而且语义检索模型已准备好
    当用户在 Agent 输入框中搜索语义相近但无共同关键词的内容
    那么上下文候选列表应该显示没有可选上下文的空状态

  @P0 @draft @AG-MESSAGE-004
  场景: Agent 回复期间用户可以整理下一轮想法
    假如用户已经发送一条消息且 Agent 正在回复
    当用户在输入框输入 NEXT_TURN_DRAFT
    而且用户按 Enter 继续输入 SECOND_LINE
    那么输入框应该保留 NEXT_TURN_DRAFT 和 SECOND_LINE
    而且当前回复完成前，输入框应该保持可编辑

  @P1 @recovery @attachment @AG-HISTORY-005
  场景: 用户发送附件后重启仍能看到附件
    假如用户已经在对话中发送附件 ATTACHMENT_FILE
    而且 Agent 已经完成回复
    当用户关闭并重新打开 Reflecta 应用
    而且用户打开原对话
    那么原对话应该仍显示附件 ATTACHMENT_FILE
    而且输入框应该可操作
