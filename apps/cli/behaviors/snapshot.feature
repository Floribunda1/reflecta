功能: 项目快照

  背景:
    假设 数据库已初始化并包含 Category、Thought、Context 和 Connection

  # snapshot project

  场景: 正常项目快照
    假设 数据库中存在 Category、Thought、Context 和 Connection
    当 用户执行命令 "snapshot project"
    那么 标准输出为一个 JSON 对象，包含以下字段：
      | 字段            | 类型   | 说明                                      |
      | categories      | 数组   | 每个元素为 { id, name, thoughtCount }，按 sort_order 排列 |
      | recentThoughts  | 数组   | 最多 10 条最近更新的活跃 Thought          |
      | stats           | 对象   | 包含 totalThoughts、totalContexts、totalCategories、totalReferences |

  场景: Category 的 Thought 计数
    假设 数据库中存在 Category CAT_A，其下关联了 3 条 Thought；存在 Category CAT_B，其下未关联任何 Thought
    当 用户执行命令 "snapshot project"
    那么 categories 中 CAT_A 的 thoughtCount 为 3
    并且 CAT_B 的 thoughtCount 为 0

  场景: Category 计数排除已删除的 Thought
    假设 数据库中存在 Category CAT_ID，其下关联了 2 条活跃 Thought 和 1 条已删除 Thought
    当 用户执行命令 "snapshot project"
    那么 CAT_ID 的 thoughtCount 为 2

  场景: 最近更新 Thought 的排序
    假设 数据库中存在多条 Thought，其 updated_at 依次为 T1 < T2 < T3 < … < T15
    当 用户执行命令 "snapshot project"
    那么 recentThoughts 包含 updated_at 最新的 10 条 Thought，按降序排列

  场景: 最近更新列表排除已删除 Thought
    假设 数据库中 updated_at 最新的 Thought 已被软删除
    当 用户执行命令 "snapshot project"
    那么 该已删除 Thought 不出现在 recentThoughts 中

  场景: 统计仅计入活跃 Thought
    假设 数据库中共有 50 条活跃 Thought 和 5 条已删除 Thought
    当 用户执行命令 "snapshot project"
    那么 stats.totalThoughts 为 50

  场景: 统计仅计入活跃 Context
    假设 数据库中共有 30 条活跃 Context 和 3 条已删除 Context
    当 用户执行命令 "snapshot project"
    那么 stats.totalContexts 为 30

  场景: 统计计入全部 Category
    假设 数据库中共有 20 条 Category（包含根节点和嵌套节点）
    当 用户执行命令 "snapshot project"
    那么 stats.totalCategories 为 20

  场景: 统计计入全部连接
    假设 数据库中共有 100 条 thought_connections
    当 用户执行命令 "snapshot project"
    那么 stats.totalReferences 为 100

  场景: 空项目快照
    假设 数据库刚初始化，尚未插入任何用户数据
    当 用户执行命令 "snapshot project"
    那么 categories 为空数组
    并且 recentThoughts 为空数组
    并且 stats.totalThoughts 为 0
    并且 stats.totalContexts 为 0
    并且 stats.totalCategories 为 0
    并且 stats.totalReferences 为 0
