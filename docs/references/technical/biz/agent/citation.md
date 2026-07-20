# Agent Citation 与 Entity Catalog 架构

本文说明 Reflecta Agent 的实体引用（Citation）如何工作，以及 Entity Catalog、模型输入、Prompt Caching 之间的边界。

这里的 Citation 专指 Agent 在回答中生成的稳定实体引用，例如 `[[u:understanding_id]]`。它不是知识正文里的 Wiki Link，也不是供应商自带的网页 Citation。

本文同时描述当前实现和目标架构。目标架构解决的是 Catalog 在对话历史中重复注入造成的 Prompt 膨胀，并保留完整 Catalog 位于模型输入末尾的注意力位置。对话压缩（Compaction）、相关实体筛选和知识内容压缩不在本文范围内。

## 心智模型

Citation 不是一段实体快照，而是指向 Reflecta 实体的稳定指针。Entity Catalog 也不是知识正文，而是模型在当前对话中已经见过、因而允许引用的“实体地址簿”。

整个系统分为三层：

```mermaid
flowchart LR
  State["会话事实\n原始消息 / 工具事件 / Catalog 更新"]
  Projection["模型输入投影\n干净历史 + 一份最新 Catalog"]
  Output["Assistant Markdown\n[[u:id]] / [[c:id]] / [[d:id]]"]
  View["前端实时解析\n按 type + id 查询当前实体"]

  State --> Projection
  Projection --> Output
  Output --> State
  Output --> View
```

三层的归属规则是：

- 会话事件保存“发生过什么”，是 Catalog 的可重建事实来源；
- 模型输入投影决定“这一次模型实际看见什么”，它不是新的持久化事实；
- 前端按稳定 ID 读取当前实体，是 Citation 显示名称和可点击状态的真实来源。

核心结论：**Catalog 应该以一份完整、最新的快照出现在每次模型调用的最末尾，但不应该被复制进每一轮持久化消息。**

## Citation 协议

### 稳定格式

Agent 输出使用直接 ID 协议：

| 实体类型      | 格式         | 示例               |
| ------------- | ------------ | ------------------ |
| Understanding | `[[u:<id>]]` | `[[u:abc_123]]`    |
| Context       | `[[c:<id>]]` | `[[c:context_42]]` |
| Domain        | `[[d:<id>]]` | `[[d:career]]`     |

ID 只允许 `[A-Za-z0-9_-]+`。类型前缀和 ID 一起构成引用身份，标题不进入协议。

标题不进入 Citation 有三个原因：

1. 标题允许改名，ID 才是稳定身份；
2. 同名实体和跨类型同名实体不会发生歧义；
3. 模型只需要复制 runtime 提供的 token，不需要自己拼接标题、类型和 ID。

用户在编辑器中 `@` 某个实体时，前端传递的是结构化 `contextRefs`；知识正文里的 `[[标题#id]]` 是 Wiki Link。两者都不是 Assistant Citation，不能混用。

### Catalog 记录

当前 runtime 给模型的记录采用逐行 JSON：

```text
<reflecta_entities>
{"type":"understanding","id":"abc_123","citation":"[[u:abc_123]]","title":"示例标题"}
</reflecta_entities>
```

字段语义：

| 字段       | 作用                                             |
| ---------- | ------------------------------------------------ |
| `type`     | 实体类型的唯一来源                               |
| `id`       | 工具调用使用的真实参数                           |
| `citation` | 最终回答需要原样复制的显示协议                   |
| `title`    | 帮助模型识别实体的提示；不是身份，也不是知识正文 |

System Prompt 明确要求：最终回答只能复制 Catalog 中已有的 `citation`，工具调用只能传 `id`，不能自行构造或把 Citation token 当作工具参数。

这个直接 ID 协议已经经过真实模型压力测试。DeepSeek `deepseek-v4-flash` 的 20 个 direct 会话、220 轮测试中，目标覆盖率、type + ID 绑定和长对话末轮召回均为 100%；唯一失败是一次正确 Citation 的重复输出。具体数据见 [Citation 真实模型 A/B 报告](../../../../iterations/v1.1.22/evals/citation-reliability-report.md)。因此架构演进首先保留现有协议，不把“输入投影变化”和“Citation 格式变化”绑在一起。

### Citation 表达什么

Citation 表达的是“这段回答指向哪个 Reflecta 实体”，不是不可变的证据快照：

