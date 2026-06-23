# v1.1.0 Agent Tool 与 System Prompt 对齐计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：让 Pi Agent 暴露出来的 system prompt 和 tools 符合 Reflecta 的 value proposition：帮助用户把学习、实践和对话沉淀成可追溯的个人理解。

## 1. 结论

当前 Agent tool 设计工程上可用，但产品心智模型偏了。

它现在更像：

```txt
知识库搜索
  + Understanding / Context / Domain CRUD
  + 审批
```

它应该变成：

```txt
围绕用户个人理解工作的认知辅助 Agent
  + 找到相关理解
  + 展示理解从哪里长出来
  + 暴露边界和缺口
  + 只提交候选项
  + 用户确认后才写入
```

这次改造不追求更多工具，而是把工具 interface 变深。

第一版要优先做到：

- Runtime 真实加载一份 Reflecta system prompt，不再使用散落的内联 prompt。
- Agent 默认语言从 `knowledge base` 转成 `personal understanding` / `Understanding` / `Context`。
- 读工具从 `search_all` 默认入口，转成 `search_understandings` / `search_contexts` / `read_*` 这组小而正交的 Reflecta 领域 primitive。
- 写工具从“直接 create/update/delete”转成 `propose_*` 候选写入。
- 双链关系不做独立 CRUD；它来自 Understanding 正文里的 `[[Title#understandingId]]`，修改关系就是修改正文。
- Context 不再被描述成 surrounding material，而是 Understanding 的上下文。

## 2. 判断标准

所有 system prompt 和 tool 设计都必须服从这几个规则：

```txt
Understanding = 用户形成的个人理解
Context = 围绕 Understanding 的具象上下文，可记录形成、支撑、应用、挑战或修正
Connection = 用户显式意识到的理解关系
Domain = 用户回看某个领域的语境
AI = 辅助，不是大脑
```

因此：

- Agent 可以追问、对比、整理、提出候选表达。
- Agent 不可以把自己生成的总结直接当成用户的个人理解。
- Agent 不可以自动构建关系网并直接写入。
- Agent 读取 Understanding 时，应该优先关心它的 Context。
- Agent 搜索 Context 时，应该把命中的 Context 作为父 Understanding 的上下文，而不是孤立材料。
- 没有 Context 的 Understanding 可以存在，但 Agent 必须把它当成边界或未充分追溯的理解。

## 3. 当前问题

### 3.1 System prompt 实际没有承载产品哲学

当前 Pi runtime 实际使用的是 `pi-agent-host.ts` 里的内联 prompt：

```txt
You are Reflecta's agent...
search, inspect, or read Reflecta knowledge...
create, update, or delete Reflecta knowledge...
```

这段 prompt 只表达了：

- 要回答清楚。
- 搜索前用 read-only tools。
- 写入前走 approval。

它没有表达：

- Reflecta 的核心不是知识库，而是个人理解。
- Context 是理解的上下文。
- AI 只能辅助用户形成理解。
- 候选 Understanding 必须让用户理解、修改、确认。
- 关系必须来自用户显式理解。

`agent-system-prompt.md` 里已经有更接近产品语义的内容，但现在它只被前端 context usage 估算引用，不是 Pi runtime 的真实 system prompt。

### 3.2 Tool interface 太像数据库浏览器

当前 read-only tools 暴露的是：

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

这些工具能表达数据库对象，但不能自然表达用户真正关心的问题：

```txt
我关于这个问题形成过哪些理解？
这些理解分别从哪里长出来？
哪些理解有Context 支撑？
哪些只是悬空结论？
哪些关系是我已经显式建立过的？
```

结果是 Agent 需要自己拼：

```txt
search_all -> read_understanding(includeContexts) -> graph_neighborhood
```

问题不是工具数量太少，而是 interface 心智不稳定：

- `search_all` 太像“万能知识库搜索”，还会劫持默认路线。
- `graph_*` 听起来像独立关系对象，但当前产品里关系来自正文双链。
- `*_create/update/delete` 实际是 approval proposal，但名字像直接写库。
- `understanding_get` / `context_get` 是数据库味命名，不如 `read_*` 表达 Agent 动作。

