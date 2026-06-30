# v1.1.12 Agent Entity Reference 调研

> 日期：2026-06-26
>
> 状态：Research；最终架构见 [Agent Entity Link 架构](agent-entity-link-architecture.md)
>
> 目标：调研和 Reflecta 最相近的产品场景，理解它们如何处理 AI 回答里的 source / entity / knowledge unit reference，并提炼对 Reflecta 的架构启发。

> **已被 v1.1.15 取代：** 本调研中的 session-scoped `[[ref:Sx]]` 结论只适用于历史 renderer entity link 方案。新的 Agent 工具身份协议使用 Reflecta 稳定实体 id；聊天 ref 只负责展示和导航。

## 1. 结论先行

Reflecta 当前要解决的问题不是传统 RAG 里的“这句话证据来自哪段文本”，而是：

```txt
Agent 正文里出现的蓝色引用，必须稳定打开 Reflecta 里真实存在的 Understanding / Context / Domain。
```

调研后可以把外部实践分成两类。

### 1.1 Evidence citation

代表产品和框架：

- NotebookLM
- Notion Enterprise Search
- Slite Ask
- Guru Knowledge Agents
- OpenAI File Search
- Anthropic Citations
- LlamaIndex CitationQueryEngine

它们解决的是：

```txt
AI 回答里的 claim 由哪些 source / document / chunk 支撑？
```

常见做法是系统维护 source set / retrieved chunks / document indices，然后 AI 回答带 citation，用户点击 citation 回到原文或来源。

这类方案对 Reflecta 有价值，但不能直接等同于 Reflecta 的需求。Reflecta 的引用对象不是外部文档片段，而是用户知识网中的实体。

### 1.2 Entity link / knowledge unit reference

代表产品：

- Tana Outliner
- Roam Research
- Logseq
- Obsidian

它们解决的是：

```txt
一个知识单元如何在多个上下文中被引用，并稳定回到同一个原始对象？
```

常见做法是每个 node / block / page 有稳定身份，页面显示名可以变，引用关系指向真实身份。用户或系统选择目标对象后，引用只是这个对象身份的一个可视化入口。

这类方案和 Reflecta 更接近。

### 1.3 对 Reflecta 的直接判断

Reflecta 应该采用：

```txt
session-scoped entity link registry
```

而不是：

```txt
turn-scoped evidence source map
```

原因：

- Reflecta 的产品价值是“可追溯的个人理解”，不是“临时回答证据审计”。
- Agent 在前两轮读过某个真实 Context，本轮继续引用它是合理的。
- 但 Agent 不能自由拼 `type:id`，否则会继续出现 Context id 被当成 Understanding 打开的错误。
- Registry 应只维护“这个会话中 Agent 已确认过哪些 Reflecta entity”，不维护大段内容。

一句话：

```txt
Evidence citation 解决可信度；Entity link 解决可回到知识网。Reflecta 这次优先解决后者。
```

## 2. Reflecta 的相似性判断

Reflecta 的核心价值来自 `docs/references/product/value-proposition.md`：

```txt
把学习、实践和对话，沉淀成可追溯的个人理解。
```

这里的“可追溯”不是泛泛地给答案加来源，而是让用户未来能回到：

- 这条 Understanding。
- 这条 Understanding 周围的 Context。
- 这些理解之间的显式 Connection。
- 它们所在的 Domain。

所以 Reflecta 的 reference 语义更像 Tana / Roam / Logseq 的知识单元引用，而不是 NotebookLM 的原文 citation。

但是 Reflecta 又有一个额外难点：

```txt
引用不是用户手写的，而是 Agent 生成的。
```

这意味着不能直接照搬 Obsidian 的 `[[page]]` 或 Logseq 的 `((block-id))`。AI 不能被信任为 id 的事实源。真实 link target 必须来自系统已经确认过的 entity。

## 3. 产品案例

### 3.1 Tana Outliner：知识图谱里的 node reference

资料：

