# language: zh-CN
@agent @v1.1.0
功能: 用户在多个 Agent 对话之间工作
  用户需要能在多个对话之间切换、删除对话，并确认不同对话的内容互不污染。

  @P0 @isolation @AG-CONV-001
  场景: 对话 A 正在回复时切换到对话 B 不影响 B
    假如存在对话 A 和对话 B
    而且对话 A 正在生成回复
    而且对话 B 已有用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
    当用户从对话 A 切换到对话 B
    那么对话 B 应该显示用户消息 B_USER_MESSAGE
    而且对话 B 应该显示一条已完成 Agent 回复
    而且对话 B 的输入框应该可输入

  @P0 @isolation @AG-CONV-002
  场景: 对话 A 回复完成后切回 A 可以看到 A 的内容
    假如存在对话 A 和对话 B
    而且 Agent 当前可以完成回复
    当用户打开对话 A
    而且用户发送 start A
    而且用户在 A 正在回复时切换到对话 B
    而且用户等待对话 A 的回复完成
    而且用户切回对话 A
    那么对话 A 应该显示用户消息 start A
    而且对话 A 应该显示一条已完成 Agent 回复
    而且消息顺序应该保持用户消息在前、Agent 回复在后

  @P1 @isolation @AG-CONV-003
  场景: 用户删除一个对话后仍可查看剩余对话
    假如存在对话 A 和对话 B
    而且对话 A 有用户消息 A_USER_MESSAGE 和一条 Agent 回复
    而且对话 B 有用户消息 B_USER_MESSAGE 和一条 Agent 回复
    当用户删除对话 A
    而且用户查看对话列表
    而且用户打开对话 B
    那么对话列表应该显示对话 B
    而且对话 B 应该显示用户消息 B_USER_MESSAGE
    而且对话 B 应该显示一条已完成 Agent 回复

  @P1 @isolation @AG-CONV-004
  场景: 用户按时间分组查看对话列表
    假如存在今天更新的对话 TODAY_LATE 和 TODAY_EARLY
    而且存在昨天更新的对话 YESTERDAY_THREAD
    当用户进入 Agent 页面
    那么对话列表应该显示“今天”和“昨天”分组
    而且 TODAY_LATE 应该显示在 TODAY_EARLY 前面
    而且今天的对话应该显示在昨天的对话前面

  @P1 @branch @AG-CONV-005
  场景: 用户 Fork 当前对话分支后继续查看同一段内容
    假如存在对话 FORK_SOURCE
    而且对话 FORK_SOURCE 有用户消息 FORK_USER_MESSAGE 和一条 Agent 回复
    当用户对 FORK_SOURCE 执行 Fork 当前分支
    那么对话列表应该显示 Fork 后的新对话
    而且新对话应该显示用户消息 FORK_USER_MESSAGE
    而且新对话应该显示一条已完成 Agent 回复
    而且原对话 FORK_SOURCE 应该仍保留在对话列表中

  @P1 @navigation @AG-CONV-006
  场景: 用户在长对话中通过右侧摘录跳转到指定消息
    假如用户已经有一条包含多轮消息的长对话
    当用户打开这条长对话
    而且用户点击右侧消息摘录中的目标用户消息
    那么正文应该滚动到这条目标用户消息
    而且这条目标用户消息应该被短暂高亮
    而且输入框应该可操作
