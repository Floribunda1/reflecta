# Reflecta CLI —— 从 Agent 场景推导命令目录

> 不是从 Service 方法出发，而是从 Agent 作为"认知伙伴"的工作流出发，反推 CLI 需要提供什么原子能力。

---

## 1. Agent 是谁

Reflecta CLI 的调用方不是人类，而是**AI Agent**（如 Kimi、Claude）。Agent 通过 Shell 调用 CLI 来读取和操作用户的本地知识库。

Agent 的核心身份是**认知伙伴**：帮助用户澄清想法、发现结构、补充背景、探索连接（见 [Reflecta V2 业务场景需求](../../docs/biz-modules/_deprecated/deepen/requirement.md)）。

CLI 的设计目标不是提供一套完整的 CRUD 管理后台，而是提供 Agent 完成上述角色所必需的**最小原子操作集合**。

---

## 2. Agent 的核心工作流

基于需求文档中的四大场景，Agent 的 Shell 调用可以归纳为 4 个高频模式：

### 模式 A：检索与理解（Read）

用户提到一个概念或想法，Agent 需要先定位知识库中的相关内容，理解其上下文。

典型调用序列：

1. `search thoughts "身份认同"` → 找到相关 Thought
2. `thought get th-123` → 读取完整内容、connections、referencedBy
3. `context list --thought-id th-123` → 了解该 Thought 的来源材料

**推导出的原子能力**：

- 全文搜索 Thoughts / Contexts
- 获取单条 Thought 详情（含关系网络）
- 获取某 Thought 的 Context 列表

### 模式 B：发现与关联（Discover）

Agent 在对话中发现用户的新想法与知识库中已有内容存在关联，需要帮用户看见这种连接。

典型调用序列：

1. `search thoughts "环境设计"` → 确认是否已有相关记录
2. `thought list --category-id cat-456` → 浏览该领域的全部 Thought
3. `thought connect th-123 th-456` → 建立关联

**推导出的原子能力**：

- 按分类浏览 Thought（结构性感知）
- 建立 / 移除 Thought 关联
- 查看分类树（了解知识库的整体结构）

### 模式 C：记录与沉淀（Write）

用户在对话中产生了值得记录的新想法或新材料，Agent 需要帮用户沉淀为知识资产。

典型调用序列：

1. `thought create --type insight --title "..." --body "..." --category-id cat-1` → 创建 Insight
2. `context create --thought-id th-789 --source-type book --source-name "..." --content "..."` → 添加来源
3. `thought connect th-789 th-123` → 与已有 Idea 建立连接

**推导出的原子能力**：

- 创建 Thought
- 创建 Context
- 更新 Thought / Context
- 建立 Connection

### 模式 D：整理与维护（Maintain）

用户主动要求整理知识结构，或 Agent 建议用户进行整理（如分类重组、清理废弃内容）。

典型调用序列：

1. `category list` → 查看当前分类结构
2. `category create --name "行为设计"` → 创建新分类
3. `thought update th-123 --category-id cat-new` → 迁移 Thought
4. `trash list-thoughts` → 查看已删除内容
5. `thought restore th-deleted` → 恢复

**推导出的原子能力**：

- 分类的 CRUD
- Thought / Context 的软删除、恢复
- 回收站浏览

---

## 3. 目录草案（v2）

基于上述 4 个模式，命令分组如下：

```
reflecta
├── thought
│   ├── list                ← 模式 B：结构浏览（分类 / 类型 / 最近更新）
│   ├── get <id>            ← 模式 A：读取单条详情
│   ├── create              ← 模式 C：沉淀新想法
│   ├── update <id>         ← 模式 C / D：修改
│   ├── delete <id>         ← 模式 D：软删除
│   ├── restore <id>        ← 模式 D：从回收站恢复
│   ├── connect <src> <tgt> ← 模式 B / C：建立关联
│   └── disconnect <src> <tgt>
├── context
│   ├── list --thought-id <id>   ← 模式 A：查看某 Thought 的来源材料
│   ├── create                   ← 模式 C：添加来源 / 背景
│   ├── update <id>
│   ├── delete <id>
│   └── restore <id>
├── category
│   ├── list                ← 模式 B / D：感知知识结构
│   ├── create              ← 模式 D：扩展结构
│   ├── update <id>
│   └── delete <id> [--cascade]
├── search
│   ├── thoughts <query>    ← 模式 A：全局 FTS 搜索 thoughts
│   ├── contexts <query>    ← 模式 A：全局 FTS 搜索 contexts
│   └── all <query>         ← 模式 A：联合搜索，一次查全
└── trash
    ├── list-thoughts       ← 模式 D：回收站
    └── list-contexts
```

