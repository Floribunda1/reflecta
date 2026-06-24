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
  场景: 用户通过 @ 搜索只看到词面匹配的上下文
    假如 seed 数据中存在与查询语义相关但没有共同关键词的 Understanding
    而且语义检索模型已准备好
    当用户在 Agent 输入框中搜索语义相近但无共同关键词的内容
    那么上下文候选列表应该只显示词面匹配的结果
    而且用户应该看到没有可选上下文的空状态

  @P0 @semantic @AG-RETRIEVAL-003
  场景: 用户要求 Agent 检索知识库后看到检索结果
    假如 seed 数据中存在与查询语义相关但没有共同关键词的 Understanding
    而且语义检索模型已准备好
    当用户要求 Agent 查找相关理解
    那么页面应该显示知识检索工具活动
    而且工具活动中应该显示相关 Understanding
    而且页面应该出现一条 Agent 回复正文