### 3.3 Search 默认路径和 Context 语义不清

当前 `search_all` 返回：

```ts
{
  understandings: UnderstandingSearchHit[];
  contexts: ContextSearchHit[];
}
```

这把 Understanding 命中和 Context 命中拆成了两个列表。

但 Reflecta 的产品语义里，Context 可以被直接搜索，不能被降级成孤立材料。`search_contexts` 应该保留，因为用户会问：

```txt
我有没有类似经历？
我以前有没有类似 AI 对话？
我在哪些材料里碰到过这个问题？
```

但 Context search result 必须带父 Understanding：

```txt
这个 Context 属于哪条 Understanding？
这个命中能否帮助用户回到某条个人理解？
```

所以更合适的 `search_contexts` result shape 是：

```ts
type ContextSearchHit = {
  context: ContextSummary;
  parentUnderstanding: UnderstandingSummary;
  matchedText?: string;
};
```

### 3.4 `understanding_create` 没有表达候选来源

当前裸 create 工具参数是：

```ts
{
  title?: string;
  body: string;
  domainIds?: string[];
}
```

这个 shape 很容易让 Agent 做出一条漂亮但来源不清的 Understanding。

审批只能保证不会直接写入，不能保证这个候选项符合 Reflecta 的产品哲学。

更合适的写入入口应该表达：

```txt
这是一个用户理解候选。
它是用户已经说出来的理解，还是 AI 帮用户整理出来的候选表达？
如果用户同时给了上下文，Context 应该用独立工具补到已创建的 Understanding 上。
```

## 4. 目标形态

### 4.1 System prompt 成为唯一行为契约

保留一个真实加载的文件：

```txt
apps/electron/src/main/services/agent/agent-system-prompt.md
```

Pi runtime、token usage 估算、测试都引用这同一份文件。

它至少要包含：

- Reflecta 一句话：把学习、实践和对话沉淀成可追溯的个人理解。
- Understanding / Context / Connection / Domain 的定义。
- 用户是大脑，AI 是辅助。
- 需要创建内容时，只能提交候选项。
- 候选项每次只提交一个，等待用户确认。
- Context 是围绕理解的具象上下文，不是附件、背景材料或 URL/材料标题这类元信息；材料类型只能作为 Context 的 medium。
- 如果用户要求保存 AI 生成的总结，先确认它是否代表用户自己的理解。
- 如果 Understanding 没有 Context，要明确这是未追溯边界。
- 关系只能作为候选建议，不能自动当作用户知识网。

### 4.2 Tool interface 原则

Tools should be small Reflecta-domain primitives, not generic CRUD and not workflow-sized shortcuts.

第一版保留领域对象，不做大一统 `tool({ kind, payload })`：

```txt
Domain
Understanding
Context
正文双链派生出的 link graph
```

写入侧只有三个可写对象：

```txt
Domain
Understanding
Context
```

没有 Connection CRUD。双链关系来自 Understanding 正文里的 `[[Title#understandingId]]`：

- 读取关系：用 `read_link_neighborhood` / `read_link_path`。
- 新增关系：用 `propose_understanding_update` 修改正文，插入双链。
- 删除关系：用 `propose_understanding_update` 修改正文，移除双链。
- 未解析双链：作为读取结果里的 boundary，不生成独立写工具。

`search_contexts` 必须保留。搜索 Context 是 primitive，不是 workflow；但返回结果必须带父 Understanding。

`search_all` 可以第一阶段兼容保留，但只能是 legacy/debug tool，不再出现在 prompt 默认路线里。

### 4.3 Shared types

