# Agent 最终答案协议资格审查

> **给执行 Agent：** 本文不是实现计划，而是方案准入表。后续实现计划必须先引用本文结论，不允许重新从 XML/JSON/YAML/parser/title matcher 方向开始造方案。

**Goal:** 明确 Reflecta Agent 正文内联实体引用的可行方案，停止“半个社区方案 + 半个本地补丁”的循环。

**Architecture:** 把“工具执行过程”和“最终可见答案协议”分开审查。工具过程可以是 Pi Agent 的正常文本、thinking、tool calls；最终可见答案必须通过可强制、可校验、可失败的结构化输出通道产生。

**Tech Stack:** Pi Coding Agent、Pi custom tool、provider structured outputs、TypeScript Agent events、Reflecta entity catalog、Electron renderer。

---

## 0. 问题定义

用户遇到的问题不是“引用样式不好看”，而是最终答案协议没有硬边界。

已经出现过的失败形态：

- 模型用缩写：`U1`、`D1`、`[1]`。
- 模型自编 id 或把 A 的标题配到 B 的 id。
- 模型直接不引用，只输出标题。
- 模型手写 XML：`<entity_ref type="understanding" ... />`。
- 模型可能下次手写 JSON、YAML、markdown token。
- 工具调用失败或 final-answer tool 参数失败时，前端没有一个稳定的失败状态承接。

根因不是某一种格式没有 parser，而是：

```text
机器协议被放进了模型自由生成的自然语言正文里。
```

因此所有“再识别一种模型输出格式”的方案都不合格。

## 1. 当前 v1.1.16 实际状态

当前代码已经有 structured parts，但它不是唯一出口。

### 1.1 普通 assistant text 仍然直接展示

`pi-agent-host.ts` 收到 Pi 的 `text_delta` 后直接发 `assistant.text.delta`：

```ts
if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
  assistantText += event.assistantMessageEvent.delta;
  emitAccumulated(
    this.createEvent({
      type: "assistant.text.delta",
      delta: event.assistantMessageEvent.delta,
    }),
  );
}
```

`AgentRunAccumulator` 会把这个事件直接 fold 成可见 text block。

这意味着模型不调用 `reflecta_final_answer` 也能完成可见回答。

### 1.2 `reflecta_final_answer` 是 optional tool，不是 hard final channel

当前 tool 有参数 schema：

```ts
parts: Type.Array(
  Type.Union([
    Type.Object({ type: Type.Literal("text"), text: Type.String() }),
    Type.Object({
      type: Type.Literal("entity_ref"),
      entityType: ...,
      entityId: Type.String({ minLength: 1 }),
      fallbackText: Type.Optional(Type.String()),
    }),
  ]),
)
```

但它没有做到两件事：

- 没有强制模型必须调用它。
- 没有 `terminate: true`，所以不能按 Pi 官方 structured-output pattern 尽量结束在 tool call 上。

### 1.3 无效 entity id 当前会降级展示

当前 `normalizeAgentTextParts` 找不到 catalog entry 时：

```ts
const fallback = part.fallbackText ?? "";
text += fallback;
normalized.push({ type: "text", text: fallback });
```

这不是硬失败。它会把坏引用变成普通文本继续展示。

## 2. 社区方案的完整约束

### 2.1 Vercel AI SDK

AI SDK 的 tool calling 文档明确区分：

- 默认 `auto`：模型可以选择普通文本或 tool call。
- `toolChoice: "required"`：强制调用 tool。
- `{ type: "tool", toolName }`：强制调用指定 tool。

这说明“注册一个 tool”本身不是硬保证；硬保证来自 `toolChoice`。

来源：[AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)

### 2.2 OpenAI Structured Outputs

OpenAI 的结构化输出有两类：

- function calling：连接模型和系统工具。
- `response_format` / `text.format` JSON schema：约束模型最终响应。

官方也明确说 Structured Outputs 比 JSON mode 多的是 schema adherence。

来源：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

### 2.3 LangChain Structured Output

LangChain 的成熟做法不是解析自然语言，而是让 agent final state 里返回 `structured_response`。

它有两种策略：

- `ProviderStrategy`：provider 原生结构化输出。
- `ToolStrategy`：provider 不支持时，用 tool calling 承载结构化输出。

