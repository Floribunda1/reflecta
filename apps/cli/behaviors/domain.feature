功能: Domain 管理

  背景:
    假设 数据库已初始化并包含多级嵌套的 Domain

  # domain list

  场景: 列出所有 Domain
    假设 数据库中存在多层嵌套的 Domain
    当 用户执行命令 "domain list"
    那么 标准输出包含所有 Domain
    并且 Domain 按 sort_order 升序排列
    并且 每个条目包含 id、name、parentId

  场景: 列表同时包含根节点与叶子节点
    假设 数据库中存在深度为 0、1、2 的 Domain
    当 用户执行命令 "domain list"
    那么 所有深度层级均在输出中有所体现

  场景: 空 Domain 列表
    假设 数据库刚初始化，尚未创建任何 Domain
    当 用户执行命令 "domain list"
    那么 标准输出为空

  # domain inspect

  场景: 检查包含 Understanding 的 Domain
    假设 数据库中存在一条 Domain DOMAIN_ID，其下关联了 5 条活跃 Understanding
    当 用户执行命令 "domain inspect DOMAIN_ID"
    那么 标准输出包含：
      | 字段       | 说明                               |
      | domain   | Domain 对象本身                  |
      | domains | 系统中全部 Domain 数组           |
      | understandings   | 包含 5 个 Understanding 节点的数组       |
      | page       | 分页信息，hasMore 为 false         |

  场景: 检查没有 Understanding 的 Domain
    假设 数据库中存在一条 Domain EMPTY_DOMAIN_ID，其下没有任何 Understanding
    当 用户执行命令 "domain inspect EMPTY_DOMAIN_ID"
    那么 understandings 为空数组

  场景: 检查时包含后代 Domain 的 Understanding
    假设 数据库中存在父 Domain PARENT_ID，其下直接关联了 2 条 Understanding；同时其子 Domain 下关联了 3 条 Understanding
    当 用户执行命令 "domain inspect PARENT_ID"
    那么 understandings 包含全部 5 条 Understanding

  场景: 检查时使用分页限制
    假设 数据库中存在一条 Domain DOMAIN_ID，其下关联了 10 条 Understanding
    当 用户执行命令 "domain inspect DOMAIN_ID --limit 5"
    那么 understandings 中恰好有 5 条 Understanding
    并且 page.hasMore 为 true

  场景: 检查时使用分页偏移
    假设 数据库中存在一条 Domain DOMAIN_ID，其下关联了 10 条 Understanding，按 updated_at 排序
    当 用户执行命令 "domain inspect DOMAIN_ID --limit 5 --offset 5"
    那么 understandings 中的是第 6 到第 10 条 Understanding

  场景: 检查时附带 Context
    假设 数据库中存在一条 Domain DOMAIN_ID，其 Understanding 下带有 Context
    当 用户执行命令 "domain inspect DOMAIN_ID --include-contexts"
    那么 understandings 中每个节点都包含 contextIds 数组
    并且 响应顶层包含 contexts 数组，里面是完整的 Context 对象

  场景: 检查时附带引用边
    假设 数据库中存在一条 Domain DOMAIN_ID，其 Understanding 之间存在 wiki-link 引用关系
    当 用户执行命令 "domain inspect DOMAIN_ID --include-relations"
    那么 响应中包含 edges 数组，元素为 { from, to }
    并且 edges 数组已去重

  场景: 检查时同时附带 Context 和引用边
    假设 数据库中存在一条 Domain DOMAIN_ID，其 Understanding 既有 Context 又互相引用
    当 用户执行命令 "domain inspect DOMAIN_ID --include-contexts --include-relations"
    那么 响应中同时包含 contexts 和 edges

  场景: 检查时排除已删除的 Understanding
    假设 数据库中存在一条 Domain DOMAIN_ID，其下关联了 3 条活跃 Understanding 和 1 条已删除 Understanding
    当 用户执行命令 "domain inspect DOMAIN_ID"
    那么 understandings 中仅包含 3 条活跃 Understanding

  场景: 检查不存在的 Domain
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "domain inspect MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  # domain create

  场景: 创建根 Domain
    当 用户执行命令 "domain create --name 'New Domain' --yes"
    那么 数据库中新增一条 Domain，name 为 "New Domain"
    并且 parentId 为 null
    并且 sort_order 为根层级下一个可用值

  场景: 创建子 Domain
    假设 数据库中存在一条 Domain，其 ID 为 PARENT_ID
    当 用户执行命令 "domain create --name 'Child' --parent-id PARENT_ID --yes"
    那么 数据库中新增一条 Domain，parentId 为 PARENT_ID
    并且 sort_order 为该父节点下的下一个可用值

  场景: 缺少必填参数 --name
    当 用户执行命令 "domain create --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --name

  场景: 未加 --yes 时拒绝创建
    当 用户执行命令 "domain create --name 'X'"
    那么 命令退出码应为 3

  # domain update

  场景: 重命名 Domain
    假设 数据库中存在一条名为 "Old Name" 的 Domain，其 ID 为 DOMAIN_ID
    当 用户执行命令 "domain update DOMAIN_ID --name 'New Name' --yes"
    那么 该 Domain 的 name 变为 "New Name"

  场景: 移动 Domain 到新的父节点
    假设 数据库中存在 Domain DOMAIN_ID 和 NEW_PARENT_ID
    当 用户执行命令 "domain update DOMAIN_ID --parent-id NEW_PARENT_ID --yes"
    那么 该 Domain 的 parentId 变为 NEW_PARENT_ID

  场景: 将 Domain 移动到根节点
    假设 数据库中存在一条子 Domain，其 ID 为 CHILD_ID
    当 用户执行命令 "domain update CHILD_ID --parent-id '' --yes"
    那么 该 Domain 的 parentId 变为 null

  场景: 更新不存在的 Domain
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "domain update MISSING_ID --name 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 未加 --yes 时拒绝更新
    假设 数据库中存在一条 Domain，其 ID 为 DOMAIN_ID
    当 用户执行命令 "domain update DOMAIN_ID --name 'X'"
    那么 命令退出码应为 3

  # domain delete

  场景: 不使用级联删除 Domain
    假设 数据库中存在一条 Domain DOMAIN_ID，其下有关联 Understanding
    当 用户执行命令 "domain delete DOMAIN_ID --yes"
    那么 该 Domain 被删除
    并且 关联的 Understanding 仍保留在数据库中
    并且 understanding_categories 中的关联记录已被级联删除

  场景: 使用级联删除 Domain
    假设 数据库中存在一条 Domain DOMAIN_ID，其下关联了 2 条 Understanding
    当 用户执行命令 "domain delete DOMAIN_ID --yes --cascade"
    那么 该 Domain 被删除
    并且 关联的 2 条 Understanding 被永久删除
    并且 这些 Understanding 的 Context 和 FTS 记录也被移除

  场景: 删除带有子 Domain 的父节点
    假设 数据库中存在父 Domain PARENT_ID，其下包含子 Domain
    当 用户执行命令 "domain delete PARENT_ID --yes"
    那么 父 Domain 被删除
    并且 子 Domain 的 parent_id 变为 NULL（ON DELETE SET NULL）

  场景: 删除不存在的 Domain
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "domain delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 未加 --yes 时拒绝删除
    假设 数据库中存在一条 Domain，其 ID 为 DOMAIN_ID
    当 用户执行命令 "domain delete DOMAIN_ID"
    那么 命令退出码应为 3
