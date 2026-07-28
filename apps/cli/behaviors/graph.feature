# language: zh-CN
功能: 用户通过 CLI 查看 Understanding 周围的显式连接
  用户需要从一条 Understanding 出发查看相邻理解，并在需要时一并取得支撑这些理解的 Context。

  背景:
    假设 测试知识库中已存在带 wiki-link 双链的 Understanding

  @CLI-GRAPH-001
  场景: 获取指定 Understanding 的关联图
    当 用户执行命令 "graph UNDERSTANDING_ID --depth 1"
    那么 输出包含 seed、nodes、edges

  @CLI-GRAPH-002
  场景: 获取关联图并附带 Context
    当 用户执行命令 "graph UNDERSTANDING_ID --include-context"
    那么 输出包含 contexts 数组