```ts
type Id = string;

type PaginationInput = {
  limit?: number; // integer, 1..200, default implementation-defined
  offset?: number; // integer, >= 0, default 0
};

type ContextMedium = "experience" | "video" | "book" | "article" | "opinion" | "ai" | "other";

type UnderstandingPatch = {
  title?: string | null;
  body?: string;
  domainIds?: Id[];
};

type DomainPatch = {
  name?: string;
  parentId?: Id | null;
};

type ContextPatch = {
  medium?: ContextMedium;
  title?: string | null;
  content?: string;
};

type DomainSummary = {
  id: Id;
  name: string;
  parentId?: Id | null;
  understandingCount?: number;
};

type UnderstandingSummary = {
  id: Id;
  title?: string | null;
  bodyPreview?: string;
  domainIds?: Id[];
  contextCount?: number;
  linkCount?: number;
};

type ContextSummary = {
  id: Id;
  understandingId: Id;
  medium: ContextMedium;
  title?: string | null;
  contentPreview?: string;
};

type LinkEdgeSummary = {
  fromUnderstandingId: Id;
  toUnderstandingId: Id;
  fromTitle?: string | null;
  toTitle?: string | null;
};

type UnresolvedLinkSummary = {
  fromUnderstandingId: Id;
  rawText: string;
};

type PendingProposalOutput<TType extends string, TInput> = {
  approvalStatus: "pending";
  proposalType: TType;
  proposal: TInput;
};
```

约束：

- 所有 `Id` 都必须是非空字符串。
- 所有 `query` / `body` / `content` 都必须是非空字符串。
- `*Patch` 至少要包含一个字段。
- `body` 是完整 Markdown body，不做局部 patch。
- `domainIds` 是 Understanding 的完整目标归属列表，不是增量 add/remove。
- `title: null` 表示清空标题；省略表示不改。
- `parentId: null` 表示移动到顶层 Domain；省略表示不改。

### 4.4 Read tools

#### `list_domains`

列出 Domain。用于发现用户有哪些领域语境。

```ts
type ListDomainsInput = {};

type ListDomainsOutput = {
  domains: DomainSummary[];
};
```

#### `inspect_domain`

读取一个 Domain 的领域回看语境，不负责搜索。

```ts
type InspectDomainInput = PaginationInput & {
  domainId: Id;
  includeUnderstandings?: boolean; // default true
  includeContexts?: boolean; // default false
  includeLinkEdges?: boolean; // default false
};

type InspectDomainOutput = {
  domain: DomainSummary;
  children?: DomainSummary[];
  understandings?: UnderstandingSummary[];
  contexts?: ContextSummary[];
  linkEdges?: LinkEdgeSummary[];
};
```

#### `list_understandings`

枚举 Understanding。用于浏览列表，不用于语义搜索。

```ts
type ListUnderstandingsInput = PaginationInput & {
  domainIds?: Id[];
  includeDescendants?: boolean; // default false
};

type ListUnderstandingsOutput = {
  understandings: UnderstandingSummary[];
};
```

#### `list_contexts`

列出一条 Understanding 下的 Context。

```ts
type ListContextsInput = {
  understandingId: Id;
};

type ListContextsOutput = {
  understanding: UnderstandingSummary;
  contexts: ContextSummary[];
};
```

#### `search_understandings`

搜索 Understanding title/body。Context 命中不混进这个工具。

```ts
type SearchUnderstandingsInput = PaginationInput & {
  query: string;
  domainIds?: Id[];
  includeDescendants?: boolean; // default true when domainIds is present
};

type SearchUnderstandingHit = {
  understanding: UnderstandingSummary;
  matchedText?: string;
};

type SearchUnderstandingsOutput = {
  hits: SearchUnderstandingHit[];
};
```

#### `search_contexts`

搜索 Context。结果必须带父 Understanding，避免把 Context 变成孤立材料。

```ts
type SearchContextsInput = PaginationInput & {
  query: string;
  domainIds?: Id[];
  understandingId?: Id;
  mediums?: ContextMedium[];
};

type SearchContextsHit = {
  context: ContextSummary;
  parentUnderstanding: UnderstandingSummary;
  matchedText?: string;
};

type SearchContextsOutput = {
  hits: SearchContextsHit[];
};
```

#### `read_understanding`

精读一条 Understanding。默认带 Context summary 和正文双链摘要。

