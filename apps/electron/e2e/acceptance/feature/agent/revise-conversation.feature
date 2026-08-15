# language: zh-CN
@agent @v1.1.0
功能: 用户修订已有 Agent 对话
  用户需要能复制、编辑历史用户消息或重新生成回复，并看到当前对话结果被正确更新。

  @P1 @happy_path @AG-MESSAGE-001
  场景: 用户编辑历史消息后看到新的当前回复
    假如用户已经发送 ORIGINAL_USER_MESSAGE
    而且 Agent 已经完成一条回复
    而且 Agent 可以完成回复
    当用户对 ORIGINAL_USER_MESSAGE 执行编辑
    那么 ORIGINAL_USER_MESSAGE 所在的消息应该切换为显示原内容的编辑框
    而且编辑框应该仍然位于后续 Agent 回复之前
    而且底部输入框中的草稿应该保持不变
    当用户将内容改为 EDITED_USER_MESSAGE
    而且用户提交编辑
    而且用户等待 Agent 完成回复
    那么用户消息应该变成 EDITED_USER_MESSAGE
    而且当前对话应该只显示一条用户消息
    而且当前对话应该只显示一条完成状态的 Agent 回复
    而且消息顺序应该仍然是用户消息在前、Agent 回复在后
    而且底部输入框中的草稿应该仍然保持不变

  @P1 @happy_path @editing @AG-MESSAGE-005
  场景: 用户取消编辑后保留原对话和底部草稿
    假如用户已经发送 CANCEL_EDIT_USER_MESSAGE
    而且 Agent 已经完成一条回复
    而且用户已经在底部输入框输入 PRESERVED_DRAFT
    当用户编辑 CANCEL_EDIT_USER_MESSAGE
    而且用户将编辑内容改为 UNSAVED_EDIT
    而且用户取消编辑
    那么 CANCEL_EDIT_USER_MESSAGE 应该退出编辑状态并重新显示原内容
    而且原来的 Agent 回复应该保持不变
    而且底部输入框应该仍然显示 PRESERVED_DRAFT

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

  @P1 @happy_path @AG-MESSAGE-003
  场景: 用户复制一条消息后剪贴板包含该消息正文
    假如对话中有用户消息 COPY_USER_MESSAGE
    而且 Agent 已经回复 COPY_AGENT_REPLY
    当用户复制 COPY_USER_MESSAGE
    那么系统剪贴板应该包含 COPY_USER_MESSAGE
    而且对话中的 COPY_USER_MESSAGE 和 COPY_AGENT_REPLY 应该保持不变
