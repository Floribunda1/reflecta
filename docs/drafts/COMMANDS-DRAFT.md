# Reflecta CLI Output Draft

> 这份文档只讨论 CLI 的输出设计，不复用 server 内部返回结构。目标是让 agent 以最低成本读取、判断、再决定是否写入。

---

## 1. 设计原则

### 1.1 输出先服务于 agent 工作流

CLI 不是后端 SDK，也不是管理后台 API。

它的输出应该优先满足这几类动作：

1. 快速定位候选内容
2. 读取足够上下文做判断
3. 一次拿到局部图谱而不是 N+1 补查
4. 在用户确认后再执行写入

### 1.2 列表和聚合结果分开设计

- 列表命令返回同质记录，默认 `jsonl`
- inspect / graph / snapshot 这类命令返回单个聚合 `json object`
- mutation 成功时只返回最小必要对象；删除类操作返回空

### 1.3 默认轻量，按需展开

- `search` / `list` 返回 summary
- `get` 返回 detail，但默认不展开大块关联内容
- `get` / `inspect` / `graph` 可通过 `--include-*` 补充 `contexts`、`references`、`referencedBys`、`edges`

---

## 2. 输出约定

```ts
type ID = string;
type ISODateTime = string;

type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFIRMATION_REQUIRED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

type ErrorOutput = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

type PageInfo = {
  limit: number;
  offset?: number;
  nextOffset?: number | null;
  hasMore: boolean;
};
```

规则：

- 成功时 `stdout` 只输出业务数据，不包 `{ ok, data }`
- 失败时 `stderr` 输出 `ErrorOutput`
- 同质列表默认输出 JSONL；`--format json` 时输出数组
- 聚合读取命令始终输出单个 JSON object
- 无返回值的成功 mutation 输出空字符串，依赖 exit code `0`
- 固定字段尽量稳定；无值时优先返回 `[]` 或 `null`，不要频繁省略字段

---

## 3. 核心输出类型

```ts
type ThoughtType = "idea" | "insight";

type SourceType =
  | "experience"
  | "book"
  | "article"
  | "video"
  | "opinion"
  | "ai";

type CategoryRef = {
  id: ID;
  name: string;
  parentId: ID | null;
};

type ThoughtSummary = {
  id: ID;
  type: ThoughtType;
  title: string | null;
  body: string;
  categories: CategoryRef[];
};

type ThoughtDetail = ThoughtSummary & {
  contextCount: number;
  referenceCount: number;
  referencedByCount: number;
  contexts?: ContextDetail[];
  references?: ThoughtSummary[];
  referencedBys?: ThoughtSummary[];
};

type ContextSummary = {
  id: ID;
  thoughtId: ID;
  sourceType: SourceType;
  sourceName: string | null;
};

type ContextDetail = ContextSummary & {
  content: string;
};

type CategorySummary = {
  id: ID;
  name: string;
  parentId: ID | null;
};

type ReferenceEdge = {
  from: ID;
  to: ID;
};

type ThoughtNode = ThoughtSummary & {
  contextIds?: ID[];
};
```

取舍：

- `ThoughtSummary` 直接保留 `body`，因为短文本知识库里正文本身就是判断依据
- `categories` 返回对象而不是纯 `categoryIds`，让 agent 不需要再查名字
- `ContextSummary` 不带 `content`，避免列表和搜索结果过重
- `references` 表示当前 thought 引用了哪些 thought；`referencedBys` 表示哪些 thought 引用了当前 thought
- 图谱命令复用 `ThoughtNode + ReferenceEdge`，避免每个节点递归嵌套

---

## 4. 搜索输出

```ts
type ThoughtSearchHit = ThoughtSummary & {
  snippet: string;
  rank: number;
};

type ContextSearchHit = {
  contextId: ID;
  thoughtId: ID;
  sourceType: SourceType;
  sourceName: string | null;
  snippet: string;
  rank: number;
};

type SearchAllResult = {
  thoughts: ThoughtSearchHit[];
  contexts: ContextSearchHit[];
};
```

规则：

- 搜索结果必须保留排序顺序
- `snippet` 只负责辅助判断相关性，不代替完整正文
- `search all` 返回聚合对象；`search thoughts` / `search contexts` 返回同质列表

---

## 5. Inspect / Graph 输出

```ts
type CategoryInspectResult = {
  category: CategorySummary;
  categories: CategorySummary[];
  thoughts: ThoughtNode[];
  contexts?: ContextDetail[];
  edges?: ReferenceEdge[];
  page: PageInfo;
};

type GraphNeighborhoodResult = {
  seed: ID;
  nodes: ThoughtNode[];
  edges: ReferenceEdge[];
  contexts?: ContextDetail[];
  page: PageInfo;
};

type GraphPath = {
  nodes: ID[];
  edges: ReferenceEdge[];
};

type GraphPathResult = {
  from: ID;
  to: ID;
  paths: GraphPath[];
};

type ProjectSnapshotResult = {
  categories: Array<{
    id: ID;
    name: string;
    thoughtCount: number;
  }>;
  recentThoughts: ThoughtSummary[];
  stats?: {
    totalThoughts: number;
    totalContexts: number;
    totalCategories: number;
    totalReferences: number;
  };
};
```

