# language: zh-CN
功能: 用户通过 CLI 沉淀和维护 Understanding
  用户需要从脚本或 Agent 中查找、创建、修正和移除自己的理解，并确认 Context、Domain 和显式连接随内容变化保持一致。

  背景:
    假设 测试知识库中存在可操作的 Understanding、Domain 和 Context

  # understanding list

  @CLI-UNDERSTANDING-001
  场景: 列出所有活跃 Understanding
    假设 测试知识库中存在活跃 Understanding
    当 用户执行命令 "understanding list"
    那么 标准输出仅包含当前可用的 Understanding
    并且 最近更新的 Understanding 显示在最前面
    并且 每个 Understanding 摘要包含 id、title、body 和 domains

  @CLI-UNDERSTANDING-002
  场景: 按 Domain ID 过滤
    假设 存在一个活跃 Domain，其 ID 为 DOMAIN_ID，且该 Domain 下有关联 Understanding
    当 用户执行命令 "understanding list --domain-id DOMAIN_ID"
    那么 标准输出仅包含直接关联到 DOMAIN_ID 的 Understanding
    并且 所有返回的 Understanding 均为活跃状态

  @CLI-UNDERSTANDING-003
  场景: 按 Domain ID 过滤并包含后代 Domain
    假设 存在一个父 Domain PARENT_ID，其子 Domain 中包含 Understanding
    当 用户执行命令 "understanding list --domain-id PARENT_ID --include-descendants"
    那么 标准输出包含直接关联到 PARENT_ID 的 Understanding，以及关联到其任意后代 Domain 的 Understanding
    并且 所有返回的 Understanding 均为活跃状态

  @CLI-UNDERSTANDING-004
  场景: 对叶子 Domain 使用 --include-descendants
    假设 存在一个叶子 Domain LEAF_ID，其下没有子 Domain
    当 用户执行命令 "understanding list --domain-id LEAF_ID --include-descendants"
    那么 结果应与不带 --include-descendants 时一致

  @CLI-UNDERSTANDING-005
  场景: Domain 过滤下无匹配 Understanding
    假设 存在一个活跃 Domain EMPTY_DOMAIN_ID，且该 Domain 下没有任何 Understanding
    当 用户执行命令 "understanding list --domain-id EMPTY_DOMAIN_ID"
    那么 标准输出为空（零行）

  @CLI-UNDERSTANDING-006
  场景: 列出最近更新的 Understanding
    假设 测试知识库中存在更新时间各不相同的 Understanding
    当 用户执行命令 "understanding list --recent"
    那么 标准输出包含最近更新的 Understanding
    并且 默认限制为 20 条

  @CLI-UNDERSTANDING-007
  场景: --recent 不能与 --domain-id 同时使用
    当 用户执行命令 "understanding list --recent --domain-id DOMAIN_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应提示 --recent 不能与 --domain-id 组合使用

  @CLI-UNDERSTANDING-008
  场景: 限制返回数量
    假设 测试知识库中活跃 Understanding 数量超过 5
    当 用户执行命令 "understanding list --limit 5"
    那么 标准输出恰好包含 5 条 Understanding 摘要

  @CLI-UNDERSTANDING-009
  场景: 限制数量为 0
    假设 测试知识库中存在活跃 Understanding
    当 用户执行命令 "understanding list --limit 0"
    那么 标准输出为空

  # understanding get

  @CLI-UNDERSTANDING-012
  场景: 查看一条活跃 Understanding
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID"
    那么 标准输出包含 Understanding 详情，字段包括 id、title、body、domains、contextCount、referenceCount、referencedByCount

  @CLI-UNDERSTANDING-013
  场景: 查看不存在的 Understanding
    假设 测试知识库中不存在 ID MISSING_ID
    当 用户执行命令 "understanding get MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "NOT_FOUND"

  @CLI-UNDERSTANDING-014
  场景: 查看已删除的 Understanding
    假设 存在一条已删除的 Understanding，其 ID 为 DELETED_UNDERSTANDING_ID
    当 用户执行命令 "understanding get DELETED_UNDERSTANDING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "NOT_FOUND"

  @CLI-UNDERSTANDING-015
  场景: 附带 Context 列表
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，且该 Understanding 下有 3 个活跃 Context
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-contexts"
    那么 输出中包含 contexts 数组，长度为 3
    并且 每个 Context 对象包含 id、understandingId、medium、title 和 content

  @CLI-UNDERSTANDING-016
  场景: 附带 Context 但 Understanding 下无 Context
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，且该 Understanding 下没有 Context
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-contexts"
    那么 输出中包含 contexts: []

  @CLI-UNDERSTANDING-017
  场景: 附带双链关系
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其正文中的 wiki-link 指向了另外 2 条活跃 Understanding
    当 用户执行命令 "understanding get UNDERSTANDING_ID --include-relations"
    那么 输出中包含 relations 数组

  # understanding create

  @CLI-UNDERSTANDING-019
  场景: 创建最简 Understanding
    当 用户执行命令 "understanding create --yes"
    那么 标准输出包含一条新 Understanding
    并且 title 为 null
    并且 body 为 ""
    并且 domainIds 为空
    并且 使用返回的 ID 再次查看时应该得到相同内容

  @CLI-UNDERSTANDING-020
  场景: 创建完整的 Understanding
    假设 测试知识库中存在 Domain DOMAIN_A 和 DOMAIN_B
    当 用户执行命令 "understanding create --title 'My Title' --body 'My body' --domain-id DOMAIN_A,DOMAIN_B --yes"
    那么 标准输出中的标题和正文应与输入一致
    并且 标准输出中的 Domain 应该同时包含 DOMAIN_A 和 DOMAIN_B

  @CLI-UNDERSTANDING-021
  场景: 创建 Understanding 时自动解析 wiki-link 并建立连接
    假设 测试知识库中存在一条标题为 "Target Understanding" 的活跃 Understanding
    当 用户执行命令 "understanding create --body 'See [[Target Understanding]] for details' --yes"
    那么 标准输出包含新 Understanding
    当 用户使用返回的 ID 查看这条 Understanding 并附带关系
    那么 关系结果应该显示它引用了 "Target Understanding"

  @CLI-UNDERSTANDING-022
  场景: 未加 --yes 时拒绝创建
    当 用户执行命令 "understanding create --title Draft"
    那么 命令退出码应为 3
    并且 再次列出 Understanding 时结果保持不变

  # understanding update

  @CLI-UNDERSTANDING-023
  场景: 更新 Understanding 标题
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding update UNDERSTANDING_ID --title 'New Title' --yes"
    那么 标准输出中的标题应为 "New Title"
    并且 这条 Understanding 应该显示为最近更新

  @CLI-UNDERSTANDING-024
  场景: 更新正文并自动同步 wiki-link 连接
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，且测试知识库中存在标题为 "Linked Understanding" 的活跃 Understanding
    当 用户执行命令 "understanding update UNDERSTANDING_ID --body 'See [[Linked Understanding]]' --yes"
    那么 标准输出中的正文应为 'See [[Linked Understanding]]'
    并且 附带关系查看 UNDERSTANDING_ID 时应该显示它引用了 "Linked Understanding"

  @CLI-UNDERSTANDING-025
  场景: 更新正文时清除旧连接
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其已有 outgoing wiki-link 连接
    当 用户执行命令 "understanding update UNDERSTANDING_ID --body 'No more links' --yes"
    那么 附带关系查看 UNDERSTANDING_ID 时应该显示它没有引用其他 Understanding

  @CLI-UNDERSTANDING-026
  场景: 更新 Domain 关联
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，当前关联到 DOMAIN_A
    当 用户执行命令 "understanding update UNDERSTANDING_ID --domain-id DOMAIN_B,DOMAIN_C --yes"
    那么 标准输出中的 Domain 应该只包含 DOMAIN_B 和 DOMAIN_C
    并且 按 DOMAIN_A 过滤列表时应该只显示仍属于 DOMAIN_A 的 Understanding

  @CLI-UNDERSTANDING-027
  场景: 清空 Domain 关联
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，当前关联到若干 Domain
    当 用户执行命令 "understanding update UNDERSTANDING_ID --domain-id '' --yes"
    那么 标准输出中的 Domain 列表应为空

  @CLI-UNDERSTANDING-028
  场景: 更新不存在的 Understanding
    假设 测试知识库中不存在 ID MISSING_ID
    当 用户执行命令 "understanding update MISSING_ID --title 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-UNDERSTANDING-029
  场景: 部分更新保留未提及字段
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其 title 为 "Old Title"，body 为 "Old Body"
    当 用户执行命令 "understanding update UNDERSTANDING_ID --title 'New Title' --yes"
    那么 标准输出中的 title 应为 "New Title"
    并且 标准输出中的 body 应为 "Old Body"

  # understanding delete

  @CLI-UNDERSTANDING-030
  场景: 删除 Understanding 后相关入口反映最新知识状态
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其正文中包含关键词 "UNIQUE_KEYWORD"
    并且 该 Understanding 的 Context 内容包含关键词 "CTX_KEYWORD"
    当 用户执行命令 "understanding delete UNDERSTANDING_ID --yes"
    那么 命令退出码应为 0
    并且 再次查看 UNDERSTANDING_ID 时应该返回 NOT_FOUND
    并且 再次列出 Understanding 时应该只显示剩余内容
    并且 搜索 "UNIQUE_KEYWORD" 应该只显示当前仍可用的知识库对象
    并且 搜索 "CTX_KEYWORD" 应该只显示当前仍可用的知识库对象

  @CLI-UNDERSTANDING-033
  场景: 删除不存在的 Understanding
    假设 测试知识库中不存在 ID MISSING_ID
    当 用户执行命令 "understanding delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-UNDERSTANDING-034
  场景: 未加 --yes 时拒绝删除
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding delete UNDERSTANDING_ID"
    那么 命令退出码应为 3
    并且 再次查看 UNDERSTANDING_ID 时仍能得到这条 Understanding
