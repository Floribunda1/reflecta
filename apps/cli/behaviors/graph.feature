# language: zh-CN
功能: 用户通过 CLI 查看 Understanding 周围的显式连接
  用户需要从一条 Understanding 出发查看相邻理解，并在需要时一并取得支撑这些理解的 Context。

  背景:
    假设 测试知识库中存在一条活跃 Understanding UNDERSTANDING_ID
    并且 UNDERSTANDING_ID 与另一条活跃 Understanding 之间存在 wiki-link Connection

  @CLI-GRAPH-001
  场景: 获取指定 Understanding 的关联图
    当 用户执行命令 "graph UNDERSTANDING_ID --depth 1"
    那么 输出中的 seed 应为 UNDERSTANDING_ID
    并且 nodes 应该包含这两条 Understanding
    并且 edges 应该包含它们之间的 Connection

  @CLI-GRAPH-002
  场景: 获取关联图并附带 Context
    假设 UNDERSTANDING_ID 有一条活跃 Context
    当 用户执行命令 "graph UNDERSTANDING_ID --include-context"
    那么 输出的 contexts 应该包含这条 Context
