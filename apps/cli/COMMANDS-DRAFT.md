# Reflecta CLI API Design for Agents

> 这份文档定义 Reflecta CLI 的目标 API。CLI 的调用方是 AI Agent，不是人类用户；设计目标不是覆盖管理后台式 CRUD，而是让 Agent 能低成本地读取、探索、挖掘、沉淀用户的本地知识图谱。

业务背景参考：[Reflecta V2 业务场景需求](../../docs/biz-modules/_deprecated/deepen/requirement.md)。

---

## 1. 设计原则

### 1.1 Agent 先读，再推理，再写入

Agent 不应该一上来修改知识库。合理流程是：

1. 定位相关知识：search / list / inspect
2. 按需读取上下文：thought get / category inspect / graph neighborhood
3. 在对话中提出候选理解、候选引用、候选沉淀
4. 用户确认后再写入：thought create/update、context create、thought reference

因此 CLI 必须让 read path 足够强，而 write path 足够明确和安全。

### 1.2 为工作流提供批量读取，而不是让 Agent N+1 拼图

知识图谱探索不是单条记录查询。Category 洞察挖掘、路径探索、共鸣发现都需要一次读取一组节点、边、来源材料和分类信息。

所以 API 分为两层：

- **原子 API**：操作单个 Thought / Context / Category / Reference
- **工作流 API**：一次导出 Agent 分析所需的局部图谱

原子 API 保证可组合；工作流 API 降低 token、round-trip 和推理成本。

### 1.3 搜索负责定位，Inspect 负责理解

`search` 只回答“可能相关的入口在哪里”；它不负责让 Agent 完整理解一个领域。

当 Agent 已经锁定一个 Thought 或 Category 后，应使用：

- `thought get`：读取单个 Thought；通过 `--include-*` 按需展开来源材料和一跳引用
- `category inspect`：读取某个领域下的全量或分页笔记
- `graph neighborhood`：读取一个 Thought 附近的图谱

### 1.4 所有输出都要机器可读、稳定、可分页

默认输出 JSONL 适合长列表流式读取；涉及嵌套结构的工作流 API 默认输出 JSON object。

所有可能变大的接口都必须支持：

- `--limit`
- `--offset` 或 `--cursor`
- `--include-*` 精确控制输出体积
- `--compact` / `--full` 控制字段级别

### 1.5 写入必须显式确认

所有 mutating command 都需要 `--yes`。Agent 必须先向用户说明准备写入什么，再执行写入。

---

## 2. 核心对象

### Thought

用户的认知单元。分为：

- `idea`：具体想法、经验、判断、问题
- `insight`：从多个 idea 抽象出的高阶洞察

### Context

Thought 的来源、补充背景或证据。包括 experience、book、video、article、opinion、ai 等类型。

### Category

用户的领域结构。Category 是 Agent 做领域洞察挖掘的主要入口。

### Reference

Thought 之间的有向引用边。语义是 **A references B**：A 的内容引用、使用、支持、启发或关联 B。当前先保留轻量引用边，不强制引入 relation type。

---

## 3. 返回类型契约

### 3.1 输出原则

返回类型遵循 agent-friendly 原则：

- 成功时 stdout 只输出业务数据，不包 `{ok,data}` envelope。
- 同质列表默认 JSONL；`--format json` 时输出数组。
- `search all`、`category inspect`、`graph neighborhood`、`graph path` 这类聚合上下文输出裸 JSON object。
- 无返回值的成功 mutation 输出空字符串，用 exit code `0` 表示成功。
- 失败时只向 stderr 输出 `{code,message,details?}`，stdout 忽略。
- 字段名稳定；固定字段没有值时返回空数组或 `null`，不要省略字段。只有受 `--include-*` 控制的整组字段可以在未请求时省略。
- 大文本字段只在需要 agent 阅读时返回；列表和搜索结果返回 summary，inspect/get 返回可分析上下文。

### 3.2 基础类型

