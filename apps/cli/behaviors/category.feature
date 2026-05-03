功能: Category 管理

  背景:
    假设 数据库已初始化并包含多级嵌套的 Category

  # category list

  场景: 列出所有 Category
    假设 数据库中存在多层嵌套的 Category
    当 用户执行命令 "category list"
    那么 标准输出包含所有 Category
    并且 Category 按 sort_order 升序排列
    并且 每个条目包含 id、name、parentId

  场景: 列表同时包含根节点与叶子节点
    假设 数据库中存在深度为 0、1、2 的 Category
    当 用户执行命令 "category list"
    那么 所有深度层级均在输出中有所体现

  场景: 空 Category 列表
    假设 数据库刚初始化，尚未创建任何 Category
    当 用户执行命令 "category list"
    那么 标准输出为空

  # category get

  场景: 获取已存在的 Category
    假设 数据库中存在一条 Category，其 ID 为 CATEGORY_ID
    当 用户执行命令 "category get CATEGORY_ID"
    那么 标准输出包含该 Category 的 id、name、parentId

  场景: 获取不存在的 Category
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "category get MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  # category inspect

  场景: 检查包含 Thought 的 Category
    假设 数据库中存在一条 Category CATEGORY_ID，其下关联了 5 条活跃 Thought
    当 用户执行命令 "category inspect CATEGORY_ID"
    那么 标准输出包含：
      | 字段       | 说明                               |
      | category   | Category 对象本身                  |
      | categories | 系统中全部 Category 数组           |
      | thoughts   | 包含 5 个 Thought 节点的数组       |
      | page       | 分页信息，hasMore 为 false         |

  场景: 检查没有 Thought 的 Category
    假设 数据库中存在一条 Category EMPTY_CAT_ID，其下没有任何 Thought
    当 用户执行命令 "category inspect EMPTY_CAT_ID"
    那么 thoughts 为空数组

  场景: 检查时包含后代 Category 的 Thought
    假设 数据库中存在父 Category PARENT_ID，其下直接关联了 2 条 Thought；同时其子 Category 下关联了 3 条 Thought
    当 用户执行命令 "category inspect PARENT_ID"
    那么 thoughts 包含全部 5 条 Thought

  场景: 检查时使用分页限制
    假设 数据库中存在一条 Category CATEGORY_ID，其下关联了 10 条 Thought
    当 用户执行命令 "category inspect CATEGORY_ID --limit 5"
    那么 thoughts 中恰好有 5 条 Thought
    并且 page.hasMore 为 true

  场景: 检查时使用分页偏移
    假设 数据库中存在一条 Category CATEGORY_ID，其下关联了 10 条 Thought，按 updated_at 排序
    当 用户执行命令 "category inspect CATEGORY_ID --limit 5 --offset 5"
    那么 thoughts 中的是第 6 到第 10 条 Thought

  场景: 检查时附带 Context
    假设 数据库中存在一条 Category CATEGORY_ID，其 Thought 下带有 Context
    当 用户执行命令 "category inspect CATEGORY_ID --include-contexts"
    那么 thoughts 中每个节点都包含 contextIds 数组
    并且 响应顶层包含 contexts 数组，里面是完整的 Context 对象

  场景: 检查时附带引用边
    假设 数据库中存在一条 Category CATEGORY_ID，其 Thought 之间存在 wiki-link 引用关系
    当 用户执行命令 "category inspect CATEGORY_ID --include-edges"
    那么 响应中包含 edges 数组，元素为 { from, to }
    并且 edges 数组已去重

  场景: 检查时同时附带 Context 和引用边
    假设 数据库中存在一条 Category CATEGORY_ID，其 Thought 既有 Context 又互相引用
    当 用户执行命令 "category inspect CATEGORY_ID --include-contexts --include-edges"
    那么 响应中同时包含 contexts 和 edges

  场景: 检查时排除已删除的 Thought
    假设 数据库中存在一条 Category CATEGORY_ID，其下关联了 3 条活跃 Thought 和 1 条已删除 Thought
    当 用户执行命令 "category inspect CATEGORY_ID"
    那么 thoughts 中仅包含 3 条活跃 Thought

  场景: 检查不存在的 Category
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "category inspect MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  # category create

  场景: 创建根 Category
    当 用户执行命令 "category create --name 'New Category' --yes"
    那么 数据库中新增一条 Category，name 为 "New Category"
    并且 parentId 为 null
    并且 sort_order 为根层级下一个可用值

  场景: 创建子 Category
    假设 数据库中存在一条 Category，其 ID 为 PARENT_ID
    当 用户执行命令 "category create --name 'Child' --parent-id PARENT_ID --yes"
    那么 数据库中新增一条 Category，parentId 为 PARENT_ID
    并且 sort_order 为该父节点下的下一个可用值

  场景: 缺少必填参数 --name
    当 用户执行命令 "category create --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --name

  场景: 未加 --yes 时拒绝创建
    当 用户执行命令 "category create --name 'X'"
    那么 命令退出码应为 3

  # category update

  场景: 重命名 Category
    假设 数据库中存在一条名为 "Old Name" 的 Category，其 ID 为 CATEGORY_ID
    当 用户执行命令 "category update CATEGORY_ID --name 'New Name' --yes"
    那么 该 Category 的 name 变为 "New Name"

  场景: 移动 Category 到新的父节点
    假设 数据库中存在 Category CATEGORY_ID 和 NEW_PARENT_ID
    当 用户执行命令 "category update CATEGORY_ID --parent-id NEW_PARENT_ID --yes"
    那么 该 Category 的 parentId 变为 NEW_PARENT_ID

  场景: 将 Category 移动到根节点
    假设 数据库中存在一条子 Category，其 ID 为 CHILD_ID
    当 用户执行命令 "category update CHILD_ID --parent-id '' --yes"
    那么 该 Category 的 parentId 变为 null

  场景: 更新不存在的 Category
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "category update MISSING_ID --name 'X' --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 未加 --yes 时拒绝更新
    假设 数据库中存在一条 Category，其 ID 为 CATEGORY_ID
    当 用户执行命令 "category update CATEGORY_ID --name 'X'"
    那么 命令退出码应为 3

  # category delete

  场景: 不使用级联删除 Category
    假设 数据库中存在一条 Category CATEGORY_ID，其下有关联 Thought
    当 用户执行命令 "category delete CATEGORY_ID --yes"
    那么 该 Category 被删除
    并且 关联的 Thought 仍保留在数据库中
    并且 thought_categories 中的关联记录已被级联删除

  场景: 使用级联删除 Category
    假设 数据库中存在一条 Category CATEGORY_ID，其下关联了 2 条 Thought
    当 用户执行命令 "category delete CATEGORY_ID --yes --cascade"
    那么 该 Category 被删除
    并且 关联的 2 条 Thought 被永久删除
    并且 这些 Thought 的 Context 和 FTS 记录也被移除

  场景: 删除带有子 Category 的父节点
    假设 数据库中存在父 Category PARENT_ID，其下包含子 Category
    当 用户执行命令 "category delete PARENT_ID --yes"
    那么 父 Category 被删除
    并且 子 Category 的 parent_id 变为 NULL（ON DELETE SET NULL）

  场景: 删除不存在的 Category
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "category delete MISSING_ID --yes"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 未加 --yes 时拒绝删除
    假设 数据库中存在一条 Category，其 ID 为 CATEGORY_ID
    当 用户执行命令 "category delete CATEGORY_ID"
    那么 命令退出码应为 3
