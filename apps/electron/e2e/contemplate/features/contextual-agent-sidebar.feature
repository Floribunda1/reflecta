# language: zh-CN
@contemplate @agent @v1.1.0
功能: 用户从图谱对象打开上下文 Agent
  用户在图谱中审视 Domain 和 Understanding 关系时，需要能从当前节点直接打开 Agent，并让当前节点自动进入这轮对话上下文。

  @P0 @context @CT-AGENT-001
  场景: 用户从图谱 Domain 节点右键菜单打开上下文 Agent
    假如 seed 数据中存在 Domain「Programming」
    当用户在 Contemplate 页面右键 Domain 节点「Programming」
    而且用户选择“和 AI 聊聊”
    那么页面右侧应该打开 Agent 侧栏
    而且 Agent 输入框中应该显示 Domain「Programming」上下文
    而且 Agent 输入框应该获得焦点
    而且 Agent 侧栏应该显示当前范围为「Programming」

  @P0 @context @CT-AGENT-002
  场景: 用户从图谱 Understanding 节点右键菜单打开上下文 Agent
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在 Contemplate 页面进入 Domain「React」图谱
    而且用户右键 Understanding 节点「React Server Components」
    而且用户选择“和 AI 聊聊”
    那么页面右侧应该打开 Agent 侧栏
    而且 Agent 输入框中应该显示 Understanding「React Server Components」上下文
    而且 Agent 输入框应该获得焦点
    而且 Agent 侧栏应该显示当前范围为「React Server Components」

  @P1 @isolation @CT-AGENT-003
  场景: 图谱 Understanding 详情面板不显示 Capture 专属聊天入口
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在 Contemplate 页面进入 Domain「React」图谱
    而且用户打开 Understanding 节点「React Server Components」详情面板
    那么详情面板中不应该显示“聊聊”按钮

  @P1 @history @CT-AGENT-004
  场景: 用户从图谱上下文 Agent 恢复历史对话并新建对话
    假如 seed 数据中存在 Domain「Programming」
    而且 Domain「Programming」已经存在一条上下文 Agent 历史对话
    当用户在 Contemplate 页面右键 Domain 节点「Programming」
    而且用户选择“和 AI 聊聊”
    那么 Agent 侧栏标题应该直接显示「Programming」
    而且 Agent 侧栏背景应该遮住底层图谱
    当用户打开历史对话并选择这条历史对话
    那么 Agent 侧栏应该显示这条历史对话内容
    当用户新建上下文对话
    那么 Agent 输入框中应该显示 Domain「Programming」上下文
    而且当前对话应该显示为空白可输入状态