```ts
type ID = string;
type ISODateTime = string;

type ThoughtType = "idea" | "insight";
type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

type PageInfo = {
  limit: number;
  offset?: number;
  cursor?: string | null;
  nextCursor?: string | null;
  hasMore: boolean;
};

type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFIRMATION_REQUIRED"
  | "DB_NOT_FOUND"
  | "CONFIG_NOT_FOUND"
  | "INTERNAL_ERROR";

type ErrorOutput = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};
```

说明：

- `createdAt` / `updatedAt` 默认不出现在 compact 输出里，避免干扰 agent 阅读；需要审计、排序解释或同步时再通过 `--detail full` 返回。
- `rank` 只在搜索结果中出现，保留底层排序依据。
- `snippet` 是给 agent 快速判断相关性的字段，不替代完整内容。

### 3.3 核心对象输出

```ts
type CategorySummary = {
  id: ID;
  name: string;
  parentId: ID | null;
};

type ContextSummary = {
  id: ID;
  thoughtId: ID;
  sourceType: SourceType;
  sourceName: string | null;
};

type ContextFull = ContextSummary & {
  content: string;
};

type ThoughtSummary = {
  id: ID;
  type: ThoughtType;
  title: string | null;
  body: string;
  categories: CategorySummary[];
};

type ThoughtDetail = ThoughtSummary & {
  contextCount: number;
  referenceCount: number;
  referencedByCount: number;
  contexts?: ContextFull[];
  references?: ThoughtSummary[];
  referencedBy?: ThoughtSummary[];
};

type ThoughtNode = ThoughtSummary & {
  contextIds?: ID[];
  referenceIds?: ID[];
  referencedByIds?: ID[];
};

type ReferenceEdge = {
  referrerId: ID;
  referencedId: ID;
};
```

设计取舍：

- `ThoughtSummary` 保留 `body`，因为个人知识库里的 Thought 通常是短文本，agent 做判断需要直接读正文。
- Thought 输出使用 `categories` 而不是裸 `categoryIds`，因为 agent 需要分类名理解语境，同时仍可从 `categories[].id` 取得写入所需 ID。
- `ThoughtDetail` 默认不展开 contexts / references / referencedBy，只返回数量；需要阅读材料或邻居正文时用 `--include-contexts`、`--include-references`、`--include-referenced-by`。
- `ContextSummary` 不带 `content`，避免列表结果过大；`ContextFull` 才带完整材料。
- 图谱类结果里的节点用 `ThoughtNode`，通过 `contextIds` / `referenceIds` 指向聚合数组，减少重复嵌套。
- `ReferenceEdge` 暂不带 relation type。当前产品语义是轻量有向引用，避免 agent 被迫过早分类。

### 3.4 搜索输出

```ts
type ThoughtSearchHit = ThoughtSummary & {
  snippet: string;
  rank: number;
};

type ContextSearchHit = {
  contextId: ID;
  thoughtId: ID;
  sourceName: string | null;
  snippet: string;
  rank: number;
};

type SearchAllResult = {
  thoughts: ThoughtSearchHit[];
  contexts: ContextSearchHit[];
};
```

要求：

- `search thoughts` 输出 `ThoughtSearchHit`。
- `search contexts` 输出 `ContextSearchHit`。
- `search all` 输出 `SearchAllResult`。
- 搜索结果必须保留 rank 顺序，不能在二次查询组装 DTO 时打乱顺序。

### 3.5 Inspect / Graph 输出

```ts
type CategoryInspectResult = {
  category: CategorySummary;
  categories: CategorySummary[];
  thoughts: ThoughtNode[];
  contexts?: ContextFull[];
  references?: ReferenceEdge[];
  page: PageInfo;
};

type GraphNeighborhoodResult = {
  seed: ID;
  nodes: ThoughtNode[];
  edges: ReferenceEdge[];
  contexts?: ContextFull[];
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
```

设计取舍：

- `CategoryInspectResult` 和 `GraphNeighborhoodResult` 使用 `{nodes/edges/contexts}` 风格的聚合对象，适合 agent 一次解析局部知识图谱。
- `contexts` 和 `references` 受 `--include-contexts` / `--include-references` 控制。不包含时字段可以省略；包含但为空时返回 `[]`。
- `page` 始终返回，agent 可以据此判断是否需要继续翻页。

### 3.6 Meta / Trash 输出