```ts
type ReadUnderstandingInput = {
  understandingId: Id;
  includeContexts?: boolean; // default true
  includeOutgoingLinks?: boolean; // default true
  includeBacklinks?: boolean; // default true
};

type ReadUnderstandingOutput = {
  understanding: UnderstandingSummary & {
    title?: string | null;
    body: string;
  };
  contexts?: ContextSummary[];
  outgoingLinks?: LinkEdgeSummary[];
  backlinks?: LinkEdgeSummary[];
  unresolvedLinks?: UnresolvedLinkSummary[];
};
```

#### `read_context`

精读一条 Context。默认带父 Understanding summary。

```ts
type ReadContextInput = {
  contextId: Id;
  includeParentUnderstanding?: boolean; // default true
};

type ReadContextOutput = {
  context: ContextSummary & {
    content: string;
  };
  parentUnderstanding?: UnderstandingSummary;
};
```

#### `read_link_neighborhood`

读取正文双链派生出的 outgoing links、backlinks、unresolved links。它只读图，不推断新关系。

```ts
type ReadLinkNeighborhoodInput = PaginationInput & {
  understandingId: Id;
  depth?: number; // integer, 1..3, default 1
  includeContexts?: boolean; // default false
};

type ReadLinkNeighborhoodOutput = {
  seed: UnderstandingSummary;
  nodes: UnderstandingSummary[];
  outgoingLinks: LinkEdgeSummary[];
  backlinks: LinkEdgeSummary[];
  unresolvedLinks: UnresolvedLinkSummary[];
  contexts?: ContextSummary[];
};
```

#### `read_link_path`

查找两条 Understanding 之间已经存在的双链路径。没有路径时返回空结果，不让 Agent 编造关系。

```ts
type ReadLinkPathInput = {
  fromUnderstandingId: Id;
  toUnderstandingId: Id;
  maxDepth?: number; // integer, 1..6, default 4
};

type ReadLinkPathOutput = {
  fromUnderstanding: UnderstandingSummary;
  toUnderstanding: UnderstandingSummary;
  paths: Array<{
    nodes: UnderstandingSummary[];
    edges: LinkEdgeSummary[];
  }>;
};
```

#### `snapshot_project`

兼容保留给排查和测试，不作为 prompt 默认入口。

```ts
type SnapshotProjectInput = {};

type SnapshotProjectOutput = {
  domains: DomainSummary[];
  recentUnderstandings: UnderstandingSummary[];
  stats: {
    domainCount: number;
    understandingCount: number;
    contextCount: number;
  };
};
```

#### `search_all`

Legacy/debug tool。第一阶段可以保留给兼容、排查和测试，但 prompt 不再主推。

```ts
type SearchAllInput = PaginationInput & {
  query: string;
};

type SearchAllOutput = {
  understandings: SearchUnderstandingHit[];
  contexts: SearchContextsHit[];
};
```

### 4.5 Write proposal tools

所有写工具都只是提交 pending proposal。它们不能直接写入 DB，approval 后才执行真正 mutation。

#### `propose_domain_create`

```ts
type ProposeDomainCreateInput = {
  name: string;
  parentId?: Id | null;
  reason?: string;
};

type ProposeDomainCreateOutput = PendingProposalOutput<
  "propose_domain_create",
  ProposeDomainCreateInput
>;
```

#### `propose_domain_update`

```ts
type ProposeDomainUpdateInput = {
  domainId: Id;
  after: DomainPatch;
  reason?: string;
};

type ProposeDomainUpdateOutput = PendingProposalOutput<
  "propose_domain_update",
  ProposeDomainUpdateInput
>;
```

#### `propose_domain_delete`

```ts
type ProposeDomainDeleteInput = {
  domainId: Id;
  deleteUnderstandings?: boolean; // default false
  reason?: string;
};

type ProposeDomainDeleteOutput = PendingProposalOutput<
  "propose_domain_delete",
  ProposeDomainDeleteInput
>;
```

#### `propose_understanding_create`