- [Nodes and references - Tana Outliner](https://outliner.tana.inc/learn/features/nodes-and-references)
- [Tana AI](https://outliner.tana.inc/learn/features/tana-ai)
- [Knowledge graph in Tana Outliner](https://outliner.tana.inc/knowledge-graph)
- [Search nodes - Tana Outliner](https://outliner.tana.inc/learn/features/search-nodes)

Tana 是最接近 Reflecta 的参考对象之一。它不是把内容当成一堆文档，而是把每个 bullet / node 当成知识图谱里的对象。

公开文档里几个关键信息：

- 每个 node 是核心 building block。
- 同一个 node 可以作为 reference 出现在多个地方。
- node 有唯一 ID。
- reference 是原始 node 的镜像副本，编辑 reference 等同于编辑原始 node。
- search node 的结果以 references 的形式出现，编辑搜索结果会编辑原始 node。
- Tana AI 可以把 notes 作为上下文，也可以通过 `@ mention search` 把 notes 拉入 AI chat。

这说明 Tana 的 reference 不是一段文本引用，而是对象引用：

```txt
显示在当前位置的内容
  -> 指向同一个 node identity
  -> 原始对象更新后，所有 references 同步
```

对 Reflecta 的启发：

- Understanding / Context 应该是 entity，不是 markdown link 字符串。
- Agent 输出的蓝色引用应该解析到 entity identity。
- title 只是展示字段，不能作为引用身份。
- 如果 title 改了，旧消息里的 link 仍应打开同一个 entity，并可显示最新 title 或历史 title。
- “可引用对象”可以来自搜索结果、当前页面、用户 `@`、AI chat context，而不必只来自当前 turn。

和 Reflecta 的差异：

- Tana 的用户通常在编辑器里主动创建 / 拉取 reference。
- Reflecta 的 Agent 会自动生成自然语言回答，因此需要额外防止模型拼错 id。

### 3.2 Roam / Logseq / Obsidian：page / block reference

资料：

- [Internal links - Obsidian Help](https://obsidian.md/help/links)
- [The basics of Logseq block references](https://discuss.logseq.com/t/the-basics-of-logseq-block-references/8458)
- [Logseq block reference feature request discussion](https://discuss.logseq.com/t/create-block-references-in-a-more-markdown-friendly-way-such-as-by-header-or-alias/19429)
- [Roam / Obsidian block reference comparison](https://www.zsolt.blog/2021/05/Addicted-to-block-references.html)

这类工具有一个共同模型：

```txt
page / block 是可寻址知识单元
reference 是指向该知识单元的入口
```

Obsidian 支持：

- `[[note]]` 链接到 note。
- `[[note#heading]]` 链接到 heading。
- `[[note#^block-id]]` 链接到 block。
- `[[note|alias]]` 改变显示文字。

Logseq / Roam 更强调 block reference：

- 页面可以被 `[[page]]` 引用。
- block 可以通过 `((block-id))` 引用。
- 用户通常通过搜索、复制 block ref、拖拽等方式插入引用。
- block reference 的价值是减少复制，让同一段 thought 在多个上下文中复用。

社区讨论里也能看到一个重要问题：用内部 UUID 做 block reference 稳定，但对 Markdown 互操作不友好，脱离应用后难读、难修。

对 Reflecta 的启发：

- 知识单元引用应该指向稳定 identity，而不是靠标题匹配。
- 展示文字和真实目标要分离。
- 应用内部可以使用 `type:id`，但不要暴露给模型自由生成。
- AI 生成引用时，最好让模型使用短 handle，最终由系统 resolve。
- unresolved reference 不能显示成可点击链接。

和 Reflecta 的差异：

- Obsidian / Logseq / Roam 主要是用户直接选择引用目标。
- Reflecta 需要 Agent 在回答中引用对象，因此 registry / resolver 是必要的保护层。

### 3.3 NotebookLM：source-grounded AI chat

资料：

- [Use chat in NotebookLM - Google Help](https://support.google.com/notebooklm/answer/16179559?hl=en)
- [How to get started with NotebookLM - Google Blog](https://blog.google/innovation-and-ai/products/notebooklm-beginner-tips/)
- [NotebookLM launches with new features - Google Blog](https://blog.google/innovation-and-ai/products/notebooklm-new-features-availability/)

NotebookLM 是 AI answer citation 的典型产品。它的 notebook 由用户上传的 sources 组成，Chat 只基于这些 sources 回答。Google Help 文档说明，NotebookLM 使用来自 sources 的直接引文、文本和图像作为 citations，用户 hover citation 可看到原文，点击 citation 会跳到引用位置。

它的关键机制是：

```txt
notebook sources
  -> AI answer
  -> citations
  -> click back to original source location
```

用户还可以勾选 source，控制哪些 source 进入回答范围。

对 Reflecta 的启发：

- 可引用范围应该由系统控制，而不是模型凭空决定。
- 引用点击目标必须由系统保存的位置 / source metadata 决定。
- citation 不是仅靠 markdown 文本成立，而是 UI 能 resolve 到真实 source location。
- 如果一个 source 没有足够细粒度，系统可能只能引用整个文档。

和 Reflecta 的差异：

- NotebookLM 的 citation 目标是 source passage。
- Reflecta 的主要目标是 Understanding / Context entity。
- NotebookLM 更偏“材料问答”，Reflecta 更偏“个人理解网络”。

所以 NotebookLM 不能证明 Reflecta 应该只做 turn-level source map。它证明的是：AI 不应该自己发明引用目标，引用必须来自系统已知 source set。

### 3.4 Notion Enterprise Search：workspace answer with sources

资料：

- [Enterprise Search - Notion Help Center](https://www.notion.com/help/enterprise-search)
- [Notion Enterprise Search product page](https://www.notion.com/product/enterprise-search)

Notion Enterprise Search 会搜索 workspace 和连接的 apps，例如 Slack、Google Drive、Jira。官方帮助文档说明：当 Enterprise Search 使用 workspace 或 connected app 信息回答问题时，会 cite sources，让用户回到 source。

它还支持：

- `Add context` 指定页面或人。
- 在 query 里 `@ mention` 页面、teamspace、people。
- 调整搜索范围，例如只搜索 workspace、某个 app、某个 page / teamspace。

对 Reflecta 的启发：

- 用户 `@` 的对象是强 context signal，应该直接注册为可引用 entity。
- 当前搜索 scope 和可引用 scope 是产品行为，不应该让模型自己猜。
- source link 属于 workspace object / connected app object，而不是裸文本。

和 Reflecta 的差异：

- Notion 的核心是 workspace search 和 enterprise source citation。
- Reflecta 的核心是用户个人理解和上下文的可回看。

### 3.5 Slite / Guru：企业知识库的 source governance

资料：

- [Slite AI knowledge base](https://slite.com/solutions/knowledge-base)
- [Guru source setup](https://help.getguru.com/docs/connecting-sources-to-guru-for-ai-answers)
- [Guru product page](https://www.getguru.com/)

Slite 的 AI Ask 强调答案来自知识库内容，并为每个答案 cite sources；如果不知道就说不知道。它还把 verified docs 排在更高位置。

Guru 的公开文档更强调 source governance：

- 连接 Slack、Google Drive 等 sources。
- 可以 selective sync。
- source 有 owner 和 permissions。
- 部分 source 可以继承原系统权限。
- Guru 会定期同步 source 变化。

对 Reflecta 的启发：

- “可引用对象”不是 UI 临时列表，而是系统掌握的真实数据对象。
- 权限 / 同步 / 删除状态会影响是否可点击。
- 连接外部 source 时，source identity 和 access control 必须由后端维护。

和 Reflecta 的差异：

- Slite / Guru 面向团队知识库和企业信任。
- Reflecta 是个人理解工具，不需要第一版引入复杂权限模型。

但它们的共同点仍然成立：

```txt
AI answer 里的 link target 来自系统 source layer，不来自模型自由文本。
```

## 4. 工程框架案例

### 4.1 OpenAI File Search：annotations 和 search results 分离

资料：

- [OpenAI File Search](https://developers.openai.com/api/docs/guides/tools-file-search)

OpenAI File Search 的 hosted tool 会从 vector store 检索文件，并在输出文本里提供 annotations。文档还说明，默认可以看到 output text 里的 file references，但如果需要 search results，需要通过 `include=["file_search_call.results"]` 显式拿回。

这体现一个重要分离：

```txt
用户看到的 citation annotation
  !=
检索工具返回的完整 search results
```

对 Reflecta 的启发：

- UI 显示 link 不代表 prompt 里必须塞完整内容。
- Registry 可以只保存 entity identity / title / type。
- 如果 Agent 需要复述内容，再调用 get 工具读取内容。

### 4.2 Anthropic Citations：结构化 citation metadata

资料：

- [Claude Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Claude Search Results](https://platform.claude.com/docs/en/build-with-claude/search-results)

Anthropic Citations 把 citation 作为结构化 metadata 返回。官方文档说明，response 可以包含多个 text block，每个 text block 可以有支持该 claim 的 citations。citation 指向 source document 的具体位置，例如 PDF page range、plain text character range、custom content block index range。

对 Reflecta 的启发：

- citation / reference 不应该只靠模型吐 markdown。
- 系统应有可验证的结构化数据来支持 UI 渲染。
- 对 Reflecta 来说，这个结构化数据不是 page range，而是 `{ type, id }`。

### 4.3 LlamaIndex CitationQueryEngine：retrieved nodes 变 numbered sources

资料：

- [LlamaIndex CitationQueryEngine](https://developers.llamaindex.ai/python/examples/query_engine/citation_query_engine/)

LlamaIndex 的 CitationQueryEngine 用 retriever 取 source nodes，再要求回答使用 source number 做 inline citations。这个模式在 RAG 社区很常见：

```txt
retrieved nodes
  -> numbered sources
  -> answer cites [1] [2]
```

对 Reflecta 的启发：

- 短编号是可行的，因为它降低了模型复制长 id 的错误概率。
- 编号应该由系统生成。
- 但 LlamaIndex 的编号通常是单次 query 内的 source chunk 编号，不适合直接当 Reflecta 的长期 entity link。

因此 Reflecta 可以借鉴“短 handle”形式，但 scope 应该是 agent session，而不是单次 retrieval。

## 5. 外部实践的共同模式

### 5.1 引用目标由系统掌握

无论是 NotebookLM、Notion、Slite、Guru，还是 Tana、Logseq、Obsidian，引用目标都不是模型随口生成的字符串。

它们至少有一个系统事实源：

- notebook sources
- workspace pages
- connected app documents
- graph nodes
- blocks
- vector store files
- retrieved source nodes

Reflecta 当前让 Agent 输出 `[[understanding:标题#id]]`，本质是把事实源交给模型，这就是不稳定的根因。

### 5.2 显示文本和真实身份分离

成熟工具都把 display text 和 identity 分开：

- Obsidian 有 alias。
- Tana reference 显示 node 内容，但 identity 是 node ID。
- Notion source link 显示 page / app title，但目标是 workspace object。
- Anthropic citation 显示在 text block 上，但 metadata 里有 document index 和 range。

Reflecta 也应该分离：

```ts
type EntityReference = {
  handle: "U1" | "C3" | "D2";
  type: "understanding" | "context" | "domain";
  id: string;
  title?: string;
};
```

`title` 是展示，不是 resolve 依据。

### 5.3 AI 只能选择已知对象

NotebookLM 通过 sources scope 限制回答。Notion 支持指定 context 和搜索 scope。Tana AI 可以把当前 note / @ mentioned notes 作为 context。

Reflecta 应采用同一原则：

```txt
Agent 可以引用：
  - 用户 @ 的 entity
  - 当前页面 entity
  - 工具结果返回的 entity
  - 本 agent session 前面已经读取 / 注册过的 entity

Agent 不可以引用：
  - 从未进入当前 session registry 的 entity
  - 自己根据标题猜出来的 entity
  - type/id 无法通过 DB resolve 的 entity
```

### 5.4 Entity link 和 content grounding 是两件事

这是本次调研最重要的区分。

一个 Agent “可以链接 C3”，只表示：

```txt
C3 是本 session 已知的真实 Context entity。
```

它不自动表示：

```txt
Agent 当前拥有 C3 的完整正文细节。
```

因此 Reflecta 应该拆开两层：

```txt
Entity link permission:
  registry 里有这个 entity，就可以生成可点击 link。

Content grounding:
  如果回答要复述细节，Agent 需要当前上下文里有内容，或重新调用 get 工具。
```

这能同时满足两个要求：

- 前两轮读过的对象，本轮仍然可以被引用。
- 不把所有历史内容都塞进 prompt。

## 6. 对 Reflecta 的推荐架构

### 6.1 名称

建议命名为：

```txt
Agent Entity Link Registry
```

不要叫 citation registry。`citation` 容易把目标带偏到 evidence / claim verification。

### 6.2 所属位置

Registry 应属于 Agent session runtime，而不是前端临时状态。

在 Electron 架构里：

```txt
Main / AgentHost:
  - 注册 entity
  - 分配 handle
  - 去重
  - 从工具结果抽取 entity
  - 持久化 session event
  - 给 prompt 渲染轻量 handle list

Renderer:
  - 把用户 @ / 当前页面 refs 传给 AgentHost
  - 接收 registry snapshot
  - 渲染 resolved link
  - unresolved handle 显示为普通文本
```

原因：

- 工具调用发生在 AgentHost。
- session replay / app restart 需要恢复 registry。
- 真实 DB resolve 应由系统层保证。
- 前端不能成为 link target 的事实源。

### 6.3 Registry 内容

第一版只存轻量 identity：

```ts
type AgentEntityReference = {
  handle: string; // U1 / C1 / D1
  type: "understanding" | "context" | "domain";
  id: string;
  title?: string;
  source: "user" | "page" | "tool" | "history";
  lastSeenAtTurn: number;
};
```

不存：

- Context 正文。
- Understanding 长内容。
- retrieval chunk。
- claim-level evidence。
- 大段摘要。

这样 registry 对上下文长度的影响可控。

### 6.4 Prompt 暴露策略

Prompt 不应该暴露完整 registry 内容。最终架构采用更小的 source marker 策略：marker 跟着 entity 自然出现的位置走，而不是每轮 dump 全局列表。

```txt
用户显式 @ 了这些知识库对象：
- [[ref:S1]] Understanding: Feedback Loop
- [[ref:S2]] Context: 一次产品复盘

规则：
- 正文里引用 Reflecta 对象时，只能使用上下文或工具结果里出现的 [[ref:Sx]] marker。
- 不要输出真实 DB id。
- 不要输出旧格式 [[type:title#id]]。
```

如果 source map 很大，第一版仍只暴露：

- 当前 turn 新增对象。
- 用户显式 @ 的对象。
- 当前页面对象。
- 工具结果中自然出现的对象。

但这只是 prompt budget 策略，不改变 source map 的 session scope。

换句话说：

```txt
Source map scope = session
Prompt visible scope = current context/tool result markers
```

### 6.5 渲染规则

Renderer 只信 registry snapshot：

```txt
[[C3]]
  -> resolve C3
  -> 找到 { type: "context", id: "..." }
  -> 打开 Context inspector

[[C999]]
  -> resolve 失败
  -> 普通文本，不可点击
```

旧格式兼容：

```txt
[[understanding:标题#id]]
[[context:标题#id]]
```

旧格式必须先修 parser，不能继续把 `context` 当成 `understanding`。但新 Agent prompt 应禁止继续生成旧格式。

### 6.6 持久化

Registry 应作为 session event 持久化：

```ts
type AgentEntityReferencesUpdated = {
  type: "entityReferences.updated";
  refs: AgentEntityReference[];
};
```

这样：

- app 重启后旧消息仍能 resolve。
- 历史 agent session 可回放。
- 前端 reducer 只需要合并 snapshot。

## 7. 不推荐的方案

### 7.1 只做 turn-level source map

不推荐。

它适合 RAG citation，但不适合 Reflecta entity link。因为 Reflecta 的 Agent 可能在前几轮读过某个 Context，本轮继续引用它符合产品语义。

正确拆分是：

```txt
entity link registry: session-scoped
evidence source map: turn-scoped, 以后需要时再做
```

### 7.2 前端维护 registry

不推荐。

前端只能维护 snapshot，不能做 source of truth。否则工具结果、session replay、历史消息、重开 app 后恢复都会变复杂。

### 7.3 继续让模型输出真实 id

不推荐。

这正是当前 bug 的来源。模型可能：

- 拼错 id。
- 混淆 type。
- 引用上下文里出现过但不是 Reflecta entity 的 id。
- 输出看似合法但无法 resolve 的链接。

### 7.4 把所有历史内容塞进 prompt

不推荐。

Entity link 不需要完整内容。只需要 identity。

需要细节时再读取对象内容，这是更干净的分层。

## 8. 最小可落地版本

第一版不需要做大系统。

最小闭环：

1. 修旧 wiki link parser，确保 `context` 不再被当成 `understanding`。
2. 在 AgentHost 里维护 session-scoped entity registry。
3. 用户 `@` 的 entity 和当前页面 entity 进入 registry。
4. 工具结果里出现的 Understanding / Context / Domain 进入 registry。
5. Prompt 和工具结果在 entity 出现的位置暴露 `[[ref:Sx]]` marker。
6. Agent 正文只输出 `[[ref:Sx]]`。
7. Renderer 用 session source map resolve marker。
8. resolve 失败则不渲染为 clickable link。

不做：

- claim-level citations。
- citation score。
- 自动证明每句话。
- 复杂权限系统。
- 全局永久 handle。
- 用户手动维护 option list。

## 9. 需要继续确认的问题

### 9.1 handle 是 session-scoped 还是 thread-scoped？

如果 Reflecta 的 Agent thread 是长期存在、可继续对话的对象，建议 handle 跟 thread/session 绑定。

不要做 global handle。全局 `U1` 没意义，也会制造跨 thread 冲突。

### 9.2 旧消息显示 title 用历史 title 还是最新 title？

两个选择：

- 历史 title：消息回放稳定。
- 最新 title：用户能看到对象当前名称。

推荐第一版用 registry snapshot 里的 title。后续如果需要，可在 hover / inspector 里显示最新 title。

### 9.3 删除对象后怎么处理？

推荐：

```txt
DB resolve 失败 -> link disabled -> 显示原文本
```

不要自动跳转到空白页。

### 9.4 Domain 是否第一版可点击？

可以暂时不可点击。因为当前 bug 主要发生在 Understanding / Context。Domain handle 可以先显示，但 inspector 能力后置。

## 10. 最终判断

社区和类似产品不是让模型自由输出真实 id。

更稳定的共同方向是：

```txt
系统掌握真实对象
系统给模型一个可选引用集合
模型只选择集合里的短引用
渲染端只渲染可 resolve 的引用
```

对 Reflecta 来说，最干净的版本不是 evidence citation 系统，而是：

```txt
Agent session 里的 Entity Link Registry。
```

它符合 Reflecta 的产品语义：

- 个人理解是实体。
- Context 是理解周围的具体上下文。
- Agent 可以帮助用户回到这些实体。
- 但 Agent 不能成为 entity identity 的事实源。

它也避免过度设计：

- 不做 claim-level citation。
- 不做复杂 source provenance。
- 不把所有历史内容塞进 prompt。
- 不让前端猜 link target。

第一版只把“蓝色引用稳定打开正确对象”做好。