```ts
type CommandSummary = {
  command: string;
  mutates: boolean;
  purpose: string;
  schemaCommand: string;
};

type CommandSchema = {
  command: string;
  mutates: boolean;
  required: string[];
  options: Record<string, string>;
  output: string;
  examples: string[];
};

type TrashedThought = ThoughtSummary & {
  deletedAt: ISODateTime;
};

type TrashedContext = ContextFull & {
  thoughtTitle: string | null;
  deletedAt: ISODateTime;
};
```

### 3.7 命令到返回类型映射

| Command                                | 默认 stdout               | `--format=json`           | 备注                             |
| -------------------------------------- | ------------------------- | ------------------------- | -------------------------------- |
| `meta actions`                         | `CommandSummary` JSONL    | `CommandSummary[]`        | 自发现入口                       |
| `meta schema <command>`                | `CommandSchema`           | `CommandSchema`           | 单对象，不使用 JSONL             |
| `search thoughts <query>`              | `ThoughtSearchHit` JSONL  | `ThoughtSearchHit[]`      | 按 rank 排序                     |
| `search contexts <query>`              | `ContextSearchHit` JSONL  | `ContextSearchHit[]`      | 按 rank 排序                     |
| `search all <query>`                   | `SearchAllResult`         | `SearchAllResult`         | 聚合对象                         |
| `thought list`                         | `ThoughtSummary` JSONL    | `ThoughtSummary[]`        | 浏览/过滤，不做关键词搜索        |
| `thought get <id>`                     | `ThoughtDetail`           | `ThoughtDetail`           | 默认轻量，`--include-*` 按需展开 |
| `thought create`                       | `ThoughtDetail`           | `ThoughtDetail`           | mutation，需 `--yes`             |
| `thought update <id>`                  | `ThoughtDetail`           | `ThoughtDetail`           | mutation，需 `--yes`             |
| `thought delete <id>`                  | 空                        | 空                        | mutation，需 `--yes`             |
| `thought restore <id>`                 | 空                        | 空                        | mutation，需 `--yes`             |
| `context list --thought-id <id>`       | `ContextFull` JSONL       | `ContextFull[]`           | Thought 的来源材料               |
| `context create`                       | `ContextFull`             | `ContextFull`             | mutation，需 `--yes`             |
| `context update <id>`                  | `ContextFull`             | `ContextFull`             | mutation，需 `--yes`             |
| `context delete <id>`                  | 空                        | 空                        | mutation，需 `--yes`             |
| `context restore <id>`                 | 空                        | 空                        | mutation，需 `--yes`             |
| `category list`                        | `CategorySummary` JSONL   | `CategorySummary[]`       | 分类浏览                         |
| `category inspect <id>`                | `CategoryInspectResult`   | `CategoryInspectResult`   | 聚合对象                         |
| `category create`                      | `CategorySummary`         | `CategorySummary`         | mutation，需 `--yes`             |
| `category update <id>`                 | `CategorySummary`         | `CategorySummary`         | mutation，需 `--yes`             |
| `category delete <id>`                 | 空                        | 空                        | mutation，需 `--yes`             |
| `graph neighborhood --thought-id <id>` | `GraphNeighborhoodResult` | `GraphNeighborhoodResult` | 聚合对象                         |
| `graph path --from <id> --to <id>`     | `GraphPathResult`         | `GraphPathResult`         | 聚合对象                         |
| `trash list-thoughts`                  | `TrashedThought` JSONL    | `TrashedThought[]`        | 回收站列表                       |
| `trash list-contexts`                  | `TrashedContext` JSONL    | `TrashedContext[]`        | 回收站列表                       |

---

## 4. API 总览

```text
reflecta
├── meta
│   ├── actions
│   └── schema <command>
├── search
│   ├── all <query>
│   ├── thoughts <query>
│   └── contexts <query>
├── thought
│   ├── list
│   ├── get <id>
│   ├── create
│   ├── update <id>
│   ├── delete <id>
│   ├── restore <id>
│   └── links inferred from `[[...]]` in body
├── context
│   ├── list --thought-id <id>
│   ├── create
│   ├── update <id>
│   ├── delete <id>
│   └── restore <id>
├── category
│   ├── list
│   ├── inspect <id>
│   ├── create
│   ├── update <id>
│   └── delete <id>
├── graph
│   ├── neighborhood --thought-id <id>
│   └── path --from <id> --to <id>
└── trash
    ├── list-thoughts
    └── list-contexts
```

