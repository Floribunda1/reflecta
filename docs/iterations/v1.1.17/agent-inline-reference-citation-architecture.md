# Agent Inline References: Numbered Citation Architecture

> 状态：Proposed
>
> 日期：2026-07-02
>
> 结论：采用 `agent-inline-reference-pitfalls.md` 里的方案二，但只采用社区 validated 的 `[1]` / `[2]` numbered citation 形态。不要再把 structured final output 作为主路径；它最多是未来增强，不是回答能否成功的门槛。

## 1. 先把心智摆正

`[1]` 不是 entity id，也不是 tool 参数，也不是可以跨轮复用的 handle。

`[1]` 只是本轮 assistant answer 里的显示引用标记。真实目标在 host 维护的 source list 里：

```text
answer text: "这条理解属于产品设计范畴 [1]，但也连接到 AI Agent 架构 [2]。"

citationSources:
  1 -> { type: "domain", id: "domain_product_design", title: "产品设计" }
  2 -> { type: "understanding", id: "u_agent_architecture", title: "Agent 架构不是 prompt 堆叠" }
```

模型可以写 `[1]`，但系统只按 `citationSources[1]` 渲染链接。模型不能决定 `[1]` 指向谁。

这和之前踩坑的 `U1` / `D1` / `ref:nanoid` 不同：

- `U1` / `D1` 容易被模型和用户当成实体身份。
- `ref:nanoid` 看起来像真实系统 id，容易污染 tool 参数。
- `[1]` 只在最终回答文本里有意义，不进入 tool 参数，不进入实体身份层。

## 2. 社区方案调研结论

### LlamaIndex

LlamaIndex 的 `CitationQueryEngine` 是最接近的开源参考。它的做法不是让模型凭空发明引用，而是 runtime 把检索出来的内容包装成 `Source 1`、`Source 2`，prompt 要求模型在回答中写对应编号，例如 `[1]` / `[2]`。

关键实现点：

- prompt 明确说只在引用 source 时写对应编号。
- runtime 把检索节点拆成 citation source nodes。
- 每个 source 的编号由 runtime 顺序生成，不由模型生成。
- `citation_chunk_size` 控制引用粒度。

参考：

