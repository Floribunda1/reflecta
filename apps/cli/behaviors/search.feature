功能: 全文检索

  背景:
    假设 数据库中已存在 Thought 与 Context，且 FTS5 索引已建立

  # 查询归一化

  场景: 简单查询分词为前缀匹配
    当 用户执行命令 "search thoughts 'hello world'"
    那么 底层 FTS 查询应为 '"hello*" AND "world*"'

  场景: 特殊字符被自动剥离
    当 用户执行命令 "search thoughts 'foo-bar baz!'"
    那么 底层 FTS 查询应为 '"foo" AND "bar" AND "baz*"'（连字符和感叹号被移除）

  # search thoughts

  场景: 按标题匹配 Thought
    假设 数据库中存在一条活跃 Thought，标题为 "React Patterns"
    当 用户执行命令 "search thoughts 'React'"
    那么 该 Thought 出现在结果中
    并且 每个命中项包含 id、type、title、body、categories、snippet、rank

  场景: 按正文匹配 Thought
    假设 数据库中存在一条活跃 Thought，其正文包含 "distributed consensus"
    当 用户执行命令 "search thoughts 'distributed consensus'"
    那么 该 Thought 出现在结果中

  场景: 排除已删除的 Thought
    假设 数据库中存在一条已删除 Thought，其标题包含 "Deleted Keyword"
    当 用户执行命令 "search thoughts 'Deleted Keyword'"
    那么 该已删除 Thought 不出现在结果中

  场景: 无匹配结果时返回空
    假设 没有任何 Thought 包含短语 "XYZZY_NONEXISTENT"
    当 用户执行命令 "search thoughts 'XYZZY_NONEXISTENT'"
    那么 标准输出为空

  场景: 使用 --limit 限制结果数
    假设 超过 3 条 Thought 匹配查询 "a"
    当 用户执行命令 "search thoughts 'a' --limit 3"
    那么 恰好返回 3 条结果

  场景: 使用 --offset 分页
    假设 有 10 条 Thought 按相关性排序后匹配查询 "the"
    当 用户执行命令 "search thoughts 'the' --limit 3 --offset 3"
    那么 返回第 4 到第 6 条结果

  场景: 摘要高亮匹配关键词
    假设 数据库中存在一条活跃 Thought，其正文为 "The quick brown fox jumps"
    当 用户执行命令 "search thoughts 'fox'"
    那么 结果中的 snippet 包含 <mark>fox</mark>

  场景: 结果按相关性排序
    假设 有多条 Thought 匹配 "design"，但相关性不同
    当 用户执行命令 "search thoughts 'design'"
    那么 结果按 rank 升序排列（最相关在前）

  # search contexts

  场景: 按内容匹配 Context
    假设 数据库中存在一条活跃 Context，其内容为 "Kubernetes scheduling internals"
    当 用户执行命令 "search contexts 'Kubernetes scheduling'"
    那么 该 Context 出现在结果中
    并且 每个命中项包含 contextId、thoughtId、sourceType、sourceName、snippet、rank

  场景: 按来源名称匹配 Context
    假设 数据库中存在一条活跃 Context，其 sourceName 为 "Designing Data-Intensive Applications"
    当 用户执行命令 "search contexts 'Data-Intensive'"
    那么 该 Context 出现在结果中

  场景: 排除已删除的 Context
    假设 数据库中存在一条已删除 Context，其内容为 "Deleted Context Content"
    当 用户执行命令 "search contexts 'Deleted Context Content'"
    那么 该已删除 Context 不出现在结果中

  场景: Context 搜索无匹配
    假设 没有任何 Context 包含 "NONEXISTENT_CONTEXT_TERM"
    当 用户执行命令 "search contexts 'NONEXISTENT_CONTEXT_TERM'"
    那么 标准输出为空

  场景: Context 搜索分页
    假设 有 15 条 Context 匹配查询 "code"
    当 用户执行命令 "search contexts 'code' --limit 5 --offset 10"
    那么 恰好返回 5 条结果，对应偏移量 10–14

  # search all

  场景: 同时检索 Thought 与 Context
    假设 Thought 与 Context 均包含 "architecture"
    当 用户执行命令 "search all 'architecture'"
    那么 输出包含 thoughts 数组和 contexts 数组
    并且 两个数组均不为空

  场景: Thought 无匹配但 Context 有匹配
    假设 仅有 Context 匹配 "ops"，没有任何 Thought 匹配
    当 用户执行命令 "search all 'ops'"
    那么 thoughts 为空数组
    并且 contexts 包含匹配的 Context

  场景: Thought 有匹配但 Context 无匹配
    假设 仅有 Thought 匹配 "paradigm"，没有任何 Context 匹配
    当 用户执行命令 "search all 'paradigm'"
    那么 contexts 为空数组
    并且 thoughts 包含匹配的 Thought

  场景: 两者均无匹配
    假设 Thought 和 Context 都不匹配 "ZZZ_NO_MATCH"
    当 用户执行命令 "search all 'ZZZ_NO_MATCH'"
    那么 thoughts 为空数组
    并且 contexts 为空数组

  场景: search all 尊重 limit 与 offset
    假设 有 10 条 Thought 和 10 条 Context 匹配 "test"
    当 用户执行命令 "search all 'test' --limit 3 --offset 2"
    那么 thoughts 和 contexts 两个数组均最多包含 3 条，且从偏移量 2 开始

  场景: search all 默认限制
    假设 超过 20 条 Thought 和 20 条 Context 匹配 "a"
    当 用户执行命令 "search all 'a'"
    那么 thoughts 和 contexts 每个数组最多返回 20 条
