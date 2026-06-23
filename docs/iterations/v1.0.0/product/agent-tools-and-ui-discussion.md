# Reflecta V2 Agent Tools and UI Plan

> 日期：2026-06-18
>
> 状态：Accepted
>
> 职责：定义 V2 Agent 的 tools、聊天流组件和前台展示边界。本文不替代 tech plan。
>
> 上游文档：
>
> - `docs/iterations/references/value-proposition.md`
> - `docs/iterations/v1.0.0/product/agent-value-proposition.md`
> - `docs/iterations/v1.0.0/product/agent-chat-system-feature-set.md`

## 1. 基本前提

Agent 前台不暴露“概念深化”“关系探讨”等模式。

用户最容易理解的形态接近 Vibe Coding：

> 用户在聊天里自然输入需求，并通过 `@` 把 Understanding / Context / Domain 等对象交给 Agent。

例如：

```txt
帮我把 @反馈延迟 这个概念聊深一点。

我感觉 @逃避复盘 @不愿止损 @拖延沟通 有点像，帮我一起分析一下。

基于 @这条 Understanding 和 @这个 Context，追问我几个问题。

把我们刚刚聊出来的东西，整理成一条候选 Understanding。
```

用户不需要选择模式，不需要填写工作流表单，也不需要理解 tool call。

前台应该只让用户理解三件事：

- 我把哪些对象交给了 Agent。
- Agent 基于哪些对象做了读取 / 搜索。
- 哪些内容只是候选，必须由我确认后才会写入 Reflecta。

## 2. Tools 设计原则

Tools 是给 AI 用的，不是给用户看的。

因此 tools 不能从前台 UI 组件倒推，也不能假设 Agent 应该 one shot 拿到完整上下文。

更接近 Vibe Coding 的调用逻辑是：

```txt
用户给一个任务
-> Agent 先 map / list / search 找候选
-> read 少量关键对象
-> 发现不够，再 list / search / expand
-> 综合回答
-> 需要写入时生成 proposal
```

在 code 场景里，Agent 最熟悉的不是“给我一个 project snapshot 后一次性推理完”，而是：

- 用 `ls` / file tree 先理解项目结构。
- 用 `rg` 搜索相关文件。
- 用 `sed` / `cat` 读取少量上下文。
- 追踪引用和附近代码。
- 只在必要时继续展开。
- 最后用 patch 提出修改。

Reflecta Agent 也应该类似。工具要让 AI 可以低成本探索，而不是强迫它预判一次需要多少上下文。

当前项目里的 CLI 已经按这个方向设计：

```bash
reflecta <resource> <action> [args] [options]
```

例如：

- `reflecta snapshot project`
- `reflecta domain list`
- `reflecta domain inspect <id>`
- `reflecta understanding list`
- `reflecta understanding get <id>`
- `reflecta context list --understanding-id <id>`
- `reflecta search all <query>`
- `reflecta graph neighborhood --understanding-id <id>`

所以 Electron Agent tools 不应该另起一套抽象命名。更好的做法是：

> 前台 Agent tools 与 CLI action 同构，只是把 `resource action` 转成 AI SDK 可用的 tool name。

例如 `reflecta understanding get` 对应 `understanding_get`，`reflecta search all` 对应 `search_all`。

参考 Agent-Friendly CLI 的共通原则，V2 Agent tools 应该遵守：

- 结构导航优先：Agent 可以先看 Domain 地图，再决定在哪些范围里 list / search。
- 搜索和读取分离：search 负责找候选，read 负责读取少量确定对象。
- 小步探索优先：允许 Agent 多次低成本调用，而不是追求一次性取全。
- 局部展开：当 Agent 已经有一组对象时，可以 expand 它们的 Context / Connection / neighbors。
- 原子写入候选：写入仍然拆成明确 proposal，不让聚合工具直接产生副作用。
- Token 最小化：输出默认是摘要和必要字段，按需 include 正文、Context、Connection。
- 零歧义：tool output 要能区分 found / empty / not found / permission or validation error。
- 默认安全：所有 mutation 都只是 proposal，真正写入必须用户确认。
- 无隐藏交互：tool 不等待用户输入，不弹确认；确认是前台 approval flow。