其中：

- `meta` 是 Agent 自发现入口。
- `search` 是全库定位入口。
- `thought/context/category` 是核心对象的原子读写。
- `category inspect` 是领域洞察挖掘入口。
- `graph` 是图谱探索入口。
- `trash` 只负责列出回收站，恢复仍由对应对象命令完成。

---

## 5. Meta API

### `reflecta meta actions`

列出所有命令，供 Agent 自发现。

返回类型：`CommandSummary` JSONL；`--format json` 时为 `CommandSummary[]`。

输出（`--format json`）：

```json
[
  {
    "command": "category inspect",
    "mutates": false,
    "purpose": "Read a category subtree for synthesis and discovery",
    "schemaCommand": "reflecta meta schema category.inspect"
  }
]
```

### `reflecta meta schema <command>`

输出某个命令的机器可读 schema。

返回类型：`CommandSchema`。

示例：

```bash
reflecta meta schema category.inspect
```

输出：

```json
{
  "command": "category inspect <id>",
  "mutates": false,
  "required": ["id"],
  "options": {
    "includeDescendants": "boolean",
    "includeContexts": "boolean",
    "includeReferences": "boolean",
    "limit": "number",
    "offset": "number",
    "detail": "compact | full"
  },
  "output": "CategoryInspectResult",
  "examples": [
    "reflecta category inspect cat_123 --include-descendants --include-contexts --include-references --limit 200 --format json"
  ]
}
```

设计理由：

- Agent 不应该从 human-readable help 中猜参数。
- README 只能辅助人类理解，不能作为 Agent 的唯一 discovery 机制。

---

## 6. Search API

Search 只用于全库定位候选入口，不用于完整理解。

### `reflecta search all <query>`

同时搜索 Thoughts 和 Contexts。

返回类型：`SearchAllResult`。

```bash
reflecta search all "身份认同 行动力" --limit 20 --format json
```

输出：

```json
{
  "thoughts": [
    {
      "id": "th_1",
      "type": "idea",
      "title": "身份模糊会削弱行动力",
      "body": "...",
      "categories": [
        {
          "id": "cat_identity",
          "name": "身份认同",
          "parentId": null
        }
      ],
      "snippet": "...<mark>身份认同</mark>...",
      "rank": -3.42
    }
  ],
  "contexts": [
    {
      "contextId": "ctx_1",
      "thoughtId": "th_2",
      "sourceName": "Atomic Habits",
      "snippet": "...<mark>identity</mark> based habits...",
      "rank": -2.88
    }
  ]
}
```

要求：

- Thought 搜索结果必须保留 FTS rank 顺序。
- Thought 和 Context 都应返回 `snippet` 与 `rank`。
- CLI 层屏蔽 FTS5 语法细节，Agent 输入普通 query 即可。

### `reflecta search thoughts <query>`

只搜索 Thought 标题和正文。

返回类型：`ThoughtSearchHit` JSONL；`--format json` 时为 `ThoughtSearchHit[]`。

```bash
reflecta search thoughts "交易心理 恐惧" --limit 10
```

适用：

- 用户提到一个概念，Agent 需要找相关 Thought。
- Agent 想找是否已有类似观点。

### `reflecta search contexts <query>`

只搜索 Context 来源名和正文。

返回类型：`ContextSearchHit` JSONL；`--format json` 时为 `ContextSearchHit[]`。

```bash
reflecta search contexts "自我效能" --limit 10
```

适用：

- Agent 想找已有材料、书摘、经历、外部观点。
- Companion 模式中寻找背景补充。

---

## 7. Thought API

### `reflecta thought list`

结构化浏览 Thought，不负责关键词搜索。

返回类型：`ThoughtSummary` JSONL；`--format json` 时为 `ThoughtSummary[]`。

