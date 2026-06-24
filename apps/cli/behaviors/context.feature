# language: zh-CN
功能: Context 管理

  背景:
    假设 数据库已初始化并包含 Understanding 与 Context

  # context list

  @CLI-CONTEXT-001
  场景: 列出某 Understanding 下的所有活跃 Context
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其下有 3 个活跃 Context
    当 用户执行命令 "context list --understanding-id UNDERSTANDING_ID"
    那么 标准输出包含 3 个 Context 对象
    并且 每个对象包含 id、understandingId、medium、title、content
    并且 Context 按 created_at 降序排列

  @CLI-CONTEXT-002
  场景: Understanding 下没有任何 Context
    假设 存在一条活跃 Understanding EMPTY_UNDERSTANDING_ID，其下没有任何 Context
    当 用户执行命令 "context list --understanding-id EMPTY_UNDERSTANDING_ID"
    那么 标准输出为空

  @CLI-CONTEXT-003
  场景: 排除已软删除的 Context
    假设 存在一条活跃 Understanding UNDERSTANDING_ID，其下有 2 个活跃 Context 和 1 个已删除 Context
    当 用户执行命令 "context list --understanding-id UNDERSTANDING_ID"
    那么 标准输出仅包含 2 个活跃 Context

  @CLI-CONTEXT-004
  场景: 缺少必填参数 --understanding-id
    当 用户执行命令 "context list"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 VALIDATION_ERROR

  @CLI-CONTEXT-005
  场景: 对不存在的 Understanding 列出 Context
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "context list --understanding-id MISSING_ID"
    那么 标准输出为空

  # context get

  @CLI-CONTEXT-006
  场景: 查看一条活跃 Context
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context get CONTEXT_ID"
    那么 标准输出包含该 Context 的全部字段

  @CLI-CONTEXT-007
  场景: 查看已软删除的 Context
    假设 存在一条已软删除的 Context，其 ID 为 DELETED_CONTEXT_ID
    当 用户执行命令 "context get DELETED_CONTEXT_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-CONTEXT-008
  场景: 查看不存在的 Context
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "context get MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  # context create

  @CLI-CONTEXT-009
  场景: 创建最简 Context
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "context create --understanding-id UNDERSTANDING_ID --medium other --yes"
    那么 数据库中新增一条 Context，其 understandingId 为 UNDERSTANDING_ID，medium 为 "other"
    并且 title 为 null
    并且 content 为 ""

  @CLI-CONTEXT-010
  场景: 创建完整的 Context
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "context create --understanding-id UNDERSTANDING_ID --medium article --title 'Blog Post' --content 'Important context' --yes"
    那么 数据库中新增一条 Context，所有字段与输入一致

  @CLI-CONTEXT-011
  场景: 创建 Context 后可被搜索到
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "context create --understanding-id UNDERSTANDING_ID --medium experience --content 'UNIQUE_CONTEXT_TEXT' --yes"
    那么 使用 "UNIQUE_CONTEXT_TEXT" 搜索 context 可返回该新 Context

  @CLI-CONTEXT-012
  场景: 缺少必填参数 --understanding-id
    当 用户执行命令 "context create --medium other --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --understanding-id

  @CLI-CONTEXT-013
  场景: 缺少必填参数 --medium
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "context create --understanding-id UNDERSTANDING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --medium

  @CLI-CONTEXT-014
  场景: 未加 --yes 时拒绝创建
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "context create --understanding-id UNDERSTANDING_ID --medium other"
    那么 命令退出码应为 3
    并且 数据库中未新增任何 Context

  @CLI-CONTEXT-015
  场景: 为不存在的 Understanding 创建 Context
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "context create --understanding-id MISSING_ID --medium other --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含外键约束或 NOT_FOUND 错误

  # context update

  @CLI-CONTEXT-016
  场景: 更新 Context 内容
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context update CONTEXT_ID --content 'Updated content' --yes"
    那么 该 Context 的 content 被更新
    并且 标准输出包含更新后的 Context 详情

  @CLI-CONTEXT-017
  场景: 更新 Context 标题
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context update CONTEXT_ID --title 'New Context' --yes"
    那么 该 Context 的 title 被更新

  @CLI-CONTEXT-018
  场景: 更新 Context medium
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context update CONTEXT_ID --medium video --yes"
    那么 该 Context 的 medium 被更新

  @CLI-CONTEXT-019
  场景: 更新内容后搜索结果同步变化
    假设 存在一条活跃 Context CONTEXT_ID，其内容为 "OLD_TEXT"
    当 用户执行命令 "context update CONTEXT_ID --content 'NEW_TEXT' --yes"
    那么 搜索 "OLD_TEXT" 不再返回该 Context
    并且 搜索 "NEW_TEXT" 可返回该 Context

  @CLI-CONTEXT-020
  场景: 部分更新保留未更改字段
    假设 存在一条活跃 Context CONTEXT_ID，其 title 为 "Old Name"，content 为 "Old Content"
    当 用户执行命令 "context update CONTEXT_ID --content 'New Content' --yes"
    那么 content 已更新
    并且 title 仍为 "Old Name"

  @CLI-CONTEXT-021
  场景: 更新不存在的 Context
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "context update MISSING_ID --content 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-CONTEXT-022
  场景: 未加 --yes 时拒绝更新
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context update CONTEXT_ID --content 'X'"
    那么 命令退出码应为 3

  # context delete

  @CLI-CONTEXT-023
  场景: 软删除 Context
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context delete CONTEXT_ID --yes"
    那么 该 Context 的 deleted_at 被设置
    并且 该 Context 不再出现在 context list 的结果中
    并且 该 Context 不再出现在搜索结果中

  @CLI-CONTEXT-024
  场景: 删除 Context 后不再出现在搜索结果中
    假设 存在一条活跃 Context CONTEXT_ID，其内容为 "DELETE_ME_KEYWORD"
    当 用户执行命令 "context delete CONTEXT_ID --yes"
    那么 搜索 "DELETE_ME_KEYWORD" 不再返回该 Context

  @CLI-CONTEXT-025
  场景: 删除不存在的 Context
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "context delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-CONTEXT-026
  场景: 未加 --yes 时拒绝删除
    假设 存在一条活跃 Context，其 ID 为 CONTEXT_ID
    当 用户执行命令 "context delete CONTEXT_ID"
    那么 命令退出码应为 3