```ts
type ProposeUnderstandingCreateInput = {
  title?: string;
  body: string;
  domainIds?: Id[];
  basis: "user_stated" | "ai_candidate";
  reason?: string;
};

type ProposeUnderstandingCreateOutput = PendingProposalOutput<
  "propose_understanding_create",
  ProposeUnderstandingCreateInput
>;
```

规则：

- `basis: "user_stated"` 表示用户已经表达了这条理解，Agent 只做整理。
- `basis: "ai_candidate"` 表示 AI 在提出候选表达，必须在 UI 中明确等待用户确认。
- `propose_understanding_create` 不携带 Context。Understanding 可以先独立存在。
- 如果用户同时给了具体经历、材料、实践或 AI 对话，先提交 Understanding 候选；approval 后再用新 Understanding id 调用 `propose_context_create`。

#### `propose_understanding_update`

```ts
type ProposeUnderstandingUpdateInput = {
  understandingId: Id;
  before?: UnderstandingPatch;
  after: UnderstandingPatch;
  reason?: string;
};

type ProposeUnderstandingUpdateOutput = PendingProposalOutput<
  "propose_understanding_update",
  ProposeUnderstandingUpdateInput
>;
```

规则：

- Agent 必须先 `read_understanding`，再提交 `propose_understanding_update`。
- 修改双链关系也走 `after.body`，不走独立 link/connection write tool。
- `before` 用于 UI diff 和并发校验；缺省时后端仍需在 approval 时读取最新值。

#### `propose_understanding_delete`

```ts
type ProposeUnderstandingDeleteInput = {
  understandingId: Id;
  reason?: string;
};

type ProposeUnderstandingDeleteOutput = PendingProposalOutput<
  "propose_understanding_delete",
  ProposeUnderstandingDeleteInput
>;
```

#### `propose_context_create`

```ts
type ProposeContextCreateInput = {
  understandingId: Id;
  medium: ContextMedium;
  title?: string;
  content: string;
  reason?: string;
};

type ProposeContextCreateOutput = PendingProposalOutput<
  "propose_context_create",
  ProposeContextCreateInput
>;
```

规则：

- `propose_context_create` 只能给已有 Understanding 补 Context。
- 如果 Context 属于刚创建的 Understanding，先等 `propose_understanding_create` approval 产生 Understanding id，再调用 `propose_context_create`。
- Context 不是附件库；`content` 必须是围绕该 Understanding 的具象上下文。

#### `propose_context_update`

```ts
type ProposeContextUpdateInput = {
  contextId: Id;
  after: ContextPatch;
  reason?: string;
};

type ProposeContextUpdateOutput = PendingProposalOutput<
  "propose_context_update",
  ProposeContextUpdateInput
>;
```

#### `propose_context_delete`

```ts
type ProposeContextDeleteInput = {
  contextId: Id;
  reason?: string;
};

type ProposeContextDeleteOutput = PendingProposalOutput<
  "propose_context_delete",
  ProposeContextDeleteInput
>;
```

### 4.6 当前工具到目标工具的迁移表

| 当前工具                | 目标工具                       | 说明                                   |
| ----------------------- | ------------------------------ | -------------------------------------- |
| `snapshot_project`      | `snapshot_project`             | 兼容保留，不作为默认入口               |
| `domain_list`           | `list_domains`                 | 只改名                                 |
| `domain_inspect`        | `inspect_domain`               | `includeEdges` 改成 `includeLinkEdges` |
| `understanding_list`    | `list_understandings`          | 只改名                                 |
| `understanding_get`     | `read_understanding`           | 默认带 Context 和双链摘要              |
| `context_list`          | `list_contexts`                | 只改名                                 |
| `context_get`           | `read_context`                 | 默认带父 Understanding summary         |
| `search_all`            | legacy/debug only              | 不再主推                               |
| `search_understandings` | `search_understandings`        | 保留                                   |
| `search_contexts`       | `search_contexts`              | 保留，但结果带父 Understanding         |
| `graph_neighborhood`    | `read_link_neighborhood`       | graph 改成正文双链心智                 |
| `graph_path`            | `read_link_path`               | graph 改成正文双链心智                 |
| `domain_create`         | `propose_domain_create`        | 名字表达 pending proposal              |
| `domain_update`         | `propose_domain_update`        | 参数收敛到 `after`                     |
| `domain_delete`         | `propose_domain_delete`        | 名字表达 pending proposal              |
| `understanding_create`  | `propose_understanding_create` | 增加 `basis`                           |
| `understanding_update`  | `propose_understanding_update` | 参数收敛到 `after`                     |
| `understanding_delete`  | `propose_understanding_delete` | 名字表达 pending proposal              |
| `context_create`        | `propose_context_create`       | 名字表达 pending proposal              |
| `context_update`        | `propose_context_update`       | 参数收敛到 `after`                     |
| `context_delete`        | `propose_context_delete`       | 名字表达 pending proposal              |

