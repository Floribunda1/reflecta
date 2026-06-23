# v1.1.0 Agent Tool 与 System Prompt 对齐计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：让 Pi Agent 和 CLI 暴露给 AI 的工具保持同一套心智：小而稳定的 Reflecta primitive，而不是 Agent 专属工作流。

## 1. 结论

之前的方案把工具设计复杂化了。

正确方向不是给 Agent 包一层更聪明的 workflow tool，而是让 Pi Agent 和 CLI 共享同一套简单工具：

```txt
Domain CRUD
Understanding CRUD
Context CRUD
domain_inspect
search
graph
```

只有四个产品语义约束需要进 tool interface：

- `understanding_list` 可以选择 `includeContexts`，因为短 Understanding 脱离 Context 时容易失真。
- `understanding_get` 可以选择 `includeContexts` 和 `includeRelations`。
- `search` 返回混合命中；Context 命中必须带 `understandingId`，让 AI 能回到父 Understanding。
- `graph` 只保留一个邻域 primitive：`graph(understandingId, includeContext, depth)`。

双链关系不做独立 CRUD。关系来自 Understanding 正文里的 `[[Title#understandingId]]`：

- 新增关系：`understanding_get` -> `understanding_update(body)`。
- 删除关系：`understanding_get` -> `understanding_update(body)`。
- 读取关系：`understanding_get({ includeRelations: true })`。

Pi Agent 和 CLI 的工具名和输入参数必须同步。读取工具的返回 shape 必须同步。写工具的业务 payload 必须同步；Pi 在用户确认前可以额外返回 pending approval envelope。

## 2. 判断标准

system prompt 负责传达产品价值和行为边界；tool description / schema 负责传达可用工具和参数。两者都必须服从这几个规则：

```txt
Understanding = 用户形成的个人理解
Context = 围绕 Understanding 的具象上下文，可记录形成、支撑、应用、挑战或修正
Connection = 正文双链派生出的理解关系，不是独立写入对象
Domain = 用户回看某个领域的语境
AI = 辅助，不是大脑
```

因此：

- Agent 可以追问、对比、整理、提出候选表达。
- Agent 不可以把自己生成的总结直接当成用户的个人理解。
- Agent 不可以自动构建关系网并直接写入。
- Agent 需要真实内容时必须读取对象，不要凭轻量引用、标题或文件名猜测。
- 没有 Context 的 Understanding 可以存在；这是边界，不是错误。

## 3. 当前问题

### 3.1 System prompt 实际没有承载产品哲学

当前 Pi runtime 实际使用的是 `pi-agent-host.ts` 里的内联 prompt：

```txt
You are Reflecta's agent...
search, inspect, or read Reflecta knowledge...
create, update, or delete Reflecta knowledge...
```

这段 prompt 没有表达：

- Reflecta 的核心不是知识库，而是个人理解。
- Context 是理解的上下文。
- AI 只能辅助用户形成理解。
- 候选 Understanding 必须让用户理解、修改、确认。
- 关系来自用户正文里的显式双链。

`agent-system-prompt.md` 已经有更接近产品语义的内容，但现在它只被前端 context usage 估算引用，不是 Pi runtime 的真实 system prompt。

### 3.2 Pi Agent 和 CLI 工具心智没有收敛

当前 Pi read tools 有：

```txt
snapshot_project
domain_list
domain_inspect
understanding_list
understanding_get
context_list
context_get
search_all
search_understandings
search_contexts
graph_neighborhood
graph_path
```

问题：

- `search_all` / `search_understandings` / `search_contexts` 三个搜索工具让 AI 先判断搜索类型，心智更重。
- `graph_neighborhood` / `graph_path` 把正文双链误导成独立 graph 工具。
- `snapshot_project` 是 overview/debug，不应该是 Agent 默认入口。
- Pi 和 CLI 应该暴露同一组工具，不应该为 Agent 单独设计一套高阶 surface。

### 3.3 写工具名字可以保留 CRUD

当前 Pi 写工具已经是：

```txt
domain_create/update/delete
understanding_create/update/delete
context_create/update/delete
```

这些名字足够 primitive，不需要改成 `propose_*`。

Pi runtime 只需要在 description 和执行语义里明确：

```txt
这些写工具只提交 pending approval，用户确认前不写入。
```

CLI 可以复用同名同参工具。不要让 Pi 和 CLI 出现两套命名。

## 4. 目标 Tool Contract

### 4.1 Shared types

