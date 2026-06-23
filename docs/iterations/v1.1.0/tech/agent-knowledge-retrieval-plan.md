# v1.1.0 Agent Knowledge Retrieval 计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：用 LanceDB 完全替换当前 SQLite FTS 搜索方案，把 Agent 的知识库搜索改成本地优先的 hybrid semantic retrieval。第一版采用 RAG 社区成熟的 retrieval 技术，但不做完整 RAG answer pipeline，不做自动 GraphRAG 社区总结。

## 1. 结论

这版不应该只是把 FTS 的 `AND` 搜索改成 `OR` fallback。

`AND` 导致空结果只是症状。真正要改的是：

```txt
Agent natural language query
  -> hybrid semantic retrieval
  -> grounded Understanding candidates
```

第一版主路径：

```txt
RetrievalDocument projection
  + dense vector search
  + LanceDB FTS / BM25 lexical search
  + RRF fusion
  + parent Understanding grouping
  + Reflecta explicit relation expansion
  + retrieval trace
```

不做：

- 固定 RAG answer pipeline
- LLM 直接生成最终答案并自动写回
- GraphRAG community summary
- LLM reranker 作为第一版必需项
- 云端向量数据库作为默认依赖
- 继续维护 SQLite FTS 搜索索引

一句话：

```txt
Reflecta Retrieval 不是“搜资料片段”，而是从语义和关键词两路找入口，
最后返回可解释、可继续读取的个人 Understanding 候选。
```

## 2. 社区方案校准

社区主流 RAG / semantic retrieval 通常不是纯 keyword search，也不是纯 vector search，而是组合：

- retriever interface：接收自然语言 query，返回可供后续使用的 documents。
- dense vector search：找语义相近内容，解决“意思相近但没有共同关键词”。
- sparse / BM25 / FTS：保住术语、专有名词、缩写、ID、精确词。
- hybrid fusion：把 dense 和 sparse 的结果合并，常见默认是 RRF。
- parent document retrieval：先搜小粒度 chunk，再返回更完整的 parent document。
- contextual retrieval：给 chunk 补父文档语境再 embed，避免 chunk 脱离上下文。
- reranking：作为第二阶段优化，不是第一版必须。

参考：