## 5. 渐进式 Phase

每个 phase 都必须是可用切片，不按文件或模块横切。

### Phase 1：让真实 Pi runtime 使用唯一 system prompt

用户可见变化：

- Agent 开始以 Reflecta 的产品语义回答，不再默认说“知识库管理”。
- 现有聊天、搜索、审批能力不退化。

改动：

- `PiAgentHost` 从 `agent-system-prompt.md` 读取 system prompt。
- 删除或停止使用 `pi-agent-host.ts` 内联 prompt。
- `context-usage.ts` 继续引用同一份 prompt。
- 更新 prompt 内容，加入 value proposition 约束。

TDD：

1. RED：写 integration/unit test，断言 `createPiResourceLoader().getSystemPrompt()` 返回 markdown prompt 内容，而不是内联字符串。
2. GREEN：改 runtime prompt loader。
3. RED：写 prompt contract test，断言 runtime prompt 包含 `Understanding`、`Context`、`用户是大脑`、`候选项`、`Context 是理解的上下文`。
4. GREEN：补齐 prompt。
5. E2E：真实 AI 下问“你在 Reflecta 里能帮我做什么”，只断言回复完成，并且页面没有出现工具错误；不断言固定文案。

退出条件：

- Pi runtime 和前端 context usage 使用同一份 prompt。
- `rg "You are Reflecta's agent|knowledge-base search results" apps/electron/src/main/services/agent` 不再命中新 runtime prompt。

### Phase 2：修正现有 tool 文案和默认选择

用户可见变化：

- Agent 不再把 Context 说成周边材料。
- Agent 不再优先把所有读取需求打到 `search_all`。
- Tool card 文案更接近“查找相关理解 / 读取上下文”。

改动：

- `read_understanding` description 改为读取 Understanding 及其Context。
- `snapshot_project` 不再描述成 knowledge-base stats，而是领域理解概览。
- `search_all` prompt guideline 降级，不再写 “call search_all before answering”。
- 所有 approval pending 文案从 “knowledge base has not been changed” 改成 “候选项尚未写入”。

TDD：

1. RED：写 tool contract test，禁止 runtime tool descriptions 出现 `surrounding material`。
2. RED：写 tool contract test，禁止 runtime prompt guideline 强制 `call search_all before answering`。
3. GREEN：改 tool descriptions / guidelines。
4. E2E：真实 AI 下让用户要求“查一下我关于某主题的理解”，允许模型调用工具，但不要求固定工具名；断言最终页面有完成回复，不出现空转 loading。

退出条件：

- 现有工具仍能执行。
- 产品文案不再把 Context 降级成附件、背景或 surrounding material。

### Phase 3：收敛 read tool interface

用户可见变化：

- Agent 可以分别搜索 Understanding 和 Context。
- Context 命中会带回父 Understanding，不再像孤立材料。
- Tool activity 不再显示 `graph_*` 这种误导关系模型的名字。

改动：

- 新增目标 read tool 名：
  - `list_domains`
  - `inspect_domain`
  - `list_understandings`
  - `list_contexts`
  - `search_understandings`
  - `search_contexts`
  - `read_understanding`
  - `read_context`
  - `read_link_neighborhood`
  - `read_link_path`
