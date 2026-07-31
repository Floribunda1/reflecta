# language: zh-CN
@agent @v1.1.0
功能: 用户修订已有 Agent 对话
  用户需要能编辑历史用户消息或重新生成回复，并看到当前对话结果被正确更新。

  @P1 @happy_path @AG-MESSAGE-001
  场景: 用户编辑历史消息后看到新的当前回复
    假如用户已经发送 ORIGINAL_USER_MESSAGE
    而且 Agent 已经完成一条回复
    而且 Agent 可以完成回复
    当用户编辑 ORIGINAL_USER_MESSAGE
    而且用户将内容改为 EDITED_USER_MESSAGE
    而且用户提交编辑
    而且用户等待 Agent 完成回复
    那么用户消息应该变成 EDITED_USER_MESSAGE
    而且当前对话应该只显示一条用户消息
    而且当前对话应该只显示一条完成状态的 Agent 回复
    而且消息顺序应该仍然是用户消息在前、Agent 回复在后

  @P1 @happy_path @AG-MESSAGE-002
  场景: 用户重新生成回复后看到新的当前回复
    假如用户已经发送 REGENERATE_USER_MESSAGE
    而且 Agent 已经完成一条回复
    而且 Agent 可以完成回复
    当用户对当前 Agent 回复执行重新生成
    而且用户等待 Agent 完成回复
    那么对话中应该保留用户消息 REGENERATE_USER_MESSAGE
    而且当前对话应该只显示一条完成状态的 Agent 回复
    而且消息顺序应该保持用户消息在前、Agent 回复在后
