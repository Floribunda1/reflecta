# language: zh-CN
@capture @knowledge_wander @v1.2.0
功能: 用户在领域图谱中重新遇见自己的理解
  用户需要先看见当前领域中真实存在的 Understanding，再根据自己的兴趣选择节点进入原文与 Context，而不是沿系统规定的顺序阅读。

  @P0 @happy_path @KW-GRAPH-001
  场景: 用户打开全部领域图谱
    假如 seed 数据中存在多条有关联和无关联的 Understanding
    当用户在 Capture 中进入「知识漫步」
    那么页面应该显示「全部领域」及其 Understanding 数量
    而且每条当前范围内的 Understanding 都应该成为可进入的图谱节点
    而且真实 Connection 应该作为节点之间的边出现

  @P0 @context @KW-GRAPH-002
  场景: 用户从图谱节点进入理解详情并返回
    假如图谱中存在 Understanding「React Server Components」
    当用户选择节点「React Server Components」
    那么右侧应该显示同一条 Understanding 的可编辑详情和 Context
    而且图谱应该保持这个节点的选择状态
    当用户关闭详情
    那么图谱应该保留原来的视口
    而且节点选择状态应该被清除

  @P0 @navigation @KW-GRAPH-003
  场景: 用户切换图谱的领域范围
    假如 seed 数据中存在 Domain「Programming」及其子领域
    当用户在知识漫步中选择 Domain「Programming」
    那么页面应该显示「Programming」及其范围内的 Understanding 数量
    而且图谱应该只呈现这个领域及其子领域中的 Understanding

  @P0 @navigation @KW-GRAPH-004
  场景: 用户从旧入口回到 Capture
    假如用户保存过旧 Contemplate 地址
    当用户打开这个旧地址
    那么应该进入 Capture 页面
    而且模块切换菜单应该只提供 Capture 和 Agent