```ts
type Id = string;

type PaginationInput = {
  limit?: number; // integer, 1..200
  offset?: number; // integer, >= 0
};

type ContextMedium = "experience" | "video" | "book" | "article" | "opinion" | "ai" | "other";

type DomainSummary = {
  id: Id;
  name: string;
  parentId?: Id | null;
};

type UnderstandingSummary = {
  id: Id;
  title?: string | null;
  bodyPreview?: string;
  domainIds?: Id[];
  contextCount?: number;
};

type ContextSummary = {
  id: Id;
  understandingId: Id;
  medium: ContextMedium;
  title?: string | null;
  contentPreview?: string;
};

type ContextDetail = ContextSummary & {
  content: string;
};

type RelationSummary = {
  sourceUnderstandingId: Id;
  targetUnderstandingId?: Id;
  targetTitle?: string;
  rawText: string;
  resolved: boolean;
};
```

约束：

- 所有 `Id` 都是非空字符串。
- 所有 `query` / `body` / `content` 都是非空字符串。
- `body` 是完整 Markdown body，不做局部 patch。
- `domainIds` 是 Understanding 的完整目标归属列表，不是增量 add/remove。
- `title: null` 表示清空标题；省略表示不改。
- `parentId: null` 表示移动到顶层 Domain；省略表示不改。

### 4.2 Domain tools

#### `domain_list`

```ts
type DomainListInput = {};

type DomainListOutput = {
  domains: DomainSummary[];
};
```

#### `domain_inspect`

`domain_inspect` 是 Domain 额外保留的一个非 CRUD primitive，用来让 AI 看某个领域里的理解语境。

```ts
type DomainInspectInput = PaginationInput & {
  domainId: Id;
  includeUnderstandings?: boolean; // default true
  includeContexts?: boolean; // default false
  includeRelations?: boolean; // default false
};

type DomainInspectOutput = {
  domain: DomainSummary;
  children?: DomainSummary[];
  understandings?: UnderstandingSummary[];
  contexts?: ContextDetail[];
  relations?: RelationSummary[];
};
```

#### `domain_create`

```ts
type DomainCreateInput = {
  name: string;
  parentId?: Id | null;
  reason?: string;
};

type DomainCreateOutput = {
  domain: DomainSummary;
};
```

Pi Agent 执行时返回 pending approval；approval 后才产生 `DomainCreateOutput`。

#### `domain_update`

```ts
type DomainUpdateInput = {
  domainId: Id;
  name?: string;
  parentId?: Id | null;
  reason?: string;
};

type DomainUpdateOutput = {
  domain: DomainSummary;
};
```

#### `domain_delete`

```ts
type DomainDeleteInput = {
  domainId: Id;
  deleteUnderstandings?: boolean; // default false
  reason?: string;
};

type DomainDeleteOutput = {
  domainId: Id;
  deleted: true;
};
```

### 4.3 Understanding tools

#### `understanding_list`

```ts
type UnderstandingListInput = PaginationInput & {
  domainIds?: Id[];
  includeDescendants?: boolean; // default false
  includeContexts?: boolean; // default false
};

type UnderstandingListOutput = {
  understandings: UnderstandingSummary[];
  contextsByUnderstandingId?: Record<Id, ContextDetail[]>;
};
```

`understanding_list` 可以带 Context，因为很多 Understanding 本身很短。AI 需要列表级语境时用 `includeContexts: true`；需要精读单条时再调用 `understanding_get({ includeContexts: true })`。

#### `understanding_get`

```ts
type UnderstandingGetInput = {
  understandingId: Id;
  includeContexts?: boolean; // default false
  includeRelations?: boolean; // default false
};

type UnderstandingGetOutput = {
  understanding: UnderstandingSummary & {
    body: string;
  };
  contexts?: ContextDetail[];
  relations?: RelationSummary[];
};
```

`includeRelations` 返回正文双链解析出的 outgoing / incoming / unresolved 关系。关系不是独立 CRUD 对象。

#### `understanding_create`

```ts
type UnderstandingCreateInput = {
  title?: string;
  body: string;
  domainIds?: Id[];
  basis?: "user_stated" | "ai_candidate";
  reason?: string;
};

type UnderstandingCreateOutput = {
  understanding: UnderstandingSummary;
};
```

`basis` 用来区分用户已经表达的理解，还是 AI 帮用户整理出的候选表达。

#### `understanding_update`

```ts
type UnderstandingUpdateInput = {
  understandingId: Id;
  title?: string | null;
  body?: string;
  domainIds?: Id[];
  reason?: string;
};

type UnderstandingUpdateOutput = {
  understanding: UnderstandingSummary;
};
```

新增或删除双链关系都通过更新 `body` 完成。

#### `understanding_delete`

```ts
type UnderstandingDeleteInput = {
  understandingId: Id;
  reason?: string;
};

type UnderstandingDeleteOutput = {
  understandingId: Id;
  deleted: true;
};
```

### 4.4 Context tools

#### `context_list`

