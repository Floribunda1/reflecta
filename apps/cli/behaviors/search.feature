功能: 全文检索

  背景:
    假设 数据库中已存在 Understanding 与 Context，且 FTS5 索引已建立

  场景: 搜索返回混合命中
    假设 Understanding 与 Context 均包含 "React"
    当 用户执行命令 "search 'React'"
    那么 输出包含 hits 数组
    并且 每个命中项的 type 为 understanding 或 context

  场景: Context 命中带所属 Understanding ID
    假设 数据库中存在一条活跃 Context，其内容包含 "Dockerfile"
    当 用户执行命令 "search 'Dockerfile'"
    那么 Context 命中包含 understandingId

  场景: 无匹配时返回空 hits
    假设 Understanding 和 Context 都不匹配 "ZZZ_NO_MATCH"
    当 用户执行命令 "search 'ZZZ_NO_MATCH'"
    那么 输出为 { hits: [] }