---

## 4. 设计决策说明

### 4.1 搜索能力统一放在 `search` 命令组

所有关键词检索（FTS）统一通过 `search thoughts`、`search contexts`、`search all` 访问，`thought` 组不保留搜索入口。

理由：

- Agent 需要"搜索"时，直观会去 `search` 命名空间查找。
- `thought list` 的职责是浏览和过滤（按分类、类型、时间），不是关键词检索。
- 避免同一能力有两个入口，减少 Agent 的决策成本。

### 4.2 `context list` 为什么放在 `context` 组而不是 `thought contexts`？

放在 `context` 组（`context list --thought-id <id>`）。

理由：

- Context 的 CRUD（create/update/delete）都在 `context` 组，list 放在一起保持操作一致性。
- Agent 在 `context --help` 中就能发现全部 context 操作，不需要跨组查找。
- `--thought-id` 是过滤条件而非主键，用选项而非位置参数是合理的。

### 4.3 `search all` 是否保留？

保留。

理由：

- 模式 A 中 Agent 经常需要同时了解"用户说了什么"（Thought）和"材料里有什么"（Context）。
- 虽然 Agent 可以并发调 `search thoughts` + `search contexts`，但本地 CLI 的并发意义不大（没有网络延迟），一次调用更省 token 和推理步数。
- 输出格式为 `{thoughts:[], contexts:[]}`，虽然与 jsonl 列表不一致，但 Agent 知道自己在调用 `search all`，能够处理嵌套结构。

### 4.4 `trash` 组是否需要 `restore` 命令？

不需要。恢复统一走 `thought restore <id>` 和 `context restore <id>`。

理由：

- Agent 在 `trash list-thoughts` 拿到 ID 后，直接调用 `thought restore <id>` 即可，路径清晰。
- `trash` 组只负责"查看回收站"，不越界到"恢复操作"，保持命令语义与底层 service 一致。

### 4.5 `thought list` 的过滤能力边界

`thought list` 支持以下过滤选项：

- `--category-id <id>` + `--include-descendants`
- `--type <idea|insight>`
- `--recent`
- `--limit`

不支持 `--search`（关键词搜索）。关键词检索统一走 `search thoughts <query>`。

理由：

- `list` 的职责是"浏览和过滤"，`search` 的职责是"关键词检索"。
- `listThoughts` 的 `searchQuery` 参数虽然存在，但它是前缀匹配且与 `searchThoughts` 的 FTS5 能力有重叠。对 Agent 来说，统一走 `search` 更简单，不需要理解两种搜索的语义差异。

---

## 5. 未暴露的能力与理由

| Service 方法                                      | 是否暴露 | 理由                                               |
| ------------------------------------------------- | -------- | -------------------------------------------------- |
| `ThoughtService.listThoughts(searchQuery)`        | ❌       | 与 `searchThoughts` 能力重叠，统一走 `search` 命令 |
| `SearchService.searchThoughts` / `searchContexts` | ✅       | 通过 `search` 命令组暴露                           |
| `TrashService.listTrashedThoughts`                | ✅       | 通过 `trash list-thoughts` 暴露                    |
| `ContextService.listTrashedContexts`              | ✅       | 通过 `trash list-contexts` 暴露                    |
| `CategoryService.deleteCategory(id, true)`        | ✅       | 通过 `category delete --cascade` 暴露              |

---

## 6. 待确认

1. **`search all` 的默认格式**：`search thoughts/contexts` 默认 jsonl，`search all` 返回嵌套对象。是否统一要求 `--format=json` 时才可用 `search all`？
2. **`thought list` 的默认排序**：非 `--recent` 模式下，`listThoughts` 没有指定排序。CLI 层是否需要统一按 `updatedAt` 降序？还是保持数据库默认顺序？
