# language: zh-CN
@app @navigation
功能: 用户在 Reflecta 的主要工作区之间切换
  用户需要在 Capture、Agent 和设置之间移动。

  @P0 @happy_path @APP-NAV-001
  场景: 用户从 Capture 进入 Agent 后返回 Capture
    假如用户正在 Capture 查看一条 Understanding
    当用户选择“和 AI 对话”
    那么用户应该进入 Agent 页面
    当用户选择“查看笔记”
    那么用户应该返回 Capture 页面

  @P1 @happy_path @APP-NAV-002
  场景: 用户打开设置并返回原工作区
    假如用户正在 Agent 页面查看一条对话
    当用户打开设置
    那么用户应该可以切换 AI、存储、语义检索和回收站设置
    当用户关闭设置
    那么用户应该返回原来的 Agent 对话
