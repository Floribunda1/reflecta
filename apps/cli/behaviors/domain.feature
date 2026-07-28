# language: zh-CN
功能: 用户通过 CLI 组织和检查 Domain
  用户需要从脚本或 Agent 中创建领域层级、调整分类并检查某个领域内已经沉淀的 Understanding。

  背景:
    假设 测试知识库中存在多级嵌套的 Domain

  # domain list

  @CLI-DOMAIN-001
  场景: 列出所有 Domain
    假设 知识库中存在多层嵌套的 Domain
    当 用户执行命令 "domain list"
    那么 标准输出包含所有 Domain
    并且 同层 Domain 按用户设置的展示顺序排列
    并且 每个条目包含 id、name、parentId

  @CLI-DOMAIN-003
  场景: 空 Domain 列表
    假设 测试知识库刚初始化，尚未创建任何 Domain
    当 用户执行命令 "domain list"
    那么 标准输出为空

  # domain inspect

  @CLI-DOMAIN-004
  场景: 检查包含 Understanding 的 Domain
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其下关联了 5 条活跃 Understanding
    当 用户执行命令 "domain inspect DOMAIN_ID"
    那么 标准输出包含：
      | 字段       | 说明                               |
      | domain   | Domain 对象本身                  |
      | domains | 系统中全部 Domain 数组           |
      | understandings   | 包含 5 个 Understanding 节点的数组       |
      | page       | 分页信息，hasMore 为 false         |

  @CLI-DOMAIN-005
  场景: 检查没有 Understanding 的 Domain
    假设 测试知识库中存在一条 Domain EMPTY_DOMAIN_ID，其下没有任何 Understanding
    当 用户执行命令 "domain inspect EMPTY_DOMAIN_ID"
    那么 understandings 为空数组

  @CLI-DOMAIN-006
  场景: 检查时包含后代 Domain 的 Understanding
    假设 测试知识库中存在父 Domain PARENT_ID，其下直接关联了 2 条 Understanding；同时其子 Domain 下关联了 3 条 Understanding
    当 用户执行命令 "domain inspect PARENT_ID"
    那么 understandings 包含全部 5 条 Understanding

  @CLI-DOMAIN-007
  场景: 检查时使用分页限制
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其下关联了 10 条 Understanding
    当 用户执行命令 "domain inspect DOMAIN_ID --limit 5"
    那么 understandings 中恰好有 5 条 Understanding
    并且 page.hasMore 为 true

  @CLI-DOMAIN-008
  场景: 检查时使用分页偏移
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其下关联了 10 条 Understanding，按更新时间从新到旧排列
    当 用户执行命令 "domain inspect DOMAIN_ID --limit 5 --offset 5"
    那么 understandings 中的是第 6 到第 10 条 Understanding

  @CLI-DOMAIN-009
  场景: 检查时附带 Context
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其 Understanding 下带有 Context
    当 用户执行命令 "domain inspect DOMAIN_ID --include-contexts"
    那么 understandings 中每个节点都包含 contextIds 数组
    并且 响应顶层包含 contexts 数组，里面是完整的 Context 对象

  @CLI-DOMAIN-010
  场景: 检查时附带引用边
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其 Understanding 之间存在 wiki-link 引用关系
    当 用户执行命令 "domain inspect DOMAIN_ID --include-relations"
    那么 响应中包含 edges 数组，元素为 { from, to }
    并且 edges 数组已去重

  @CLI-DOMAIN-012
  场景: 检查时排除已删除的 Understanding
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其下关联了 3 条活跃 Understanding 和 1 条已删除 Understanding
    当 用户执行命令 "domain inspect DOMAIN_ID"
    那么 understandings 中仅包含 3 条活跃 Understanding

  @CLI-DOMAIN-013
  场景: 检查不存在的 Domain
    假设 测试知识库中不存在 ID MISSING_ID
    当 用户执行命令 "domain inspect MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  # domain create

  @CLI-DOMAIN-014
  场景: 创建根 Domain
    当 用户执行命令 "domain create --name 'New Domain' --yes"
    那么 标准输出包含名为 "New Domain" 的根 Domain
    并且 再次列出 Domain 时 "New Domain" 显示在其他根 Domain 之后

  @CLI-DOMAIN-015
  场景: 创建子 Domain
    假设 测试知识库中存在一条 Domain，其 ID 为 PARENT_ID
    当 用户执行命令 "domain create --name 'Child' --parent-id PARENT_ID --yes"
    那么 标准输出包含名为 "Child" 的 Domain，其 parentId 为 PARENT_ID
    并且 再次列出 Domain 时 "Child" 显示在 PARENT_ID 的已有子 Domain 之后

  @CLI-DOMAIN-016
  场景: 缺少必填参数 --name
    当 用户执行命令 "domain create --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --name

  @CLI-DOMAIN-017
  场景: 未加 --yes 时拒绝创建
    当 用户执行命令 "domain create --name 'X'"
    那么 命令退出码应为 3

  # domain update

  @CLI-DOMAIN-018
  场景: 重命名子 Domain 并保留原来的父级
    假设 测试知识库中存在父 Domain PARENT_ID
    并且 PARENT_ID 下存在一条名为 "Old Name" 的子 Domain DOMAIN_ID
    当 用户执行命令 "domain update DOMAIN_ID --name 'New Name' --yes"
    那么 标准输出中的 Domain 名称应为 "New Name"
    并且 标准输出中的 parentId 仍为 PARENT_ID
    并且 再次列出 Domain 时应该显示 "New Name"

  @CLI-DOMAIN-019
  场景: 移动 Domain 到新的父节点
    假设 测试知识库中存在 Domain DOMAIN_ID 和 NEW_PARENT_ID
    当 用户执行命令 "domain update DOMAIN_ID --parent-id NEW_PARENT_ID --yes"
    那么 标准输出中的 parentId 应为 NEW_PARENT_ID

  @CLI-DOMAIN-020
  场景: 将 Domain 移动到根节点
    假设 测试知识库中存在一条子 Domain，其 ID 为 CHILD_ID
    当 用户执行命令 "domain update CHILD_ID --parent-id '' --yes"
    那么 标准输出中的 parentId 应为 null
    并且 再次列出 Domain 时 CHILD_ID 应显示为根 Domain

  @CLI-DOMAIN-021
  场景: 更新不存在的 Domain
    假设 测试知识库中不存在 ID MISSING_ID
    当 用户执行命令 "domain update MISSING_ID --name 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-DOMAIN-022
  场景: 未加 --yes 时拒绝更新
    假设 测试知识库中存在一条 Domain，其 ID 为 DOMAIN_ID
    当 用户执行命令 "domain update DOMAIN_ID --name 'X'"
    那么 命令退出码应为 3

  @CLI-DOMAIN-028
  场景: 防止把父 Domain 移动到自己的后代下面
    假设 测试知识库中存在父 Domain PARENT_ID 及其子 Domain CHILD_ID
    当 用户执行命令 "domain update PARENT_ID --parent-id CHILD_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应该说明该移动会形成无效层级
    并且 再次列出 Domain 时 PARENT_ID 仍为根 Domain，CHILD_ID 仍属于 PARENT_ID

  # domain delete

  @CLI-DOMAIN-023
  场景: 不使用级联删除 Domain
    假设 存在一条 Domain DOMAIN_ID，其下有关联 Understanding UNDERSTANDING_ID
    并且 UNDERSTANDING_ID 只关联到 DOMAIN_ID
    当 用户执行命令 "domain delete DOMAIN_ID --yes"
    那么 再次列出 Domain 时应该得到删除前除 DOMAIN_ID 外的 Domain 集合
    并且 查看 UNDERSTANDING_ID 时仍能得到这条 Understanding
    并且 该 Understanding 的 Domain 列表应该为空

  @CLI-DOMAIN-024
  场景: 使用级联删除 Domain
    假设 测试知识库中存在一条 Domain DOMAIN_ID，其下关联了 2 条 Understanding
    当 用户执行命令 "domain delete DOMAIN_ID --yes --cascade"
    那么 再次列出 Domain 时应该得到删除前除 DOMAIN_ID 外的 Domain 集合
    并且 查看这 2 条 Understanding 时都应该返回 NOT_FOUND
    并且 搜索这些 Understanding 的唯一内容时应该只显示当前仍可用的知识库对象

  @CLI-DOMAIN-025
  场景: 删除带有子 Domain 的父节点
    假设 测试知识库中存在父 Domain PARENT_ID，其下包含子 Domain
    当 用户执行命令 "domain delete PARENT_ID --yes"
    那么 再次列出 Domain 时应该得到删除前除 PARENT_ID 外的 Domain 集合
    并且 原来的子 Domain 应该显示为根 Domain

  @CLI-DOMAIN-026
  场景: 删除不存在的 Domain
    假设 测试知识库中不存在 ID MISSING_ID
    当 用户执行命令 "domain delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  @CLI-DOMAIN-027
  场景: 未加 --yes 时拒绝删除
    假设 测试知识库中存在一条 Domain，其 ID 为 DOMAIN_ID
    当 用户执行命令 "domain delete DOMAIN_ID"
    那么 命令退出码应为 3