```bash
reflecta thought list --category-id cat_1 --include-descendants --type idea --limit 100
reflecta thought list --recent --limit 20
```

输出：

```json
{
  "id": "th_1",
  "type": "idea",
  "title": "环境提示降低行动阻力",
  "body": "...",
  "categories": [
    {
      "id": "cat_habit",
      "name": "习惯养成",
      "parentId": null
    }
  ]
}
```

设计边界：

- `thought list` 是浏览和过滤，不提供 `--search`。
- 如果 Agent 要关键词定位，用 `search thoughts`。
- 如果 Agent 要完整领域分析，用 `category inspect`，不要用 `thought list` + N 次 `thought get`。

### `reflecta thought get <id>`

按需读取单个 Thought。

返回类型：`ThoughtDetail`。

```bash
reflecta thought get th_1 --include-contexts --format json
```

输出（请求 `--include-contexts`）：

```json
{
  "id": "th_1",
  "type": "idea",
  "title": "热爱是高效前进的强驱动力",
  "body": "...",
  "categories": [
    {
      "id": "cat_motivation",
      "name": "行动力",
      "parentId": null
    }
  ],
  "contextCount": 1,
  "referenceCount": 1,
  "referencedByCount": 0,
  "contexts": [
    {
      "id": "ctx_1",
      "thoughtId": "th_1",
      "sourceType": "experience",
      "sourceName": "个人经历",
      "content": "..."
    }
  ]
}
```

适用：

- Socratic 澄清：读取用户正在讨论的 Thought。
- Companion 模式：先读核心 Thought 和数量，需要材料或邻居时再加 `--include-contexts` / `--include-references` / `--include-referenced-by`。

选项：

- `--include-contexts`：展开 Thought 的来源材料
- `--include-references`：展开 outgoing references 的 Thought summary
- `--include-referenced-by`：展开 incoming references 的 Thought summary

### `reflecta thought create`

用户确认后创建 Thought。

返回类型：`ThoughtDetail`。缺少 `--yes` 时返回 `CONFIRMATION_REQUIRED`，不执行写入。

```bash
reflecta thought create \
  --type insight \
  --title "行动力的根本问题可能是身份模糊" \
  --body "..." \
  --category-id cat_identity,cat_action \
  --yes \
  --format json
```

### `reflecta thought update <id>`

用户确认后修改 Thought。

返回类型：`ThoughtDetail`。缺少 `--yes` 时返回 `CONFIRMATION_REQUIRED`，不执行写入。

```bash
reflecta thought update th_1 --body "澄清后的表达..." --yes --format json
```

### Thought 关系维护

Thought 之间的关系不再通过独立命令手动新增、删除。

在 CLI 中，关系由 `thought create --body` / `thought update --body` 里的 wiki links 推导：

```bash
reflecta thought update th_new --body "关联到 [[th_existing]]" --yes --format json
```

语义：

- `[[target]]` 或 `[[target|label]]` 表示当前 Thought 引用目标 Thought
- CLI 会把 `[[...]]` 规范化成内部 `/wiki/...` markdown link 后再写入
- 更新正文时会同步该 Thought 的 outgoing references

---

## 8. Context API

### `reflecta context list --thought-id <id>`

读取某个 Thought 的来源材料。

返回类型：`ContextFull` JSONL；`--format json` 时为 `ContextFull[]`。

```bash
reflecta context list --thought-id th_1 --format json
```

说明：

- `thought get --include-contexts` 也能返回 contexts。
- `context list` 主要用于 Agent 已有 Thought ID，只想读取来源材料、不需要 Thought 正文或引用信息的轻量场景。

### `reflecta context create`

用户确认后为 Thought 添加来源或补充材料。

返回类型：`ContextFull`。缺少 `--yes` 时返回 `CONFIRMATION_REQUIRED`，不执行写入。

```bash
reflecta context create \
  --thought-id th_1 \
  --source-type book \
  --source-name "Atomic Habits" \
  --content "..." \
  --yes \
  --format json
```

适用：

- Companion 模式中，用户认可某个外部理论对自己有意义。
- 对话中用户补充了一段经历，需要沉淀为 Context。

---

