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
  + Context provenance recall
  + Reflecta 显式关系扩展
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
给定用户问题、关键词、当前选中的 Thought / Context / Category 引用，返回一批有来源证据、可继续读取的个人理解候选。
```

SQLite FTS、Context 来源、显式关系、未来的 vector index 都只是它的实现细节。

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
  -> retrieve grounded understanding candidates
  -> Agent 选择要读哪些 Thought 或具体来源 Context
  -> Pi Agent 继续 loop
```

Pi Agent 仍然负责 loop。Reflecta 只负责把知识库候选召回做好。

## 4. Product Semantics：Context 是理解的根

这个模块必须服从 Reflecta 的 value proposition：

```txt
Reflecta 帮用户把学习、实践和对话，沉淀成可追溯的个人理解。
```

在这个语义里：

```txt
Thought = 用户形成的个人理解
Context = 这个理解从哪里长出来的具象来源
Connection = 用户显式意识到的理解关系
Category = 用户回看某个领域的语境
```

所以 Context 不是“知识周边”，也不是普通附件。Context 回答的是：

```txt
这个理解为什么会形成？
它来自哪次实践、哪段材料、哪场对话、哪次失败、哪种具体场景？
```

这会直接改变 retrieval 的设计：

```txt
Context 命中不是次级信号。
Context 命中是“这条 Thought 有具体来源证据”的强信号。
```

一个 Context 被搜索命中时，retrieval 不应该只返回一个孤立的 Context，也不应该把它当作 Thought 的“周边”。它应该返回：

```txt
父 Thought 作为理解候选
  + 命中的 Context 作为 source evidence
```

例子：

```txt
query: "AI workflow debug 不满意 标准"

Context 命中：
  "今天花了很多时间去让它写一个 human readable 的文档..."

父 Thought：
  "认知边界：AI能力的天花板"

Retrieval candidate 应该表达：
  这条 Thought 相关，因为它有一个具体 AI workflow 调试场景作为来源证据。
```

## 5. 为什么还会有关系扩展

这里的关系扩展不是 GraphRAG。

Reflecta 本来就有结构化关系：

- Thought 属于 Category
- Thought 引用其他 Thought
- Thought 被其他 Thought 引用
- Thought 之间有 connection edge
- 用户可以显式选择 Thought / Context / Category 作为引用

所以关系扩展在第一版里的作用只有一个：

```txt
FTS / Context 找入口点。
显式关系补相邻理解。
```

例子：

```txt
FTS 命中 Thought A: "PDCA 中的 C 才是关键"

Relation expansion 可以补：
  - A 引用的 Thought
  - 引用 A 的 Thought
  - A 所属 Category 下的近邻 Thought
```

关系扩展不负责凭空搜索。它只在已经有 anchor 时扩展。

Context 不在这一层处理。Context 是 provenance/source evidence，有自己的召回和打分语义。

## 6. 模块接口

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
  candidates: UnderstandingCandidate[];
  trace: RetrievalTrace;
};
```

候选结果必须解释自己为什么出现，并且优先围绕 Thought 组织：

```ts
type UnderstandingCandidate = {
  id: string;
  type: "thought";
  title?: string;
  snippet?: string;
  score: number;
  sourceEvidence: SourceEvidence[];
  suggestedRead?: {
    tool: "thought_get";
    input: { thoughtId: string; includeContexts: true };
  };
  evidence: CandidateEvidence[];
};

type SourceEvidence = {
  contextId: string;
  sourceType: string;
  sourceName?: string | null;
  snippet: string;
  matchedTokens: string[];
  reason: string;
};

type CandidateEvidence = {
  channel: "thought_text" | "source_context" | "relation" | "anchor";
  reason: string;
  matchedTokens?: string[];
  relationDistance?: number;
};
```

Context 可以作为 detail 被读取，但 retrieval 的默认候选主语是 Thought。这样符合产品语义：用户回看的是个人理解，Context 说明这个理解从哪里长出来。

## 7. 模块内部职责

### 7.1 KnowledgeRetriever

总入口。

它只负责串流程：

```txt
normalize query
  -> thought lexical recall
  -> context provenance recall
  -> relation expansion
  -> candidate fusion
  -> trace
```

它不直接写 SQL，不直接遍历图，不直接算所有分数。

### 7.2 ThoughtTextRetriever

本地 Thought 文本召回。

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
    thought_text: matched token "PDCA" in title
    thought_text: matched token "检验" in body
```

