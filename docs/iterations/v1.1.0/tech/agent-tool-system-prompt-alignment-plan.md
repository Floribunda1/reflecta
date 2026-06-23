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
- 读工具主入口从 `search_all` 转成产品语义的 `find_understandings`。
- 写工具从“创建一个 Understanding”转成“提交一个可追溯的理解候选”。
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
inspect_domain
understanding_list
read_understanding
context_list
read_context
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

这个 interface 太浅。复杂度暴露给了模型。

### 3.3 Search 返回 shape 不符合 Context

当前 `search_all` 返回：

```ts
{
  understandings: UnderstandingSearchHit[];
  contexts: ContextSearchHit[];
}
```

这把 Understanding 命中和 Context 命中拆成了两个列表。

但 Reflecta 的产品语义里，Context 命中不应该是另一类“搜索结果”。它应该被解释成：

```txt
某个 Understanding 被它的上下文命中了。
```

所以更合适的 shape 是：

```ts
type UnderstandingCandidate = {
  understanding: UnderstandingSummary;
  matchedBy: "understanding" | "context" | "connection";
  matchedContexts: ContextEvidence[];
  relatedUnderstandings: RelatedUnderstanding[];
  boundaryNotes: string[];
  trace: RetrievalTrace;
};
```

### 3.4 `propose_understanding` 允许 Context-less AI proposal

当前裸 create 工具参数是：

```ts
{
  title?: string;
  body: string;
  domainIds?: string[];
}
```

这个 shape 很容易让 Agent 做出一条漂亮但悬空的 Understanding。

审批只能保证不会直接写入，不能保证这个候选项符合 Reflecta 的产品哲学。

更合适的写入入口应该表达：

```txt
这是一个用户理解候选。
它有没有 Context？
Context 的 medium、title、content 是什么？
它是用户已经说出来的理解，还是 AI 帮用户整理出来的候选表达？
如果没有 Context，它应该被标记为缺少上下文，而不是伪装成成熟理解。
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

### 4.2 Read tools 分两层

Agent prompt 中主推产品语义工具：

```txt
find_understandings
```

它的 interface：

```ts
type FindUnderstandingsInput = {
  query: string;
  domainIds?: string[];
  selectedRefs?: AgentContextRef[];
  limit?: number;
};

type FindUnderstandingsResult = {
  candidates: UnderstandingCandidate[];
  emptyReason?: "no_match" | "query_too_broad" | "query_too_specific";
  suggestedNextQueries?: string[];
};
```

它背后的 implementation 第一版复用 `agent-knowledge-retrieval-plan.md`：

```txt
SQLite FTS
  + token fallback
  + Context recall
  + explicit graph expansion
  + local ranking
  + retrieval trace
