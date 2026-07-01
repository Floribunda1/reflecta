# Agent Inline References: Numbered Citation Architecture

> 状态：Proposed
>
> 日期：2026-07-02
>
> 结论：主路径改成社区常见的 `[1]` / `[2]` numbered citation。Agent 继续 stream 普通文本；host 负责维护每条 assistant answer 的 citation source map；renderer 只把当前 answer 里能映射到 source map 的 `[n]` 渲染成可点击 Reflecta entity。Structured final output 不再是回答成功的门槛。

## 1. 这个模块到底在解决什么

用户要的不是“让模型写一个看起来像链接的东西”。

用户要的是：Agent 在自然语言回答里提到某个 Reflecta 知识对象时，用户能点击那处引用，打开真实的 Understanding、Context 或 Domain。

这里有两个世界：

```text
语言世界：模型写自然语言，里面可能出现 "[1]"
身份世界：Reflecta 里的对象有真实 id，例如 understanding:u_123
```

inline reference 模块的职责就是把这两个世界接起来：

```text
模型只能写显示标记
系统拥有真实身份映射
renderer 只根据系统映射渲染链接
```

这个模块不负责判断一段话是否真实，也不负责自动找标题，也不负责替 Agent 重写答案。它只负责回答文本里的 citation marker 和真实 entity 之间的绑定。

## 2. 最重要的心智模型

`[1]` 不是 id。

`[1]` 不是 handle。

`[1]` 不是可以给工具调用用的参数。

`[1]` 只是当前这条 assistant answer 里的脚注标记。它的意义完全来自同一条 assistant answer 保存的 `citationSources`。

```text
assistant.turn
  text:
    "这个问题更像是架构心智没有收束 [1]，不是单个 prompt 写坏了。"

  citationSources:
    [1] -> Understanding: "架构心智没有收束时，代码会反复补洞"
           id = u_architecture_mindset
```

如果只看到文本里的 `[1]`，它没有任何稳定含义。只有把它和当前 turn 的 `citationSources` 放在一起，它才变成一个可点击引用。

这就是整个架构的核心：引用身份不在正文里，正文里只有引用位置。

## 3. 三种表示不能混用

这个模块稳定与否，取决于大家是否一直区分三种东西。

### Entity Identity

真实身份是 Reflecta 数据层的对象身份：

```text
understanding:u_123
context:ctx_456
domain:d_789
```

真实 id 用在：

- tool 参数
- database record
- entity catalog
- renderer 点击后的 inspect/open 动作

真实 id 不应该暴露成用户需要读懂的 citation marker。

### Citation Marker

citation marker 是回答正文里的显示标记：

```text
[1]
[2]
[3]
```

它只用在：

- assistant answer text
- markdown rendering
- 用户视觉定位

它不应该进入 tool 参数，不应该跨 turn 复用，也不应该被当成 entity identity。

### Rendered Link

rendered link 是 UI 层把 marker 和 source map 合成之后的结果：

```text
"[1]" -> clickable chip/link -> open understanding:u_123
```

renderer 不能发明 source。它只能消费已经保存到当前 assistant turn 上的 `citationSources`。

## 4. 模块 Interface

把这个模块当成一个深 module，它对外只应该暴露很小的 interface。

### 输入

```ts
type CitationSourceInput = {
  entityCatalog: AgentEntityCatalogEntry[];
  visibleEntityKeys: string[];
};
```

`entityCatalog` 是本轮已知的真实实体集合。`visibleEntityKeys` 表示本轮 prompt 确实给模型看过、允许模型 cite 的实体。

这里的重点不是字段名，而是约束：只有模型实际见过的 source 才能获得 `[n]`。

### 输出

```ts
type AgentCitationSource = {
  index: number;
  entity: {
    type: "understanding" | "context" | "domain";
    id: string;
    title?: string;
  };
  origin: AgentEntityCatalogEntry["origin"];
};
```

这个输出就是本条 answer 的 source map。

### 持久化形态

```ts
type AssistantAnswer = {
  text: string;
  citationSources: AgentCitationSource[];
};
```

这就是主路径需要保存的全部东西：普通文本 + 当前 answer 的 source map。

不需要 `ReferenceRegistry`。不需要第二个 answer object。也不需要让模型输出 JSON parts。

