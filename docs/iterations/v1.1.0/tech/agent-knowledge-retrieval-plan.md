# v1.1.0 Agent Knowledge Retrieval 计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：把 Agent 的知识库搜索从“直接执行数据库 FTS 查询”改成“本地可解释的知识召回模块”。第一版不做 RAG、不做向量数据库、不做完整 GraphRAG。

## 1. 结论

第一版只用本地能力：

```txt
SQLite FTS
  + token fallback
  + Reflecta 现有关系图扩展
  + 本地可解释排序
  + retrieval trace
```

不引入：

- 向量数据库
- embedding pipeline
- LLM reranker
- GraphRAG community summary
- 固定 RAG pipeline

这里的核心变化不是“换搜索引擎”，而是新增一个 Reflecta 领域模块：

```txt
KnowledgeRetriever
```

它的接口是产品语义：

```txt
给定用户问题、关键词、当前选中引用或对话上下文，返回一批可解释、可继续读取的知识候选。
```

SQLite FTS、图关系、未来的 vector index 都只是它的实现细节。

## 2. 当前问题

现在 Agent 调用的是数据库味很重的搜索工具：

```txt
search_all("PDCA 检验 标准 Check 验证 迭代 反馈")
```

这个 query 进入 SQLite FTS 后，空格分隔的词会形成很强的匹配约束。对 Agent 来说，这句话本来是“一组候选关键词”；对 FTS 来说，它更像“这些词都要同时满足”。

真实 session JSONL 里已经出现过这种现象：

```txt
query: "PDCA 检验 标准 Check 验证 迭代 反馈"
result: thoughts=[], contexts=[]

query: "检验"
result: thoughts=2

query: "PDCA"
result: thoughts=1
```

所以根因不是“库里没有内容”，而是：

```txt
Agent 输入的是自然语言/关键词包。
当前 search_all 执行的是底层 FTS 表达式。
两者语义不一致。
```

## 3. 不是 RAG

这次不做 RAG。

RAG 通常是：

```txt
query
  -> retrieve chunks
  -> stuff into prompt
  -> generate answer
```

v1.1.0 的目标是：

```txt
query
  -> retrieve candidates
  -> Agent 选择要读哪些 Thought/Context
  -> Pi Agent 继续 loop
```

Pi Agent 仍然负责 loop。Reflecta 只负责把知识库候选召回做好。

## 4. 为什么会有 Graph

这里的 Graph 不是 GraphRAG。

Reflecta 本来就有结构化关系：

- Thought 属于 Category
- Thought 有 Context
- Thought 引用其他 Thought
- Thought 被其他 Thought 引用
- Thought 之间有 connection edge
- 用户可以显式选择 Thought / Context / Category 作为引用

所以 Graph 在第一版里的作用只有一个：

```txt
FTS 找入口点。
Graph 补周边上下文。
```

例子：

```txt
FTS 命中 Thought A: "PDCA 中的 C 才是关键"

Graph expansion 可以补：
  - A 的 Context
  - A 引用的 Thought
  - 引用 A 的 Thought
  - A 所属 Category 下的近邻 Thought
```

Graph 不负责凭空搜索。它只在已经有 anchor 时扩展。

## 5. 模块接口

新增模块建议放在：

```txt
packages/server/src/domains/retrieval
```

外部接口保持小：

```ts
type RetrieveKnowledgeInput = {
  query: string;
  anchors?: KnowledgeAnchor[];
  scope?: "all" | "thoughts" | "contexts";
  intent?: "find" | "compare" | "expand" | "verify";
  limit?: number;
};

type RetrieveKnowledgeResult = {
  candidates: KnowledgeCandidate[];
  trace: RetrievalTrace;
};
```

候选结果必须解释自己为什么出现：

```ts
type KnowledgeCandidate = {
  id: string;
  type: "thought" | "context" | "category";
  title?: string;
  snippet?: string;
  score: number;
  suggestedRead?: {
    tool: "thought_get" | "context_get" | "category_inspect";
    input: Record<string, unknown>;
  };
  evidence: CandidateEvidence[];
};

type CandidateEvidence = {
  channel: "lexical" | "graph" | "anchor";
  reason: string;
  matchedTokens?: string[];
  graphDistance?: number;
};
```

## 6. 模块内部职责

### 6.1 KnowledgeRetriever

总入口。

它只负责串流程：

```txt
normalize query
  -> lexical recall
  -> graph expansion
  -> candidate fusion
  -> trace
```

它不直接写 SQL，不直接遍历图，不直接算所有分数。

