# language: zh-CN
@capture @agent @v1.1.0
功能: 用户围绕 Capture 对象使用上下文 Agent
  用户在回看和整理理解时，需要能从当前 Domain 或 Understanding 旁边打开 Agent，并让当前对象自动进入这轮对话上下文。

  @P0 @context @CP-AGENT-001
  场景: 用户从 Domain 右键菜单打开上下文 Agent
    假如 seed 数据中存在 Domain「Programming」
    当用户在 Capture 页面右键 Domain「Programming」
    而且用户选择“和 AI 聊聊”
    那么页面右侧应该打开 Agent 侧栏
    而且 Agent 输入框中应该显示 Domain「Programming」上下文
    而且 Agent 输入框应该获得焦点
    而且 Agent 侧栏应该显示当前范围为「Programming」

  @P0 @context @CP-AGENT-002
  场景: 用户从 Understanding 列表右键菜单打开上下文 Agent
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在 Capture 页面右键 Understanding「React Server Components」
    而且用户选择“和 AI 聊聊”
    那么页面右侧应该打开 Agent 侧栏
    而且 Agent 输入框中应该显示 Understanding「React Server Components」上下文
    而且 Agent 输入框应该获得焦点
    而且 Agent 侧栏应该显示当前范围为「React Server Components」

  @P0 @context @CP-AGENT-003
  场景: 用户从 Understanding 详情页按钮打开上下文 Agent
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在 Capture 页面打开 Understanding「React Server Components」
    而且用户点击详情页的“聊聊”按钮
    那么页面右侧应该打开 Agent 侧栏
    而且 Agent 输入框中应该显示 Understanding「React Server Components」上下文
    而且 Agent 输入框应该获得焦点

  @P1 @isolation @CP-AGENT-004
  场景: 用户在 Agent 页面内检查 Understanding 详情
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在 Agent 页面打开 Understanding「React Server Components」详情面板
    那么详情面板应该显示 Understanding「React Server Components」的标题和正文
    而且用户应该可以关闭详情面板并继续当前对话

  @P1 @draft @CP-AGENT-005
  场景: 对话列表只收录已发送消息的 Capture 上下文对话
    假如 seed 数据中存在 Domain「Programming」
    当用户在 Capture 页面右键 Domain「Programming」
    而且用户选择“和 AI 聊聊”
    而且用户不发送任何消息
    而且用户进入 Agent 页面
    那么对话列表应该保持打开上下文 Agent 前的历史内容

  @P1 @history @CP-AGENT-006
  场景: 用户在上下文 Agent 中继续历史对话并开始新对话
    假如当前 Capture 对象已有一条发送过消息的上下文对话
    当用户打开上下文 Agent 的历史
    那么用户应该可以重新打开这条对话并看到原有消息
    当用户开始新对话
    那么输入区应该清空
    而且当前 Capture 对象应该继续作为初始上下文

  @P1 @navigation @CP-AGENT-007
  场景: 用户把当前上下文对话转到完整 Agent 页面
    假如用户正在 Capture 的上下文 Agent 中查看一条对话
    当用户选择在完整 Agent 页面中继续
    那么用户应该进入 Agent 页面
    而且 Agent 页面应该打开同一条对话

  @P1 @layout @CP-AGENT-008
  场景: 用户调整并关闭上下文 Agent
    假如 Capture 右侧已经打开上下文 Agent
    当用户向左拖动 Capture 内容与上下文 Agent 之间的分隔条
    那么上下文 Agent 应该变宽
    而且 Capture 当前内容应该继续显示
    当用户关闭上下文 Agent
    那么 Capture 应该恢复为不显示上下文 Agent 的工作区
