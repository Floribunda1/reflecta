功能: 图遍历

  背景:
    假设 数据库中已存在多条 Thought 及其之间的 thought_connections 连接

  # graph neighborhood

  场景: 深度为 1 的邻域
    假设 存在活跃 Thought SEED_ID，它有 2 条 outgoing 连接和 1 条 incoming 连接
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID"
    那么 响应包含：
      | 字段       | 预期值                              |
      | seed       | SEED_ID                             |
      | nodes      | 包含 SEED_ID 及 3 个相连 Thought    |
      | edges      | 所有已访问节点之间的连接             |
      | page.hasMore | false                             |

  场景: 深度为 2 的邻域
    假设 存在 Thought 链 A -> B -> C，其中 A 为 SEED_ID
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --depth 2"
    那么 nodes 包含 A、B、C
    并且 edges 包含 A->B 和 B->C

  场景: 深度为 0 时仅返回种子节点
    假设 存在活跃 Thought SEED_ID
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --depth 0"
    那么 nodes 仅包含 SEED_ID
    并且 edges 为空数组

  场景: 双向边均被包含
    假设 存在 Thought A 与 B，两者互相连接（A <-> B），且 A 为 SEED_ID
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID"
    那么 edges 中同时包含 A->B 和 B->A

  场景: 排除已删除的 Thought
    假设 SEED_ID 同时连接到 ACTIVE_ID 和 DELETED_ID
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID"
    那么 nodes 中不包含 DELETED_ID
    并且 与 DELETED_ID 相关的边也被省略

  场景: 附带 Context 信息
    假设 SEED_ID 及其邻居均带有 Context
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --include-contexts"
    那么 nodes 中每个节点都包含 contextIds 数组
    并且 响应顶层包含 contexts 数组，里面是完整的 Context 对象

  场景: 邻域分页限制
    假设 SEED_ID 在深度 1 下有 50 个邻居
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --limit 10 --offset 0"
    那么 nodes 包含 10 个节点
    并且 page.hasMore 为 true

  场景: 邻域分页偏移
    假设 SEED_ID 在深度 1 下有 50 个邻居
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --limit 10 --offset 40"
    那么 nodes 包含最后 10 个节点
    并且 page.hasMore 为 false

  场景: limit 大于节点总数
    假设 SEED_ID 仅有 3 个邻居
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --limit 100"
    那么 返回全部 4 个节点（种子 + 邻居）
    并且 page.hasMore 为 false

  场景: 孤立 Thought 的邻域
    假设 存在活跃 Thought ISOLATED_ID，没有任何连接
    当 用户执行命令 "graph neighborhood --thought-id ISOLATED_ID"
    那么 nodes 仅包含 ISOLATED_ID
    并且 edges 为空数组

  场景: 邻域查询不存在的 Thought
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "graph neighborhood --thought-id MISSING_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 邻域查询已删除的 Thought
    假设 存在一条已删除 Thought，其 ID 为 DELETED_ID
    当 用户执行命令 "graph neighborhood --thought-id DELETED_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 环状结构的邻域去重
    假设 存在环 A -> B -> C -> A，且 A 为 SEED_ID
    当 用户执行命令 "graph neighborhood --thought-id SEED_ID --depth 3"
    那么 nodes 包含 A、B、C
    并且 edges 没有重复

  # graph path

  场景: 存在直接路径
    假设 存在连接 FROM_ID -> TO_ID
    当 用户执行命令 "graph path --from FROM_ID --to TO_ID"
    那么 响应包含 1 条路径：
      | 字段  | 值                                 |
      | nodes | [FROM_ID, TO_ID]                   |
      | edges | [{ from: FROM_ID, to: TO_ID }]     |

  场景: 存在多跳路径
    假设 存在 Thought 链 A -> B -> C，其中 A 为 FROM_ID，C 为 TO_ID
    当 用户执行命令 "graph path --from FROM_ID --to TO_ID"
    那么 响应包含一条路径，nodes 为 [A, B, C]

  场景: 存在多条路径
    假设 存在 A -> B -> D 和 A -> C -> D
    当 用户执行命令 "graph path --from A --to D"
    那么 响应包含 2 条路径

  场景: 不存在路径
    假设 FROM_ID 与 TO_ID 之间没有任何连接
    当 用户执行命令 "graph path --from FROM_ID --to TO_ID"
    那么 paths 为空数组

  场景: 起点与终点为同一节点
    假设 存在活跃 Thought SAME_ID
    当 用户执行命令 "graph path --from SAME_ID --to SAME_ID"
    那么 响应包含 1 条路径：
      | 字段  | 值           |
      | nodes | [SAME_ID]    |
      | edges | []           |

  场景: 路径经过已删除节点时不可达
    假设 从 FROM_ID 到 TO_ID 的唯一路径经过一个已删除 Thought
    当 用户执行命令 "graph path --from FROM_ID --to TO_ID"
    那么 paths 为空数组（已删除节点不可遍历）

  场景: 最大深度限制为 6
    假设 存在线性链 A -> B -> C -> D -> E -> F -> G -> H，共 7 条边
    当 用户执行命令 "graph path --from A --to H"
    那么 paths 为空数组（超过 MAX_DEPTH = 6）

  场景: 最大路径数限制为 10
    假设 从 FROM_ID 到 TO_ID 存在 15 条不同的简单路径
    当 用户执行命令 "graph path --from FROM_ID --to TO_ID"
    那么 返回的路径数不超过 10

  场景: 避免环导致无限搜索
    假设 存在环 A -> B -> C -> B，且目标为 C
    当 用户执行命令 "graph path --from A --to C"
    那么 仅返回简单路径 A -> B -> C
    并且 不会无限探索环

  场景: 起点不存在
    假设 存在活跃 Thought TO_ID，且 MISSING_FROM 是数据库中不存在的 ID
    当 用户执行命令 "graph path --from MISSING_FROM --to TO_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 终点不存在
    假设 存在活跃 Thought FROM_ID，且 MISSING_TO 是数据库中不存在的 ID
    当 用户执行命令 "graph path --from FROM_ID --to MISSING_TO"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 NOT_FOUND

  场景: 缺少必填参数 --from
    当 用户执行命令 "graph path --to SOME_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --from

  场景: 缺少必填参数 --to
    当 用户执行命令 "graph path --from SOME_ID"
    那么 命令退出码应为 1
    并且 标准错误输出应提示缺少 --to
