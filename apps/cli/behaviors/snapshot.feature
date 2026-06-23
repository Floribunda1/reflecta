功能: 项目快照

  背景:
    假设 数据库已初始化并包含 Domain、Understanding、Context 和 Connection

  # snapshot project

  场景: 正常项目快照
    假设 数据库中存在 Domain、Understanding、Context 和 Connection
    当 用户执行命令 "snapshot project"
    那么 标准输出为一个 JSON 对象，包含以下字段：
      | 字段            | 类型   | 说明                                      |
      | domains      | 数组   | 每个元素为 { id, name, understandingCount }，按 sort_order 排列 |
      | recentUnderstandings  | 数组   | 最多 10 条最近更新的活跃 Understanding          |
      | stats           | 对象   | 包含 totalUnderstandings、totalContexts、totalDomains、totalReferences |

  场景: Domain 的 Understanding 计数
    假设 数据库中存在 Domain DOMAIN_A，其下关联了 3 条 Understanding；存在 Domain DOMAIN_B，其下未关联任何 Understanding
    当 用户执行命令 "snapshot project"
    那么 domains 中 DOMAIN_A 的 understandingCount 为 3
    并且 DOMAIN_B 的 understandingCount 为 0

  场景: Domain 计数排除已删除的 Understanding
    假设 数据库中存在 Domain DOMAIN_ID，其下关联了 2 条活跃 Understanding 和 1 条已删除 Understanding
    当 用户执行命令 "snapshot project"
    那么 DOMAIN_ID 的 understandingCount 为 2

  场景: 最近更新 Understanding 的排序
    假设 数据库中存在多条 Understanding，其 updated_at 依次为 T1 < T2 < T3 < … < T15
    当 用户执行命令 "snapshot project"
    那么 recentUnderstandings 包含 updated_at 最新的 10 条 Understanding，按降序排列

  场景: 最近更新列表排除已删除 Understanding
    假设 数据库中 updated_at 最新的 Understanding 已被软删除
    当 用户执行命令 "snapshot project"
    那么 该已删除 Understanding 不出现在 recentUnderstandings 中

  场景: 统计仅计入活跃 Understanding
    假设 数据库中共有 50 条活跃 Understanding 和 5 条已删除 Understanding
    当 用户执行命令 "snapshot project"
    那么 stats.totalUnderstandings 为 50

  场景: 统计仅计入活跃 Context
    假设 数据库中共有 30 条活跃 Context 和 3 条已删除 Context
    当 用户执行命令 "snapshot project"
    那么 stats.totalContexts 为 30

  场景: 统计计入全部 Domain
    假设 数据库中共有 20 条 Domain（包含根节点和嵌套节点）
    当 用户执行命令 "snapshot project"
    那么 stats.totalDomains 为 20

  场景: 统计计入全部连接
    假设 数据库中共有 100 条 understanding_connections
    当 用户执行命令 "snapshot project"
    那么 stats.totalReferences 为 100

  场景: 空项目快照
    假设 数据库刚初始化，尚未插入任何用户数据
    当 用户执行命令 "snapshot project"
    那么 domains 为空数组
    并且 recentUnderstandings 为空数组
    并且 stats.totalUnderstandings 为 0
    并且 stats.totalContexts 为 0
    并且 stats.totalDomains 为 0
    并且 stats.totalReferences 为 0
