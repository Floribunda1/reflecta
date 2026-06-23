功能: 知识搜索

  背景:
    假设 数据库中已存在可搜索的 Understanding 与 Context

  场景: 搜索返回混合命中
    假设 Understanding 与 Context 均包含 "React"
    当 用户执行命令 "search 'React'"
    那么 输出包含 hits 数组
    并且 每个命中项的 type 为 understanding 或 context

  场景: Context 命中带所属 Understanding ID
    假设 数据库中存在一条活跃 Context，其内容包含 "Dockerfile"
    当 用户执行命令 "search 'Dockerfile'"
    那么 Context 命中包含 understandingId

  场景: 词面搜索返回包含关键词的 Context
    假设 用户创建了一条 Context，其内容包含唯一关键词 "lexicalsignalaltair"
    当 用户执行命令 "search 'lexicalsignalaltair'"
    那么 输出包含该 Context

  场景: 语义搜索返回表达不同但含义相关的 Understanding
    假设 用户创建了一条 Understanding，其内容说明 "验收标准让 AI 产出保持可控"
    当 用户执行命令 "search '怎样让模型回复更稳定可靠'"
    那么 输出包含该 Understanding

  场景: 无匹配时返回空 hits
    假设 Understanding 和 Context 都不匹配 "ZZZ_NO_MATCH"
    当 用户执行命令 "search 'ZZZ_NO_MATCH'"
    那么 输出为 { hits: [] }

  场景: 搜索结果反映知识更新和删除
    假设 用户创建了一条 Understanding，其正文包含 "searchstatebeforemarker"
    当 用户将该 Understanding 的正文更新为 "searchstateaftermarker"
    那么 搜索 "searchstatebeforemarker" 不再返回该 Understanding
    并且 搜索 "searchstateaftermarker" 可返回该 Understanding
    当 用户删除该 Understanding
    那么 搜索 "searchstateaftermarker" 不再返回该 Understanding