## 3. Primitive Tool Set

### 3.0 命名原则

Tool name 尽量直接来自 CLI action：

```txt
<resource>_<action>
```

原因：

- 现有 CLI 已经是给 Agent 用的接口。
- Agent 可以把在 CLI 场景中学到的调用方式迁移到 app 内 tools。
- 文档、测试、BFF DTO 可以复用同一套资源语义。
- 不需要维护两套“读取知识库”的抽象。

如果 AI SDK tool name 不支持空格，就用 snake_case；但文档和实现应能追溯到 CLI action。

### 3.1 Navigation tools

Navigation tools 让 Agent 先理解知识库的结构，类似 code agent 先看目录树。

| Tool                 | 类比                       | 输入                                                             | 输出                                                       |
| -------------------- | -------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `snapshot_project`   | 打开项目时先看 overview    | 无。                                                             | domains、recentUnderstandings、stats。                     |
| `domain_list`        | `ls` / file tree           | 无。                                                             | DomainSummary[]：id、name、parentId。                      |
| `understanding_list` | `ls <dir>`                 | `domainId?`、`includeDescendants?`、`recent?`、`limit?`。        | UnderstandingSummary[]。                                   |
| `domain_inspect`     | `ls <dir> + local context` | `id`、`includeContexts?`、`includeEdges?`、`limit?`、`offset?`。 | domain、domains、understandings、contexts?、edges?、page。 |

### 3.2 Search tools

Search tools 让 Agent 从自然语言、关键词或概念进入知识库，类似 `rg`。

| Tool                    | 类比                | 输入                           | 输出                        |
| ----------------------- | ------------------- | ------------------------------ | --------------------------- |
| `search_all`            | `rg`                | `query`、`limit?`、`offset?`。 | understandings + contexts。 |
| `search_understandings` | `rg understandings` | `query`、`limit?`、`offset?`。 | UnderstandingSearchHit[]。  |
| `search_contexts`       | `rg contexts`       | `query`、`limit?`、`offset?`。 | ContextSearchHit[]。        |

### 3.3 Read tools

Read tools 让 Agent 在已经知道对象 ID 后读取内容，类似 `cat` / `sed`。

| Tool                 | 类比                            | 输入                                                                      | 输出                      |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `understanding_get`  | `cat understanding`             | `id`、`includeContexts?`、`includeReferences?`、`includeReferencedBys?`。 | UnderstandingDetail。     |
| `context_list`       | 打开 Understanding Context列表  | `understandingId`。                                                       | ContextDetail[]。         |
| `context_get`        | `cat context`                   | `id`。                                                                    | ContextDetail。           |
| `graph_neighborhood` | 追踪引用 / backlinks            | `understandingId`、`depth?`、`includeContexts?`、`limit?`、`offset?`。    | GraphNeighborhoodResult。 |
| `graph_path`         | 查两个 Understanding 之间的路径 | `from`、`to`。                                                            | GraphPathResult。         |

`understanding_get` 是 P0 最重要的 read tool。Agent 已经知道要读什么时，低成本读出来。

当前 CLI 用 `include-*` 控制输出体积：

```txt
--include-contexts
--include-references
--include-referenced-bys
```

Electron tools 可以沿用同样的布尔开关，不要先设计更复杂的 `fields[]`，除非实际 token 成本证明需要。

### 3.4 Proposal tools

| Tool                            | 用途                                              | 输出                                                                     |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `understanding_create_proposal` | 把对话中形成的候选理解整理成 Understanding。      | 候选 Understanding：title、body、context refs、suggested domain。        |
| `understanding_update_proposal` | 对已有 Understanding 提出修改。                   | diff proposal：target understanding、before、after、reason。             |
| `context_create_proposal`       | 把本轮对话片段作为 Context 绑定到 Understanding。 | 候选 Context：target understanding、summary、quoted conversation range。 |
| `connection_create_proposal`    | 对两条 Understanding 提出候选 Connection。        | 候选 Connection：from、to、reason。                                      |

