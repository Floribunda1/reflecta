# language: zh-CN
@capture @agent @v1.1.0
功能: 用户从 Capture 对象打开上下文 Agent
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
