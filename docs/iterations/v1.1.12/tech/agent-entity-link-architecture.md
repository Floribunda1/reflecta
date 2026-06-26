# v1.1.12 Agent Entity Link 架构

> 日期：2026-06-26
>
> 状态：Draft
>
> 目标：定义 Agent 正文里 Reflecta entity link 的最终模块架构，让 Agent 能稳定引用真实 Understanding / Context / Domain，同时不污染对话上下文、不阻断 streaming render。

## 0. 阅读路径

这份文档按实现者的心智模型组织：

- 先看 [1. 要解决的问题](#1-要解决的问题)：明确这不是 citation / grounding 系统。
- 再看 [2. File Search 类比](#2-file-search-类比)：说明借鉴的是哪一层。
- 然后看 [3. 最终架构](#3-最终架构)：谁维护 source，谁解析正文，谁打开详情。
- 需要落地时看 [5. 数据流](#5-数据流) 和 [6. 存储和恢复](#6-存储和恢复)。
- 担心边界时看 [8. 风险和处理策略](#8-风险和处理策略)。

## 1. 要解决的问题

当前 Agent 正文引用已有 Reflecta 对象时，要求模型输出：

```txt
[[understanding:标题#id]]
[[context:标题#id]]
[[domain:标题#id]]
```

这有两个问题：

- Renderer 现有 parser 没有真正解析 type，Context id 可能被当成 Understanding 打开。
- 即使修掉 parser，模型仍然需要在自由文本里复写真实 id，容易把已知对象的 id 写错或混淆。

v1.1.12 要解决的是：

```txt
Agent 正文里的蓝色引用，稳定打开 Reflecta 里真实存在的 entity。
```

不解决：

- 不做 claim-level evidence citation。
- 不判断 Agent 的论证是否有依据。
- 不把所有历史 Context 内容塞进 prompt。
- 不让 Agent 直接写入用户知识网。

一句话：

```txt
这是 entity link 架构，不是 content grounding 架构。
```

## 2. File Search 类比

OpenAI File Search 的关键不是短编号本身，而是分离三件事：

```txt
source / file metadata
answer text
renderable citation / annotation
```

官方 File Search 文档里，回答正文和引用信息不是同一种东西：正文在 message text 里，引用以 annotations / file citation metadata 的形式关联到 file id / filename；完整 search results 也和正文分开，需要显式 include。

参考：

- [OpenAI File Search](https://developers.openai.com/api/docs/guides/tools-file-search)
- [OpenAI Citation Formatting](https://developers.openai.com/api/docs/guides/citation-formatting)

Reflecta 借鉴这一点：

```txt
Agent text 不再携带真实 entity id。
真实 entity identity 存在系统维护的 source map 里。
Renderer 根据 source map 把正文 marker 渲染成 clickable entity chip。
```

但 Reflecta 不照搬 File Search 的 final annotations：

- File Search 是 API 在最终 response 里返回 annotation。
- Reflecta 要支持 streaming UI，所以正文 marker 由 Renderer 实时解析。
- AgentHost 不解析 final text；它只维护 source identity。

## 3. 最终架构

最终模块分成五层：

```txt
Reflecta DB
  -> 真实事实源：Understanding / Context / Domain

AgentHost Entity Source Map
  -> 给已经进入 Agent 输入面的真实 entity 分配 sourceId

Prompt / Tool Output Adapter
  -> 在 entity 出现的位置暴露 [[ref:S1]]

Renderer Entity Ref Resolver
  -> 实时解析 [[ref:S1]]，查 source map，渲染 chip

Inspector / Detail Query
  -> 点击 chip 后用真实 { type, id } 打开详情
```

### 3.1 核心对象

```ts
type AgentEntityType = "understanding" | "context" | "domain";

type AgentEntityRef = {
  type: AgentEntityType;
  id: string;
  title?: string;
};

type AgentEntitySource = {
  sourceId: string; // S1 / S2 / S3, session-scoped
  entity: AgentEntityRef;
  origin:
    | { kind: "user_context"; messageId: string }
    | { kind: "tool_result"; toolCallId: string; toolName: string };
};
```

Agent 正文只输出：

```txt
[[ref:S1]]
```

不输出：

```txt
[[context:标题#真实id]]
```

### 3.2 sourceId 规则

- `sourceId` 只在一个 Agent session 内有效。
- 第一次看到某个 `type:id` 时分配下一个 `Sx`。
- 同一个 session 内，同一个 `type:id` 永远复用同一个 `sourceId`。
- title 可以后续补全或更新，但 identity 只看 `type:id`。
- `S1` 在不同 session 可以指向不同对象。

### 3.3 模块职责

#### AgentHost

AgentHost 负责真实 entity identity：

- 从用户 `@` 的 `contextRefs` 注册 source。
- 从只读工具结果注册 source。
- 给 prompt / tool result 里已经出现的 entity 填入 `[[ref:Sx]]`。
- 把 source map 写入 session log。

AgentHost 不负责：

- 不解析 assistant final text。
- 不生成 message annotations。
- 不渲染 link。
- 不猜 unresolved marker。

#### Renderer

Renderer 负责文本呈现：

- replay session log，得到当前 session 的 source map。
- streaming delta 阶段实时解析 `[[ref:Sx]]`。
- resolved marker 渲染成现有 chip 样式。
- unresolved marker 显示普通文本，不 clickable。
- 点击 chip 时调用现有 inspector/detail query。

Renderer 不负责：

- 不分配 sourceId。
- 不从 title 猜 entity。
- 不把模型输出的真实 id 当事实源。

## 4. 为什么不做全局 Registry Block

不要每轮 prompt 都塞一个完整列表：

```txt
当前 session 所有可引用对象：
S1 ...
S2 ...
S3 ...
...
S80 ...
```

这会污染注意力，也会浪费上下文。

v1.1.12 的策略是：

```txt
source marker 跟着已经进入 Agent 输入面的 entity 走。
```

用户 `@` 的对象本来就会进入 prompt，只是把真实 id 换成 marker：

```txt
用户显式 @ 了这些知识库对象：
- [[ref:S1]] Understanding: Feedback Loop
- [[ref:S2]] Context: 一次产品迭代复盘
```

工具结果本来就会返回 entity，只是补一个 marker：

```json
{
  "ref": "[[ref:S3]]",
  "type": "context",
  "title": "一次交易复盘",
  "excerpt": "..."
}
```

system prompt 只需要一条规则：

```txt
聊天正文引用 Reflecta 对象时，只使用用户 @ 或工具结果里出现的 [[ref:Sx]] marker，不要输出真实 id。
```

## 5. 数据流

### 5.1 用户 @ 对象

用户输入：

```txt
@Feedback Loop 这个理解和上次产品迭代复盘有什么关系？
```

Renderer 发送给 AgentHost：

```ts
contextRefs: [{ type: "understanding", id: "u_feedback_loop_123", title: "Feedback Loop" }];
```

AgentHost 注册：

```txt
S1 -> understanding:u_feedback_loop_123
```

Prompt 里出现：

```txt
用户显式 @ 了这些知识库对象：
- [[ref:S1]] Understanding: Feedback Loop
```

Agent 输出：

```txt
你的 [[ref:S1]] 不是一个抽象原则。
```

Renderer streaming 时查 source map：

```txt
[[ref:S1]]
  -> understanding:u_feedback_loop_123
  -> ✦ Feedback Loop
```

### 5.2 工具返回对象

Agent 调用 `retrieve_knowledge` 后，工具返回真实对象：

```ts
{
  type: "context",
  id: "ctx_product_review_456",
  title: "一次产品迭代复盘"
}
```

AgentHost 注册：

```txt
S2 -> context:ctx_product_review_456
```

给模型看到的工具结果包含：

```json
{
  "ref": "[[ref:S2]]",
  "type": "context",
  "title": "一次产品迭代复盘",
  "excerpt": "..."
}
```

Agent 输出：

```txt
这个模式在 [[ref:S2]] 里已经出现过。
```

Renderer 渲染：

```txt
这个模式在 ↳ 一次产品迭代复盘 里已经出现过。
```

点击 chip：

```txt
{ type: "context", id: "ctx_product_review_456" }
  -> Context inspector
```

### 5.3 Streaming Render

streaming 阶段不等 final message。

```txt
assistant.text.delta:
  "这个模式在 [[ref:S2]]"
```

Renderer 当前已有 source map：

```txt
S2 -> context:ctx_product_review_456
```

所以可以实时渲染 chip。

如果 delta 比 source map 先到，Renderer 先显示普通文本；source map 事件到达后，下一次 render 自动变成 chip。

## 6. 存储和恢复

Source map 存在 Agent session log，不存在 React 临时状态，也不新建全局业务表。

新增 durable event：

```ts
type AgentEntitySourcesUpdated = AgentEventBase & {
  type: "entity.sources.updated";
  sources: AgentEntitySource[];
};
```

写入时机：

- 用户消息入队后，注册 `contextRefs`，写一次。
- 工具结果返回真实 entity 后，写一次。
- 同一 `type:id` 已存在时不重复写；title 更完整时可以覆盖写一次。

恢复规则：

```txt
打开 session
  -> replay session log
  -> reducer 合并 entity.sources.updated
  -> renderer 恢复 source map
  -> 旧消息里的 [[ref:Sx]] 继续可点击
```

切换对话：

```txt
session A 有自己的 S1/S2
session B 有自己的 S1/S2
互不共享
```

重启应用：

```txt
读取 Sessions/*.jsonl
replay entity.sources.updated
恢复 source map
```

这个设计和 `session-canonical-log-plan.md` 兼容：

- live delta 仍然只用于当前 UI。
- durable session log 只保存语义事件。
- `entity.sources.updated` 是语义事件，不是 token-level transport 噪声。

## 7. 与现有系统的关系

### 7.1 复用现有 display 工具

Renderer 已经有 entity display 逻辑：

- `contextMentionClass()`
- `contextMentionIcon()`
- `WikiLinkChip`
- inspector 打开 Understanding / Context 的路径

新方案不替换这些 UI。

它只替换 identity 来源：

```txt
旧：
markdown link href 里解析真实 id

新：
[[ref:S1]] -> source map -> 真实 { type, id }
```

### 7.2 兼容旧格式

旧消息仍可能包含：

```txt
[[understanding:标题#id]]
[[context:标题#id]]
```

第一版仍要修旧 parser：

- 正确解析 type。
- Context 不再被当成 Understanding。
- resolve 失败时不 clickable。

但新 Agent prompt 禁止继续生成旧格式。

### 7.3 不改变 Reflecta 事实源

Reflecta 的事实源仍然是：

- Understanding
- Context
- Domain

Source map 不是新的业务事实源，只是 Agent session 里的 entity alias table。

## 8. 风险和处理策略

### 8.1 Agent 写不存在的 marker

例如：

```txt
[[ref:S999]]
```

处理：

```txt
resolve 失败 -> 普通文本 -> 不 clickable
```

不猜，不搜索，不创建 source。

### 8.2 Agent 选错 source

例如应该引用 S1，却写了 S2。

系统只能保证：

```txt
S2 打开的一定是 S2 对应的真实 entity。
```

系统不能保证：

```txt
Agent 的语义判断一定正确。
```

这是回答质量问题，不是 entity identity 问题。

### 8.3 source 太多

Source map 可以随 session 增长，但不会全部进入 prompt。

Prompt 只在 entity 自然出现的位置暴露 marker：

- 用户 `@`。
- 工具结果。
- 未来任何本来就会给 Agent 看的 entity 字段。

存储 scope 和 prompt visible scope 分开。

### 8.4 对象被删除

source map 里仍有：

```txt
S2 -> context:ctx_deleted
```

点击时 detail query 查不到。

处理：

```txt
显示 not found / disabled state
不打开空白 inspector
```

### 8.5 title 改名

第一版使用 source map 里记录的 title，保证历史消息回放稳定。

后续可以在 inspector 打开时显示最新 title，但正文 chip 不需要实时追新。

### 8.6 编辑历史消息

如果编辑某条旧 user message，session log 会从编辑点之后重新生成。

Source map 也应跟着新分支重放：

```txt
编辑点之前的 sources 保留
编辑点之后的 future sources 丢弃并重新分配
```

不要把旧未来分支里的 Sx 泄漏到新分支。

## 9. 最小落地计划

### Phase 1：修旧 link parser

- 支持 `[[understanding:标题#id]]`、`[[context:标题#id]]`、`[[domain:标题#id]]`。
- Context link 打开 Context inspector。
- Domain 第一版可以 non-clickable。
- unknown / invalid link 不 clickable。

### Phase 2：新增 session source map

- 增加 `AgentEntitySource` 类型。
- 增加 `entity.sources.updated` session event。
- AgentHost 注册用户 `contextRefs`。
- Renderer reducer replay source map。

### Phase 3：Renderer 实时解析 marker

- 支持 `[[ref:S1]]`。
- streaming delta 和历史消息走同一套 resolver。
- resolved marker 渲染现有 chip。
- unresolved marker 显示普通文本。

### Phase 4：工具结果注册 source

- 从 `retrieve_knowledge`、`understanding_get`、`context_get` 等只读工具输出抽取真实 entity。
- 给工具结果里的 entity 补 `ref: "[[ref:Sx]]"`。
- 不可靠结构先跳过，不做猜测。

### Phase 5：更新 prompt contract

把正文引用规则改为：

```txt
聊天正文引用 Reflecta 对象时，只能使用用户 @ 或工具结果里出现的 [[ref:Sx]] marker。不要输出真实 DB id，不要输出旧格式 [[type:title#id]]。
```

## 10. 测试清单

必须覆盖：

- 同一个 `type:id` 在同一 session 内复用同一个 `Sx`。
- 不同 session 的 `S1` 可以指向不同 entity。
- `[[ref:S1]]` 在 streaming render 中能用 source map 渲染 chip。
- `[[ref:S999]]` 不 clickable。
- replay `entity.sources.updated` 后，旧 assistant message 的 marker 可恢复。
- 旧格式 `[[context:标题#ctx_1]]` 不再打开 Understanding inspector。
- 对象删除后点击不打开空白页。

## 11. 最终边界

最终架构保持三条线清楚分离：

```txt
Reflecta DB:
  真实 entity source of truth

Agent session source map:
  Agent 对话内的 entity alias table

Renderer resolver:
  把正文 marker 显示成 clickable entity chip
```

v1.1.12 不引入更大的 citation 系统。

第一版只把这件事做好：

```txt
Agent 输出 [[ref:S1]]
用户看到稳定可点击的 Reflecta entity link
```