## 5. 模块内部有四个职责

这四个职责可以分文件实现，但文档不按文件解释，因为接手的人更需要知道职责怎么分。

### 5.1 Source Map Builder

它从本轮可引用 entities 生成稳定的 `citationSources`。

它负责：

- 给可引用 entity 分配 `[1]` / `[2]`。
- 保证同一个 assistant answer 内编号稳定。
- 保证编号只指向具体 entity，不指向 collection、tool call 或一坨结果。
- 生成给 prompt 用的 source list。

它不负责：

- 让模型一定引用。
- 扫描正文标题。
- 猜 `[999]` 想表达什么。

### 5.2 Prompt Adapter

它把 source map 用最简单的文本形式给模型看：

```text
You may cite these Reflecta sources:

[1] Understanding: 架构心智没有收束时，代码会反复补洞
    id: u_architecture_mindset

[2] Domain: AI Agent
    id: d_ai_agent

Rules:
- Use [1], [2] in the final answer only when citing these sources.
- Tool calls must use real ids, never citation numbers.
- Do not invent citation numbers.
```

Prompt adapter 的核心不是“prompt 写得多严格”，而是把模型可写的 token 限制在 host 已经分配好的编号集合里。

### 5.3 Answer Stream Binder

主 Agent 的普通 `text_delta` 就是最终回答流。binder 不等 JSON，不等 finalizer。

它负责：

- 收集正在 stream 的 answer text。
- 把同一条 answer 的 `citationSources` 一起发给前端。
- 最终保存 `text + citationSources`。

它不负责：

- validate 每一句话是否真的由 source 支撑。
- 因为没写 citation 就 fail 整个回答。
- 把普通文本改写成 structured parts。

### 5.4 Renderer

renderer 消费 `text + citationSources`。

它负责：

- 在 markdown 普通正文里识别完整 `[number]`。
- 如果 number 存在于当前 answer 的 `citationSources`，渲染成可点击引用。
- 如果 marker 不完整、在 code block 里、或没有 source，保持普通文本。

它不负责：

- title matching。
- 自动链接所有出现的实体标题。
- 根据旧 turn 的 `[1]` 推断当前 `[1]` 是谁。

## 6. 端到端 Pipeline

```text
User input
  -> selected @ refs enter AgentEntityCatalog
  -> read-only tools add more real entities to AgentEntityCatalog
  -> host builds citationSources for entities visible to this answer
  -> prompt shows numbered source list to Agent
  -> Agent streams plain markdown answer with optional [n] markers
  -> frontend renders text immediately
  -> renderer turns valid [n] into links using current answer citationSources
  -> host persists assistant.turn text + citationSources
```

这个 pipeline 里，只有一个地方拥有真实绑定：host 生成并保存的 `citationSources`。

模型没有绑定权。renderer 也没有绑定权。模型只是选择在自然语言的哪个位置放 `[1]`。

## 7. Streaming 心智

这个方案天然支持 streaming，因为 answer 仍然是普通文本。

source map 和 text stream 是两条可以独立到达前端的数据：

```text
source map:
  [1] -> u_123
  [2] -> d_456

text stream:
  "这里的问题是 "
  "系统把 "
  "["
  "1"
  "]"
  " 当成了 id。"
```

UI 不需要等完整回答。

当文本还只有 `[` 或 `[1` 时，先按普通文本显示。等 marker 闭合成 `[1]`，renderer 如果能在 source map 找到 `1`，就把这一段升级成可点击引用。

这种升级是 UI 层增强，不改变 answer text。持久化的还是原始文本和 source map。

## 8. Persistence 心智

历史可点击的前提是：每条 assistant answer 自己保存自己的 source map。

不能只保存：

```text
"这件事和架构心智有关 [1]"
```

必须保存：

```text
text:
  "这件事和架构心智有关 [1]"

citationSources:
  [1] -> understanding:u_architecture_mindset
```

这样三个月后打开历史记录，`[1]` 仍然能点到原来的 entity。

但这不意味着 `[1]` 可以跨轮进入模型上下文。给模型恢复历史时，应该把显示 marker 和真实 entity 分开。

推荐恢复形态：

