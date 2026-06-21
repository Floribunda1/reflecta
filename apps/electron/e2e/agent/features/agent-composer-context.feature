功能: V2 Agent Composer 与上下文输入

  背景:
    假设 用户已打开 Agent 页面
    并且 数据库中存在 Category "交易心理"
    并且 "交易心理" 下存在 Thought "反馈延迟"
    并且 Thought "反馈延迟" 绑定了 Context

  @P0
  场景: Composer 基础输入行为
    当 用户在 Composer 中输入多行内容
    那么 Shift+Enter 插入换行
    并且 Enter 发送消息
    并且 中文 IME 组合输入期间按 Enter 不会误发送

  @P0
  场景: 用户通过 @ 引用 Thought
    当 用户在 Composer 中输入 "我想继续想 @反馈延迟 这个问题"
    并且 用户从 @ 选择器中选择 Thought "反馈延迟"
    并且 用户发送消息
    那么 消息中保存轻量 ref，包含 object type、object id 和 display title
    并且 消息中不自动保存 Thought 全文
    并且 聊天流中按输入位置显示 ReferenceChip "@反馈延迟"

  @P0
  场景: 用户通过 @ 引用 Context
    当 用户在 Composer 中选择一个 Context 引用
    并且 用户发送 "基于 @这段讨论，帮我追问几个问题"
    那么 消息中保存 Context 的轻量 ref
    并且 消息中不自动保存 Context 全文
    并且 聊天流中显示可检查的 Context ReferenceChip

  @P0
  场景: 用户通过 @ 引用 Category
    当 用户在 Composer 中选择 Category "交易心理"
    并且 用户发送 "基于 @交易心理，帮我看看哪些理解值得继续追问"
    那么 消息中保存 Category 的轻量 ref
    并且 消息中不自动保存整个 Category 内容
    并且 聊天流中显示 Category ReferenceChip

  @P0
  场景: 多个上下文引用保持 inline 顺序
    当 用户发送 "对比 @反馈延迟 和 @交易心理，先问我一个问题"
    那么 聊天流保留普通文本和 ReferenceChip 的原始顺序
    并且 ReferenceChip 不会被挤到消息开头或末尾
    并且 Thread preview 显示可读的引用标题

  @P1
  场景: Context usage 异步更新且不阻塞输入
    假设 Composer 中已有长文本和多个 @ 引用
    当 用户继续输入内容
    那么 Context usage meter 异步更新
    并且 Composer 输入保持响应
    并且 超出模型上下文窗口时显示可理解的提示

  @P1
  场景: 重新打开 Thread 后恢复 Composer 引用显示
    假设 已存在一条包含 Thought、Context 和 Category 引用的用户消息
    当 用户重新打开该 Thread
    那么 聊天流仍显示对应 ReferenceChip
    并且 每个 ReferenceChip 仍指向原始对象 id
