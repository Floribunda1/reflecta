功能: Thought 管理

  背景:
    假设 数据库已初始化并包含多种类型的 Thought、Category 和 Context

  # thought list

  场景: 列出所有活跃 Thought
    假设 数据库中存在活跃且类型混合的 Thought
    当 用户执行命令 "thought list"
    那么 标准输出仅包含未软删除的 Thought
    并且 Thought 按 updated_at 降序排列
    并且 每个 Thought 摘要包含 id、type、title、body 和 categories

  场景: 按类型 idea 过滤
    假设 数据库中同时存在 idea 和 insight 类型的 Thought
    当 用户执行命令 "thought list --type idea"
    那么 标准输出仅包含 type 为 "idea" 的 Thought
    并且 所有返回的 Thought 均为活跃状态

  场景: 按类型 insight 过滤
    假设 数据库中同时存在 idea 和 insight 类型的 Thought
    当 用户执行命令 "thought list --type insight"
    那么 标准输出仅包含 type 为 "insight" 的 Thought

  场景: 按 Category ID 过滤
    假设 存在一个活跃 Category，其 ID 为 CATEGORY_ID，且该 Category 下有关联 Thought
    当 用户执行命令 "thought list --category-id CATEGORY_ID"
    那么 标准输出仅包含直接关联到 CATEGORY_ID 的 Thought
    并且 所有返回的 Thought 均为活跃状态

  场景: 按 Category ID 过滤并包含后代 Category
    假设 存在一个父 Category PARENT_ID，其子 Category 中包含 Thought
    当 用户执行命令 "thought list --category-id PARENT_ID --include-descendants"
    那么 标准输出包含直接关联到 PARENT_ID 的 Thought，以及关联到其任意后代 Category 的 Thought
    并且 所有返回的 Thought 均为活跃状态

  场景: 对叶子 Category 使用 --include-descendants
    假设 存在一个叶子 Category LEAF_ID，其下没有子 Category
    当 用户执行命令 "thought list --category-id LEAF_ID --include-descendants"
    那么 结果应与不带 --include-descendants 时一致

  场景: Category 过滤下无匹配 Thought
    假设 存在一个活跃 Category EMPTY_CAT_ID，且该 Category 下没有任何 Thought
    当 用户执行命令 "thought list --category-id EMPTY_CAT_ID"
    那么 标准输出为空（零行）

  场景: 列出最近更新的 Thought
    假设 数据库中存在 updated_at 各不相同的 Thought
    当 用户执行命令 "thought list --recent"
    那么 标准输出包含最近更新的 Thought
    并且 默认限制为 20 条

  场景: --recent 不能与 --type 同时使用
    当 用户执行命令 "thought list --recent --type idea"
    那么 命令退出码应为 1
    并且 标准错误输出应提示 --recent 不能与 --type 组合使用

  场景: --recent 不能与 --category-id 同时使用
    当 用户执行命令 "thought list --recent --category-id CATEGORY_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应提示 --recent 不能与 --category-id 组合使用

  场景: 限制返回数量
    假设 数据库中活跃 Thought 数量超过 5
    当 用户执行命令 "thought list --limit 5"
    那么 标准输出恰好包含 5 条 Thought 摘要

  场景: 限制数量为 0
    假设 数据库中存在活跃 Thought
    当 用户执行命令 "thought list --limit 0"
    那么 标准输出为空

  场景: 软删除的 Thought 不会出现在列表中
    假设 存在一条软删除的 Thought，其 ID 为 DELETED_THOUGHT_ID
    当 用户执行命令 "thought list"
    那么 标准输出不包含 DELETED_THOUGHT_ID

  场景: 软删除的 Thought 不会出现在 Category 过滤结果中
    假设 存在一条软删除的 Thought，其关联到 Category CATEGORY_ID
    当 用户执行命令 "thought list --category-id CATEGORY_ID"
    那么 标准输出不包含该软删除的 Thought

  # thought get

  场景: 查看一条活跃 Thought
    假设 存在一条活跃 Thought，其 ID 为 THOUGHT_ID
    当 用户执行命令 "thought get THOUGHT_ID"
    那么 标准输出包含 Thought 详情，字段包括 id、type、title、body、categories、contextCount、referenceCount、referencedByCount

  场景: 查看不存在的 Thought
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "thought get MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "NOT_FOUND"

  场景: 查看已软删除的 Thought
    假设 存在一条软删除的 Thought，其 ID 为 DELETED_THOUGHT_ID
    当 用户执行命令 "thought get DELETED_THOUGHT_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "NOT_FOUND"

  场景: 附带 Context 列表
    假设 存在一条活跃 Thought THOUGHT_ID，且该 Thought 下有 3 个活跃 Context
    当 用户执行命令 "thought get THOUGHT_ID --include-contexts"
    那么 输出中包含 contexts 数组，长度为 3
    并且 每个 Context 对象包含 id、thoughtId、sourceType、sourceName 和 content

  场景: 附带 Context 但 Thought 下无 Context
    假设 存在一条活跃 Thought THOUGHT_ID，且该 Thought 下没有 Context
    当 用户执行命令 "thought get THOUGHT_ID --include-contexts"
    那么 输出中包含 contexts: []

  场景: 附带引用列表
    假设 存在一条活跃 Thought THOUGHT_ID，其正文中的 wiki-link 指向了另外 2 条活跃 Thought
    当 用户执行命令 "thought get THOUGHT_ID --include-references"
    那么 输出中包含 references 数组，长度为 2
    并且 数组中每个元素都是 Thought 摘要

  场景: 附带引用但无 outgoing wiki-link
    假设 存在一条活跃 Thought THOUGHT_ID，其正文中没有任何 wiki-link
    当 用户执行命令 "thought get THOUGHT_ID --include-references"
    那么 输出中包含 references: []

  场景: 附带被引用列表
    假设 存在一条活跃 Thought THOUGHT_ID，有另外 3 条活跃 Thought 的正文中通过 wiki-link 引用了它
    当 用户执行命令 "thought get THOUGHT_ID --include-referenced-bys"
    那么 输出中包含 referencedBys 数组，长度为 3
    并且 数组中每个元素都是 Thought 摘要

  场景: 被引用列表排除已删除的 Thought
    假设 存在一条活跃 Thought THOUGHT_ID，有一条已删除 Thought 通过 wiki-link 引用了它
    当 用户执行命令 "thought get THOUGHT_ID --include-referenced-bys"
    那么 referencedBys 中不包含该已删除 Thought

  场景: 同时附带 Context、引用和被引用
    假设 存在一条活跃 Thought THOUGHT_ID，它同时拥有 Context、 outgoing wiki-link 和 incoming wiki-link
    当 用户执行命令 "thought get THOUGHT_ID --include-contexts --include-references --include-referenced-bys"
    那么 输出中同时包含正确填充的 contexts、references 和 referencedBys 数组

  # thought create

  场景: 创建最简 Thought
    当 用户执行命令 "thought create --type idea --yes"
    那么 数据库中新增一条 Thought，其 type 为 "idea"
    并且 title 为 null
    并且 body 为 ""
    并且 categoryIds 为空
    并且 标准输出包含该 Thought 的详情

  场景: 创建完整的 Thought
    假设 数据库中存在 Category CAT_A 和 CAT_B
    当 用户执行命令 "thought create --type insight --title 'My Title' --body 'My body' --category-id CAT_A,CAT_B --yes"
    那么 数据库中新增一条 Thought，字段与输入一致
    并且 该 Thought 同时关联到 CAT_A 和 CAT_B

  场景: 创建 Thought 时自动解析 wiki-link 并建立连接
    假设 数据库中存在一条标题为 "Target Thought" 的活跃 Thought
    当 用户执行命令 "thought create --type idea --body 'See [[Target Thought]] for details' --yes"
    那么 数据库中新增一条 Thought
    并且 thought_connections 中存在一条从新 Thought 指向 "Target Thought" 的记录

  场景: 缺少必填参数 --type
    当 用户执行命令 "thought create --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 VALIDATION_ERROR，提示缺少 --type

  场景: 未加 --yes 时拒绝创建
    当 用户执行命令 "thought create --type idea"
    那么 命令退出码应为 3
    并且 数据库中未新增任何 Thought

  # thought update

  场景: 更新 Thought 标题
    假设 存在一条活跃 Thought，其 ID 为 THOUGHT_ID
    当 用户执行命令 "thought update THOUGHT_ID --title 'New Title' --yes"
    那么 该 Thought 的 title 变为 "New Title"
    并且 updated_at 被刷新
    并且 标准输出包含更新后的 Thought 详情

  场景: 更新正文并自动同步 wiki-link 连接
    假设 存在一条活跃 Thought THOUGHT_ID，且数据库中存在标题为 "Linked Thought" 的活跃 Thought
    当 用户执行命令 "thought update THOUGHT_ID --body 'See [[Linked Thought]]' --yes"
    那么 该 Thought 的 body 被更新
    并且 存在一条从 THOUGHT_ID 指向 "Linked Thought" 的连接

  场景: 更新正文时清除旧连接
    假设 存在一条活跃 Thought THOUGHT_ID，其已有 outgoing wiki-link 连接
    当 用户执行命令 "thought update THOUGHT_ID --body 'No more links' --yes"
    那么 该 Thought 之前的所有 outgoing 连接均被移除

  场景: 更新 Category 关联
    假设 存在一条活跃 Thought THOUGHT_ID，当前关联到 CAT_A
    当 用户执行命令 "thought update THOUGHT_ID --category-id CAT_B,CAT_C --yes"
    那么 该 Thought 仅关联到 CAT_B 和 CAT_C
    并且 与 CAT_A 的关联已被移除

  场景: 清空 Category 关联
    假设 存在一条活跃 Thought THOUGHT_ID，当前关联到若干 Category
    当 用户执行命令 "thought update THOUGHT_ID --category-id '' --yes"
    那么 该 Thought 不再关联任何 Category

  场景: 更新不存在的 Thought
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "thought update MISSING_ID --title 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 部分更新保留未提及字段
    假设 存在一条活跃 Thought THOUGHT_ID，其 title 为 "Old Title"，body 为 "Old Body"
    当 用户执行命令 "thought update THOUGHT_ID --title 'New Title' --yes"
    那么 title 已更新为 "New Title"
    并且 body 仍为 "Old Body"

  # thought delete

  场景: 软删除 Thought
    假设 存在一条活跃 Thought，其 ID 为 THOUGHT_ID
    当 用户执行命令 "thought delete THOUGHT_ID --yes"
    那么 该 Thought 的 deleted_at 被设为当前时间戳
    并且 该 Thought 不再出现在 thought list 的结果中
    并且 该 Thought 不再出现在搜索结果中
    并且 命令退出码应为 0

  场景: 删除 Thought 后将其从 FTS 索引中移除
    假设 存在一条活跃 Thought THOUGHT_ID，其正文中包含关键词 "UNIQUE_KEYWORD"
    当 用户执行命令 "thought delete THOUGHT_ID --yes"
    那么 搜索 "UNIQUE_KEYWORD" 不再返回 THOUGHT_ID

  场景: 删除 Thought 后将其 Context 从 FTS 索引中移除
    假设 存在一条活跃 Thought THOUGHT_ID，其 Context 内容包含 "CTX_KEYWORD"
    当 用户执行命令 "thought delete THOUGHT_ID --yes"
    那么 在 Context 中搜索 "CTX_KEYWORD" 不再返回这些 Context

  场景: 删除不存在的 Thought
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "thought delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 未加 --yes 时拒绝删除
    假设 存在一条活跃 Thought，其 ID 为 THOUGHT_ID
    当 用户执行命令 "thought delete THOUGHT_ID"
    那么 命令退出码应为 3
    并且 该 Thought 仍处于活跃状态