### 6.2 LexicalRetriever

本地文本召回。

第一版仍然用 SQLite FTS，但不把 FTS 语法暴露给 Agent。

执行顺序：

```txt
1. strict search
   用当前 FTS 行为查一次。

2. token fallback
   如果 strict 结果为空或过少，把 query 拆成 token，逐 token 搜索。

3. prefix fallback
   对短 token 做前缀召回。

4. substring fallback
   对中文词在 FTS 仍然召回不足时，用 LIKE 兜底。
```

输出不是最终结果，而是带 evidence 的候选：

```txt
Thought A
  evidence:
    lexical: matched token "PDCA" in title
    lexical: matched token "检验" in body
```

### 6.3 GraphExpander

从已有 anchor 扩展周边知识。

输入：

```txt
用户显式选择的 refs
LexicalRetriever 命中的 Thought / Context
```

扩展规则第一版只做一跳：

```txt
Thought -> contexts
Thought -> references
Thought -> referencedBy
Thought -> same category siblings, capped
Context -> parent thought
Category -> direct thoughts, capped
```

必须有 cap：

```txt
每个 seed 最多扩展 N 个候选。
总 graph candidates 最多 M 个。
```

避免图扩展把结果冲散。

### 6.4 CandidateFusion

合并、去重、排序。

同一个实体可能来自多个通道：

```txt
FTS 命中 title
Context 命中 content
Graph 从 selected ref 扩展到
```

Fusion 要把它们合成一个 candidate，并保留所有 evidence。

第一版用 deterministic score：

```txt
score =
  lexical token hits
  + title boost
  + exact phrase boost
  + anchor boost
  + graph distance boost
  + small recency boost
```

先不要上 LLM rerank。

### 6.5 RetrievalTrace

Debug 输出。

每次 retrieve 都返回 trace：

```json
{
  "query": "PDCA 检验 标准 Check 验证 迭代 反馈",
  "tokens": ["PDCA", "检验", "标准", "Check", "验证", "迭代", "反馈"],
  "strictHits": 0,
  "fallbacks": ["token"],
  "matchedTokens": ["PDCA", "检验"],
  "missedTokens": ["标准", "Check", "验证", "迭代", "反馈"],
  "lexicalCandidates": 3,
  "graphCandidates": 6,
  "returnedCandidates": 8
}
```

没有 trace，就等于又造了一个黑盒。

## 7. Agent 工具形态

第一版不要继续增加多个搜索工具。

Agent 主路径应该收敛成：

```txt
retrieve_knowledge
read knowledge detail tools
```

`retrieve_knowledge` 返回候选和下一步读取建议：

```json
{
  "id": "thought_1",
  "type": "thought",
  "title": "复盘的价值在于积累领域经验",
  "snippet": "复盘就是去理解现实世界的反馈...",
  "suggestedRead": {
    "tool": "thought_get",
    "input": { "thoughtId": "thought_1", "includeContexts": true }
  },
  "evidence": [
    {
      "channel": "lexical",
      "reason": "matched token: 复盘"
    }
  ]
}
```

保留底层 `thought_get`、`context_get`、`category_inspect`，但 prompt 里不鼓励 Agent 反复试不同 search query。

## 8. Phase 1：修 search_all 召回语义

用户状态：用户让 Agent 搜索知识库时，多关键词查询不再轻易返回空。

实现范围：

- 在 Agent read-only tool 内部改 `search_all` 的执行逻辑。
- 不改 CLI `search` 命令语义。
- 不引入新索引。
- 增加 `trace` 字段。

TDD：

1. RED：写 main unit/integration，用真实 search service 数据复现：
   - 多词 query strict 为空。
   - 单 token query 有结果。
   - `search_all` 最终应返回非空候选。
2. GREEN：实现 token fallback 和 merge 去重。
3. RED：写 trace 断言。
4. GREEN：返回 strict hits、matched tokens、fallback mode。

退出条件：

- Agent `search_all` 对关键词包有高召回。
- CLI 搜索行为不变。
- UI tool activity 仍能展示搜索数量。

## 9. Phase 2：引入 retrieve_knowledge 工具

用户状态：Agent 用一个更稳定的知识召回工具，不需要理解 FTS 语法。

实现范围：

- 新增 `KnowledgeRetriever` 模块。
- 新增 Pi read-only tool：`retrieve_knowledge`。
- `search_all` 暂时保留，但 prompt 中主推 `retrieve_knowledge`。

TDD：

