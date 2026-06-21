功能: V2 Agent 消息渲染与可读性

  背景:
    假设 用户已打开 Agent 页面
    并且 当前 Thread 中存在用户消息、Assistant 消息和 ToolActivity

  @P0
  场景: Assistant 回复流式渲染 Markdown
    当 Assistant 正在流式输出包含标题、列表和代码块的 Markdown
    那么 聊天流应增量渲染 Markdown
    并且 未闭合的列表或代码块不应导致页面闪烁或显示原始解析错误
    并且 回复结束后 Markdown 呈现为完整格式

  @P0
  场景: Markdown 代码块和表格控件可用
    假设 Assistant 回复中包含代码块和表格
    当 用户操作代码块复制或表格滚动
    那么 Markdown 控件仍可点击
    并且 控件不会被聊天样式遮挡

  @P0
  场景: Reasoning 按原始输出顺序内联展示
    当 Assistant 先输出 reasoning 再调用 tool 再输出正文
    那么 聊天流按 reasoning、ToolActivity、正文的顺序展示
    并且 reasoning 默认使用弱化样式
    并且 reasoning 不会被合并到最终正文

  @P0
  场景: 流式 reasoning 显示正在思考状态
    当 Assistant 正在流式输出 reasoning
    那么 聊天流显示 "正在思考"
    并且 reasoning 文本随流式片段增长
    并且 回复结束后状态变为 "思考过程"

  @P0
  场景: ToolActivity 默认折叠并汇总状态
    假设 Agent 已调用多个 tools
    当 聊天流渲染 ToolActivity
    那么 ToolActivity 默认折叠
    并且 显示运行中、完成、失败或已拒绝状态
    并且 list tool 输出显示数量摘要而不是完整 payload

  @P0
  场景: 聊天流跟随正在增长的输出
    假设 用户停留在聊天底部
    当 Assistant 流式输出 text、reasoning 或 tool output
    那么 聊天流自动跟随到底部
    并且 新增内容不会出现在可视区域之外

  @P0
  场景: 用户上滑后不强制抢滚动
    假设 Assistant 正在流式回复
    当 用户向上滚动查看旧消息
    那么 聊天流不强制跳回底部
    并且 页面显示回到底部入口
    并且 用户点击入口后回到最新输出

  @P1
  场景: 消息时间戳显示完整信息
    假设 当前 Thread 中存在多条消息
    当 用户查看消息
    那么 每条消息下方显示可读时间
    并且 用户可以看到更详细的日期时间信息

  @P1
  场景: 复制 Assistant 回复不包含隐藏 payload
    假设 当前 Thread 中存在一条已完成的 Assistant 回复
    当 用户点击复制
    那么 系统复制该回复的可读文本
    并且 不包含 hidden tool payload 或 approval metadata

  @P1
  场景: ReferenceChip 点击后展示对象预览
    假设 聊天流中存在 ReferenceChip "@反馈延迟"
    当 用户点击该 chip
    那么 系统在聊天流附近展示轻量预览
    并且 用户可以从预览跳转到真实 Thought
