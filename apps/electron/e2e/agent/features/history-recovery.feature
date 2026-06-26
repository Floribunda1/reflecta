# language: zh-CN
@agent @v1.1.0
功能: 用户恢复 Agent 历史对话
  用户需要在切换、离开或重启应用后，继续看到之前的对话内容和可处理状态。

  @P0 @recovery @AG-HISTORY-001
  场景: 用户重启应用后仍能看到已完成对话
    假如用户已经完成一轮 Agent 对话
    当用户关闭并重新打开 Reflecta 应用
    而且用户重新进入 Agent 页面
    而且用户打开原对话
    那么原对话应该仍显示用户消息
    而且原对话应该仍显示一条 Agent 回复正文
    而且输入框应该可操作

  @P1 @recovery @AG-HISTORY-002
  场景: 用户重启应用后对话列表和消息顺序保持一致
    假如用户已经完成一轮 Agent 对话
    而且对话列表预览包含该对话的用户消息
    当用户重启 Reflecta 应用
    而且用户重新进入 Agent 页面
    那么对话列表预览应该仍显示该用户消息
    而且打开原对话后消息顺序应该保持用户消息在前、Agent 回复在后

  @P1 @recovery @proposal @AG-HISTORY-003
  场景: 用户离开后仍可处理等待确认的提案
    假如对话中已经出现待确认提案
    当用户离开 Agent 页面
    而且用户重新进入 Agent 页面并打开该对话
    那么用户应该仍能看到该待确认提案
    而且用户应该仍能看到确认和拒绝操作

  @P0 @recovery @control @AG-HISTORY-004
  场景: 用户重新打开有未完成回复的对话后可以继续操作
    假如用户上次关闭 Reflecta 时，当前对话中有一条未完成的 Agent 回复
    当用户重新打开 Reflecta 应用
    而且用户打开原对话
    那么该回复应该显示为已停止状态
    而且输入框应该可操作

  @P1 @recovery @attachment @AG-HISTORY-005
  场景: 用户发送附件后重启仍能看到附件
    假如用户已经在对话中发送附件 ATTACHMENT_FILE
    而且 Agent 已经完成回复
    当用户关闭并重新打开 Reflecta 应用
    而且用户打开原对话
    那么原对话应该仍显示附件 ATTACHMENT_FILE
    而且输入框应该可操作

  @P0 @recovery @context @AG-HISTORY-006
  场景: 用户重启应用后仍可打开 Agent 回复中的知识库引用
    假如 seed 数据中存在 Understanding「React Server Components」
    而且用户已经完成一轮包含该 Understanding 引用的 Agent 对话
    当用户关闭并重新打开 Reflecta 应用
    而且用户重新进入 Agent 页面
    而且用户打开原对话
    那么 Agent 回复中应该显示 Understanding「React Server Components」引用
    当用户点击该引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Understanding「React Server Components」

  @P0 @recovery @streaming @AG-HISTORY-007
  场景: 用户切回正在回复的对话后仍看到当前回复进度
    假如用户已经打开对话 A
    而且对话 A 正在生成回复并已经显示部分回复内容
    而且存在另一个可打开的对话 B
    当用户切换到对话 B
    而且用户再切回对话 A
    那么对话 A 应该仍显示已经生成的 Agent 回复内容
    而且对话 A 应该仍处于正在回复状态
    而且用户应该仍能停止这次回复