- 实体改名后，旧消息会显示新标题；
- 实体删除后，旧消息显示“引用不可用”；
- 实体正文后来被修改，Citation 仍指向修改后的同一个实体；
- 系统当前没有保存 claim 到原文片段的逐句证据映射。

因此它是活的实体链接，不是学术引用或审计级内容快照。需要不可变出处时，应另行设计版本化实体或证据快照，不能把该语义塞进现有 Citation token。

## 当前端到端流程

```mermaid
sequenceDiagram
  participant User as 用户 / Composer
  participant Host as PiAgentHost
  participant Catalog as AgentEntityCatalog
  participant Pi as Pi Session
  participant Model as 模型
  participant UI as Markdown Renderer
  participant DB as Reflecta 数据库

  User->>Host: text + contextRefs + files
  Host->>Catalog: 加入用户显式选择的实体
  Host->>Pi: 用户正文 + 轻量上下文 + Catalog 快照 + 附件元数据
  Pi->>Model: System Prompt + 历史 + 当前 Prompt
  Model->>Host: 可选的只读工具调用
  Host->>Catalog: 从工具结果收集新实体
  Host->>Model: 工具结果 + 新实体 Citation 记录
  Model-->>Host: Markdown + [[type:id]]
  Host-->>UI: 流式文本并持久化原始 Markdown
  UI->>DB: 按 type + id 查询当前实体
  DB-->>UI: 当前标题 / 已删除 / 加载失败
```

### Catalog 从哪里来

`AgentEntityCatalog` 以 `type:id` 为 key 去重。实体来自两条路径：

1. 用户显式 `@` 的 `contextRefs`，origin 记录为 `user_context`；
2. Agent 工具返回的数据，origin 记录为 `tool_result`。

工具收集器识别 Understanding、Context、Domain 的对象、ID 字段、ID 数组和 `retrieve_knowledge` 的候选结构。已存在实体再次出现时不会重复加入；如果后来取得了新的非空标题，则更新 Catalog 中的标题。

Catalog 的变化以 `entity.catalog.updated` 事件保存。它的职责是记录这个对话分支已经暴露过哪些实体，而不是复制实体正文。

用户显式选择的实体另有一段“轻量上下文”说明，最多包含 8 个 ref。它表达本轮用户明确指向了什么，属于这条用户消息本身；全局 Entity Catalog 则表达整个当前分支可引用的实体集合。两者不能合并成一个概念。

### 当前 Prompt 如何构造

当前 `buildPiPromptText` 按以下顺序拼接：

```text
用户正文
+ 本轮显式选择的轻量上下文
+ 当前完整 Entity Catalog
+ 附件元数据
```

完整 Catalog 会随 `session.prompt(...)` 一起成为 Pi 的用户消息并持久化。因此第 `n` 轮请求实际包含：

```text
System + Tools
+ (User 1 + Catalog 1) + Assistant 1
+ (User 2 + Catalog 2) + Assistant 2
+ ...
+ (User n + Catalog n)
```

Reflecta 自己的 `user.message` 事件只保存原始用户正文、context refs 和附件，不保存这段拼接后的 Catalog；重复发生在 Pi 的模型会话历史里。

工具循环还有第二条注入路径：只读工具结果会附带本次新发现实体的 Citation 记录，使模型在同一次运行的下一次调用中立刻可以引用它们。经审批的写工具也会把结果实体加入 Catalog，但当前两条路径的即时可见方式并不完全对称。

### Assistant 输出如何保存

Assistant 文本按 Markdown 原样流式输出，并最终保存在 `assistant.turn` 中。后端当前不重写 Citation，也不保存独立的 message-level citation manifest。

这意味着当前约束主要由 System Prompt 和模型评测保证，而不是后端白名单强制保证。模型如果生成一个语法正确但不在当时 Catalog 中的 ID，前端仍会尝试查询；查不到时显示“引用不可用”。因此 Catalog 是生成契约，不是安全边界。

### 前端如何显示

前端先跳过 fenced code 和 inline code，再把合法直接 Citation 转成内部链接：

```text
[[u:abc_123]]
    ↓
#reflecta-entity/understanding/abc_123
```

`EntityCitationAnchor` 随后用 `type + id` 实时读取实体：

