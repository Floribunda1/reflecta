功能: V2 Agent 知识库读取与追溯

  背景:
    假设 用户已打开 Agent 页面
    并且 数据库中存在 Category "交易心理"
    并且 "交易心理" 下存在多条 Thought
    并且 存在 Thought "反馈延迟"
    并且 Thought "反馈延迟" 绑定了 Context 和 Connection

  @P0
  场景: Agent 从项目结构开始查找相关内容
    当 用户发送 "我之前是不是写过关于拖延的东西？"
    那么 Agent 可以先调用 tool "snapshot_project"
    并且 Agent 可以根据 categories 和 recentThoughts 决定后续调用
    并且 ToolActivity 默认折叠显示调用摘要

  @P0
  场景: Agent 主动读取被 @ 的 Thought
    假设 用户消息引用了 Thought "反馈延迟"
    当 Agent 判断需要读取原文
    那么 Agent 可以调用 tool "thought_get"
    并且 ToolActivity 显示 "AI 读取了 1 条 Thought"
    并且 Assistant 回复基于真实 Thought 内容

  @P0
  场景: Agent 使用搜索进入知识库
    当 用户发送 "找一下我写过的反馈不清晰相关内容"
    那么 Agent 可以调用 tool "search_all"
    并且 搜索结果包含 Thought 和 Context 候选
    并且 Agent 选择少量候选后可以调用 "thought_get" 或 "context_list"
    并且 Assistant 回复中通过 CitationLink 指向使用过的对象

  @P0
  场景: Agent 查看 Thought 的 Context
    假设 用户正在讨论 Thought "反馈延迟"
    当 Agent 需要判断这条理解从哪里长出来
    那么 Agent 可以调用 tool "context_list"
    并且 Assistant 回复说明 Context 对当前判断的影响
    并且 不会把 Context 自动保存为新的 Thought

  @P0
  场景: Agent 查看 Thought 周围的显式关系
    假设 用户询问 "@反馈延迟 和我其他想法有什么关系？"
    当 Agent 需要读取已有 Connection
    那么 Agent 可以调用 tool "graph_neighborhood"
    并且 ToolActivity 显示 "AI 查看了 1 个关联图谱"
    并且 Assistant 只把关系表述为已有显式 Connection 或候选关联视角

  @P1
  场景: Agent 检查 Category 的局部内容
    当 用户发送 "基于 @交易心理，帮我看看哪些理解值得继续追问"
    那么 Agent 可以调用 tool "category_inspect"
    并且 可按需包含 contexts 或 edges
    并且 Assistant 回复列出少量可继续追问的 Thought

  @P1
  场景: 只读工具失败后给出可追溯说明
    假设 Agent 调用只读 tool 时返回错误
    当 Assistant 继续回复
    那么 聊天流显示 tool 失败状态
    并且 Assistant 不把失败工具的结果当作事实
    并且 用户可以继续追问或换一种检索方式

  @P1
  场景: CitationLink 可追溯到真实对象
    假设 Assistant 回复引用了 Thought "反馈延迟"
    当 用户点击 CitationLink
    那么 系统展示该 Thought 的预览或跳转入口
    并且 用户能确认该回复基于真实 Reflecta 对象