- 保留当前实现作 adapter，先让新名字转发到旧 service。
- `search_contexts` result 增加 `parentUnderstanding`。
- `read_understanding` 默认带 Context summary 和双链摘要。
- `graph_neighborhood` / `graph_path` 改名为 `read_link_neighborhood` / `read_link_path`。
- `search_all` 降级成 legacy/debug，不再出现在 prompt guideline。

TDD：

1. RED：tool registry contract test，断言目标 read tools 全部注册。
2. GREEN：新增目标 tool 名并转发旧 service。
3. RED：seed Understanding + Context，调用 `search_contexts("命中 Context 的词")`，期望返回 `parentUnderstanding`。
4. GREEN：补 `parentUnderstanding` result shape。
5. RED：seed 正文双链，调用 `read_link_neighborhood`，期望返回 outgoing links / backlinks / unresolved links。
6. GREEN：接入当前 graph/wiki-link 解析结果。
7. E2E：真实 AI 下让用户查询一个已 seed 的主题，断言出现 tool activity，最终回复完成，不出现旧 `search_all` 强制路径。

退出条件：

- read tool 名称和 4.4 参数一致。
- `search_all` 不再是 prompt 主推工具。
- Context search 能带用户回到父 Understanding。
- 双链读工具只读派生关系，不创建关系。

### Phase 4：收敛 write proposal interface

用户可见变化：

- 所有写入卡片都明确是候选项，确认前不写入。
- 用户让 Agent 记录一条理解时，proposal card 只展示 Understanding 候选。
- 用户同时给了 Context 时，Agent 在 Understanding 确认后再提交 Context 候选。
- 没有 Context 的 Understanding 可以正常存在；Agent 只在回答边界时说明它尚未被 Context 追溯。

改动：

- 新增目标 write proposal tools：
  - `propose_domain_create`
  - `propose_domain_update`
  - `propose_domain_delete`
  - `propose_understanding_create`
  - `propose_understanding_update`
  - `propose_understanding_delete`
  - `propose_context_create`
  - `propose_context_update`
  - `propose_context_delete`
- 旧 `domain_*` / `understanding_*` / `context_*` 第一阶段可作为 alias 保留。
- `propose_understanding_create` 增加 `basis`。
- `propose_*_update` 参数收敛为 `after` patch。
- approval pending 文案从 “knowledge base has not been changed” 改成“候选项尚未写入”。
- 不新增 connection/link 写工具。

TDD：

1. RED：tool registry contract test，断言目标 write proposal tools 全部注册。
2. GREEN：新增目标 tool 名并复用现有 approval pipeline。
3. RED：调用 `propose_understanding_create`，pending event payload 包含 `basis`，且不包含 Context 字段。
4. GREEN：补 pending payload。
5. RED：approve `propose_understanding_create` 后，DB 里只出现 Understanding。
6. GREEN：实现候选理解写入。
7. RED：approve `propose_context_create` 后，DB 里 Context 绑定到已有 Understanding。
8. GREEN：复用现有 Context 写入。
9. RED：调用 `propose_understanding_update` 修改 body 插入双链，approve 后 link neighborhood 可读到关系。
10. GREEN：复用正文双链解析。
11. E2E：真实 AI 下输入“把这段来自某次 AI 对话的理解记录下来...”，断言先出现 Understanding proposal；确认后再出现 Context proposal；两次确认后刷新仍能看到新 Understanding 和 Context。

退出条件：

- write tool 名称和 4.5 参数一致。
- 所有写入仍然走 approval。
- 记录 Understanding + Context 通过两个 proposal tool 组合完成，不把 Context 塞进 Understanding create。
- 修改双链关系只能通过 Understanding body update。

### Phase 5：收敛 tool display 和 prompt 默认路线

用户可见变化：

- Tool activity 不再显示数据库味工具名。
- Agent 行为更稳定：搜索、读取、提出候选，但不自动织网。

改动：

