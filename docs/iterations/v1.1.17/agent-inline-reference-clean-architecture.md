# Agent Inline References Clean Architecture

> 状态：Proposed
>
> 日期：2026-07-02
>
> 结论：保留 `AgentTextPart` / `entity_ref`，但把 inline reference 的生成从二次 LLM finalizer 移回主 Agent 的最终结构化输出。不要新增 `ReferenceRegistry`，直接复用 `AgentEntityCatalog` 作为本轮允许引用集合。

## 1. 目标

用户要的不是底部 References，而是 Agent 正文内部出现可点击的 Reflecta 知识实体引用：

- Understanding
- Context
- Domain

目标效果类似 Codex 的文件引用：正文中直接可点，点击后打开对应对象。

但 Reflecta entity 和文件路径不同。文件路径本身就是稳定地址；知识对象标题不是稳定地址。因此 inline link 的目标必须来自真实 `entityId`，不能来自 title matcher、短编号或正文 parser。

## 2. 最干净的心智

最终答案不是一段 markdown string，而是一串 message parts：

```ts
type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: "understanding" | "context" | "domain";
      entityId: string;
      fallbackText?: string;
    };
```

模型可以决定在哪里插引用，但真实引用目标必须通过运行时校验：

```text
entity_ref.entityId 必须存在于本轮 AgentEntityCatalog
```

这条规则比任何 prompt 都重要。

## 3. 当前架构的问题

当前 finalizer 链路是：

```text
Pi Agent 先写普通答案
  -> Reflecta finalizer 读取 piDraftText + toolResults + entityCatalog
  -> 第二个模型重写整篇答案并输出 JSON parts
  -> Reflecta 校验 parts
```

这个 seam 放错了。

`agent-finalizer` 实际承担了太多职责：

- 理解用户问题
- 理解主 Agent 草稿
- 理解完整 tool results
- 决定引用哪些实体
- 决定引用插在哪里
- 重写最终答案
- 生成 JSON
- 保证 entity id 正确

这不是一个深 module，而是第二个回答 Agent。它慢、会改写正文，也不能保证引用落在用户真正需要的位置。

## 4. 目标架构

目标链路：

```text
用户 @ refs / 工具输出
  -> AgentEntityCatalog 收集真实 entity refs
  -> 主 Agent 生成最终 structured answer parts
  -> validateFinalAnswerParts(parts, entityCatalog)
  -> AgentRunAccumulator 持久化 validated parts
  -> Renderer inline 渲染 entity_ref
```

关键点：

- `AgentEntityCatalog` 是本轮允许引用集合。
- 主 Agent 最终答案直接输出 `AgentTextPart[]`。
- `entity_ref` 直接使用真实 `entityId`，不引入 `R1` / `U1` / `[1]`。
- `validateFinalAnswerParts` 是硬门。
- renderer 只渲染 validated parts。

## 5. Final Structured Output

不要把这里理解成新模块或新通道。它只是主 Agent 最终输出的结构化形态。最小 interface：

```ts
type FinalAnswerInput = {
  parts: AgentTextPart[];
};
```

如果当前 Agent framework 用 tool call 承载最终结构化输出，形态可以是：

```ts
reflecta_final_answer({
  parts: [
    { type: "text", text: "你最近反复在区分 " },
    {
      type: "entity_ref",
      entityType: "understanding",
      entityId: "u_123",
      fallbackText: "自我价值不等于外部认可",
    },
    { type: "text", text: " 和外部评价之间的关系。" },
  ],
});
```

运行时收到后：

1. 用 schema 校验 shape。
2. 用 `validateFinalAnswerParts(parts, entityCatalog)` 校验 entity id。
3. 成功则保存为最终 answer parts。
4. 失败则 retry 或进入 explicit failure，不能静默降级成普通文本。

这只是 transport adapter，不是架构核心。硬要求是：runtime 必须拿到结构化的 `{ parts: AgentTextPart[] }`，并且这个 transport 必须支持下面的 streaming 规则。

