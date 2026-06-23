# language: zh-CN
@agent @retrieval @v1.1.0
功能: Agent 上下文检索
  用户需要在 Agent 输入框中通过 @ 搜索找到可引用知识，既支持关键词命中，也支持语义召回。

  @P0 @lexical @AG-RETRIEVAL-001
  场景: 用户通过关键词搜索找到 Understanding
    假如 seed 数据中存在带唯一关键词的 Understanding
    当用户在 Agent 输入框中搜索该唯一关键词
    那么上下文候选列表应该包含该 Understanding

  @P0 @semantic @AG-RETRIEVAL-002
  场景: 用户通过语义搜索找到没有共同关键词的 Understanding
    假如 seed 数据中存在 semantic target Understanding
    而且本地 embedding endpoint 已启用
    当用户在 Agent 输入框中搜索语义相近但无共同关键词的 query
    那么上下文候选列表应该包含 semantic target Understanding
