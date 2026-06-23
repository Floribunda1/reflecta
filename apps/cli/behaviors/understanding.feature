功能: Understanding 管理

  背景:
    假设 数据库已初始化并包含 Understanding、Domain 和 Context

  # understanding list

  场景: 列出所有活跃 Understanding
    假设 数据库中存在活跃 Understanding
    当 用户执行命令 "understanding list"
    那么 标准输出仅包含未软删除的 Understanding
    并且 Understanding 按 updated_at 降序排列
    并且 每个 Understanding 摘要包含 id、title、body 和 domains

  场景: 按 Domain ID 过滤
    假设 存在一个活跃 Domain，其 ID 为 DOMAIN_ID，且该 Domain 下有关联 Understanding
    当 用户执行命令 "understanding list --domain-id DOMAIN_ID"
    那么 标准输出仅包含直接关联到 DOMAIN_ID 的 Understanding
    并且 所有返回的 Understanding 均为活跃状态

  场景: 按 Domain ID 过滤并包含后代 Domain
    假设 存在一个父 Domain PARENT_ID，其子 Domain 中包含 Understanding
    当 用户执行命令 "understanding list --domain-id PARENT_ID --include-descendants"
    那么 标准输出包含直接关联到 PARENT_ID 的 Understanding，以及关联到其任意后代 Domain 的 Understanding
    并且 所有返回的 Understanding 均为活跃状态

  场景: 对叶子 Domain 使用 --include-descendants
    假设 存在一个叶子 Domain LEAF_ID，其下没有子 Domain
    当 用户执行命令 "understanding list --domain-id LEAF_ID --include-descendants"
    那么 结果应与不带 --include-descendants 时一致

  场景: Domain 过滤下无匹配 Understanding
    假设 存在一个活跃 Domain EMPTY_DOMAIN_ID，且该 Domain 下没有任何 Understanding
    当 用户执行命令 "understanding list --domain-id EMPTY_DOMAIN_ID"
    那么 标准输出为空（零行）

  场景: 列出最近更新的 Understanding
    假设 数据库中存在 updated_at 各不相同的 Understanding
    当 用户执行命令 "understanding list --recent"
    那么 标准输出包含最近更新的 Understanding
    并且 默认限制为 20 条

  场景: --recent 不能与 --domain-id 同时使用
    当 用户执行命令 "understanding list --recent --domain-id DOMAIN_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应提示 --recent 不能与 --domain-id 组合使用

  场景: 限制返回数量
    假设 数据库中活跃 Understanding 数量超过 5
    当 用户执行命令 "understanding list --limit 5"
    那么 标准输出恰好包含 5 条 Understanding 摘要

  场景: 限制数量为 0
    假设 数据库中存在活跃 Understanding
    当 用户执行命令 "understanding list --limit 0"
    那么 标准输出为空

  场景: 软删除的 Understanding 不会出现在列表中
    假设 存在一条软删除的 Understanding，其 ID 为 DELETED_UNDERSTANDING_ID
    当 用户执行命令 "understanding list"
    那么 标准输出不包含 DELETED_UNDERSTANDING_ID

  场景: 软删除的 Understanding 不会出现在 Domain 过滤结果中
    假设 存在一条软删除的 Understanding，其关联到 Domain DOMAIN_ID
    当 用户执行命令 "understanding list --domain-id DOMAIN_ID"
    那么 标准输出不包含该软删除的 Understanding

  # understanding get

  场景: 查看一条活跃 Understanding
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID"
    那么 标准输出包含 Understanding 详情，字段包括 id、title、body、domains、contextCount、referenceCount、referencedByCount

  场景: 查看不存在的 Understanding
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "understanding get MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "NOT_FOUND"

  场景: 查看已软删除的 Understanding
    假设 存在一条软删除的 Understanding，其 ID 为 DELETED_UNDERSTANDING_ID
    当 用户执行命令 "understanding get DELETED_UNDERSTANDING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "NOT_FOUND"

  场景: 附带 Context 列表
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，且该 Understanding 下有 3 个活跃 Context
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-contexts"
    那么 输出中包含 contexts 数组，长度为 3
    并且 每个 Context 对象包含 id、understandingId、medium、title 和 content

  场景: 附带 Context 但 Understanding 下无 Context
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，且该 Understanding 下没有 Context
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-contexts"
    那么 输出中包含 contexts: []

  场景: 附带双链关系
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其正文中的 wiki-link 指向了另外 2 条活跃 Understanding
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-relations"
    那么 输出中包含 relations 数组

  场景: 同时附带 Context 和双链关系
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，它同时拥有 Context、 outgoing wiki-link 和 incoming wiki-link
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-contexts --include-relations"
    那么 输出中同时包含正确填充的 contexts 和 relations 数组

  # understanding create

  场景: 创建最简 Understanding
    当 用户执行命令 "understanding create --yes"
    那么 数据库中新增一条 Understanding
    并且 title 为 null
    并且 body 为 ""
    并且 domainIds 为空
    并且 标准输出包含该 Understanding 的详情

  场景: 创建完整的 Understanding
    假设 数据库中存在 Domain DOMAIN_A 和 DOMAIN_B
    当 用户执行命令 "understanding create --title 'My Title' --body 'My body' --domain-id DOMAIN_A,DOMAIN_B --yes"
    那么 数据库中新增一条 Understanding，字段与输入一致
    并且 该 Understanding 同时关联到 DOMAIN_A 和 DOMAIN_B

  场景: 创建 Understanding 时自动解析 wiki-link 并建立连接
    假设 数据库中存在一条标题为 "Target Understanding" 的活跃 Understanding
    当 用户执行命令 "understanding create --body 'See [[Target Understanding]] for details' --yes"
    那么 数据库中新增一条 Understanding
    并且 understanding_connections 中存在一条从新 Understanding 指向 "Target Understanding" 的记录

  场景: 未加 --yes 时拒绝创建
    当 用户执行命令 "understanding create --title Draft"
    那么 命令退出码应为 3
    并且 数据库中未新增任何 Understanding

  # understanding update

  场景: 更新 Understanding 标题
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding update UNDERSTANDING_ID --title 'New Title' --yes"
    那么 该 Understanding 的 title 变为 "New Title"
    并且 updated_at 被刷新
    并且 标准输出包含更新后的 Understanding 详情

  场景: 更新正文并自动同步 wiki-link 连接
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，且数据库中存在标题为 "Linked Understanding" 的活跃 Understanding
    当 用户执行命令 "understanding update UNDERSTANDING_ID --body 'See [[Linked Understanding]]' --yes"
    那么 该 Understanding 的 body 被更新
    并且 存在一条从 UNDERSTANDING_ID 指向 "Linked Understanding" 的连接

  场景: 更新正文时清除旧连接
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其已有 outgoing wiki-link 连接
    当 用户执行命令 "understanding update UNDERSTANDING_ID --body 'No more links' --yes"
    那么 该 Understanding 之前的所有 outgoing 连接均被移除

  场景: 更新 Domain 关联
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，当前关联到 DOMAIN_A
    当 用户执行命令 "understanding update UNDERSTANDING_ID --domain-id DOMAIN_B,DOMAIN_C --yes"
    那么 该 Understanding 仅关联到 DOMAIN_B 和 DOMAIN_C
    并且 与 DOMAIN_A 的关联已被移除

  场景: 清空 Domain 关联
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，当前关联到若干 Domain
    当 用户执行命令 "understanding update UNDERSTANDING_ID --domain-id '' --yes"
    那么 该 Understanding 不再关联任何 Domain

  场景: 更新不存在的 Understanding
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "understanding update MISSING_ID --title 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 部分更新保留未提及字段
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其 title 为 "Old Title"，body 为 "Old Body"
    当 用户执行命令 "understanding update UNDERSTANDING_ID --title 'New Title' --yes"
    那么 title 已更新为 "New Title"
    并且 body 仍为 "Old Body"

  # understanding delete

  场景: 软删除 Understanding
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding delete UNDERSTANDING_ID --yes"
    那么 该 Understanding 的 deleted_at 被设为当前时间戳
    并且 该 Understanding 不再出现在 understanding list 的结果中
    并且 该 Understanding 不再出现在搜索结果中
    并且 命令退出码应为 0

  场景: 删除 Understanding 后不再出现在搜索结果中
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其正文中包含关键词 "UNIQUE_KEYWORD"
    当 用户执行命令 "understanding delete UNDERSTANDING_ID --yes"
    那么 搜索 "UNIQUE_KEYWORD" 不再返回 UNDERSTANDING_ID

  场景: 删除 Understanding 后其 Context 不再出现在搜索结果中
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其 Context 内容包含 "CTX_KEYWORD"
    当 用户执行命令 "understanding delete UNDERSTANDING_ID --yes"
    那么 在 Context 中搜索 "CTX_KEYWORD" 不再返回这些 Context

  场景: 删除不存在的 Understanding
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "understanding delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 未加 --yes 时拒绝删除
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding delete UNDERSTANDING_ID"
    那么 命令退出码应为 3
    并且 该 Understanding 仍处于活跃状态