```text
Previous assistant answer:
"这件事和架构心智有关。"

It cited these Reflecta entities:
- Understanding: 架构心智没有收束时，代码会反复补洞; id=u_architecture_mindset
```

不要这样恢复：

```text
Previous answer used [1] = u_architecture_mindset
```

后者会把 `[1]` 重新训练成跨轮 handle。

## 9. Tool 参数防污染

工具参数永远使用真实 id。

```json
{ "understandingId": "u_architecture_mindset" }
```

工具参数里出现这些值都应该被拒绝：

```text
[1]
1
U1
D1
ref:abc
```

这不是用户体验问题，是架构不变量。只要 display token 能进入 tool 参数，后续就会重新出现“模型把引用显示符号当身份”的老坑。

## 10. Source 编号规则

编号由 host 生成，不由模型生成。

推荐规则：

1. 用户显式 `@` 的 entities 先出现，按用户输入顺序。
2. 工具结果里新出现的 entities 后出现，按首次进入 catalog 的顺序。
3. 历史 catalog 里的 entities 不自动参与本轮编号，除非本轮 prompt 真的把它们暴露给模型。

编号的 scope 是一条 assistant answer，不是一个 session。

同一个 session 里可以出现：

```text
turn A:
  [1] -> understanding:u_a

turn B:
  [1] -> domain:d_b
```

这没有问题，因为 `[1]` 的意义来自各自 turn 的 `citationSources`。

## 11. 错误处理

这个模块要避免两类错误：

1. 错链：把 citation 渲染到错误 entity。
2. 炸回答：因为 citation 不完整导致整条回答失败。

所以规则是：

- `[1]` 能映射到当前 turn source：渲染成链接。
- `[999]` 找不到 source：保持普通文本。
- `[abc]` 不是 numbered citation：保持普通文本。
- code block / inline code 里的 `[1]`：保持普通文本。
- source map 为空：整条回答就是普通 markdown。
- tool 参数里出现 citation marker：拒绝工具调用。

invalid citation 不应该变成 link，也不应该让已经 stream 出来的回答失败。

## 12. 为什么不是 structured final output

Structured final output 把“生成最终答案”和“绑定引用”揉在一起了。

它要求模型最后再输出一份 machine-readable answer object。实际运行时，这会变成一个新的成功门槛：

```text
主 Agent 已经 stream 了正文
但没输出 final parts
host 判定失败
用户看到“缺少最终结构化回答”
```

这和用户想要的体验相反。引用应该是回答的增强，不应该让回答本身变脆。

numbered citation 把职责拆开：

```text
主 Agent：写最终答案文本
host：维护本 answer 的 source map
renderer：把可解析 marker 渲染成链接
```

没有第二个回答生成器，也没有必须等完整 JSON 的阻塞点。

## 13. 为什么不是 title matcher

title matcher 看起来更自动，但它把“出现了某个词”和“模型想引用某个实体”混在一起。

Reflecta 的 title 很容易是短词或泛词：

```text
AI
产品
设计
复盘
行动
```

这些词出现在正文里，不代表它们都应该链接到某个 entity。

numbered citation 要求模型显式放 `[n]`，系统只负责把这个显式 marker 绑定到已知 source。它不会扫描自然语言猜 intent。

## 14. 为什么不是 ReferenceRegistry

`ReferenceRegistry` 会让系统多一层身份：

```text
real id -> registry handle -> display marker
```

但这个模块只需要两层：

```text
real id -> per-turn display marker
```

多出来的 registry handle 没有必要，而且会重新制造 `ref:nanoid` 那类问题：模型以为 handle 是可传给工具的真实 id。

如果接手的人觉得需要 registry，先做 deletion test：

```text
删掉 registry 后，复杂度会回到哪里？
```

在这个设计里，复杂度已经由 `citationSources` 承担。再加 registry 只会多一个需要解释和防污染的身份层。

## 15. 和现有 AgentEntityCatalog 的关系

`AgentEntityCatalog` 是原材料目录，不是 citation map。

它回答的问题是：

```text
本轮系统知道哪些真实 Reflecta entities？
```

`citationSources` 回答的问题是：

```text
这条 assistant answer 里的 [1]/[2] 分别指向哪些 entities？
```

两者不是同一个东西。

