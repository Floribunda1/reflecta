# language: zh-CN
功能: 用户通过 CLI 找回相关 Understanding 和 Context
  用户需要用关键词或语义描述找到自己的理解和具体上下文，并在内容修改或删除后得到与当前知识库一致的结果。

  背景:
    假设 测试知识库中已存在可搜索的 Understanding 与 Context

  @CLI-SEARCH-001
  场景: 搜索返回混合命中
    假设 Understanding 与 Context 均包含 "React"
    当 用户执行命令 "search 'React'"
    那么 输出包含 hits 数组
    并且 每个命中项的 type 为 understanding 或 context

  @CLI-SEARCH-002
  场景: Context 命中带所属 Understanding ID
    假设 测试知识库中存在一条活跃 Context，其内容包含 "Dockerfile"
    当 用户执行命令 "search 'Dockerfile'"
    那么 Context 命中包含 understandingId

  @CLI-SEARCH-003
  场景: 词面搜索返回包含关键词的 Context
    假设 用户创建了一条 Context，其内容包含唯一关键词 "lexicalsignalaltair"
    当 用户执行命令 "search 'lexicalsignalaltair'"
    那么 输出包含该 Context

  @CLI-SEARCH-004
  场景: 语义搜索返回表达不同但含义相关的 Understanding
    假设 用户创建了一条 Understanding，其内容说明 "验收标准让 AI 产出保持可控"
    当 用户执行命令 "search '怎样让模型回复更稳定可靠'"
    那么 输出包含该 Understanding

  @CLI-SEARCH-005
  场景: 无匹配时返回空 hits
    假设 Understanding 和 Context 都不匹配 "ZZZ_NO_MATCH"
    当 用户执行命令 "search 'ZZZ_NO_MATCH'"
    那么 输出为 { hits: [] }

  @CLI-SEARCH-006
  场景: 搜索结果反映知识更新和删除
    假设 用户创建了一条 Understanding，其正文包含 "searchstatebeforemarker"
    当 用户将该 Understanding 的正文更新为 "searchstateaftermarker"
    那么 搜索 "searchstatebeforemarker" 应该只显示当前内容仍然匹配的对象
    并且 搜索 "searchstateaftermarker" 应该返回该 Understanding
    当 用户删除该 Understanding
    那么 搜索 "searchstateaftermarker" 应该只显示当前仍可用的知识库对象
