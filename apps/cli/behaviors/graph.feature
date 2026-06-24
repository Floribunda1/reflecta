# language: zh-CN
功能: Understanding 关联图

  背景:
    假设 数据库中已存在带 wiki-link 双链的 Understanding

  @CLI-GRAPH-001
  场景: 获取指定 Understanding 的关联图
    当 用户执行命令 "graph UNDERSTANDING_ID --depth 1"
    那么 输出包含 seed、nodes、edges

  @CLI-GRAPH-002
  场景: 获取关联图并附带 Context
    当 用户执行命令 "graph UNDERSTANDING_ID --include-context"
    那么 输出包含 contexts 数组