### 7.3 ContextProvenanceRetriever

本地 Context 来源召回。

这不是普通“搜索 context”。它的输出要回到父 Thought：

```txt
Context 命中
  -> 找到 parent Thought
  -> 给 parent Thought 添加 sourceEvidence
  -> 提升 parent Thought 的排序
```

Context 召回应覆盖：

```txt
sourceType
sourceName
content
parent Thought title
parent Thought categories
```

输出例子：

```txt
Thought "AI工作流调试能力"
  sourceEvidence:
    Context "一次 AI workflow 产出失控的具体经历"
      matchedTokens: ["workflow", "debug", "不满意"]
      reason: "具体实践场景命中 query"
```

这层是 Reflecta value proposition 的核心，不是锦上添花。

### 7.4 RelationExpander

从已有 anchor 扩展相邻理解。

输入：

```txt
用户显式选择的 refs
ThoughtTextRetriever 命中的 Thought
ContextProvenanceRetriever 找到的 parent Thought
```

扩展规则第一版只做一跳：

```txt
Thought -> references
Thought -> referencedBy
Thought -> same category siblings, capped
Category -> direct thoughts, capped
```

必须有 cap：

```txt
每个 seed 最多扩展 N 个候选。
总 relation candidates 最多 M 个。
```

避免图扩展把结果冲散。

### 7.5 CandidateFusion

合并、去重、排序。

同一个实体可能来自多个通道：

```txt
FTS 命中 title
Context 来源命中具体场景
Relation 从 selected ref 扩展到
```

Fusion 要把它们合成一个 candidate，并保留所有 evidence。

第一版用 deterministic score：

```txt
score =
  thought text token hits
  + source context token hits
  + source evidence boost
  + title boost
  + exact phrase boost
  + anchor boost
  + relation distance boost
  + small recency boost
```

先不要上 LLM rerank。

### 7.6 RetrievalTrace

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
  "thoughtTextCandidates": 3,
  "contextSourceCandidates": 4,
  "relationCandidates": 6,
  "returnedCandidates": 8
}
```

没有 trace，就等于又造了一个黑盒。

## 8. Agent 工具形态

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
  "sourceEvidence": [
    {
      "contextId": "context_1",
      "sourceType": "experience",
      "sourceName": null,
      "snippet": "一次交易亏损后复盘当时的市场判断和执行纪律...",
      "matchedTokens": ["复盘", "反馈"],
      "reason": "具体实践来源命中 query"
    }
  ],
  "suggestedRead": {
    "tool": "thought_get",
    "input": { "thoughtId": "thought_1", "includeContexts": true }
  },
  "evidence": [
    {
      "channel": "source_context",
      "reason": "matched token: 复盘"
    }
  ]
}
```

保留底层 `thought_get`、`context_get`、`category_inspect`，但 prompt 里不鼓励 Agent 反复试不同 search query。

## 9. Phase 1：修 search_all 召回语义

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
   - 如果命中来自 Context，结果必须能指回 parent Thought。
2. GREEN：实现 token fallback 和 merge 去重。
3. RED：写 trace 断言。
4. GREEN：返回 strict hits、matched tokens、fallback mode。

退出条件：

- Agent `search_all` 对关键词包有高召回。
- Context 命中不会丢失 Thought provenance。
- CLI 搜索行为不变。
- UI tool activity 仍能展示搜索数量。

## 10. Phase 2：引入 retrieve_knowledge 工具

用户状态：Agent 用一个更稳定的知识召回工具，不需要理解 FTS 语法。

实现范围：

- 新增 `KnowledgeRetriever` 模块。
- 新增 Pi read-only tool：`retrieve_knowledge`。
- `search_all` 暂时保留，但 prompt 中主推 `retrieve_knowledge`。

TDD：

1. RED：写 `KnowledgeRetriever.retrieveKnowledge()` 测试，输入自然语言 query，输出 candidates + trace。
2. GREEN：把 Phase 1 的 fallback 逻辑移入 `ThoughtTextRetriever`。
3. RED：写 Pi tool result shape 测试。
4. GREEN：让 tool 返回 candidates、sourceEvidence、trace、suggestedRead。

退出条件：

- Agent 有一个产品语义的 retrieval tool。
- 旧 search tools 还能工作。
- 新 tool 输出可 debug，并保留 Context provenance。