Proposal tools 不写入知识库。它们只生成前台可确认的结构化 proposal。

确认后再调用现有 domain mutation。这个阶段不要把 CLI 的 `--yes` 心智暴露给用户；前台 confirmation card 就是 app 内的 `--yes`。

### 3.5 不进入 tools 的能力

以下能力放在 system prompt / model reasoning 里，不做 tool：

- 概念深化。
- 多 Understanding 比较。
- 找共同机制。
- 找张力 / 矛盾。
- 生成追问。
- 生成案例 / 反例。

这些不是外部能力调用，而是 LLM 的核心推理工作。把它们做成 tool 只会增加一层假抽象。

## 4. Tool 调用示例

以下只是示例，不是规定路径。Agent 可以按任务自行组合 primitive tools。

### 4.1 搜索“拖延”相关内容

用户输入：

```txt
我之前是不是写过关于拖延的东西？
```

可能的调用方式 A：先看结构，再局部搜索。

```txt
1. snapshot_project()
2. Agent 发现可能相关的目录：行为机制、学习复盘、交易心理。
3. understanding_list(domainId: 行为机制, includeDescendants: true, limit: 30)
4. understanding_list(domainId: 学习复盘, includeDescendants: true, limit: 30)
5. 如果列表里没有明显命中：
   search_all(query: "拖延", limit: 10)
6. understanding_get(id: selectedUnderstandingId)
```

可能的调用方式 B：先全局搜索，再看目录确认范围。

```txt
1. search_all(query: "拖延", limit: 10)
2. domain_list()
3. Agent 发现结果主要集中在学习复盘和交易心理。
4. understanding_list(domainId: 学习复盘, includeDescendants: true, limit: 20)
5. understanding_get(id: selectedUnderstandingId)
```

### 4.2 深化一个明确 `@` 的 Understanding

用户输入：

```txt
帮我把 @反馈延迟 这个概念聊深一点。
```

可能的调用方式：

```txt
1. understanding_get(id: @反馈延迟)
2. 如果正文提到Context或用户问“为什么形成”：
   context_list(understandingId: @反馈延迟)
3. 如果用户问“和哪些Understanding有关”：
   understanding_get(id: @反馈延迟, includeReferences: true, includeReferencedBys: true)
4. 如果需要补充用户知识库内的相近概念：
   search_understandings(query: "反馈 行动 拖延 判断", limit: 8)
```

### 4.3 探讨几条 Understanding 的隐含关联

用户输入：

```txt
我感觉 @逃避复盘 @不愿止损 @拖延沟通 有点像，帮我一起分析一下。
```

可能的调用方式：

```txt
1. understanding_get(id: @逃避复盘)
2. understanding_get(id: @不愿止损)
3. understanding_get(id: @拖延沟通)
4. graph_neighborhood(understandingId: @逃避复盘, depth: 1, limit: 20)
5. 如果正文太薄：
   context_list(understandingId: @逃避复盘)
6. 如果发现候选关键词“承认错误 / 自我评价”：
   search_understandings(query: "承认错误 自我评价 回避", limit: 5)
```

### 4.4 沉淀候选内容

用户输入：

```txt
把刚刚聊出来的东西整理成一条候选 Understanding。
```

可能的调用方式：

```txt
1. 基于当前 thread 先生成候选表达。
2. 如果候选需要挂到已有对象：
   understanding_get(id: referencedUnderstandingId)
3. 如果需要避免重复：
   search_understandings(query: candidateTitle, limit: 5)
4. 如果没有明显重复：
   understanding_create_proposal(...)
5. 如果像是在修改已有 Understanding：
   understanding_update_proposal(...)
```