```

低层工具可以暂时保留，但不作为 prompt 里的默认路线：

```txt
read_understanding
read_context
inspect_domain
graph_neighborhood
```

`search_all` 第一阶段可以保留兼容测试和排查，但不再指导模型优先调用它。

### 4.3 Write tools 改成候选理解语义

新增或替换一个 Agent-facing 写工具：

```txt
propose_understanding
```

它表达的是“捕捉一个用户理解候选”，而不是裸 `createUnderstanding`。

建议 shape：

```ts
type ProposeUnderstandingInput = {
  title?: string;
  body: string;
  domainIds?: string[];
  proposedContext?: {
    medium: "experience" | "video" | "book" | "article" | "opinion" | "ai" | "other";
    title?: string;
    content: string;
  };
  proposalReason: string;
};
```

规则：

- 有具体场景或材料时带 `proposedContext`。
- 没有 `proposedContext` 时 proposal UI 只展示 Understanding 候选，不伪造 Context。
- 如果用户只是在让 AI 总结材料，Agent 不能直接把总结当 Understanding；应该先问用户这是否代表他的理解。
- approval 后，后端用一次事务创建 Understanding，并在有 `proposedContext` 时一起创建 Context。
- `add_context` 保留，用于给已有 Understanding 增加 Context。
- `update_understanding` 保留，但 prompt 必须要求先读取现有 Understanding 和 Context。

不新增 connection 写工具，直到产品明确需要“关系候选卡片”。

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

### Phase 3：新增 `find_understandings` 作为主读工具

用户可见变化：

- 用户问“我关于 X 有哪些理解”时，Agent 能返回带 Context 的候选，而不是裸搜索结果。
- 如果没有命中，Agent 能说清楚是没有匹配，还是 query 太宽/太窄。

改动：

- 新增 `find_understandings` Pi tool。
- 第一版 implementation 调用 `KnowledgeRetriever`。
- 返回 `UnderstandingCandidate[]`：
  - parent Understanding
  - matched Context evidence
  - explicit related Understandings
  - boundary notes
  - retrieval trace
- System prompt 指导 Agent 优先使用 `find_understandings`，只有需要精读时再 `read_understanding` / `read_context`。

TDD：

1. RED：seed Understanding + Context，调用 `find_understandings("命中 Context 的词")`，期望返回父 Understanding 和命中的 Context evidence。
2. GREEN：接入 `KnowledgeRetriever`。
3. RED：seed 只有 Understanding、没有 Context 的记录，期望 candidate 带 boundary note。
4. GREEN：补 boundary note。
5. E2E：真实 AI 下让用户查询一个已 seed 的主题，断言出现 tool activity，最终回复完成，并且 UI 有可读的 Context / 候选展示。

退出条件：

- `find_understandings` 覆盖普通查询路径。
- `search_all` 不再是 prompt 主推工具。
- 空结果有可解释 fallback。

### Phase 4：新增 `propose_understanding` 候选写入工具

用户可见变化：

- 用户让 Agent 记录一条理解时，proposal card 会显示它是否带 Context。
- 带 Context 的理解确认后，会同时创建 Understanding 和 Context。
- 没有 Context 的理解会明确显示“缺少 Context”。

改动：

- 新增 `propose_understanding` approval tool。
- approval 后用一次后端事务：
  - 创建 Understanding。
  - 如果有 `proposedContext`，创建 Context。
- System prompt 规定：
  - 用户已经表达的理解可以整理成 candidate。
  - AI 自己总结出的内容只能作为候选表达，必须说明 Context 状态。
  - 缺少 Context 时优先追问；用户明确要先记录时，标记为 ungrounded。
- UI proposal card 展示：
  - Understanding title/body。
  - proposed Context 的 medium/title/content preview。
  - proposal reason。

TDD：

1. RED：调用 `propose_understanding` approval tool，pending event payload 可包含 `proposedContext`。
2. GREEN：注册 approval tool。
3. RED：approve 带 proposedContext 的 proposal 后，DB 里同时出现 Understanding 和 Context。
4. GREEN：实现事务写入。
5. RED：approve 不带 proposedContext 的 proposal 后，只创建 Understanding。
6. GREEN：补输出。
7. E2E：真实 AI 下输入“把这段来自某次 AI 对话的理解记录下来...”，断言出现 pending proposal；点击确认后，刷新仍能看到新 Understanding 和 Context。

退出条件：

- 新写入路径不需要 Agent 连续调用 `propose_understanding` + `add_context`。
- 写入 proposal 能表达 Context 状态。
- 旧的裸 create 工具不再作为 prompt 主推工具。

### Phase 5：收敛 tool surface

用户可见变化：

- Tool activity 不再显示数据库味工具名。
- Agent 行为更稳定：先找理解，再精读 Context，再提出候选。

改动：

- Pi tools 列表中主推：
  - `find_understandings`
  - `read_understanding`
  - `read_context`
  - `inspect_domain`
  - `propose_understanding`
  - `add_context`
  - update/delete approval tools
- 降级或隐藏：
  - `search_understandings`
  - `search_contexts`
  - `search_all`
- Tool UI 文案统一：
  - 搜索相关内容 -> 查找相关理解
  - 读取 Understanding -> 读取理解
  - 读取 Context -> 读取上下文
  - 候选 Understanding -> 候选理解

TDD：

1. RED：agent turn view 测试输入 `find_understandings` event，期望 UI 显示“查找相关理解”。
2. GREEN：更新 tool display mapping。
3. RED：tool registry contract test，断言 prompt 主推工具包含 `find_understandings`，不包含强制 `search_all`。
4. GREEN：收敛 registry / guidelines。
5. E2E：真实 AI 下跑三个 happy path：
   - 查询已有理解。
   - 记录带 Context 的理解。
   - 给已有 Understanding 补 Context。

退出条件：

- Runtime prompt 和 tool display 都不再把产品表达成 generic knowledge base。
- happy path 全部真实 AI 通过。
- 底层 `search_all` 即使保留，也只是 debug/legacy 工具，不是主路径。

## 6. 测试边界

这次不写 fake happy path。

可以用 unit test 测稳定规则：

- prompt loader 是否读取同一份文件。
- tool descriptions 是否包含/不包含关键产品词。
- `find_understandings` 对 seed DB 的 deterministic result。
- `propose_understanding` approve 后的事务结果。
- reducer 和 UI display mapping。

必须用真实 AI 跑的路径：

- Agent 解释自己在 Reflecta 里的角色。
- 查询已有理解。
- 记录带 Context 的理解。
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
- `find_understandings` 是 Agent 查询个人理解的主路径。
- `propose_understanding` 是 Agent 创建新理解候选的主路径。
- 所有写入仍然走 approval。
