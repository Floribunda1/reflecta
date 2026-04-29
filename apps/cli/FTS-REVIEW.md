# Reflecta CLI —— 当前 FTS 实现对照 Agent 场景 review

## 1. 当前实现概述

### 1.1 FTS5 表结构

```sql
CREATE VIRTUAL TABLE fts_thoughts USING fts5(
  thought_id UNINDEXED,   -- 不参与搜索
  title,                   -- 可搜索
  body,                    -- 可搜索
  content=''               -- 外部内容表，手动同步
);

CREATE VIRTUAL TABLE fts_contexts USING fts5(
  context_id UNINDEXED,   -- 不参与搜索
  thought_id UNINDEXED,   -- 不参与搜索
  source_name,             -- 可搜索
  content,                 -- 可搜索
  content=''
);
```

**关键事实**：没有指定 `tokenize='...'`，使用 FTS5 默认的 `unicode61` tokenizer。

### 1.2 查询实现

| 方法                           | SQL 模式                                   | 返回 snippet        | 返回 rank                |
| ------------------------------ | ------------------------------------------ | ------------------- | ------------------------ |
| `SearchService.searchThoughts` | `MATCH ${query} ORDER BY rank`             | ❌                  | ❌（只用于排序，不返回） |
| `SearchService.searchContexts` | `MATCH ${query} ORDER BY rank`             | ✅（`<mark>` 高亮） | ✅                       |
| `ThoughtService.listThoughts`  | `MATCH ${term}* ORDER BY rank`（前缀匹配） | ❌                  | ❌                       |

### 1.3 同步机制

Service 层手动维护，无数据库 trigger：

- `createThought` → `INSERT INTO fts_thoughts`
- `updateThought` → `DELETE` + `INSERT INTO fts_thoughts`
- `deleteThought` → `DELETE FROM fts_thoughts` + `DELETE FROM fts_contexts`
- `restoreThought` → `INSERT OR IGNORE INTO fts_thoughts`
- Context 的 CRUD 同理

同步逻辑完整，软删除的内容不会留在 FTS 索引中。

---

## 2. 逐一对照 Agent 工作流

### 模式 A：检索与理解（Read）

**Agent 行为**：用户提到一个概念，Agent 搜索知识库定位相关 Thought/Context。

| 场景                   | 当前 FTS 支持情况         | 问题                             |
| ---------------------- | ------------------------- | -------------------------------- |
| 搜索 thought 标题/正文 | `search thoughts <query>` | **有缺陷**（见下方问题 1、2）    |
| 搜索 context 内容      | `search contexts <query>` | 正常（含 snippet）               |
| 联合搜索               | `search all <query>`      | 正常，但 thoughts 部分无 snippet |

### 模式 B：发现与关联（Discover）

**Agent 行为**：Agent 想验证两个概念之间是否有潜在联系，分别搜索后分析。

| 场景                        | 当前支持                    | 评估                       |
| --------------------------- | --------------------------- | -------------------------- |
| 搜概念 A 的全部相关 thought | `search thoughts "A"`       | 依赖问题 1 的修复          |
| 搜概念 B 的全部相关 thought | `search thoughts "B"`       | 同上                       |
| 同时搜 A 和 B（共现）       | `search thoughts "A AND B"` | **有风险**（见下方问题 2） |

### 模式 C：记录与沉淀（Write）

**Agent 行为**：创建 Thought/Context 后，FTS 索引被正确更新。

| 场景                      | 当前支持 | 评估                                   |
| ------------------------- | -------- | -------------------------------------- |
| 新建 thought 后立即可搜索 | ✅       | 同步逻辑完整                           |
| 更新 thought 后索引正确   | ✅       | 先删后插，无脏数据                     |
| 删除 thought 后索引清理   | ✅       | 同时清理 thought 和关联 context 的 FTS |

### 模式 D：整理与维护（Maintain）

| 场景               | 当前支持 | 评估                             |
| ------------------ | -------- | -------------------------------- |
| 软删除后不可搜索   | ✅       | 已从 FTS 移除                    |
| 恢复后重新可搜索   | ✅       | INSERT OR IGNORE                 |
| 永久删除后彻底清理 | ✅       | fts_thoughts + fts_contexts 双清 |

---

## 3. 发现的问题

### 问题 1：中文搜索效果不一致（❗ 需要修复）

**现象**：

- `search thoughts "身份"` → 可能**找不到**包含 "身份认同" 的 thought
- `thought list --search "身份"` → **可以找到**（因为底层加了 `*` 前缀通配符）

**根因**：

- FTS5 默认 `unicode61` tokenizer 对中文按**连续字符串**切分（"身份认同" 被视为一个 token）
- `searchThoughts` 的 query **原样传入 MATCH**，没有自动加 `*`
- `listThoughts` 的 searchQuery **自动加了 `*`**（`MATCH '身份*'`）