```ts
type ContextListInput = {
  understandingId: Id;
};

type ContextListOutput = {
  understanding: UnderstandingSummary;
  contexts: ContextSummary[];
};
```

#### `context_get`

```ts
type ContextGetInput = {
  contextId: Id;
};

type ContextGetOutput = {
  context: ContextDetail;
  understanding: UnderstandingSummary;
};
```

#### `context_create`

```ts
type ContextCreateInput = {
  understandingId: Id;
  medium: ContextMedium;
  title?: string;
  content: string;
  reason?: string;
};

type ContextCreateOutput = {
  context: ContextSummary;
};
```

#### `context_update`

```ts
type ContextUpdateInput = {
  contextId: Id;
  medium?: ContextMedium;
  title?: string | null;
  content?: string;
  reason?: string;
};

type ContextUpdateOutput = {
  context: ContextSummary;
};
```

#### `context_delete`

```ts
type ContextDeleteInput = {
  contextId: Id;
  reason?: string;
};

type ContextDeleteOutput = {
  contextId: Id;
  deleted: true;
};
```

### 4.5 Search tool

#### `search`

```ts
type SearchInput = PaginationInput & {
  query: string;
};

type SearchHit =
  | {
      type: "understanding";
      understanding: UnderstandingSummary;
      matchedText?: string;
    }
  | {
      type: "context";
      context: ContextSummary;
      understandingId: Id;
      matchedText?: string;
    };

type SearchOutput = {
  hits: SearchHit[];
};
```

一个搜索工具就够了。AI 不需要先判断应该搜 Understanding 还是 Context。

### 4.6 Graph tool

#### `graph`

```ts
type GraphInput = {
  understandingId: Id;
  includeContext?: boolean; // default false
  depth?: number; // default 1
};

type GraphOutput = {
  seed: Id;
  nodes: UnderstandingSummary[];
  edges: Array<{ from: Id; to: Id }>;
  contexts?: ContextDetail[];
};
```

一个 graph 工具就够了。只做从某个 Understanding 出发的双链邻域，不保留 path / neighborhood 两个旧入口。

## 5. 当前工具到目标工具

| 当前工具                             | 目标                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| `snapshot_project`                   | 删除                                                    |
| `domain_list`                        | 保留                                                    |
| `domain_inspect`                     | 保留                                                    |
| `understanding_list`                 | 保留                                                    |
| `understanding_get`                  | 保留，参数收敛为 `includeContexts` / `includeRelations` |
| `context_list`                       | 保留                                                    |
| `context_get`                        | 保留                                                    |
| `search_all`                         | 改为 `search`                                           |
| `search_understandings`              | 删除                                                    |
| `search_contexts`                    | 删除                                                    |
| `graph_neighborhood`                 | 改为 `graph`                                            |
| `graph_path`                         | 删除                                                    |
| `domain_create/update/delete`        | 保留                                                    |
| `understanding_create/update/delete` | 保留                                                    |
| `context_create/update/delete`       | 保留                                                    |

## 6. 渐进式 Phase

### Phase 1：真实 Pi runtime 使用唯一 system prompt

改动：

- `PiAgentHost` 从 `agent-system-prompt.md` 读取 system prompt。
- 删除或停止使用 `pi-agent-host.ts` 内联 prompt。
- `context-usage.ts` 继续引用同一份 prompt。
- prompt 使用 Reflecta 产品语言：个人理解、Context、候选项、用户确认。

TDD：

1. RED：断言 `createPiResourceLoader().getSystemPrompt()` 返回 markdown prompt 内容，而不是内联字符串。
2. GREEN：改 runtime prompt loader。
3. RED：prompt contract test 断言包含 `Understanding`、`Context`、`用户是大脑`、`候选项`。
4. GREEN：补齐 prompt。

退出条件：

- Pi runtime 和前端 context usage 使用同一份 prompt。
- `rg "You are Reflecta's agent|knowledge-base search results" apps/electron/src/main/services/agent` 不再命中新 runtime prompt。

### Phase 2：抽出 CLI / Pi 共享 tool contract

改动：

- 新增共享 contract，定义第 4 节所有工具名、参数和读取返回 shape。
- CLI 和 Pi Agent 都从同一份 contract 注册工具，或通过测试保证 input schema 完全一致。
- 读取工具的 output schema 在 CLI / Pi 之间一致。
- Pi 写工具执行时仍返回 pending approval。
- CLI 保持同名同参。

TDD：

1. RED：contract test 对比 CLI tools 和 Pi tools 的名称集合。
2. RED：contract test 对比 CLI tools 和 Pi tools 的参数 schema。
3. RED：contract test 对比 CLI / Pi read tools 的返回 schema。
4. GREEN：抽出共享 contract 或补齐 adapter。

