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
