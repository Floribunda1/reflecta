# language: zh-CN
@capture @knowledge_wander @v1.2.0
功能: 用户在领域图谱中重新遇见自己的理解
  用户需要先看见当前领域中真实存在的 Understanding，再根据自己的兴趣选择节点进入原文与 Context。

  @P0 @happy_path @KW-GRAPH-001
  场景: 用户打开全部领域图谱
    假如 seed 数据中存在多条有关联和无关联的 Understanding
    当用户在 Capture 中进入「知识漫步」
    那么页面应该显示「全部领域」及其 Understanding 数量
    而且每条当前范围内的 Understanding 都应该成为可进入的图谱节点
    而且真实 Connection 应该作为节点之间的边出现

  @P1 @navigation @KW-GRAPH-011
  场景: 用户从理解列表进入当前领域的知识漫步
    假如用户正在 Capture 浏览一个 Domain 的理解列表
    当用户选择理解列表中的知识漫步入口
    那么 Capture 主工作区应该切换为知识漫步图谱
    而且图谱标题栏应该显示当前 Domain 的名称
    而且图谱标题栏应该保留返回理解列表的入口

  @P0 @context @KW-GRAPH-002
  场景: 用户从图谱节点进入理解详情并返回
    假如图谱中存在 Understanding「React Server Components」
    当用户选择节点「React Server Components」
    那么右侧应该显示同一条 Understanding 的可编辑详情和 Context
    而且图谱应该保持这个节点的选择状态
    当用户关闭详情
    那么图谱应该保留原来的视口
    而且节点选择状态应该被清除

  @P0 @interaction @KW-GRAPH-005
  场景: 用户悬停节点时临时查看它的直接邻域
    假如图谱中存在相连的 Understanding「A」和「B」以及无关的 Understanding「C」
    当用户将指针移到节点「A」
    那么节点「A」应该成为当前主强调
    而且节点「B」及「A」与「B」之间的 Connection 应该保持清晰
    而且无关节点「C」应该退到背景
    而且右侧详情区域应该保持关闭
    当用户将指针移出节点「A」
    那么所有节点和 Connection 应该恢复默认状态

  @P0 @interaction @KW-GRAPH-006
  场景: 用户连续选择图谱节点并结束查看
    假如图谱中存在 Understanding「React Server Components」和「Vue Reactivity」
    当用户选择节点「React Server Components」
    那么右侧应该打开 Understanding「React Server Components」的详情
    当用户继续选择节点「Vue Reactivity」
    那么右侧应该改为显示 Understanding「Vue Reactivity」的详情
    而且图谱应该只保留节点「Vue Reactivity」的选择状态
    当用户关闭 Understanding 详情
    那么右侧详情应该关闭
    而且图谱应该恢复为未选择节点的状态

  @P0 @navigation @KW-GRAPH-003
  场景: 用户切换图谱的领域范围
    假如 seed 数据中存在 Domain「Programming」及其子领域
    当用户在知识漫步中选择 Domain「Programming」
    那么页面应该显示「Programming」及其范围内的 Understanding 数量
    而且图谱应该只呈现这个领域及其子领域中的 Understanding

  @P1 @empty @KW-GRAPH-007
  场景: 用户打开还没有 Understanding 的领域图谱
    假如 seed 数据中存在没有 Understanding 的 Domain「Empty Domain」
    当用户进入 Domain「Empty Domain」的知识漫步
    那么图谱标题栏应该显示「Empty Domain」
    而且主工作区应该显示“这个领域还没有理解”