- 读取成功：显示数据库中的当前标题；
- 实体删除或不存在：显示“引用不可用”；
- 查询失败：显示“引用加载失败”；
- Understanding 和 Context 可以打开 Inspector；Domain 当前只显示，不进入 Inspector。

前端渲染不依赖 Prompt 中的 Catalog title，也不依赖 `_entityCatalog` 参数。这个边界是正确的：模型看到的标题只帮助生成，UI 显示由当前业务数据决定。

## 当前架构的两个系统性问题

### Catalog 在历史中重复膨胀

如果第 `i` 轮 Catalog 的长度是 `|Cᵢ|`，当前历史承担的 Catalog 总量是：

```text
|C₁| + |C₂| + ... + |Cₙ|
```

Catalog 大小稳定时，它随轮数线性重复；Catalog 随工具发现持续增长时，累计量接近二次增长。结果不仅是价格问题：

- 每一份旧 Catalog 都占模型 context window；
- Transformer 仍会对缓存读取的 token 建立注意力，缓存不会让这些 token 从上下文消失；
- 同一实体改名后，历史里可能同时出现旧标题和新标题；
- 多份地址簿形成重复噪声，反而比“一份末尾 Catalog”更容易分散注意力；
- 当前附件元数据位于 Catalog 之后，Catalog 实际并非绝对末尾。

Prompt Caching 能减少相同前缀的重复计算和费用，但不能解决这类上下文膨胀。

### Catalog 重建没有严格跟随当前分支

编辑旧消息或 fork 后，模型输入应只依赖 root 到当前 leaf 的活动分支。当前 `eventsFromManager` 使用 `SessionManager.getEntries()` 读取全部 session entries；这可能把已放弃分支里的 `entity.catalog.updated` 也归入 Catalog。

Citation 的分支语义应该是：

```text
当前 Catalog = reduce(active branch 上的 Catalog 事件) + 当前运行中新发现的实体
```

使用全部 entries 不是缓存问题，而是状态边界错误。目标架构必须以 `getBranch()` 或等价的 active-branch view 重建 Catalog。

## 目标架构：持久状态与模型输入投影分离

目标架构不减少 Catalog 的覆盖范围，也不把它换成“最近相关实体”。它只改变 Catalog 进入模型输入的方式。

```mermaid
flowchart TD
  Branch["当前活动分支事件"]
  Reduce["Catalog Reducer\n得到唯一的当前快照"]
  History["Pi 干净历史\n用户正文 / Assistant / 工具结果"]
  Projector["Model Context Projector\n每次 LLM 调用前运行"]
  ModelInput["模型实际输入\n干净历史 + 一份末尾 Catalog"]
  Provider["Provider Adapter\n缓存策略与请求格式"]

  Branch --> Reduce
  Reduce --> Projector
  History --> Projector
  Projector --> ModelInput
  ModelInput --> Provider
```

目标请求形态是：

```text
System + Tools
+ User 1 + Assistant 1
+ User 2 + Assistant 2
+ ...
+ User n
+ Catalog n
```

Catalog 成本从 `Σ|Cᵢ|` 变成当前一份 `|Cₙ|`。

### Model Context Projector 的边界

Pi 的 `context` extension hook 会在每次 LLM 调用前收到一份可安全修改的 message deep copy。Model Context Projector 应使用这个原生边界，而不是维护第二套会话或自建模型调用循环。

Projector 对调用者提供一个窄接口，内部承担这些复杂性：

1. 从模型可见副本中移除 runtime 生成的旧 Catalog block；
2. 保留原始用户正文、显式选择、附件元数据、Assistant 和工具结果；
3. 把当前活动分支的完整 Catalog 序列化一次；
4. 将它作为独立文本 block 放在最后一个模型可见消息的末尾；
5. 返回新 messages，不修改 SessionManager 的持久记录。

Projector 必须满足幂等性：对同一份输入执行一次或多次，结果都只有零份或一份 runtime Catalog。

新用户消息不再通过 `buildPiPromptText` 持久化完整 `entityCatalog`。`buildPiPromptText` 仍负责属于本轮消息本身的用户正文、显式选择和附件元数据。

### 为什么仍然注入完整 Catalog

这里不采用“每轮只放相关实体”或 top-k：

- 相关性选择本身会给 Agent 增加先验，引导它只关注最近或检索器认为相关的实体；
- 一个早期见过、当前没有再次出现的实体仍可能在后续推理中变得重要；
- Citation Catalog 只保存地址和标题，不是把所有实体正文重复放入上下文；
- 完整快照位于最末尾，保留了当前协议经过验证的 recency 位置。