## 6. Streaming Rendering

前端不能等完整 `{ parts }` 全部生成完才开始渲染。

正确流式链路是：

```text
LLM structured output stream
  -> runtime incremental parser
  -> assistant.final.partial
  -> renderer 更新同一个 streaming message block
  -> final validate
  -> assistant.turn done
```

每次 stream 更新时，runtime 尽量提取当前稳定的前缀：

- 已完成的 `text` part：立即按普通文本渲染。
- 已完成且通过 catalog 校验的 `entity_ref` part：可以立即渲染成 inline link。
- 还没闭合的当前文本：作为 `previewText` 按普通文本渲染。
- 还没完整的 `entity_ref`：不能提前变成链接。

最终完整对象到达后，再做 strict schema validation 和完整 `validateFinalAnswerParts(parts, entityCatalog)`。成功后，同一个 streaming block 进入 done 状态；失败则进入 failed/retry，不能把错误引用静默当成成功。

如果某个 transport 只能在全部结束后一次性给出 `{ parts }`，不能暴露可解析的 partial structured output，那它不满足这个模块的 UX 要求。不能为了结构化输出牺牲流式渲染。

## 7. 普通 text_delta 的角色

普通 `text_delta` 仍然可以用于运行中的草稿展示，但它不是带引用的最终答案协议。

推荐规则：

```text
有 validated final structured parts:
  持久化 structured parts

没有 final structured parts 且 entityCatalog 为空:
  可以把普通 text 作为纯文本答案持久化

没有 final structured parts 且 entityCatalog 非空:
  不生成 inline references
  要么 explicit failure
  要么降级为纯文本 + 底部 references
```

不要在这种失败路径里假装 inline reference 已经成功。

## 8. 为什么不需要 ReferenceRegistry

不需要新建 `ReferenceRegistry`。

之前设想的 `R1` / `R2` 临时 handle 只解决两个小问题：

- token 更短
- 不暴露真实 id

但 Reflecta 的工具调用本来就使用真实 entity id；再引入一层 handle 会重新制造 display token 污染、跨轮歧义和历史解释成本。

最小且干净的做法：

```text
AgentEntityCatalog = 本轮允许引用列表
entity_ref.entityId = 真实 entity id
validateFinalAnswerParts = 唯一校验门
```

## 9. 和开源方案的关系

这不是自造架构，而是取开源方案里最适合 Reflecta 的部分。

- Dify / AnythingLLM / Khoj：引用对象由检索或工具运行时收集，并挂到 message 上。Reflecta 继续用 `AgentEntityCatalog` 承担这部分。
- LlamaIndex / Open WebUI：常见 inline citation 是 `[1]` 文本协议。它能做文档 citation，但不适合 Reflecta entity identity，因为会重踩短号、parser、历史污染问题。
- Vercel AI SDK / LangChain / provider citations：更可靠的方向是 structured parts / source annotations，而不是普通 markdown string。Reflecta 的 `AgentTextPart[]` 正是这个方向。

所以 Reflecta 的目标不是 numbered citation，而是 first-class `entity_ref` part。

## 10. Module 责任

### `AgentEntityCatalog`

职责：

- 从用户 `@` context refs 收集 entity。
- 从 read-only tool outputs 收集 entity。
- 暴露本轮 entity catalog snapshot。

不负责：

- 分配短号。
- 扫描正文标题。
- 判断自然语言里哪里该自动链接。

### Final Structured Output adapter

职责：

- 承载主 Agent 的 structured parts stream。
- 只接受 `text` 和 `entity_ref`。
- 流式产出 `assistant.final.partial`。
- 完整结束后产出可校验的 `{ parts: AgentTextPart[] }`。

不负责：

- 二次总结。
- 读取完整 toolResults。
- 替主 Agent 重写答案。

### `validateFinalAnswerParts`

职责：

- 校验每个 `entity_ref` 是否存在于 `AgentEntityCatalog`。
- 输出 normalized final text + parts。
- 失败时返回错误。