## 9. Category API

### `reflecta category list`

读取分类树或分类列表。

返回类型：`CategorySummary` JSONL；`--format json` 时为 `CategorySummary[]`。

```bash
reflecta category list --format json
```

输出（`--format json`）：

```json
[
  {
    "id": "cat_identity",
    "name": "身份认同",
    "parentId": null
  }
]
```

### `reflecta category inspect <id>`

读取某个 Category 下的局部知识库，是 Category 洞察挖掘的主入口。

返回类型：`CategoryInspectResult`。

```bash
reflecta category inspect cat_trading \
  --include-descendants \
  --include-contexts \
  --include-references \
  --limit 200 \
  --format json
```

输出：

```json
{
  "category": {
    "id": "cat_trading",
    "name": "交易心理",
    "parentId": null
  },
  "categories": [
    {
      "id": "cat_fear",
      "name": "恐惧",
      "parentId": "cat_trading"
    }
  ],
  "thoughts": [
    {
      "id": "th_1",
      "type": "idea",
      "title": "恐惧来自亏损后的身份威胁",
      "body": "...",
      "categories": [
        {
          "id": "cat_trading",
          "name": "交易心理",
          "parentId": null
        }
      ],
      "contextIds": ["ctx_1"],
      "referenceIds": ["th_2"]
    }
  ],
  "contexts": [
    {
      "id": "ctx_1",
      "thoughtId": "th_1",
      "sourceType": "experience",
      "sourceName": "一次亏损后的复盘",
      "content": "..."
    }
  ],
  "references": [
    {
      "referrerId": "th_1",
      "referencedId": "th_2"
    }
  ],
  "page": {
    "limit": 200,
    "offset": 0,
    "hasMore": false
  }
}
```

选项：

- `--include-descendants`：包含子分类
- `--include-contexts`：包含每条 Thought 的 contexts
- `--include-references`：包含局部图谱边
- `--detail compact|full`：控制 Thought 字段体积
- `--limit <n>`：默认 100
- `--offset <n>`：默认 0

设计理由：

- Category 洞察挖掘需要一次读取“领域切片”，让 Agent 在本地上下文里做主题聚类、矛盾发现、前提抽象。
- 对 20-200 条笔记的小中型 Category，直接全量读取比反复 FTS 更可靠，尤其适合中文和语义分析。
- 对大型 Category，用分页和 `--detail compact` 控制 token。

### `reflecta category create/update/delete`

用于用户确认后的结构维护。

返回类型：

- `category create` / `category update`：`CategorySummary`
- `category delete`：空 stdout，exit code `0` 表示成功
- 缺少 `--yes` 时返回 `CONFIRMATION_REQUIRED`，不执行写入

```bash
reflecta category create --name "行为设计" --parent-id cat_psychology --yes
reflecta category update cat_1 --name "交易与风险心理" --yes
reflecta category delete cat_1 --cascade --yes
```

---

## 10. Graph API

### `reflecta graph neighborhood --thought-id <id>`

读取某个 Thought 周围的图谱。

返回类型：`GraphNeighborhoodResult`。

```bash
reflecta graph neighborhood \
  --thought-id th_identity \
  --depth 2 \
  --direction both \
  --include-contexts \
  --limit 100 \
  --format json
```

输出：

```json
{
  "seed": "th_identity",
  "nodes": [
    {
      "id": "th_identity",
      "type": "idea",
      "title": "身份认同影响行动力",
      "body": "...",
      "categories": [
        {
          "id": "cat_identity",
          "name": "身份认同",
          "parentId": null
        }
      ]
    }
  ],
  "edges": [
    {
      "referrerId": "th_identity",
      "referencedId": "th_habit"
    }
  ],
  "contexts": [],
  "page": {
    "limit": 100,
    "hasMore": false
  }
}
```

选项：

- `--depth <n>`：默认 1，建议最大 3
- `--direction outgoing|incoming|both`：默认 both
- `--include-contexts`
- `--limit <n>`

适用：

- 从一个概念出发做发散探索。
- 检查已有 reference 能否支持某个候选洞察。
- 给用户解释“这个 Thought references 了哪些 Thought，以及被哪些 Thought referenced”。