- [LangChain retrievers](https://docs.langchain.com/oss/python/integrations/retrievers)
- [LangChain ParentDocumentRetriever](https://reference.langchain.com/python/langchain-classic/retrievers/parent_document_retriever/ParentDocumentRetriever)
- [LanceDB Hybrid Search](https://docs.lancedb.com/search/hybrid-search)
- [Qdrant Hybrid Queries](https://qdrant.tech/documentation/search/hybrid-queries/)
- [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- [Microsoft GraphRAG query modes](https://microsoft.github.io/graphrag/)

Reflecta 应该采用其中的 retrieval 技术，但输出对象不能照搬普通 RAG 的 `chunk`。Reflecta 的默认输出主语必须是 `Understanding`。

## 3. 当前问题与替换边界

现在 Agent 调用的是通用搜索工具：

```txt
search({ query: "PDCA 检验 标准 Check 验证 迭代 反馈" })
```

这个 query 对 Agent 来说是自然语言 / 关键词包。对当前 SQLite FTS 来说，它可能变成过强的布尔约束，导致明明有相关内容却返回空。

真实 session JSONL 里已经出现过：

```txt
query: "PDCA 检验 标准 Check 验证 迭代 反馈"
result: understandings=[], contexts=[]

query: "检验"
result: understandings=2

query: "PDCA"
result: understandings=1
```

但直接开放 `OR` 搜索只解决“不为空”：

```txt
OR search
  -> scattered Understanding hits
  -> scattered Context hits
```

它仍然没有解决：

- 语义相近但无共同关键词的漏召回。
- Context 命中后如何回到父 Understanding。
- 同一条 Understanding 的多路证据如何合并。
- Agent 下一步应该读取哪条 detail。
- Debug 时如何知道 dense / lexical / relation 哪一路起作用。

所以第一版应该做 hybrid semantic retrieval，而不是 FTS patch。

替换边界：

```txt
SQLite = Reflecta 产品事实源
LanceDB = 唯一检索索引
```

SQLite 仍然保存 `understandings`、`contexts`、`domains`、`connections`。LanceDB 保存由这些表派生出来的 `RetrievalDocument` rows，并负责 dense vector search、FTS / BM25、hybrid fusion。

当前 `SearchCore` / SQLite FTS 搜索路径要被替换：

- Pi Agent 的 `retrieve_knowledge` 使用 LanceDB。
- 现有 `search` tool 如果继续保留名称，也只作为兼容入口，内部走 LanceDB / `retrieveKnowledge()`。
- CLI `search` 也切到 LanceDB，不再直接查 SQLite FTS。
- 删除 SQLite FTS 表：`fts_understandings` / `fts_contexts`。

## 4. Product Semantics

这个模块必须服从 Reflecta 的 value proposition：

```txt
Reflecta 帮用户把学习、实践和对话，沉淀成可追溯的个人理解。
```

在这个语义里：

```txt
Understanding = 用户形成的个人理解
Context = 围绕 Understanding 的具象上下文，可记录形成、支撑、应用、挑战或修正
Connection = 用户显式意识到的理解关系
Domain = 用户回看某个领域的语境
```

Retrieval 的关键区别：

```txt
检索单元可以是 Understanding 或 Context。
返回候选默认必须是 Understanding。
```

Context 命中不是次级信号。Context 命中说明：

```txt
这条 Understanding 有一个具体上下文和 query 相关。
```

所以当检索命中 Context 时，结果不应该只返回孤立 Context：

```txt
context:C1
```

而应该返回：

```txt
Understanding U1
  + matchedContext C1
  + evidence: semantic / lexical hit on C1
```

这就是 Reflecta 版本的 parent document retrieval：

```txt
child document = Context retrieval document
parent document = Understanding
```

## 5. RetrievalDocument

`RetrievalDocument` 是检索索引里的派生投影，不是产品源数据。

源数据仍然是：

```txt
understandings
contexts
domains
connections
```

检索索引用的是：

```txt
source tables
  -> RetrievalDocument
  -> LanceDB vector column
  -> LanceDB FTS / BM25 index
```

最小类型：

```ts
type RetrievalDocument = {
  id: string; // "understanding:U1" | "context:C1"
  entityType: "understanding" | "context";
  entityId: string;
  parentUnderstandingId: string;
  textForEmbedding: string;
  textForLexicalSearch: string;
  metadata: {
    domainIds: string[];
    domainNames: string[];
    medium?: string;
    title?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
};
```

`parentUnderstandingId` 是检索层回到产品语义层的桥。

例子：

```txt
Understanding U1:
title: AI 工作流的关键是验收标准，不是提示词堆叠
body: Agent 产出质量取决于是否有明确 check 标准...

Context C1:
understandingId: U1
medium: experience
title: 一次写 human readable 文档失败的经历
content: debug 很久后发现问题不是 prompt，而是没有定义什么叫 human readable...
```

生成两条检索文档：

```ts
{
  id: "understanding:U1",
  entityType: "understanding",
  entityId: "U1",
  parentUnderstandingId: "U1",
  textForEmbedding: [
    "Understanding: AI 工作流的关键是验收标准，不是提示词堆叠",
    "Domain: AI / Agent",
    "Agent 产出质量取决于是否有明确 check 标准..."
  ].join("\n"),
  textForLexicalSearch: "AI 工作流 验收标准 提示词 check 标准 Agent 产出质量..."
}
```

```ts
{
  id: "context:C1",
  entityType: "context",
  entityId: "C1",
  parentUnderstandingId: "U1",
  textForEmbedding: [
    "Parent Understanding: AI 工作流的关键是验收标准，不是提示词堆叠",
    "Domain: AI / Agent",
    "Context medium: experience",
    "Context title: 一次写 human readable 文档失败的经历",
    "debug 很久后发现问题不是 prompt，而是没有定义什么叫 human readable..."
  ].join("\n"),
  textForLexicalSearch: "AI 工作流 验收标准 human readable debug prompt experience..."
}
```

为什么 Context 的 embedding text 要带 parent Understanding？

```txt
裸 Context 容易丢语境。
带 parent title / domain / medium 后，embedding 更容易表达“这个具体场景支撑哪条理解”。
```

## 6. 模块接口

新增模块建议放在：

```txt
packages/server/src/domains/retrieval
```

外部 interface 保持小：

```ts
type KnowledgeAnchor =
  | { type: "understanding"; id: string }
  | { type: "context"; id: string }
  | { type: "domain"; id: string };

type RetrieveKnowledgeInput = {
  query: string;
  anchors?: KnowledgeAnchor[];
  limit?: number;
};

type RetrieveKnowledgeResult = {
  candidates: UnderstandingCandidate[];
  trace: RetrievalTrace;
};
```

先不加 `intent` / `scope`。第一版没有明确行为差异时，这些参数只会扩大 interface。

候选：

```ts
type UnderstandingCandidate = {
  id: string;
  type: "understanding";
  title?: string | null;
  snippet?: string;
  score: number;
  matchedContexts: MatchedContext[];
  suggestedRead: {
    tool: "understanding_get";
    input: { understandingId: string; includeContexts: true };
  };
  evidence: CandidateEvidence[];
};

type MatchedContext = {
  contextId: string;
  medium: string;
  title?: string | null;
  snippet: string;
  reason: string;
};

type CandidateEvidence = {
  channel: "dense" | "lexical" | "relation" | "anchor";
  documentId?: string;
  entityType?: "understanding" | "context";
  score?: number;
  rank?: number;
  reason: string;
};
```

## 7. 内部流程

```txt
retrieveKnowledge(query, anchors)
  -> build query embedding
  -> LanceDB hybrid search RetrievalDocument
  -> group by parentUnderstandingId
  -> attach matched Contexts
  -> expand explicit relations from strong anchors
  -> build Understanding candidates
  -> trace
```

### 7.1 RetrievalProjection

负责从产品表生成 `RetrievalDocument`。

规则：

- Understanding 生成一条 `understanding:*` document。
- Context 生成一条 `context:*` document。
- Context document 必须包含 parent Understanding title、Domain names、medium、title、content。
- Domain 不作为默认 candidate，但 Domain name 进入 Understanding / Context metadata 和 text。
- 删除 / 更新 Understanding 或 Context 时，同步删除 / 更新对应 document。

这个 projection 可以删掉重建。它不是事实来源。

同步原则：

```txt
SQLite write succeeds
  -> syncByUnderstandingId(parentUnderstandingId)
  -> LanceDB upsert / delete
```

LanceDB 同步失败不能回滚 SQLite 产品数据。失败时记录 index dirty 状态，后续触发 `rebuildRetrievalIndex()`。

### 7.2 LanceDbRetrievalIndex

负责：

- 管理 LanceDB table。
- 写入 `RetrievalDocument` rows。
- 存储 embedding vector。
- 为 lexical text 建 LanceDB FTS index。
- 执行 LanceDB vector / FTS / hybrid search。
- 记录 embedding model、dimension、projection version、index location。
- embedding model 或 projection version 变化时触发 rebuild。

第一版必须支持 rebuild，不必先做复杂增量迁移。

### 7.3 EmbeddingProvider

负责：

- 把 query 和 `RetrievalDocument.textForEmbedding` 转成 vector。
- 保证写入索引和查询使用同一个 embedding model。
- 批量生成 embedding，避免逐条网络请求。

第一版默认使用一个 provider embedding model。模型切换时不做在线混用，直接 full rebuild。

### 7.4 HybridRetriever

调用 LanceDB 执行 hybrid search：

```txt
dense vector search
lexical FTS / BM25 search
RRF fusion
```

RRF 可以由 LanceDB 提供；如果 API 层不满足 trace 需要，再在 adapter 里显式合并：

```txt
fusedScore(doc) =
  sum(1 / (k + rankFromEachChannel))
```

第一版不调复杂权重。没有评测集时，RRF 是足够稳的默认。

### 7.5 UnderstandingCandidateBuilder

把 fused retrieval documents 映射回 `UnderstandingCandidate`。

规则：

```txt
doc entityType = understanding
  -> candidate parentUnderstandingId
  -> evidence on Understanding

doc entityType = context
  -> candidate parentUnderstandingId
  -> matchedContexts includes context
  -> evidence on Context
```

同一个 `parentUnderstandingId` 下的多条 document 合并成一个 candidate。

### 7.6 RelationExpander

关系扩展不是 GraphRAG。

它只从强 anchor 扩展一跳：

- 用户显式选择的 Understanding。
- 用户显式选择的 Domain。
- dense / lexical fusion 排名前列的 Understanding。
- Context 命中后折回的 parent Understanding。

第一版只做：

- Understanding -> references
- Understanding -> referencedBy
- Understanding -> connection edge
- Domain anchor -> direct understandings, capped

默认不做 same-domain siblings 的大范围扩散。Domain 是语境，不等于强关系。

必须有 cap：

```txt
per seed max N
total relation candidates max M
```

### 7.7 Optional Reranker

第一版不强制上 LLM reranker。

保留后续入口：

```txt
hybrid candidates top 50
  -> reranker
  -> top 10 candidates
```

只有当真实查询出现“hybrid 召回到了，但排序明显不稳定”时再加。

## 8. RetrievalTrace

每次 retrieve 都返回 trace。

示例：

```json
{
  "query": "agent 产出不满意 不是 prompt 是标准问题",
  "embeddingModel": "text-embedding-xxx",
  "projectionVersion": 1,
  "dense": {
    "searched": true,
    "topK": 30,
    "hits": 12
  },
  "lexical": {
    "searched": true,
    "topK": 30,
    "hits": 7
  },
  "fusion": {
    "method": "rrf",
    "documentsAfterFusion": 15
  },
  "grouping": {
    "understandingCandidates": 6,
    "matchedContexts": 4
  },
  "relation": {
    "expandedFrom": 3,
    "candidates": 2
  },
  "returnedCandidates": 8
}
```

Trace 不是给用户展示全文，而是让开发和 Agent 调试时知道：

- 是 dense 命中，还是 lexical 命中。
- 哪些 Context 被折回了哪个 Understanding。
- relation expansion 有没有冲散结果。
- index / embedding 是否过期。

## 9. Agent 工具形态

主路径：

```txt
retrieve_knowledge
understanding_get / context_get / domain_inspect
```

`retrieve_knowledge` 返回候选和下一步读取建议：

```json
{
  "id": "understanding_1",
  "type": "understanding",
  "title": "AI 工作流的关键是验收标准，不是提示词堆叠",
  "snippet": "Agent 产出质量取决于是否有明确 check 标准...",
  "score": 0.52,
  "matchedContexts": [
    {
      "contextId": "context_1",
      "medium": "experience",
      "title": "一次写 human readable 文档失败的经历",
      "snippet": "debug 很久后发现问题不是 prompt...",
      "reason": "context document semantic hit"
    }
  ],
  "suggestedRead": {
    "tool": "understanding_get",
    "input": { "understandingId": "understanding_1", "includeContexts": true }
  },
  "evidence": [
    {
      "channel": "dense",
      "documentId": "context:context_1",
      "entityType": "context",
      "rank": 2,
      "reason": "semantic similarity on contextualized Context"
    },
    {
      "channel": "lexical",
      "documentId": "understanding:understanding_1",
      "entityType": "understanding",
      "rank": 5,
      "reason": "lexical hit on AI / 标准"
    }
  ]
}
```

现有 `search` 名称可以保留做兼容，但不能再走旧 SQLite FTS。它要么直接调用 `retrieveKnowledge()` 并降级成旧 shape，要么在内部调用同一个 LanceDB adapter。

## 10. 技术选型

选定 LanceDB。

原因：

- 本地库，不需要额外服务进程。
- 同一套索引覆盖 vector search、FTS / BM25、hybrid search。
- TypeScript 可用，适合 Electron main 进程集成。
- 替代 SQLite FTS 后，检索逻辑集中在一个 index adapter，少维护一套搜索语义。

风险：

- Electron 打包和 native dependency 需要 spike。
- LanceDB index 是 SQLite 之外的新持久化目录，需要明确存储位置和 rebuild 策略。
- embedding provider 失败时，写路径不能让 SQLite 产品数据回滚。

不采用：

- SQLite FTS5 + sqlite-vec：会让 hybrid fusion、index sync、embedding storage 都落到自己维护。
- Qdrant / Chroma：更像额外检索服务，先不引入服务进程。
- GraphRAG：适合全库宏观问题和 community summary，不适合作为 v1.1.0 主线。

Phase 0 只验证 LanceDB 是否能在 Electron 环境稳定运行。

## 11. Phase 0：LanceDB Spike

用户状态：无用户可见变化。

实现范围：

- 用少量 Understanding / Context 样本生成 `RetrievalDocument`。
- 验证 LanceDB table 创建、写入、删除、查询。
- 验证 vector search、FTS search、hybrid search。
- 验证 Electron main 进程可写入、查询、重启后读取索引。
- 验证打包风险，不做完整 UI。

TDD / checks：

1. 给定 Understanding + Context，能生成 deterministic `RetrievalDocument`。
2. Context document 包含 parent Understanding title / Domain / medium / content。
3. 能对 query 做 dense search。
4. 能对 query 做 LanceDB FTS / lexical search。
5. 能执行 LanceDB hybrid search。

退出条件：

- LanceDB 可在 Electron main 进程稳定运行。
- 明确 embedding model、dimension、LanceDB index 存储位置。
- 明确 rebuild 策略。

## 12. Phase 1：RetrievalDocument Projection

用户状态：无直接用户可见变化。

实现范围：

- 新增 `packages/server/src/domains/retrieval`。
- 新增 projection builder。
- 新增 LanceDB sync / rebuild 命令或内部方法。
- Understanding / Context 创建、更新、删除后能同步检索文档。
- 删除 SQLite FTS 写入逻辑。

TDD：

1. RED：Understanding 生成 `understanding:*` document。
2. GREEN：实现 Understanding projection。
3. RED：Context 生成 `context:*` document，且带 parent Understanding 语境。
4. GREEN：实现 Context projection。
5. RED：删除 Understanding / Context 后对应 document 不再被检索。
6. GREEN：实现 sync / rebuild。
7. RED：更新 Understanding title 后，其 Context retrieval rows 也被重建。
8. GREEN：实现 `syncByUnderstandingId()`。

退出条件：

- `RetrievalDocument` 可被完整重建。
- Context document 不会退化成裸 content chunk。
- Domain names 能进入 searchable text / metadata。
- LanceDB 是唯一被同步的检索索引。

## 13. Phase 2：HybridRetriever

用户状态：Agent 可以从语义相近表达中找回候选。

实现范围：

- 新增 embedding 生成和存储。
- 新增 LanceDB dense retrieval。
- 新增 LanceDB FTS / lexical retrieval。
- 新增 LanceDB hybrid retrieval / RRF fusion。
- 新增 trace。

TDD：

1. RED：query 与 Understanding 没有共同关键词，但语义接近，dense 能召回。
2. GREEN：接入 embedding search。
3. RED：query 包含精确术语 / 缩写，lexical 能召回。
4. GREEN：接入 LanceDB FTS / BM25。
5. RED：同一 document 同时出现在 dense 和 lexical 时，RRF 排名提升。
6. GREEN：接入 LanceDB RRF，或在 adapter 内补 RRF。
7. RED：trace 返回 dense / lexical / fusion 统计。
8. GREEN：补 trace。

退出条件：

- dense 和 lexical 是并行通道。
- 不再依赖 FTS fallback 作为主召回心智。
- 查询结果能解释每条 document 来自哪一路。
- 不再查询 SQLite `fts_understandings` / `fts_contexts`。

## 14. Phase 3：UnderstandingCandidateBuilder

用户状态：Agent 得到的是 Understanding candidates，而不是零散 retrieval documents。

实现范围：

- 按 `parentUnderstandingId` group。
- Context hit 挂到 `matchedContexts`。
- Understanding hit 和 Context hit 的 evidence 合并。
- 输出 `suggestedRead`。
- 新增 Pi read-only tool：`retrieve_knowledge`。
- 现有 `search` tool 改为 LanceDB-backed compatibility adapter。

TDD：

1. RED：只命中 Context document 时，返回 parent Understanding candidate。
2. GREEN：实现 parent grouping。
3. RED：同一个 Understanding 的 Understanding document 和 Context document 命中时，只返回一个 candidate。
4. GREEN：实现 evidence merge。
5. RED：candidate 包含 `matchedContexts` 和 `suggestedRead`。
6. GREEN：实现 result shape。
7. RED：Pi tool contract 测试。
8. GREEN：接入 `retrieve_knowledge`。

退出条件：

- Agent 不需要自己把 Context hit 追到 parent Understanding。
- 返回结果能表达“这条理解从哪里长出来”。
- `retrieve_knowledge` 和兼容 `search` 都不再使用 SQLite FTS。

## 15. Phase 4：Delete SQLite FTS Search

用户状态：用户继续使用搜索能力，但结果来自 LanceDB。

实现范围：

- 删除 `SearchCore` 对 SQLite FTS 表的查询路径。
- CLI `search` 切到 LanceDB-backed retrieval。
- Electron / Pi `search` 兼容入口切到 LanceDB-backed retrieval。
- migration 删除 `fts_understandings` / `fts_contexts`。
- Understanding / Context 写路径删除 FTS insert / delete / restore 逻辑。
- 已有 profile 里的旧 FTS 表在迁移后不存在。

TDD：

1. RED：CLI `search` 不访问 SQLite FTS 表也能返回结果。
2. GREEN：CLI `search` 走 LanceDB adapter。
3. RED：Pi `search` 不访问 SQLite FTS 表也能返回结果。
4. GREEN：Pi `search` 走同一 adapter。
5. RED：Understanding 更新后 CLI / Pi 搜索均反映 LanceDB 同步结果。
6. GREEN：接入 write path sync。

退出条件：

- 当前搜索方案完全由 LanceDB 替代。
- SQLite FTS 不再是运行时依赖。
- 旧 tool 名称如果保留，也只是 compatibility surface。

## 16. Phase 5：Relation Expansion

用户状态：Agent 找到一个入口理解后，可以看到显式相关的相邻理解。

实现范围：

- 从强 anchor 做一跳扩展。
- 只使用 Reflecta 显式关系。
- relation candidate 排名低于直接 dense / lexical 命中的 candidate。
- trace 记录 relation 来源。

TDD：

1. RED：给定 matched Understanding，返回 referencedBy Understanding。
2. GREEN：实现一跳 relation expansion。
3. RED：给定 selected Understanding anchor，即使 query 文本弱，也能返回相邻理解。
4. GREEN：接入 anchors。
5. RED：relation expansion cap 测试。
6. GREEN：限制每个 seed 和总候选数量。

退出条件：

- Retrieval result 能解释 relation evidence。
- 不会因为关系扩展返回过多无关结果。
- Context 不通过 RelationExpander 扩展；Context 仍由 retrieval document 命中后折回 parent。

## 17. Phase 6：Optional Reranker

只有满足下面条件才进入：

```txt
hybrid retrieval 已能召回正确候选，
但真实 session 中 top ranking 经常不稳定。
```

候选方案：

- 本地 cross-encoder reranker。
- provider rerank API。
- LLM rerank small candidate set。

退出条件：

- reranker 只重排 hybrid candidate，不负责凭空召回。
- trace 能显示 reranker 前后排名。
- 成本、延迟、隐私策略明确。

## 18. 验收标准

产品验收：

- Agent 不再因为多关键词 query 大量返回空。
- Agent 能用语义相近表达找回相关 Understanding。
- Agent 能通过具体 Context 场景找到对应 Understanding。
- 搜索结果能表达“这条理解从哪里长出来”。
- Agent 能根据 `suggestedRead` 读取候选详情。
- Debug 时能看到 dense / lexical / fusion / grouping / relation trace。

工程验收：

- `retrieveKnowledge()` 是测试主 seam。
- Agent 不需要知道 LanceDB、embedding、FTS、RRF 细节。
- `RetrievalDocument` 是可重建 projection，不是事实来源。
- embedding model / projection version 变化可触发 rebuild。
- 旧 `search` 名称如果保留，内部也走 LanceDB。
- SQLite FTS 不再作为搜索索引维护。
- LanceDB 能在 Electron 环境稳定运行。

## 19. 最终目标形态

```txt
Pi Agent
  -> retrieve_knowledge(query, anchors)
  -> KnowledgeRetriever
      -> RetrievalProjection
      -> LanceDbRetrievalIndex
      -> EmbeddingProvider
      -> HybridRetriever(LanceDB dense + FTS + RRF)
      -> UnderstandingCandidateBuilder(parent grouping)
      -> RelationExpander(explicit one-hop)
      -> RetrievalTrace
  -> Understanding candidates + suggestedRead
  -> understanding_get / context_get / domain_inspect
```

一句话：

```txt
v1.1.0 做 local-first hybrid semantic retriever：
LanceDB 向量召回负责语义相近，
LanceDB FTS / BM25 负责精确词，
RetrievalDocument 负责索引投影，
parentUnderstandingId 负责把 Context 命中折回 Understanding，
RRF 负责合并排序，
trace 负责可解释和可调试。
SQLite 继续做产品事实源，但不再承担搜索索引职责。
```