1. RED：写 `KnowledgeRetriever.retrieveKnowledge()` 测试，输入自然语言 query，输出 candidates + trace。
2. GREEN：把 Phase 1 的 fallback 逻辑移入 `LexicalRetriever`。
3. RED：写 Pi tool result shape 测试。
4. GREEN：让 tool 返回 candidates、trace、suggestedRead。

退出条件：

- Agent 有一个产品语义的 retrieval tool。
- 旧 search tools 还能工作。
- 新 tool 输出可 debug。

## 10. Phase 3：加入 Graph Expansion

用户状态：Agent 搜到一个入口 Thought 后，可以看到相关上下文，而不是孤立命中。

实现范围：

- 新增 `GraphExpander`。
- 只做一跳扩展。
- 只从明确 anchor 扩展：
  - lexical hit
  - selected ref
  - user-provided context ref

TDD：

1. RED：给定一个 lexical hit Thought，返回它的 Context 和 referencedBy Thought。
2. GREEN：实现一跳 graph expansion。
3. RED：给定 selected ref，即使 query 文本弱，也能返回 anchor 周边候选。
4. GREEN：把 anchors 接入 `retrieveKnowledge()`。
5. RED：graph expansion cap 测试。
6. GREEN：限制每个 seed 和总候选数量。

退出条件：

- Retrieval result 能解释 graph evidence。
- 不会因为图扩展返回过多无关结果。

## 11. Phase 4：统一 SearchDocument

用户状态：搜索结果能稳定覆盖 Thought、Context、Category，不再每种实体一套临时查询。

实现范围：

新增统一投影模型：

```ts
type SearchDocument = {
  docId: string;
  entityType: "thought" | "context" | "category";
  entityId: string;
  thoughtId?: string;
  title: string;
  text: string;
  categoryIds: string[];
  updatedAt: string;
};
```

SQLite 可落成：

```txt
search_documents
search_documents_fts
```

TDD：

1. RED：Thought 创建/更新/删除后 SearchDocument 同步。
2. GREEN：同步 Thought projection。
3. RED：Context 创建/更新/删除后 SearchDocument 同步。
4. GREEN：同步 Context projection。
5. RED：Category 名称可作为召回信号。
6. GREEN：Category projection 或 category names 注入 Thought/Context document。

退出条件：

- Retrieval 不再直接依赖多套 domain-specific FTS 表。
- 未来加 vector 时只需要给 `SearchDocument` 加 embedding。

## 12. Phase 5：可选 Semantic Channel

只有满足下面条件才进入：

```txt
lexical + graph 已稳定，
但真实使用中仍大量出现“语义相关但无共同关键词”的漏召回。
```

实现范围：

- 增加 `SemanticRetriever`。
- 用 `SearchDocument` 生成 embedding。
- 本地优先，候选技术：
  - LanceDB
  - Chroma
  - Typesense
  - SQLite vector extension 如果项目依赖可接受

不在第一版做的原因：

- embedding pipeline 会引入索引同步和模型成本。
- vector 结果 debug 难度高于 lexical/graph。
- 当前真实问题是关键词包被 FTS 严格解释导致空结果。

退出条件：

- semantic channel 是补召回，不替代 lexical。
- trace 能显示 semantic evidence。
- fusion 能合并 lexical / graph / semantic。

## 13. 验收标准

产品验收：

- Agent 搜索知识库时，不再因为多关键词 query 大量返回空。
- 用户能在 tool activity 中看到搜索命中数量。
- Debug 时能看到 retrieval trace。
- Agent 能根据 `suggestedRead` 读取候选详情。

工程验收：

- Agent 不需要知道 FTS 语法。
- FTS、Graph、未来 Vector 都藏在 `KnowledgeRetriever` 后面。
- `retrieveKnowledge()` 是测试主 seam。
- CLI 现有 search 行为不被 Phase 1 意外改变。

## 14. 最终目标形态

```txt
Pi Agent
  -> retrieve_knowledge(query, anchors, intent)
  -> KnowledgeRetriever
      -> LexicalRetriever(SQLite FTS / token fallback)
      -> GraphExpander(Reflecta relations)
      -> CandidateFusion(score + evidence)
      -> RetrievalTrace
  -> candidates + suggestedRead
  -> thought_get / context_get / category_inspect
```

一句话：

```txt
v1.1.0 先做本地-first 的 Hybrid Knowledge Retriever：
SQLite FTS 负责文本入口，
Reflecta Graph 负责上下文扩展，
可解释 Fusion 负责排序和 debug，
Vector 只作为未来可插拔的补召回通道。
```