### 4.5 修改已有 Understanding

用户输入：

```txt
把 @反馈延迟 这条改得更精确一点，强调“反馈不可解释”不是“反馈慢”。
```

可能的调用方式：

```txt
1. understanding_get(id: @反馈延迟)
2. 如果需要确认Context：
   context_list(understandingId: @反馈延迟)
3. 生成修改版本。
4. understanding_update_proposal(target: @反馈延迟, before: ..., after: ..., reason: ...)
```

## 5. 外部信息

Concept Deepening 需要历史脉络、人物、理论、跨领域案例。

P0 可以先不做外部搜索 tool，让模型基于已有知识回答，并在回答中保留不确定性。

后续如果要支持外部Context，再考虑：

| Tool                      | 用途                                                 | 前台展示                                               |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `search_external_sources` | 用户明确要求查外部材料、历史、人物、理论背景时调用。 | External result cards，展示标题、Context、摘要、链接。 |

外部搜索会引入材料可信度、联网开关、隐私边界和引用格式，先不要为了“看起来完整”提前上。

## 6. 前台 UI 组件

### ReferenceChip

显示用户 `@` 的真实对象。

```txt
@逃避复盘  @不愿止损  @拖延沟通
```

职责：

- 表明用户给了 Agent 哪些上下文。
- 点击后预览对象。
- 让用户知道 AI 不是凭空讨论。

### ToolActivity

显示 Agent 读取或搜索了什么。

默认折叠，避免污染聊天流。

```txt
AI 读取了 3 条 Understanding、2 条 Context
AI 搜索了 8 条内容
AI 读取了关联Understanding
```

展开后展示对象列表和简短摘要。

### CitationLink

AI 回复中引用具体 Reflecta 对象时使用。

职责：

- 让用户能追溯回答基于哪条 Understanding / Context。
- 点击后打开预览，不打断对话。

### CandidateUnderstandingCard

当 AI 提出候选 Understanding 时出现。

内容：

- 标题。
- 正文。
- 关联的 Context。
- 可选 Domain。
- 保存 / 拒绝。

要求：

- 用户可编辑。
- 保存前不进入知识库。

### CandidateConnectionCard

当 AI 提出候选 Connection 时出现。

内容：

- From Understanding。
- To Understanding。
- 关系说明。
- 确认 / 拒绝。

要求：

- 文案必须是“候选关联”，不是“已发现关联”。
- 用户确认后才创建 Connection。

### CandidateContextCard

当 AI 建议把本轮对话片段作为 Context 时出现。

内容：

- Context 摘要。
- 原始对话片段。
- 绑定目标 Understanding。
- 保存 / 拒绝。

### UpdateUnderstandingDiffCard

当 AI 建议修改已有 Understanding 时出现。

内容：

- 原内容。
- 新内容。
- 差异高亮。
- 确认 / 拒绝。

要求：

- 不允许静默覆盖。
- 修改必须可读、可拒绝。

## 7. 右侧 Panel

V2 先不做固定右侧 Inspector。

原因：

- 当前核心体验还没验证，不需要先增加三栏布局。
- 用户心智应该集中在 chat + `@` 引用 + candidate 卡片。
- 对象预览和待确认内容可以先在聊天流里解决。
- 窄屏 / 收起状态 / panel focus 管理都会增加实现成本。

V2 的前台先保持：

```txt
左侧：Thread list
中间：Chat stream
```

Chat stream 内承载：

- `ReferenceChip`
- `ToolActivity`
- `CandidateUnderstandingCard`
- `CandidateConnectionCard`
- `CandidateContextCard`
- `UpdateUnderstandingDiffCard`

后续如果引用对象、tool activity、pending proposal 多到聊天流承载不住，再补 Inspector。

### Later: Inspector

如果后续要做右侧 Panel，它应该是 Inspector：

> 用户点哪里，它就展示哪里的详情。

它的职责是辅助查看和确认，而不是给用户增加新的产品概念。