因此本架构选择“全局可见、单份快照、末尾注入”，而不是“相关实体子集”。如果单份 Catalog 本身最终过大，优先压缩序列化表示；是否改变覆盖范围应作为独立产品与模型质量决策。

### 工具循环如何看到最新 Catalog

`context` hook 在每一次 LLM 调用前触发，包括一次运行中模型调用工具后的下一次调用。工具输出先更新同一个 `AgentEntityCatalog`，Projector 随后读取最新 snapshot，因此：

```text
工具返回实体
→ Catalog collector 更新状态
→ entity.catalog.updated 持久化
→ 下一次 LLM 调用前投影完整最新 Catalog
```

这条统一路径可以同时覆盖只读工具和经审批的写工具。现有“只在只读工具文本结果后追加增量 Citation block”的特殊路径应被统一投影取代，否则同一次调用仍可能出现重复 Catalog。

### 旧会话如何兼容

旧 Pi 历史已经持久化了 `<reflecta_entities>`。不应为了迁移而重写 session 文件；Projector 只在模型可见副本中清理它们。

旧 block 只有在同时满足以下条件时才可视为 runtime 生成内容：

- 有完整的 `<reflecta_entities>...</reflecta_entities>` 边界；
- 内部每一行都能解析为已知 `type / id / citation / title` schema；
- `citation` 与 `type + id` 能严格互相推导。

不满足 schema 的同名用户文本必须原样保留。新的 runtime block 应带明确版本标记，后续清理不再依赖猜测。

### 序列化格式的边界

当前 JSON 记录重复了字段名，也同时携带可推导的 `id` 和 `citation`，确实有进一步缩短空间。但直接 ID 协议已经有可靠性基线，因此目标架构先保留现有 JSON 格式。

未来如果改成紧凑格式，例如每行只保留类型、ID 和标题，必须把它视为 Citation Prompt 协议变更，并重新跑同一套真实模型评测。输入投影去重与序列化压缩是两个独立变量，不能在一次变更里同时发生。

## Prompt Caching 架构

### 缓存的是前缀，不是任意片段

主流供应商的 Prompt Caching 都以 exact prefix 为基本心智模型。静态内容放前面，动态内容放后面；相同前缀可以复用，前缀中间发生变化后，后面的缓存不能继续命中。

Pi 的 provider 层已经具备缓存能力：`cacheRetention` 默认使用短期策略，支持的 adapter 会把它映射成供应商的缓存字段，并使用 session ID 改善缓存亲和性。Reflecta 已经从 Pi usage 中保存 `cacheRead` 和 `cacheWrite`，但当前没有显式声明 Catalog 的动态边界。

Pi 当前的 Anthropic-style 兼容策略会在最后一个 user / assistant 文本 block 上放缓存标记。目标架构中最后一个 block 恰好是 Catalog，所以只沿用这个默认位置仍会缓存到 Catalog 末尾；下一轮移除旧 Catalog 后，这个长前缀无法精确匹配。Catalog-aware adapter 必须把会话级 breakpoint 放在 Catalog 前一个普通内容 block 上。System Prompt 和最后一个 tool definition 的稳定缓存点不受影响。

所以 Reflecta 不需要：

- 自己保存 KV cache；
- 按模型供应商复制一套会话历史；
- 为缓存生成另一份隐藏对话；
- 为提高命中率保留历史 Catalog 重复副本。

Reflecta 需要定义的是哪一段属于稳定前缀，Pi/provider adapter 负责如何向供应商表达。

### “在 Catalog 前设置缓存边界”是什么意思

缓存边界不是插入 Prompt 的一行文字，也不是让模型忽略边界后的内容。它是 provider request 上的元数据，含义是：

> 从请求开头到这里是希望复用的前缀；后面的 Catalog 仍然正常进入本次模型上下文，只是不要求它成为下一轮可复用前缀的一部分。

请求可以简化成：

```text
第 1 轮：[System + Tools + User 1] | [Catalog 1]
第 2 轮：[System + Tools + User 1 + Assistant 1 + User 2] | [Catalog 2]
第 3 轮：[System + Tools + User 1 + Assistant 1 + User 2 + Assistant 2 + User 3] | [Catalog 3]
```