**对 Agent 的影响**：
Agent 调用 `search thoughts "身份"` 和 `thought list --search "身份"` 得到不同结果，无法理解为什么。Agent 也不知道 FTS5 的 tokenizer 行为，不会主动加 `*`。

**建议修复**：
统一在 `searchThoughts` / `searchContexts` 的 query 处理中，为每个 token 自动追加 `*` 前缀（或至少对非引号包裹的单个 token 加 `*`）。让 `search` 和 `list --search` 的召回行为一致。

> 注意：如果 query 已经是复杂表达式（如 `"A AND B"`），加 `*` 需要更谨慎的处理，避免破坏语法。

---

### 问题 2：FTS5 查询语法直接暴露给 Agent（⚠️ 需要处理）

**现象**：
Agent 传入的 `query` 被原样拼进 `MATCH ${query}`。FTS5 MATCH 有特殊的查询语法：

- `A AND B` → 同时包含 A 和 B
- `A OR B` → 包含 A 或 B
- `NOT B` → 不包含 B
- `"phrase"` → 精确短语
- `A NEAR B` → proximity 搜索
- `*` 前缀通配符
- 特殊字符（如 `-`、`:`、`"`）可能导致解析错误或意外行为

**对 Agent 的影响**：

- Agent 可能无意构造出非法 MATCH 表达式，导致 SQLite 报错
- Agent 如果不知道 FTS5 语法，搜索 `"身份认同"` 时传入的引号会被 FTS 当作短语操作符，这可能不是 Agent 的意图
- 用户搜索内容本身可能包含特殊字符（如书名号、冒号），直接传入 MATCH 会出错

**建议修复**：
方案 A（推荐）：CLI 层对 query 做转义/清理，只保留安全的 token 字符，然后用 `AND` 连接。例如：

- Agent 传 `"身份认同"` → 清理为 `身份 认同` → 拼接为 `身份* AND 认同*`
- Agent 传 `design pattern` → 拼接为 `design* AND pattern*`

方案 B：用 `quote()` 包裹整个 query，让 FTS 把它当作字面量短语搜索。但这会失去 AND/OR 能力。

方案 C：让 Agent 自己学习 FTS5 查询语法。但这违背了 agent-friendly 原则（Agent 不应该了解底层索引的查询语法）。

---

### 问题 3：`searchThoughts` 不返回 snippet（🟡 可选优化）

**现象**：
`searchContexts` 返回了 `snippet`（带 `<mark>` 高亮），Agent 可以一眼看到匹配片段。但 `searchThoughts` 只返回完整的 `ThoughtSummaryDTO`。

**对 Agent 的影响**：

- Thought 的 body 通常不长，Agent 可以自己扫描找关键词，问题不大
- 但如果 body 较长，Agent 需要额外推理才能定位匹配位置，多消耗 token

**建议**：
可以考虑给 `searchThoughts` 也加上 `snippet()`，在返回的 jsonl 中增加一个 `snippet` 字段。但由于 `searchThoughts` 返回的是组装后的 DTO（不是直接从 FTS 表查询），实现上需要额外一次 snippet 查询。

优先级：低。个人知识库的 thought body 通常很短，Agent 全量阅读的成本不高。

---

### 问题 4：`search all` 的 thoughts 部分无 snippet（🟡 可选优化）

与问题 3 同理。`search all` 的 `contexts` 有 snippet，`thoughts` 没有。

---

## 4. 不是问题的地方

| 方面                   | 评估                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **同步机制**           | 手动维护正确，无遗漏。trigger 方案虽然更自动化，但手动维护在本地 SQLite 中更简单可控。     |
| **软删除过滤**         | 正确。delete 时同时清理 FTS，restore 时重新插入。                                          |
| **性能**               | 个人知识库规模下（几千条），FTS5 性能完全足够。                                            |
| **BM25 / 向量搜索**    | 不需要。数据规模和文本长度决定了 TF-based rank 已够用。                                    |
| **跨表联合搜索**       | `search all` 已满足。不需要在 SQL 层面做跨 FTS 表 JOIN。                                   |
| **Category name 搜索** | Category 数量少（通常 < 100），不需要 FTS。Agent 通过 `category list` 拉回后自己过滤即可。 |

---

## 5. 结论与建议

### 必须修复（P1）

**统一中文前缀搜索行为**：
让 `searchThoughts` / `searchContexts` 对 query 的处理与 `listThoughts` 的 searchQuery 一致——为非引号 token 自动追加 `*` 前缀，确保中文内容的前缀召回正常工作。

**屏蔽 FTS5 查询语法暴露**：
CLI 层对 query 做清理和分词，用安全的 `AND` 连接 token，不要让 Agent 的输入直接拼进 MATCH 表达式。

### 可选优化（P2）

给 `searchThoughts` 增加 snippet 返回，与 `searchContexts` 保持一致。实现成本不高，但收益也有限。

### 不需要做的事

- 引入 BM25 / 向量搜索 / RAG
- 增加 Category 的 FTS 索引
- 改为 trigger 自动同步
- 增加正则 / 子串搜索能力