来源：[LangChain Structured Output](https://docs.langchain.com/oss/python/langchain/structured-output)

### 2.4 Anthropic Citations

Anthropic citations 是 provider 返回的 text block citation metadata，不是让模型手写引用 token。

它适合文档证据引用，但 Reflecta 要引用的是应用内实体，不是 provider document chunk，所以不能直接照搬。

来源：[Claude Citations](https://platform.claude.com/docs/en/build-with-claude/citations)

### 2.5 Pi Structured Output Tool

Pi 官方 example `structured-output.ts` 是：

- 注册一个 final structured-output tool。
- tool 参数承载结构化结果。
- `execute()` 返回 `details`。
- 返回 `terminate: true`，让 agent 可以结束在这个 tool call 上。

Pi 文档也说明 `terminate: true` 只是提示跳过自动 follow-up LLM call，并且只有同一批 finalized tool result 都 terminating 时才生效。

这解决的是“tool call 后不要再补一段普通文本”，不是“强制模型一定调用这个 tool”。

来源：[Pi Extensions](https://pi.dev/docs/latest/extensions)、[Pi structured-output example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/structured-output.ts)

## 3. 方案资格审查表

判定：

- Pass：能作为根因方案。
- Partial：只能减少一种失败，不能单独解决根因。
- Reject：会重踩已知坑。

| 方案                                      | 能强制结构化最终答案 | 能阻止普通 text 成为最终答案 | 能校验实体 id | 失败能显式化 | 是否依赖模型手写格式 | Pi 当前可用性                          | 结论                   |
| ----------------------------------------- | -------------------- | ---------------------------- | ------------- | ------------ | -------------------- | -------------------------------------- | ---------------------- |
| Prompt 要求模型写引用                     | 否                   | 否                           | 否            | 否           | 是                   | 可用                                   | Reject                 |
| 正文 XML/JSON/YAML/parser                 | 否                   | 否                           | 部分          | 否           | 是                   | 可用                                   | Reject                 |
| title 自动匹配                            | 否                   | 否                           | 否            | 否           | 否                   | 可用                                   | Reject                 |
| `U1/D1/[1]` numbered citation             | 否                   | 否                           | 部分          | 部分         | 是                   | 可用                                   | Reject                 |
| `[[ref:*]]` display token                 | 否                   | 否                           | 部分          | 部分         | 是                   | 可用                                   | Reject                 |
| 当前 optional `reflecta_final_answer`     | 否                   | 否                           | 部分          | 否           | 否                   | 已实现                                 | Partial                |
| Pi terminating structured-output tool     | 否                   | 部分                         | 部分          | 部分         | 否                   | 可用                                   | Partial                |
| Provider-native structured final response | 是                   | 是                           | 是            | 是           | 否                   | 取决于 provider 接入                   | Pass                   |
| Required final tool call                  | 是                   | 是                           | 是            | 是           | 否                   | 取决于 Pi/provider 是否暴露 toolChoice | Pass                   |
| Anthropic/OpenAI native citations         | 是                   | 是                           | 是            | 是           | 否                   | 不适配 Reflecta entity                 | Reject for entity refs |

## 4. 最终结论

Reflecta 不能再把正文引用协议建立在模型自然语言输出上。

合格方案只有两类：

### 4.1 Provider-native structured final response

最终可见答案由一个 schema-constrained response 产生：

```ts
type FinalAnswer = {
  parts: Array<
    | { type: "text"; text: string }
    | {
        type: "entity_ref";
        entityType: "understanding" | "context" | "domain";
        entityId: string;
        fallbackText?: string;
      }
  >;
};
```

运行时规则：

- provider 负责 schema adherence。
- Reflecta 负责 catalog validation。
- validation 失败时 retry 或显示失败状态。
- 不把普通 assistant text 当最终答案展示。

### 4.2 Required final tool call

如果 provider 或 SDK 能强制指定 final tool：

```text
toolChoice = { type: "tool", toolName: "reflecta_final_answer" }
```

则 `reflecta_final_answer` 可以作为最终答案协议。

但必须同时满足：

- 该 tool 是 required，不是 optional。
- tool result `terminate: true`。
- tool 参数校验失败就是失败或 retry。
- id 不在 catalog 中就是失败，不 fallback 成普通文本。
- 普通 assistant text 不能进入最终可见答案。

## 5. Pi 当前链路的判定

当前 Pi Agent session 这条链路看起来没有暴露通用 `toolChoice: required` 或 provider `response_format` 到 `createAgentSession` 的 public options。

因此在当前链路里：

- 只加 `terminate: true` 是必要的小修，但不是根因方案。
- 只加更强 prompt 不是根因方案。
- 只加强 `normalizeAgentTextParts` 校验不是根因方案。
- optional `reflecta_final_answer` 不能被称为 hard final answer protocol。

如果要做根因方案，需要新增一个真正的 finalization seam：

```text
Pi Agent turn
  -> 产生工具调用、thinking、候选普通文本、entity catalog
  -> Reflecta finalizer 使用 provider structured output 或 required tool call
  -> validate FinalAnswer.parts against entity catalog
  -> renderer 只展示 validated parts
```

这不是正文 parser，也不是自造引用格式。它只是把最终答案交给社区主流的结构化输出机制，而不是交给普通 assistant text。

## 6. 流式渲染实现

最终方案必须流式。不能把“等完整 JSON 回来再一次性渲染”当成可接受产品体验。

社区依据：

- Vercel AI SDK 明确支持用 `streamText` + `output` 流式消费 structured response，并暴露 `partialOutputStream`；array output 还有 `elementStream`。
- OpenAI Structured Outputs 负责 schema adherence；如果直接用 OpenAI-compatible streaming，stream 里拿到的是 JSON 文本 chunk，完整校验仍要等最终对象。
- Vercel AI Gateway 文档也提醒：OpenAI-compatible structured output streaming 需要收集 chunk，完整 parse 发生在 stream 结束后。

因此 Reflecta 的产品实现要分两层：

```text
provider structured stream
  -> Reflecta finalizer adapter
  -> validated/provisional Agent final-answer live events
  -> renderer streaming block
  -> final assistant.turn snapshot
```

UI 永远不看 raw JSON。

### 6.1 Finalizer 输出 schema

schema 仍然是 structured parts，但为流式渲染优化成一个字段：

```ts
type FinalAnswerPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: "understanding" | "context" | "domain";
      entityId: string;
      fallbackText?: string;
    };

type FinalAnswer = {
  parts: FinalAnswerPart[];
};
```

JSON Schema 要求：

- root 是 object，只有 `parts` 一个字段。
- `parts.items` 只允许 `text` 或 `entity_ref`。
- `additionalProperties: false`。
- `entityType` 是 enum。
- `entityId` 是非空 string。

root 只保留 `parts`，是为了让 provider 从一开始就往 `parts` 写内容，减少流式等待。

### 6.2 Main process live events

新增 finalizer 专用 live event，不复用 Pi 的普通 `assistant.text.delta`：

```ts
type AgentFinalAnswerPartial = AgentEventBase & {
  type: "assistant.final.partial";
  runId: string;
  messageId: string;
  text: string;
  parts: AgentTextPart[];
  previewText?: string;
};

type AgentFinalAnswerFailed = AgentEventBase & {
  type: "assistant.final.failed";
  runId: string;
  messageId: string;
  error: string;
};
```

语义：

- `parts` 只放已经通过 catalog validation 的稳定 parts。
- `previewText` 是当前 JSON stream 中还没稳定提交的 plain text 预览，只能按普通文本渲染，不能变成引用。
- `text` 是 `parts` + `previewText` 的 plain text，用于搜索状态和滚动定位。
- `assistant.turn` 仍然是最终持久化事件，只写 validated `parts`，不写 `previewText`。

### 6.3 Finalizer adapter

新增一个 main process module：

```text
apps/electron/src/main/services/agent/agent-finalizer.ts
```

接口：

```ts
type RunAgentFinalizerInput = {
  model: AgentModelSelection;
  userQuestion: string;
  piDraftText: string;
  toolResults: unknown[];
  entityCatalog: AgentEntityCatalogEntry[];
  requiresEntityRefs: boolean;
  signal?: AbortSignal;
  onPartial(partial: { text: string; parts: AgentTextPart[]; previewText?: string }): void;
};

type RunAgentFinalizerResult = {
  text: string;
  parts: AgentTextPart[];
};
```

实现规则：

1. 用当前 configured finalizer provider 发起 structured output stream。
2. 如果 provider 是 OpenAI Responses / OpenAI-compatible，使用 provider-native JSON schema。
3. 如果以后引入 AI SDK，可以直接用 `partialOutputStream` / `elementStream`；但这不是必须前提。
4. 如果继续用现有 `@earendil-works/pi-ai`，通过 `stream()` 获取 `text_delta`，通过 `onPayload` 注入 provider-native structured output payload。
5. 累积 raw JSON stream，但 raw JSON 只在 adapter 内部存在。
6. 每次 JSON stream 更新后，做 partial parse，提取当前可用的 `parts`。
7. 对 `entity_ref` 立即做 catalog validation；通过才进入 committed `parts`。
8. 对最后一个仍在增长的 `text` part，只作为 `previewText` 发给 UI。
9. stream done 后，用 `ajv` 对完整对象做 strict validation，再做 catalog validation。
10. validation 失败时 retry 一次；仍失败则发 `assistant.final.failed`。

这不是正文 parser。这里解析的是 provider 在 structured-output 模式下产生的 JSON 协议，不是模型可见正文里的 XML/JSON/YAML。

### 6.4 Renderer 行为

renderer 需要支持一个 streaming final block：

```ts
type AgentFinalTextBlock = {
  kind: "text";
  text: string;
  parts?: AgentTextPart[];
  previewText?: string;
  state?: "streaming" | "done" | "failed";
  createdAt: string;
};
```

渲染规则：

- `parts` 走现有 structured markdown/entity renderer。
- `previewText` 接在 `parts` 后面，按普通 markdown/text 流式显示。
- `previewText` 里的 `<entity_ref>`、JSON、YAML 都只是普通文本，不解析。
- 收到最终 `assistant.turn` 后，用 persisted block 替换 streaming block。
- 收到 `assistant.final.failed` 后，把 block 标成 failed，显示失败原因，不把 provisional preview 当成功答案。

### 6.5 Pi Agent 与 finalizer 的关系

Pi Agent 仍然可以流式展示过程，但它的普通 text 不能再成为最终答案。

```text
Pi text_delta
  -> 过程草稿 / internal draft
  -> 可作为 finalizer 输入
  -> 不直接持久化为最终 answer text block

Finalizer partial
  -> 最终答案区域流式渲染
  -> validated 后持久化 assistant.turn
```

如果产品不想显示 Pi 草稿，就只显示 reasoning/tool blocks 和“正在整理最终答案”的状态。

### 6.6 最小实现顺序

1. 增加 `assistant.final.partial` / `assistant.final.failed` 类型和 reducer upsert。
2. 增加 renderer 对 `previewText` / `state` 的支持。
3. 新增 `agent-finalizer.ts`，先用 fixture stream 做单元测试，不接真实 provider。
4. 接入 provider-native structured output stream。
5. 把 Pi run 完成后的最终答案入口改成调用 finalizer。
6. 禁止 Pi 普通 `assistant.text.delta` 落成最终答案；它只能作为过程草稿或被丢弃。
7. e2e 覆盖：
   - finalizer text preview 能流式出现。
   - `entity_ref` 通过 catalog validation 后变成可点击引用。
   - invalid id 触发 retry / failed，不 fallback。
   - 模型输出 XML 时不会被解析成引用。

## 7. 失败策略

合格实现必须把失败显式化。

| 失败                                        | 系统行为                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| finalizer schema invalid                    | retry 一次；仍失败则显示“最终答案结构化失败”                                                                         |
| `entity_ref` id 不在 catalog                | retry 一次；仍失败则显示“引用实体不存在”                                                                             |
| final answer 没有引用但本轮答案声称基于实体 | retry 一次；仍无引用则显示“缺少必要实体引用”。只有系统判定本轮不需要 grounded entity refs 时，才允许无引用普通答案。 |
| Pi 工具调用失败                             | tool block 显示 failed，并带失败原因                                                                                 |
| 模型普通 text 中出现 `<entity_ref>`         | 当成普通文本，不解析；如果该 turn 要求 grounded final answer，则 finalizer 失败                                      |

关键点：失败可以展示给用户，但不能静默改成“看起来成功”。

## 8. 历史数据处理

v1.1.17 不应该迁移历史普通 assistant text 去补引用，因为那会重新引入 parser/title matcher。

历史处理原则：

- 已经是 structured `parts` 的历史消息继续按原数据渲染。
- 历史 plain text 继续作为历史 plain text 展示。
- 不从历史 XML/JSON/YAML/markdown token 中猜 entity refs。
- 如果历史数据里有 v1.1.16 生成的无效 `entity_ref`，只允许一次性审计报告，不在运行时加兼容 parser。

如果后续实现需要删除旧 fallback 行为，迁移也必须是一次性脚本，跑完删除脚本；运行时不保留旧逻辑兼容。

## 9. 后续实现计划准入

任何 v1.1.17 后续 implementation plan 必须先回答：

1. 使用 provider-native structured output，还是 required final tool call？
2. 如果继续走 Pi Agent session，Pi 当前 API 是否真的能强制 final tool？
3. 普通 `assistant.text.delta` 是否还能成为最终可见答案？
4. validation fail 后是 retry、失败状态，还是 fallback？
5. e2e 如何覆盖这四个失败：
   - 模型输出 XML。
   - 模型不调用 final-answer tool。
   - 模型引用不存在 id。
   - 工具调用失败。

答不清这些，就不能进入实现。