### `reflecta graph path --from <id> --to <id>`

寻找两个 Thought 之间已有引用路径。

返回类型：`GraphPathResult`。

```bash
reflecta graph path --from th_identity --to th_action --max-depth 4 --format json
```

输出：

```json
{
  "from": "th_identity",
  "to": "th_action",
  "paths": [
    {
      "nodes": ["th_identity", "th_self_efficacy", "th_action"],
      "edges": [
        { "referrerId": "th_identity", "referencedId": "th_self_efficacy" },
        { "referrerId": "th_self_efficacy", "referencedId": "th_action" }
      ]
    }
  ]
}
```

适用：

- 明确桥梁探索：用户问 X 和 Y 是否有关。
- Agent 不应把 path 结果当成唯一答案，只把它当成已有知识库里的线索。

---

## 11. Trash API

### `reflecta trash list-thoughts`

返回类型：`TrashedThought` JSONL；`--format json` 时为 `TrashedThought[]`。

```bash
reflecta trash list-thoughts --limit 50
```

### `reflecta trash list-contexts`

返回类型：`TrashedContext` JSONL；`--format json` 时为 `TrashedContext[]`。

```bash
reflecta trash list-contexts --limit 50
```

恢复仍由对象命令完成：

```bash
reflecta thought restore th_deleted --yes
reflecta context restore ctx_deleted --yes
```

---

## 12. Agent 工作流示例

### 12.1 Socratic 澄清：让 vague thought 变 precise

用户正在讨论 Thought `th_love_drive`。

Agent 调用：

```bash
reflecta thought get th_love_drive --include-contexts --include-references --format json
reflecta search all "热爱 高效 前进 内耗 意义感" --limit 10 --format json
```

Agent 行为：

1. 读取原 Thought、contexts、一跳引用
2. 搜索相近概念，作为可选背景
3. 不直接写入，先追问用户
4. 用户确认后：

```bash
reflecta thought update th_love_drive --body "澄清后的表达..." --yes --format json
```

如果用户决定拆分子命题：

```bash
reflecta thought create --type idea --title "热爱包含低内耗的持续投入" --body "..." --category-id cat_motivation --yes --format json
reflecta thought reference th_love_drive th_new --yes
```

### 12.2 Category 洞察挖掘：从碎片 Idea 提炼 Insight

用户问：“我交易心理这个分类下面的笔记共同在处理什么问题？”

Agent 调用：

```bash
reflecta category inspect cat_trading \
  --include-descendants \
  --include-contexts \
  --include-references \
  --limit 200 \
  --format json
```

Agent 行为：

1. 直接读取领域切片
2. 在模型上下文里做主题聚类、前提抽取、矛盾检查
3. 提出候选 insight，但不写入
4. 用户确认后：

```bash
reflecta thought create \
  --type insight \
  --title "交易恐惧本质上是身份威胁，而不只是风险厌恶" \
  --body "..." \
  --category-id cat_trading \
  --yes \
  --format json
```

随后建立与底层 Idea 的引用：

```bash
reflecta thought reference th_insight th_idea_1 --yes
reflecta thought reference th_insight th_idea_2 --yes
```

### 12.3 发散探索：从一个概念出发寻找可能路径

用户问：“身份认同到底怎么影响行动力？”

Agent 调用：

```bash
reflecta search all "身份认同 行动力 动机 习惯 自我效能" --limit 20 --format json
reflecta category inspect cat_identity --include-descendants --include-contexts --include-references --limit 150 --format json
reflecta graph neighborhood --thought-id th_identity --depth 2 --direction both --include-contexts --limit 100 --format json
```

Agent 行为：

1. 用 search 找可能入口
2. 用 category inspect 读取身份认同领域的论证结构
3. 用 graph neighborhood 顺着已有引用发散
4. 给用户多个可能路径，而不是唯一答案

可能输出给用户：

- 身份认同 -> 自我效能 -> 行动力
- 身份认同 -> 内在动机 -> 习惯养成 -> 行动力
- 身份认同 -> 社会认同 -> 外部压力 -> 行动力

用户确认某个涌现观点值得记录后：