- Tool UI 文案统一：
  - `search_understandings` -> 查找相关理解
  - `search_contexts` -> 查找相关上下文
  - `read_understanding` -> 读取理解
  - `read_context` -> 读取上下文
  - `read_link_neighborhood` -> 查看双链关系
  - `propose_understanding_create` -> 候选理解
  - `propose_context_create` -> 候选上下文
  - `propose_domain_create` -> 候选领域
- System prompt 指导 Agent 使用 primitive 组合：
  - 查找主题：`search_understandings` / `search_contexts` -> `read_understanding` / `read_context`。
  - 回看领域：`list_domains` -> `inspect_domain`。
  - 查看关系：`read_understanding` -> `read_link_neighborhood`。
  - 新增双链：`search_understandings` -> `read_understanding` -> `propose_understanding_update`。
  - 记录理解：`propose_understanding_create`；如果用户同时给了上下文，approval 后继续 `propose_context_create`。
- 隐藏或降级旧名：
  - `domain_list`
  - `domain_inspect`
  - `understanding_list`
  - `understanding_get`
  - `context_list`
  - `context_get`
  - `graph_neighborhood`
  - `graph_path`
  - `search_all`

TDD：

1. RED：agent turn view 测试输入 `read_link_neighborhood` event，期望 UI 显示“查看双链关系”。
2. GREEN：更新 tool display mapping。
3. RED：tool registry contract test，断言 prompt 主推工具不包含强制 `search_all`。
4. GREEN：收敛 registry / guidelines。
5. E2E：真实 AI 下跑四个 happy path：
   - 查询已有理解。
   - 查询已有 Context。
   - 记录理解并补 Context。
   - 给已有 Understanding 正文补双链。

退出条件：

- Runtime prompt 和 tool display 都不再把产品表达成 generic knowledge base。
- happy path 全部真实 AI 通过。
- 底层旧工具即使保留，也只是 alias / debug，不是主路径。

## 6. 测试边界

这次不写 fake happy path。

可以用 unit test 测稳定规则：

- prompt loader 是否读取同一份文件。
- tool descriptions 是否包含/不包含关键产品词。
- tool registry 是否暴露 4.4 / 4.5 定义的目标工具。
- `search_contexts` 对 seed DB 返回 Context 和父 Understanding。
- `read_link_neighborhood` 对 seed 双链返回 outgoing links / backlinks / unresolved links。
- `propose_understanding_create` approve 后只创建 Understanding。
- `propose_context_create` approve 后给已有 Understanding 创建 Context。
- `propose_understanding_update` 修改正文双链后，link neighborhood 能读到新关系。
- reducer 和 UI display mapping。

必须用真实 AI 跑的路径：

- Agent 解释自己在 Reflecta 里的角色。
- 查询已有理解。
- 查询已有 Context。
- 记录理解并补 Context。
- 给已有 Understanding 正文补双链。
- pending proposal approve。

真实 AI E2E 不断言固定回答内容，只断言产品状态：

- 回复完成。
- 没有 stuck loading。
- 有 tool activity。
- 有 proposal card。
- approve 后数据存在。
- reload 后仍能恢复。

## 7. 不做什么

这份 plan 不做：

- 向量数据库。
- GraphRAG。
- LLM reranker。
- 自动关系写入。
- 自动把 AI 总结入库。
- 新增大而全的 Agent orchestration layer。

这些都不是当前最短路径。

当前最短路径是：

```txt
先把 Agent 看到的 Reflecta interface 改对。
```

## 8. 验收

代码层验收：

```bash
bun run --filter '@reflecta/electron' test
bun run --filter '@reflecta/electron' typecheck
bun run --cwd apps/electron test:e2e
```

搜索验收：

```bash
rg "surrounding material|call search_all before answering|knowledge-base search results" apps/electron/src/main/services/agent
```

期望：

- runtime prompt 不再命中这些旧表达。
- `agent-system-prompt.md` 是 Pi runtime 的真实 system prompt。
- `search_understandings` / `search_contexts` / `read_*` 是 Agent 查询个人理解的主路径。
- `propose_*` 是 Agent 写入候选的主路径。
- `graph_*` 不再作为主推工具名；双链读取使用 `read_link_*`。
- 所有写入仍然走 approval。