`|` 是供应商元数据中的缓存 breakpoint，不是发送给模型的字符。

第 2 轮可以读取第 1 轮已经缓存的 `System + Tools + User 1`；第 2 轮完成后，又把增长后的干净历史写成下一轮可复用前缀。每轮 Catalog 仍位于模型输入绝对末尾，模型照常注意它，但旧 Catalog 不会进入下一轮历史。

这解决了看似冲突的两个目标：

- 为模型保留末尾完整 Catalog；
- 为供应商保留可增长的干净会话前缀。

如果不设这个边界，第 1 轮缓存的结尾是 `Catalog 1`，第 2 轮在同一位置却变成 `Assistant 1`，严格 exact-prefix provider 只能退回到更短的缓存点。边界的作用只是让供应商提前在正确位置留下可复用前缀。

### 缓存策略归属

缓存策略属于 provider adapter，不属于 Catalog serializer：

| 层                      | 负责什么                                                     |
| ----------------------- | ------------------------------------------------------------ |
| Model Context Projector | 标记并放置唯一的动态 Catalog block                           |
| Pi / Provider Adapter   | 把 Catalog 前一个普通内容 block 标成 cache breakpoint        |
| Provider                | 实际保存、命中、过期和计费                                   |
| Reflecta Usage          | 记录 `input / cacheRead / cacheWrite / contextWindow` 供验证 |

对于支持显式 breakpoint 的 provider：

- Anthropic 在 Catalog 前一个 content block 上使用 `cache_control`；
- OpenAI 支持显式 breakpoint 的模型在 Catalog 前一个 content block 上使用 `prompt_cache_breakpoint`，并以稳定 session key 改善路由；
- Pi 已有的 system prompt、tool definitions 缓存能力继续保留。

对于不支持显式 breakpoint 的 provider，adapter 不做额外处理。Citation 正确性和单份 Catalog 架构不依赖缓存；差别只体现在费用与延迟。不能为了迁就某个 provider 的缓存能力，把重复 Catalog 重新放回历史。

供应商字段和支持范围会变化，具体映射必须留在 Pi/provider adapter，并以官方文档和实际 usage 为准，不能进入 System Prompt 或业务事件 schema。

### Prompt Caching 不解决什么

即使命中缓存，缓存 token 仍然属于模型输入上下文。Prompt Caching 主要优化重复前缀的计算、延迟和价格，不会：

- 扩大模型 context window；
- 消除 Transformer 对历史 token 的注意力；
- 自动移除重复或冲突信息；
- 替代对 Catalog 大小的度量。

所以架构顺序是先保证模型输入只含一份 Catalog，再在正确前缀上利用缓存。高 cache hit rate 不能证明 Prompt 没有膨胀。

## 分支、编辑与 fork 的语义

Citation Catalog 属于对话分支，不属于整个 session 文件的并集。

编辑旧用户消息后：

1. 编辑点之前的事件仍属于新分支；
2. 被替换消息及其后续旧分支产生的 Catalog 实体不自动进入新分支；
3. 新分支重新通过用户选择或工具结果见到的实体才重新进入 Catalog；
4. Projector 只投影当前活动分支的 snapshot。

Provider cache 即使复用相同 session key，也必须做 exact-prefix 校验，因此不能把另一分支的不同内容当作命中。session key 只影响路由或缓存亲和性，不是缓存内容的身份。

前端显示历史 Citation 时仍按消息所在分支的 Markdown 和实体当前状态解析；它不依赖当前输入 Catalog。这样编辑和 fork 改变未来模型可见状态，但不会重写已经生成的 Assistant 文本。

## 架构不变量

### Citation 不变量

- Citation 身份始终是 `type + stable id`，标题不参与身份；
- 工具参数只接受真实 ID，不接受 Citation token；
- Assistant Markdown 原样保存，前端只解析合法语法；
- UI 显示名称来自当前实体，不来自模型生成标题；
- Catalog 只证明实体已暴露给当前分支，不证明模型已经读取了完整正文。

### Catalog 不变量

- 一个活动分支对同一个 `type:id` 最多有一条当前记录；
- Catalog 从活动分支事件可重建，不能依赖前端临时状态；
- 每次 LLM 调用只看到零份或一份 runtime Catalog；
- 非空 Catalog 必须位于模型输入的最后；
- 工具中新发现的实体必须在下一次 LLM 调用前可见；
- 新的持久化用户 Prompt 不包含全量 Catalog 快照。