一个 entity 可以在 catalog 里，但没有分到 citation number，因为本条 answer 没把它暴露给模型或不希望引用它。

一个 assistant answer 必须持久化自己的 `citationSources`，不能依赖未来重新从 session catalog 推导。因为 catalog 会增长，编号 scope 也不是 session 级。

## 16. 和 renderer 的关系

renderer 的 interface 应该非常小：

```ts
renderAssistantMarkdown(text, citationSources);
```

renderer 不需要知道 Agent 怎么检索、工具怎么返回、prompt 怎么写。

renderer 只需要知道：

- 当前文本是什么。
- 当前 turn 的 source map 是什么。
- 点击某个 source 要打开哪个 entity。

这让 renderer 成为一个可靠 adapter，而不是一个业务推理层。

## 17. 社区方案给我们的验证

### LlamaIndex

LlamaIndex 的 `CitationQueryEngine` 把检索结果包装成 `Source 1`、`Source 2`，再要求模型在回答中写对应 numbered citation。source 编号由 runtime 生成，不由模型自由发明。

参考：

- [LlamaIndex CitationQueryEngine source](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/query_engine/citation_query_engine.py)
- [LlamaIndex inline citation example](https://developers.llamaindex.ai/python/examples/workflow/citation_query_engine/)
- [LlamaIndex sequential citation issue](https://github.com/run-llama/llama_index/issues/7299)

### Open WebUI

Open WebUI 社区方案强调：只有上下文里显式给了 source id，模型才应该写 `[source_id]`。它的 bug 也说明，如果 source list 构造错，citation 会稳定错链。

参考：

- [Open WebUI RAG citation prompt proposal](https://github.com/open-webui/open-webui/discussions/11088)
- [Open WebUI wrong first source issue](https://github.com/open-webui/open-webui/issues/12655)

### Dify

Dify 的 citation attribution 更偏底部 source UI，但它验证了 source metadata 应该跟 message 一起保存，而不是只靠文本里的标记。

参考：

- [Dify integrate knowledge within application](https://docs.dify.ai/en/use-dify/knowledge/integrate-knowledge-within-application)
- [Dify context variables preserve source attribution](https://github.com/langgenius/dify-docs/blob/main/en/use-dify/nodes/llm.mdx)
- [Dify citation metadata regression discussion](https://github.com/langgenius/dify/discussions/34716)

### Vercel AI SDK

Vercel AI SDK 的 UIMessage 把 source 作为 message part，并支持 streaming data/source。这验证了 text stream 和 source metadata 可以分开传输。

参考：

- [AI SDK streaming sources](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- [AI SDK UIMessage source parts](https://github.com/vercel/ai/blob/main/packages/ai/src/ui/ui-messages.ts)

### Anthropic Citations

Anthropic provider-level citation 也遵循同一模型：response 里的 citation 指向请求里提供的 source document/location，而不是模型在正文里创造真实身份。

参考：

- [Claude citations docs](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Claude search result citations](https://platform.claude.com/docs/en/build-with-claude/search-results)

## 18. 接手这个模块时应该坚持什么

坚持这几条，模块就不会继续发散：

- 正文里只有 display marker，没有真实身份协议。
- 真实身份只在 source map 和 tool 参数里。
- `[1]` 的 scope 永远是一条 assistant answer。
- source map 必须和 assistant answer 一起保存。
- renderer 只能把已知 source 渲染成链接，不能猜。
- citation 失败不等于回答失败。
- tool 参数必须拒绝 citation marker。

如果一个改动违反其中一条，它大概率是在把旧坑重新带回来。

## 19. 最小迁移方向

迁移不是重写整个 Agent。

最小方向是：

1. 停止把 `reflecta_final_answer` 作为回答成功门槛。
2. 为每条 assistant answer 生成并保存 `citationSources`。
3. Prompt 改成让 Agent 在普通 final text 里使用 `[1]` / `[2]`。
4. Renderer 基于当前 answer 的 `citationSources` 渲染 `[n]`。
5. 历史 prompt 构造时不要把旧 `[n]` 当 handle 传回模型。
6. Tool 参数校验拒绝 citation marker。

这条路线保留现有 stream text 主链路，只在旁边加一个 per-turn source map。它应该是最小、最接近社区方案、也最不容易继续把系统搞复杂的版本。