- [LlamaIndex CitationQueryEngine source](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/query_engine/citation_query_engine.py)
- [LlamaIndex inline citation example](https://developers.llamaindex.ai/python/examples/workflow/citation_query_engine/)
- [LlamaIndex sequential citation issue](https://github.com/run-llama/llama_index/issues/7299)

这说明 numbered citation 的核心不是 `[1]` 这个字符串，而是：

```text
runtime-produced source list + model writes source numbers + renderer maps numbers back to source metadata
```

### Open WebUI

Open WebUI 社区的 RAG citation prompt 也走同一条路：只有上下文里显式提供了 `<source_id>`，模型才允许在回答里写 `[source_id]`。

它暴露过一个很有价值的坑：source list 生成不正确时，模型会稳定引用错 source，比如整个 collection 都映射到 `documents[0]`。这不是 prompt 问题，而是 source list 构造问题。

参考：

- [Open WebUI RAG citation prompt proposal](https://github.com/open-webui/open-webui/discussions/11088)
- [Open WebUI wrong first source issue](https://github.com/open-webui/open-webui/issues/12655)

对 Reflecta 的结论：citation source list 必须由 host 从真实 entity catalog 生成，且每个 `[n]` 必须一对一指向具体 entity。不能用“collection / domain / tool call”这种粗粒度对象冒充 source。

### Dify

Dify 的 citation 更偏底部 attribution，但架构点仍然有用：retrieval resources 是 message metadata，而不是纯文本协议。它的文档里把 Knowledge Retrieval 接到 LLM context 后，会自动跟踪 citations，让用户看到 source。

它的社区 bug 也说明了一件事：citation metadata 的事件顺序和字段名必须稳定；如果 `retriever_resources` 丢了，回答本身仍然能生成，但 citation UI 会消失。

参考：

- [Dify integrate knowledge within application](https://docs.dify.ai/en/use-dify/knowledge/integrate-knowledge-within-application)
- [Dify context variables preserve source attribution](https://github.com/langgenius/dify-docs/blob/main/en/use-dify/nodes/llm.mdx)
- [Dify citation metadata regression discussion](https://github.com/langgenius/dify/discussions/34716)

对 Reflecta 的结论：source metadata 必须跟 assistant turn 一起持久化。不要只把 `[1]` 放进文本，否则历史消息无法稳定点击。

### Vercel AI SDK

Vercel AI SDK 的 UIMessage 把 source 当成 message part，例如 `source-url` / `source-document`。它还支持在 stream 过程中发送 source 数据。

参考：

- [AI SDK streaming sources](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- [AI SDK UIMessage source parts](https://github.com/vercel/ai/blob/main/packages/ai/src/ui/ui-messages.ts)

对 Reflecta 的结论：source list 可以独立于 text delta 流式到前端。文本照常 stream，source metadata 作为 message metadata/parts 更新，不需要等最终 JSON。

### Anthropic Citations

Anthropic 的 provider-level citation 不是开源实现，但它验证了同一个模型：response 文本里的 citation 指向请求中提供的 source document index / location，而不是模型自己创造真实引用目标。

参考：

- [Claude citations docs](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Claude search result citations](https://platform.claude.com/docs/en/build-with-claude/search-results)

对 Reflecta 的结论：如果 provider 原生支持 citation，可以把它当成 adapter；但 Reflecta 主路径仍然应该使用自己的 entity source list，因为 Reflecta 链接目标是 Understanding / Context / Domain。

## 3. Reflecta 目标链路

```text
User input / @ refs
  -> Pi Agent 调用只读工具
  -> AgentEntityCatalog 收集本轮真实 entities
  -> Host 为可引用 entities 分配本轮 citation number
  -> Prompt 把 source list 暴露给 Agent
  -> Pi Agent stream 普通 markdown text，正文里写 [1] / [2]
  -> Renderer 按 assistant turn 的 citationSources 把 [n] 渲染成可点击引用
  -> Persist assistant.turn text + citationSources
```

这里没有第二个 LLM finalizer，也没有 structured final answer tool 作为主路径。

主 Agent 的普通 `text_delta` 就是最终回答流。前端可以立即显示：

```text
Agent delta: "这里有两个方向 ["
UI:        "这里有两个方向 ["

Agent delta: "1]"
UI:        "这里有两个方向 [1]"  // [1] 完整且存在于 citationSources，变成可点击 link/chip
```

## 4. 最小数据模型

保留现有 `AgentEntityCatalogEntry`，但 assistant turn 需要保存本条回答实际可解析的 citation sources。

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

type AgentAssistantTurn = {
  text: string;
  citationSources?: AgentCitationSource[];
};
```

`citationSources` 是 message metadata，不是新 registry。它只是把本轮显示编号固定下来，保证历史消息里的 `[1]` 以后还是点同一个 entity。

## 5. Source 编号规则

编号必须由 host 生成：

```text
AgentEntityCatalog snapshot
  -> stable order
  -> citationSources: [1], [2], [3]...
```

推荐排序：

1. 用户显式 `@` 的 entities，按用户输入顺序。
2. 工具结果收集到的 entities，按工具结果中首次出现顺序。
3. 已存在于历史 catalog 的 entities，只有当本轮 prompt 实际暴露给模型时才参与编号。

不要让模型生成编号，不要让工具返回编号，不要把编号存回 entity。

## 6. Prompt 规则

给模型看的 source list 可以很简单：

```text
You may cite the following Reflecta sources in the final answer:

[1] Understanding: Agent 架构不是 prompt 堆叠
    id: u_agent_architecture

[2] Domain: 产品设计
    id: domain_product_design

Rules:
- In the final answer, cite sources with [1], [2], etc.
- Tool calls must use real ids, never citation numbers.
- Do not invent citation numbers.
- If a statement does not rely on one of these sources, do not cite it.
```

工具参数仍然只接受真实 id：

```json
{ "understandingId": "u_agent_architecture" }
```

如果模型把 `[1]` 传进工具参数，tool validation 应该拒绝。这是防止 display token 污染工具链的硬门。

## 7. Renderer 规则

renderer 只转换满足这些条件的 citation marker：

- marker 在 markdown 正文里，不在 code block / inline code 里。
- marker 是完整的 `[number]`，例如 `[1]`。
- number 存在于当前 assistant turn 的 `citationSources`。

无法解析或不存在的 marker 保持普通文本：

```text
[999] -> 普通文本
[abc] -> 普通文本
`[1]` -> 普通代码文本
```

这条规则很重要：错误 citation 不能变成错链接。

## 8. Streaming 规则

streaming 不需要等最终 JSON：

```text
text_delta -> append to assistant message text -> renderer incremental parse visible text
```

增量渲染时：

- 不完整 marker 先显示为普通文本。
- marker 闭合后，如果 number 存在，立即变成可点击引用。
- source list 可以先于回答流发给前端，也可以随着 tool result catalog 更新发给前端。
- 不需要因为 citation 解析失败让整个回答失败。

最终持久化时只需要保存：

```text
assistant.turn.text
assistant.turn.citationSources
```

## 9. 历史污染规则

`[1]` 不能跨 assistant turn 解释。

历史消息展示时可以继续渲染，因为那条 assistant turn 自己保存了 `citationSources`。

但把历史消息喂回 LLM 时，不应该让旧 `[1]` 继续像可用 handle 一样存在。推荐做法：

```text
display text:
  "这和产品设计有关 [1]。"

model history text:
  "这和产品设计有关。"
```

如果确实需要让模型知道旧引用目标，就用真实 entity 信息补充：

```text
Previous answer cited:
- Domain: 产品设计; id=domain_product_design
```

不要在模型上下文里说“上一轮 [1] 是 domain_product_design”，否则又会把 display token 变成身份。

## 10. 和 structured output 的关系

`AgentTextPart[]` / `entity_ref` 可以保留为兼容能力，但不再是主路径。

新的主路径是：

```text
plain streaming text + per-turn citationSources
```

如果未来某个 provider 能稳定返回 first-class citations，可以作为 adapter 写入同一个 `citationSources` 模型。不要再引入“第二个 final answer generator”。

## 11. 失败策略

不要因为缺少 citation 而让回答失败。

允许的结果：

- 有 `[n]` 且 number 有 source：渲染可点击引用。
- 有 `[n]` 但 number 无 source：保持普通文本，可记录 telemetry。
- source list 为空：普通 markdown 回答。
- 工具参数里出现 `[n]`：拒绝该 tool call，因为这是身份污染。

这比 structured final output 更符合用户体验：正文永远先出来，引用能解析就增强，不能解析也不把回答炸掉。

## 12. 最小迁移计划

1. 停用 `reflecta_final_answer` 作为成功门槛。
2. 修改 prompt：最终答案使用 `[1]` / `[2]` citation；tool 参数必须继续使用真实 id。
3. 在 host 里从 `AgentEntityCatalog` 生成 per-turn `citationSources`，随 run/turn 发送并持久化。
4. renderer 解析 assistant turn text 里的 `[n]`，只按当前 turn 的 `citationSources` 转链接。
5. 历史 prompt 构造时剥离旧 citation marker，避免跨轮污染。
6. 保留 `entity_ref` 读取兼容，但新回答不依赖它。

## 13. 判断标准

这个方案成功的标准不是“每个 entity title 都自动变成链接”，而是：

- 回答可以稳定 stream。
- `[1]` / `[2]` 点击目标稳定。
- citation marker 不污染 tool 参数。
- 旧 citation 不跨轮变成实体身份。
- 缺 citation 不导致回答失败。
- 错 citation 不会渲染成错链接。

这就是社区 numbered citation 方案真正 validated 的部分。