不负责：

- fallback 成普通文本。
- 猜测标题对应哪个实体。

### Renderer

职责：

- 把 validated `entity_ref` 渲染成可点击链接。
- 找不到 catalog entry 时显示 fallback text，但这应该只作为历史兼容，不是新链路的正常路径。

不负责：

- 解析模型手写协议。
- 自动 title matching。

## 11. 迁移步骤

### Step 1: 保留现有协议，新增 streaming Final Structured Output adapter

复用现有 `AgentTextPart` schema。adapter 的输出仍然是：

```ts
{ parts: AgentTextPart[] }
```

但 adapter 必须能在完整对象结束前发出 partial：

```ts
{
  parts: AgentTextPart[];
  previewText?: string;
}
```

如果 `reflecta_final_answer` tool call 的 arguments 不能 streaming，就不要把它作为唯一可见输出路径。

### Step 2: Host 捕获 streaming partial 和最终 parts

`PiAgentHost` 从 adapter 收到 partial 时：

- 对 stable `entity_ref` 做 catalog 校验。
- 发 `assistant.final.partial`。
- 让 renderer 更新同一个 streaming block。

adapter 完成后：

- 调用 `validateFinalAnswerParts(parts, entityCatalog.snapshot())`。
- 成功后写入 accumulator final answer。
- 失败后发 `assistant.final.failed`。

### Step 3: 取消二次 LLM finalizer 的主路径

`agent-finalizer.ts` 不再是有 catalog 答案的默认路径。

可以先保留文件，但 runtime 不再调用它来重写主 Agent 答案。

### Step 4: 明确 fallback

如果没有收到 valid final answer：

- catalog 为空：普通 text 可以作为 `{ type: "text" }` 保存。
- catalog 非空：进入 explicit failure 或纯文本 + bottom references 降级。

推荐 v1.1.17 用 explicit failure，避免再次把失败伪装成成功。

### Step 5: 删除 parser/short-ref 相关诱导

Prompt 和测试里不再出现：

- `U1`
- `D1`
- `[1]` 作为 Reflecta entity ref
- `[[ref:*]]`
- XML / YAML / markdown token

只保留 `entity_ref` structured part。

## 12. 验收标准

必须有测试覆盖：

1. 主 Agent 输出 structured partial 时，前端在最终对象完成前开始渲染 streaming block。
1. stable text part 会流式显示。
1. stable 且 catalog-valid 的 `entity_ref` 会流式显示成 inline link。
1. 未完成或未校验的 `entity_ref` 不会提前变成链接。
1. 最终 `{ parts }` valid 时，streaming block 变成 done。
1. 主 Agent 输出 valid `entity_ref`，前端渲染 inline link。
1. `entityId` 不在 catalog 中时，final answer 失败，不 fallback 成普通 text。
1. catalog 非空但没有 final structured output 时，不生成 inline refs。
1. 普通 text 中出现 `<entity_ref ...>` 时按普通文本显示，不被 parser 处理。
1. 没有 catalog 的普通回答仍可作为纯文本答案完成。
1. 历史消息中不出现 `U1` / `[1]` / `ref:nanoid` 这类显示 token。

## 13. 删除清单

最终应该删除或停用：

- 二次 LLM finalizer 主路径。
- 把完整 `toolResults` 传入 finalizer 的逻辑。
- `requiresEntityRefs` 这种强迫第二模型补引用的字段。
- 对 bad `entity_ref` 静默 fallback 成成功答案的路径。
- 所有正文 parser / title matcher / short ref 方案。

## 14. 最终结论

最干净的架构是：

```text
主 Agent 负责最终回答内容
AgentEntityCatalog 负责可引用实体集合
Final Structured Output adapter 负责流式结构化最终出口
validateFinalAnswerParts 负责硬校验
renderer 负责 inline 展示
```

不要再让第二个 LLM 重写答案。不要再新增短号映射层。不要再 parse 自然语言正文。
