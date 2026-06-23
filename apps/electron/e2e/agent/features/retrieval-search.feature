# language: zh-CN
@agent @retrieval @v1.1.0
功能: Agent 上下文检索
  用户通过 @ 快速引用自己明确知道的内容；Agent 在回复过程中可以用知识检索找回语义相关理解。

  @P0 @lexical @AG-RETRIEVAL-001
  场景: 用户通过关键词搜索找到 Understanding
    假如 seed 数据中存在带唯一关键词的 Understanding
    当用户在 Agent 输入框中搜索该唯一关键词
    那么上下文候选列表应该包含该 Understanding

  @P0 @lexical @AG-RETRIEVAL-002
  场景: 用户通过 @ 搜索不会看到只有语义相关的 Understanding
    假如 seed 数据中存在与查询语义相关但没有共同关键词的 Understanding
    而且语义检索模型已准备好
    当用户在 Agent 输入框中搜索语义相近但无共同关键词的内容
    那么上下文候选列表不应该包含该 Understanding
    而且用户应该看到没有可选上下文

  @P0 @semantic @AG-RETRIEVAL-003
  场景: Agent 使用知识检索找到语义相关 Understanding
    假如 seed 数据中存在多条与不同查询语义相关但没有共同关键词的 Understanding
    而且语义检索模型已准备好
    当 Agent 分别检索这些查询
    那么每次检索结果都应该包含对应的 Understanding
    而且每次检索应该在交互可接受的时间内完成