### 可承载内容

1. 当前引用
   - 本轮用户 `@` 了哪些 Understanding / Context / Domain。

2. 对象预览
   - 用户点击 `ReferenceChip` / `CitationLink` 后，展示对象详情。

3. 待确认候选
   - 当前 thread 里的 pending Understanding / Context / Connection proposal。

### 不应该承载

- 不展示“当前模式：概念深化 / 关系探讨”。
- 不展示复杂 workflow 步骤。
- 不把 AI 输出整理成第二套知识库。
- 不替代中间聊天流。

## 8. 两种前台形态

### V2: 无固定右侧 Panel

形态：

- 左侧 thread list。
- 中间 chat。
- `ReferenceChip` 点击后用 popover / drawer 预览。
- 候选 Understanding / Connection / Context 直接在聊天流里展示。

优点：

- 用户心智最接近普通 chat。
- 不引入额外布局复杂度。
- 最小。

缺点：

- 引用和候选变多时，聊天流会变重。
- 用户回看 pending proposal 不够集中。

### Later: 右侧 Inspector

形态：

- 左侧 thread list。
- 中间 chat。
- 右侧 Inspector。

Inspector 展示：

- 当前引用。
- 当前选中对象预览。
- 待确认候选。

优点：

- 用户不容易迷路。
- 对象预览不打断聊天。
- pending proposal 有集中位置。

缺点：

- 页面复杂度更高。
- 需要处理窄屏 / 收起状态。

## 9. V2 前台形态

V2 采用：

> 聊天流 + `@` 引用 + ToolActivity + Candidate 卡片。

不做固定右侧 Inspector。

## 10. 已定决策

### 10.1 V2 Tool Subset

V2 先开放现有 CLI 同构的核心只读 tools：

- `snapshot_project`
- `domain_list`
- `understanding_list`
- `understanding_get`
- `context_list`
- `search_all`
- `graph_neighborhood`

以下 tools 作为 V2 可选补充，若实现成本低可以一起做：

- `domain_inspect`
- `context_get`
- `search_understandings`
- `search_contexts`
- `graph_path`

### 10.2 `@` 引用语义

用户 `@` Understanding / Context / Domain 后，消息里只携带轻量 ref：

- object type
- object id
- display title / name

不自动把全文塞进消息。Agent 根据任务自行决定是否调用 `understanding_get`、`context_list`、`domain_inspect` 等 tools。

### 10.3 只读 Tool 调用权限

只读 tools 允许 Agent 主动调用，不需要用户逐次授权。

前台用折叠的 `ToolActivity` 告诉用户 Agent 做了什么，例如：

```txt
AI 读取了 3 条 Understanding
AI 搜索了 8 条内容
AI 查看了 1 个关联图谱
```

写入类动作不允许主动落库，只能生成 Candidate 卡片，用户确认后才写入。

### 10.4 Candidate 范围

V2 Candidate 组件全部进入范围：

- `CandidateUnderstandingCard`
- `CandidateConnectionCard`
- `CandidateContextCard`
- `UpdateUnderstandingDiffCard`

它们都表示 pending change preview，不是已写入内容。

### 10.5 Pending Proposal 持久化

Candidate 卡片需要随 thread/message 持久化。刷新页面后，pending proposal 仍然可见，状态仍然可恢复。

状态至少包括：

- pending
- approved
- rejected
- failed

### 10.6 外部搜索

V2 不做外部搜索。

Agent 可以基于模型已有知识提供历史脉络、人物、理论和跨领域案例，但需要保持不确定性。外部搜索涉及材料可信度、隐私、联网开关和引用格式，留到后续版本。

### 10.7 右侧 Inspector

V2 不做固定右侧 Inspector。

前台采用：

> 聊天流 + `@` 引用 + ToolActivity + Candidate 卡片。

后续只有当引用对象、tool activity、pending proposal 多到聊天流承载不住时，再补 Inspector。