```bash
reflecta thought create --type insight --title "行动力问题可能源于身份模糊" --body "..." --category-id cat_identity,cat_action --yes --format json
```

### 12.4 共创沉淀：记录新领域的新想法

用户说：“这个观点值得记下来：环境提示让我更像某种人，所以行为更容易坚持。”

Agent 调用：

```bash
reflecta category list --format json
reflecta search all "环境提示 环境设计 身份认同 习惯" --limit 10 --format json
reflecta thought create \
  --type idea \
  --title "环境提示通过身份感强化习惯" \
  --body "环境设计不只是降低行动阻力，也会让人更容易把自己看成某种身份的人，因此行为更容易坚持。" \
  --category-id cat_behavior_design,cat_identity \
  --yes \
  --format json
```

如果用户同意引用：

```bash
reflecta thought reference th_new th_existing --yes
```

---

## 13. 输出体积策略

### Small Category

小于 200 条 Thought：

```bash
reflecta category inspect cat_1 --include-descendants --include-contexts --include-references --limit 200 --format json
```

Agent 可以直接读取全部内容进行综合分析。

### Large Category

超过 200 条 Thought：

第一步读取 compact：

```bash
reflecta category inspect cat_1 --include-descendants --detail compact --limit 200 --offset 0 --format json
```

第二步按候选 ID 读取详情：

```bash
reflecta thought get th_candidate --format json
```

后续可以补充批量接口：

```bash
reflecta thought get-many --ids th_1,th_2,th_3 --include-contexts --format json
```

### Search Then Inspect

全库问题不要直接 dump 全库。先 search 定位，再 inspect 局部：

```bash
reflecta search all "身份认同 行动力" --limit 20 --format json
reflecta category inspect cat_identity --include-descendants --include-contexts --include-references --limit 150 --format json
```

---

## 14. 与当前实现的差异

当前已实现：

- `thought list/get/create/update/delete/restore`（关系通过正文内 `[[...]]` 自动同步）
- `context list/create/update/delete/restore`
- `category list/create/update/delete`
- `search thoughts/contexts/all`
- `trash list-thoughts/list-contexts`

建议新增或调整：

| 能力                                       | 优先级 | 原因                                    |
| ------------------------------------------ | ------ | --------------------------------------- |
| `meta actions` / `meta schema`             | P0     | 纯 Agent CLI 需要机器可读自发现         |
| `category inspect`                         | P0     | Category 洞察挖掘的主入口，避免 N+1     |
| `search thoughts` 返回 rank/snippet 并保序 | P0     | 搜索入口质量直接影响后续调用            |
| `graph neighborhood`                       | P1     | 发散探索和图谱解释需要局部邻域          |
| `graph path`                               | P2     | 明确桥梁探索有用，但不是所有场景必需    |
| `thought get-many`                         | P2     | 大型 Category 分批分析时减少 round-trip |

---

## 15. 推荐实施顺序

1. 修正文档与 help：让 README、`--help`、`meta schema` 与真实命令一致。
2. 修正 search：保留 FTS rank 顺序，为 Thought 返回 snippet/rank。
3. 实现 `category inspect`：优先支持 `--include-descendants`、`--include-contexts`、`--include-references`、分页。
4. 实现 `graph neighborhood`：支持 depth、direction、limit。
5. 根据真实使用情况再补 `graph path`、`thought get-many`。

---

## 16. 结论

Reflecta CLI 不应该只是一组 CRUD 命令。对 Agent 来说，最重要的是三类入口：

1. **Search**：在全库中找到可能相关的入口。
2. **Inspect**：一次读取足够的局部知识图谱，让 Agent 能做综合判断。
3. **Mutate**：用户确认后，把新 Thought、Context、Reference 写回知识库。

因此目标 API 的核心是：

- `search all` 用于定位
- `thought get` 用于单点按需读取
- `category inspect` 用于领域洞察
- `graph neighborhood` 用于发散探索
- `thought/context/category` 的 mutating commands 用于确认后的沉淀

这样 Agent 才能在“澄清、引用、扩展、沉淀”这四类工作流中保持低调用成本和高上下文质量。