### 缓存不变量

- 缓存只是性能优化，不参与 Citation 正确性；
- 缓存边界是 provider metadata，不是 Prompt 文本；
- 稳定前缀在 Catalog 之前，Catalog 是每次调用的动态后缀；
- 不支持缓存或缓存未命中时，模型看到的内容保持完全一致；
- 不以重复持久化内容换取 cache hit rate。

## 可观测性

现有 `AgentUsage` 已经记录 `input`、`output`、`cacheRead`、`cacheWrite` 和成本，`AgentContextUsage` 记录 context tokens、window 和占比。Catalog 投影还应提供只包含数量、不包含用户数据的本地指标：

| 指标                         | 用途                                           |
| ---------------------------- | ---------------------------------------------- |
| `catalogEntityCount`         | 当前快照实体数量                               |
| `catalogChars` / tokens      | 单份 Catalog 自身大小                          |
| `legacyCatalogBlocksRemoved` | 旧会话清理是否生效                             |
| `projectedCatalogBlocks`     | 必须始终为 0 或 1                              |
| `cacheRead / cacheWrite`     | 供应商前缀缓存是否实际工作                     |
| `contextUsage.percent`       | 缓存命中之外，真实 context window 是否继续增长 |

日志不能写入 Catalog 内容、ID 或标题。判断架构是否有效时，要同时看 Citation 可靠性、Catalog token、总 context token 和缓存读写，不能只看缓存命中率。

## 失败行为

- Projector 未加载或序列化失败时，应在模型调用前显式失败，不能静默发送一个没有 Catalog 的请求；
- Projector 发现多个 runtime Catalog 时，应去重并记录诊断；
- 旧 block 不能通过严格 schema 验证时，应保留原文，避免误删用户内容；
- provider 不接受缓存字段时，只关闭该 adapter 的缓存标记，不回退 Citation 架构；
- Citation 指向不存在或已删除实体时，前端降级为“引用不可用”，不能猜测替代实体。

## 不采用的方案

| 方案                                   | 原因                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| 每轮继续持久化完整 Catalog             | 缓存命中看似稳定，但 context 与注意力持续膨胀               |
| 每轮只注入相关或最近实体               | 引入选择偏差，改变 Agent 的全局实体可见性                   |
| 把 Catalog 移到固定 System Prompt      | Catalog 随工具和分支变化，修改前部内容会破坏更多缓存前缀    |
| 自建 Reflecta KV Prompt Cache          | Pi 和 provider 已拥有缓存能力，自建层无法复用供应商内部状态 |
| 同时更换投影方式和 Citation 序列化协议 | 无法判断可靠性变化来自哪一个变量                            |
| 用 Prompt Caching 代替 Prompt 去重     | 缓存不减少 context token，也不消除注意力噪声                |

## 主要代码位置

- `apps/electron/src/main/services/agent/agent-system-prompt.md`：Citation 生成契约；
- `apps/electron/src/main/services/agent/agent-citations.ts`：Catalog Prompt 序列化；
- `apps/electron/src/main/services/agent/agent-entity-catalog.ts`：实体收集、去重与更新；
- `apps/electron/src/main/services/agent/pi-prompt.ts`：当前用户 Prompt 拼接；
- `apps/electron/src/main/services/agent/pi-agent-host.ts`：会话、工具循环与 Catalog 生命周期；
- `apps/electron/src/main/services/agent/pi-session-log.ts`：Pi session 与 Reflecta 事件映射；
- `apps/electron/src/preload/typings/agent-context.ts`：用户显式选择的轻量上下文；
- `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`：Citation 语法解析；
- `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`：实体实时查询和渲染。

相关架构见 [Agent 后端架构](./server.md)、[Chat 前端状态架构](./frontend.md) 和 [知识检索与 RAG 如何工作](../../rag.md)。

## 外部依据

- [OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)：exact-prefix、session cache key 和显式 breakpoint；
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)：cache prefix、`cache_control` 和多轮对话缓存；
- [Pi Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)：每次 LLM 调用前的 `context` hook；
- [Citation 直接 ID 协议试验方案](../../../../iterations/v1.1.22/agent-direct-entity-citation-trial-plan.md)：当前协议的设计背景与评测口径。