退出条件：

- CLI 和 Pi Agent 暴露同一套 AI-facing tool surface。
- 没有 Pi-only 的高阶 workflow tool。

### Phase 3：收敛工具列表

改动：

- 删除 / 降级：
  - `snapshot_project`
  - `search_understandings`
  - `search_contexts`
  - `graph_neighborhood`
  - `graph_path`
- `search_all` 改名为 `search`。
- `graph_neighborhood` 改名并收敛为 `graph(understandingId, includeContext, depth)`。
- `understanding_get` 只保留：
  - `includeContexts`
  - `includeRelations`
- `understanding_list` 增加 `includeContexts`。
- `domain_inspect` 保留。
- `graph` 保留。

TDD：

1. RED：tool registry contract test，断言目标工具集合等于第 4 节。
2. GREEN：收敛 registry。
3. RED：seed Understanding + Context，调用 `search("...")`，结果可返回 Understanding hit 或 Context hit；Context hit 带 `understandingId`。
4. GREEN：实现 `search` adapter。
5. RED：seed 正文双链，调用 `understanding_get({ includeRelations: true })`，返回 relations。
6. GREEN：接入现有双链解析。
7. RED：seed 短 Understanding + Context，调用 `understanding_list({ includeContexts: true })`，返回 `contextsByUnderstandingId`。
8. GREEN：补 list context expansion。
9. RED：seed 正文双链，调用 `graph({ understandingId, depth: 1 })`，返回 nodes / edges。
10. GREEN：实现单一 graph adapter。

退出条件：

- `search_understandings` / `search_contexts` / `graph_path` / `snapshot_project` 在 CLI 和 Pi 中都删除。
- AI 需要列表级 Context 时通过 `understanding_list(includeContexts)` 获取；需要精读单条时通过 `understanding_get(includeContexts)` 或 `context_*` 获取。
- AI 需要关系时通过 `understanding_get(includeRelations)` 获取。

### Phase 4：文案和 UI 展示同步

改动：

- Tool card 文案不显示数据库味或内部实现味：
  - `search` -> 搜索
  - `domain_inspect` -> 查看领域
  - `understanding_get` -> 读取理解
  - `context_get` -> 读取上下文
- approval pending 文案从 “knowledge base has not been changed” 改成“候选项尚未写入”。
- system prompt 不枚举工具清单，不指导具体 tool routing；这些信息由 runtime tool description / schema 提供。
- system prompt 只承载产品价值和不可走偏的点：
  - Reflecta 是把学习、实践和对话沉淀成可追溯的个人理解，不是 generic knowledge base。
  - Understanding 是用户形成的个人理解，Context 是理解周围的具象上下文。
  - 用户是大脑，AI 是辅助；AI 只提出候选表达，不能替用户直接入库。
  - 关系来自用户显式理解，不自动构建关系网。
  - 轻量引用、附件名和本地路径不等于真实内容，需要内容时先读取。

TDD：

1. RED：tool display mapping 测试目标文案。
2. GREEN：更新 renderer mapping。
3. RED：prompt contract test 断言包含产品价值和行为边界，且不包含具体工具名。
4. GREEN：更新 runtime prompt。
5. E2E：真实 AI 下跑三条 happy path：
   - 查询已有理解。
   - 记录理解并补 Context。
   - 给已有 Understanding 正文补双链。

退出条件：

- Runtime prompt 和 tool display 都不再把产品表达成 generic knowledge base。
- happy path 全部真实 AI 通过。

## 7. 不做什么

这份 plan 不做：

- `find_understandings`。
- `read_link_neighborhood` / `read_link_path`。
- `search_understandings` / `search_contexts` 拆分。
- `propose_*` 重命名。
- Connection CRUD。
- 向量数据库。
- GraphRAG。
- LLM reranker。
- 新增大而全的 Agent orchestration layer。

当前最短路径是：

```txt
让 CLI 和 Pi Agent 暴露同一套最小 Reflecta primitive。
```

## 8. 验收

代码层验收：

```bash
rtk bun run --filter '@reflecta/electron' test
rtk bun run --filter '@reflecta/electron' typecheck
rtk bun run --cwd apps/electron test:e2e
```

搜索验收：

```bash
rtk rg "surrounding material|call search_all before answering|knowledge-base search results" apps/electron/src/main/services/agent
```

期望：

- runtime prompt 不再命中这些旧表达。
- `agent-system-prompt.md` 是 Pi runtime 的真实 system prompt。
- CLI 和 Pi Agent 的 AI-facing tool names / input schemas 一致。
- CLI 和 Pi Agent 的 read tool output schemas 一致。
- AI-facing tools 只有第 4 节定义的目标工具。
- 所有 Pi 写入仍然走 approval。