规则：

- inspect / graph 用 `{ nodes, edges, contexts }` 风格，不混入 server ORM 结构
- `contexts` 和 `edges` 由 `--include-*` 控制；请求了但为空时返回 `[]`
- `references` / `referencedBys` 仅在对应 `--include-references` / `--include-referenced-bys` 被请求时出现
- `page` 始终存在，方便 agent 判断是否继续翻页

---

## 6. 命令到输出映射

| Command | 默认 stdout | 说明 |
| --- | --- | --- |
| `thought list` | `ThoughtSummary` JSONL | 浏览与过滤 |
| `thought get <id>` | `ThoughtDetail` | 单条读取，默认轻量 |
| `thought create` | `ThoughtDetail` | 返回新对象 |
| `thought update <id>` | `ThoughtDetail` | 返回更新后对象 |
| `thought delete <id>` | 空 | 只用 exit code 表示成功 |
| `context list --thought-id <id>` | `ContextDetail` JSONL | 某条 thought 的来源材料 |
| `context get <id>` | `ContextDetail` | 单条读取 |
| `context create` | `ContextDetail` | 返回新对象 |
| `context update <id>` | `ContextDetail` | 返回更新后对象 |
| `context delete <id>` | 空 | 只用 exit code 表示成功 |
| `category list` | `CategorySummary` JSONL | 分类浏览 |
| `category get <id>` | `CategorySummary` | 单条读取 |
| `category inspect <id>` | `CategoryInspectResult` | 领域分析入口 |
| `category create` | `CategorySummary` | 返回新对象 |
| `category update <id>` | `CategorySummary` | 返回更新后对象 |
| `category delete <id>` | 空 | 只用 exit code 表示成功 |
| `search thoughts <query>` | `ThoughtSearchHit` JSONL | Thought 搜索 |
| `search contexts <query>` | `ContextSearchHit` JSONL | Context 搜索 |
| `search all <query>` | `SearchAllResult` | 聚合搜索 |
| `graph neighborhood --thought-id <id>` | `GraphNeighborhoodResult` | 局部图谱 |
| `graph path --from <id> --to <id>` | `GraphPathResult` | 路径探索 |
| `snapshot project` | `ProjectSnapshotResult` | 全局概览 |

---

## 7. 命令分组

```text
reflecta
├── thought
│   ├── list
│   ├── get <id>
│   ├── create
│   ├── update <id>
│   └── delete <id>
├── context
│   ├── list --thought-id <id>
│   ├── get <id>
│   ├── create
│   ├── update <id>
│   └── delete <id>
├── category
│   ├── list
│   ├── get <id>
│   ├── inspect <id>
│   ├── create
│   ├── update <id>
│   └── delete <id>
├── search
│   ├── thoughts <query>
│   ├── contexts <query>
│   └── all <query>
├── graph
│   ├── neighborhood --thought-id <id>
│   └── path --from <id> --to <id>
└── snapshot
    └── project
```

---

## 8. 示例

### `reflecta thought get th_123 --include-contexts --format json`

```json
{
  "id": "th_123",
  "type": "idea",
  "title": "身份感先于行动策略",
  "body": "很多行为问题并不是方法问题，而是身份认同问题。",
  "categories": [
    {
      "id": "cat_identity",
      "name": "身份认同",
      "parentId": null
    }
  ],
  "contextCount": 2,
  "referenceCount": 1,
  "referencedByCount": 3,
  "contexts": [
    {
      "id": "ctx_1",
      "thoughtId": "th_123",
      "sourceType": "book",
      "sourceName": "Atomic Habits",
      "content": "Every action you take is a vote for the type of person you wish to become."
    }
  ]
}
```

### `reflecta category inspect cat_identity --include-contexts --include-edges --format json`

```json
{
  "category": {
    "id": "cat_identity",
    "name": "身份认同",
    "parentId": null
  },
  "categories": [
    {
      "id": "cat_identity",
      "name": "身份认同",
      "parentId": null
    }
  ],
  "thoughts": [
    {
      "id": "th_123",
      "type": "idea",
      "title": "身份感先于行动策略",
      "body": "很多行为问题并不是方法问题，而是身份认同问题。",
      "categories": [
        {
          "id": "cat_identity",
          "name": "身份认同",
          "parentId": null
        }
      ],
      "contextIds": ["ctx_1"]
    }
  ],
  "contexts": [
    {
      "id": "ctx_1",
      "thoughtId": "th_123",
      "sourceType": "book",
      "sourceName": "Atomic Habits",
      "content": "Every action you take is a vote for the type of person you wish to become."
    }
  ],
  "edges": [],
  "page": {
    "limit": 200,
    "offset": 0,
    "nextOffset": null,
    "hasMore": false
  }
}
```