## 11. Phase 3：Context Provenance 作为一级召回信号

用户状态：Agent 可以从具体来源场景找到对应理解，而不是只搜抽象 Thought 文本。

实现范围：

- 新增 `ContextProvenanceRetriever`。
- Context 命中必须 group 到 parent Thought。
- `sourceEvidence` 必须进入 `retrieve_knowledge` 输出。
- Context 来源匹配应比普通 body 匹配权重更高，因为它代表理解有具体根。

TDD：

1. RED：给定一个只命中 Context content 的 query，返回 parent Thought。
2. GREEN：实现 Context -> parent Thought grouping。
3. RED：candidate 输出包含 sourceEvidence。
4. GREEN：返回 context snippet、sourceType、sourceName、matchedTokens。
5. RED：Context 命中的 Thought 排名高于只有弱 body 命中的 Thought。
6. GREEN：在 CandidateFusion 加 source evidence boost。

退出条件：

- Retrieval 不会把 Context 当作普通周边材料。
- 用户和 Agent 都能看到理解的来源证据。

## 12. Phase 4：加入 Relation Expansion

用户状态：Agent 找到一个入口理解后，可以看到显式相关的相邻理解。

实现范围：

- 新增 `RelationExpander`。
- 只做一跳扩展。
- 只从明确 anchor 扩展：
  - Thought text hit
  - Context provenance hit 的 parent Thought
  - selected ref

TDD：

1. RED：给定一个 matched Thought，返回 referencedBy Thought。
2. GREEN：实现一跳 relation expansion。
3. RED：给定 selected ref，即使 query 文本弱，也能返回 anchor 相邻理解。
4. GREEN：把 anchors 接入 `retrieveKnowledge()`。
5. RED：relation expansion cap 测试。
6. GREEN：限制每个 seed 和总候选数量。

退出条件：

- Retrieval result 能解释 relation evidence。
- 不会因为关系扩展返回过多无关结果。
- Context 不通过 RelationExpander 扩展；Context 仍由 provenance 逻辑处理。

## 13. Phase 5：统一 SearchDocument

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
  sourceType?: string;
  sourceName?: string | null;
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
- Context document 保留 source provenance 字段，不被降级成普通 text chunk。

## 14. Phase 6：可选 Semantic Channel

只有满足下面条件才进入：

```txt
Thought 文本召回 + Context 来源召回 + relation expansion 已稳定，
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
- vector 结果 debug 难度高于本地文本召回和来源证据召回。
- 当前真实问题是关键词包被 FTS 严格解释导致空结果。

退出条件：

- semantic channel 是补召回，不替代 lexical。
- trace 能显示 semantic evidence。
- fusion 能合并 thought text / source context / relation / semantic。

## 15. 验收标准

产品验收：

- Agent 搜索知识库时，不再因为多关键词 query 大量返回空。
- Agent 能通过具体 Context 来源场景找到对应 Thought。
- 搜索结果能表达“这条理解从哪里长出来”。
- 用户能在 tool activity 中看到搜索命中数量。
- Debug 时能看到 retrieval trace。
- Agent 能根据 `suggestedRead` 读取候选详情。

工程验收：

- Agent 不需要知道 FTS 语法。
- FTS、Context provenance、Relation expansion、未来 Vector 都藏在 `KnowledgeRetriever` 后面。
- `retrieveKnowledge()` 是测试主 seam。
- CLI 现有 search 行为不被 Phase 1 意外改变。

## 16. 最终目标形态

```txt
Pi Agent
  -> retrieve_knowledge(query, anchors, intent)
  -> KnowledgeRetriever
      -> ThoughtTextRetriever(SQLite FTS / token fallback)
      -> ContextProvenanceRetriever(Context as source evidence)
      -> RelationExpander(Reflecta explicit relations)
      -> CandidateFusion(score + evidence)
      -> RetrievalTrace
  -> candidates + suggestedRead
  -> thought_get / context_get / category_inspect
```

一句话：

```txt
v1.1.0 先做本地-first 的 Hybrid Knowledge Retriever：
SQLite FTS 负责 Thought 文本入口，
Context provenance 负责具象来源证据，
Reflecta relation graph 负责相邻理解扩展，
可解释 Fusion 负责排序和 debug，
Vector 只作为未来可插拔的补召回通道。
```
