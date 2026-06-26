# v1.1.12 Agent Reference Registry 技术计划

> 日期：2026-06-26
>
> 状态：Draft
>
> 目标：把 Agent 正文里的 Reflecta 引用从“模型拼真实 id”改成“系统维护引用注册表，模型只输出 handle”，保证可点击引用稳定回到真实 Understanding / Context。

## 1. 结论

Agent 正文引用不能继续依赖模型生成 `[[understanding:标题#id]]`。

当前风险有两类：

- Renderer 现有 wiki link parser 没有真正解析 type，`[[context:标题#id]]` 会被当成 Understanding 打开。
- 即使修掉 type parser，模型仍然可能拼错 id、混淆 Context id 和 Understanding id，或者引用它没有真实确认过的对象。

v1.1.12 直接引入 thread-level Reference Registry：

```txt
用户 @ / 当前页面 / 工具结果
  -> Reference Registry 自动注册真实对象
  -> prompt 暴露 [[U1]] / [[C1]] / [[D1]]
  -> Agent 正文只输出 handle
  -> Renderer 通过 registry resolve handle
  -> 只有 resolved reference 才可点击
```

不做：

- 不让用户手动维护引用选项。
- 不让模型自由输出真实 DB id。
- 不用 registry 判断 Agent 论证是否正确。
- 不在第一版实现 Domain inspector；Domain handle 可显示，暂不作为可 inspect 引用。

一句话：

```txt
Reference Registry 解决“蓝色引用能否稳定打开正确对象”，不是解决“Agent 回答是否有事实依据”。
```

## 2. Product Semantics

Reflecta 的核心价值是“可追溯的个人理解”。Agent 正文里的蓝色引用一旦可点击，用户会默认它能回到真实的个人 Understanding 或 Context。

所以可点击引用必须满足：

- 引用对象真实存在于 Reflecta 数据中。
- type 和 id 必须匹配。
- 引用来源必须是本轮对话中系统已经确认过的对象。
- 无法 resolve 的引用不能渲染成可点击链接。

在这个语义里，模型可以解释、比较、总结，但不能成为引用 id 的事实源。真实引用必须来自系统事实源：用户显式 @、当前页面上下文、或只读工具返回结果。

## 3. Module Interface

新增一个深模块：`AgentReferenceRegistry`。

它的外部 Interface 只负责四件事：

```ts
type AgentReferenceType = "understanding" | "context" | "domain";

type AgentReference = {
  handle: string; // U1 / C1 / D1
  type: AgentReferenceType;
  id: string;
  title?: string;
  status: "lightweight" | "loaded";
  source: "user" | "page" | "tool";
};

type AgentReferenceRegistry = {
  add(ref: Omit<AgentReference, "handle">): AgentReference;
  addFromToolOutput(toolName: string, output: unknown): AgentReference[];
  renderPromptBlock(): string;
  resolve(handle: string): AgentReference | null;
  snapshot(): AgentReference[];
};
```

Interface 约束：

- 同一个 thread 内，同一个 `type:id` 永远返回同一个 handle。
- Handle 按 type 分组递增：`U1`、`U2`、`C1`、`C2`、`D1`。
- `loaded` 优先级高于 `lightweight`；同一对象后续被工具读取详情后升级为 `loaded`。
- `source` 只记录最初来源，后续可被更完整数据覆盖 title/status。
- `resolve()` 找不到 handle 时返回 `null`，调用方不得猜测。

## 4. Registry Sources

Registry 自动收集，不需要用户提供 option。

### 用户 @ 的对象

Composer 发送的 `command.contextRefs` 直接注册。

```txt
@ Feedback Loop
  -> U1: understanding / feedback-loop-id / Feedback Loop / lightweight / user
```

### 当前页面对象

Contextual Agent Dock 如果由 Understanding 或 Context 打开，应把当前对象作为 `page` source 注册。第一版可以只接已有 `initialContextRefs`，不新增复杂页面协议。

### 工具结果

从只读工具输出中提取真实对象：

- `understanding_get`：注册 `output.understanding`，状态 `loaded`。
- `context_get`：注册 `output.context`，状态 `loaded`。
- `understanding_list`：注册列表里的 Understanding，状态 `lightweight`。
- `context_list`：注册列表里的 Context，状态 `lightweight`。
- `search`：注册 `hits[].understanding` 和 `hits[].context`。
- `retrieve_knowledge`：注册 `candidates[]` 的 Understanding；matched Context 有 id/title 时注册 Context。
- `graph`：注册 graph node 对应的 Understanding。

第一版只抽取现有返回结构里稳定存在的 `id/title/type` 字段。无法可靠识别的结构先跳过。

## 5. Prompt Contract

Agent system prompt 改成：

```txt
面向用户正文引用 Reflecta 对象时，只能使用 Reference Registry 给出的 handle：

正确：[[U1]]、[[C2]]
错误：[[understanding:标题#id]]、[[context:标题#id]]

如果要引用不在 registry 里的对象，先用工具查到它。
如果对象是 lightweight，需要正文细节时先调用对应 get 工具。
```

每次 `session.prompt()` 前，用户消息追加 registry block：

```txt
本 thread 当前可引用对象：

[[U1]] Understanding: Feedback Loop
状态：lightweight；需要正文时先调用 understanding_get。

[[C1]] Context: 某次实践复盘
状态：loaded。
```

工具执行结束并注册新对象后，如果 runtime 支持向模型注入 tool result 文本，则在 tool result 后追加：

```txt
本次工具结果新增可引用对象：
[[U2]] Understanding: 过程指标
[[C2]] Context: 反馈循环实践记录
```

如果 runtime 不方便追加额外文本，第一版仍可只依赖下一轮 prompt block；当前回合模型已能从工具 JSON 里看到 id/title，但最终渲染仍通过 registry 验证。

## 6. Session Events

Registry 需要随 session 持久化，否则重开 app 后旧消息里的 `[[U1]]` 无法 resolve。

新增事件：

```ts
type AgentReferencesUpdated = AgentEventBase & {
  type: "references.updated";
  refs: AgentReference[];
};
```

事件策略：

- 用户消息入队时注册 `contextRefs`，emit 一次 `references.updated`。
- 工具完成后从 output 注册 refs；有新增或升级时 emit 一次 `references.updated`。
- 事件 append 到 session JSONL，renderer reducer 合并进 session state。
- 重放历史事件时，registry 可从 `references.updated` 恢复，不需要重新跑工具。

Reducer state 增加：

```ts
references: AgentReference[];
```

Message 渲染时从 session state 读取 registry snapshot。

## 7. Rendering Contract

Renderer 不再把模型输出的旧 wiki id 当作唯一事实源。

新渲染规则：

```txt
[[U1]]
  -> registry.resolve("U1")
  -> understanding chip

[[C1]]
  -> registry.resolve("C1")
  -> context chip

[[D1]]
  -> registry.resolve("D1")
  -> domain chip, first version non-clickable

[[U999]]
  -> unresolved text, not clickable
```

兼容旧消息：

- 旧格式 `[[understanding:标题#id]]`、`[[context:标题#id]]` 继续解析 type/id。
- 旧格式必须先修 type parser，不能继续把 Context 当 Understanding 打开。
- 新 system prompt 禁止 Agent 再生成旧格式。

Unresolved 处理：

- 不打开 inspector。
- 不渲染成蓝色可点击按钮。
- 可显示为普通文本 `[[U999]]` 或 muted inline text。第一版用普通文本即可。

## 8. Implementation Plan

### Phase 1: Fix Existing Typed Link Parser

- 支持解析 `[[understanding:标题#id]]`、`[[context:标题#id]]`、`[[domain:标题#id]]`。
- Context link 点击时打开 Context inspector。
- Domain link 第一版显示但不可 inspect。
- 增加 `context-reference.test.ts` 覆盖 Context 不再被当成 Understanding。

### Phase 2: Add Registry Types And Reducer State

- 在 shared agent typings 增加 `AgentReference` 和 `references.updated` event。
- Reducer 合并 registry snapshot。
- 添加 reducer tests：重放事件后 `U1` resolve 到同一 Understanding。

### Phase 3: Register User Context Refs

- 在 `PiAgentHost.sendMessage()` 收到 `command.contextRefs` 后注册 refs。
- 生成 handle 并 emit `references.updated`。
- `buildPiPromptText()` 增加 registry block。
- 更新 `pi-prompt.test.ts`。

### Phase 4: Register Read-Only Tool Outputs

- 在 `tool_execution_end` 成功时，从 `piToolOutput(event.result)` 提取 references。
- 支持 `understanding_get`、`context_get`、`search`、`retrieve_knowledge`。
- 有新增或升级时 emit `references.updated`。
- 添加 extraction unit tests。

### Phase 5: Render Handle Links

- `MarkdownBody` 支持 `[[U1]]` / `[[C1]]` / `[[D1]]`。
- 渲染前通过 registry resolve。
- Unknown handle 保持不可点击。
- 旧格式继续兼容。

### Phase 6: Prompt Migration

- 更新 `agent-system-prompt.md`，禁止新正文输出真实 id wiki 格式。
- 新 prompt 明确 lightweight / loaded 的含义。
- 回归现有 Agent e2e：用户 @ 后回答中引用可打开。

## 9. Tests

Unit tests:

- `AgentReferenceRegistry` dedupe 同一 `type:id`。
- `loaded` 覆盖 `lightweight`。
- tool output extraction 支持 `understanding_get` / `context_get` / `search` / `retrieve_knowledge`。
- reducer 重放 `references.updated` 后恢复 registry。
- Markdown parser：
  - `[[U1]]` resolve 后可点击。
  - `[[U999]]` 不可点击。
  - `[[context:标题#id]]` 兼容旧格式并保留 Context type。

E2E tests:

- 用户 @ 一个 Understanding，Agent 回复引用 `[[U1]]`，点击打开正确 Understanding。
- Agent 工具读取一个 Context，回复引用 `[[C1]]`，点击打开正确 Context。
- 未知 handle 不打开 inspector。

## 10. Acceptance Criteria

- 新 Agent 回复不再依赖 `[[understanding:标题#id]]` 格式。
- 用户 @ 的对象能被自动注册并在 prompt 中显示 handle。
- 只读工具返回的对象能被自动注册。
- 历史 session 重载后，旧回复里的 `[[U1]]` / `[[C1]]` 仍能 resolve。
- Context id 不会再被当成 Understanding id 打开。
- 无法 resolve 的 reference 不会渲染成可点击链接。

## 11. Open Questions

- Domain inspector 是否进入 v1.1.12，还是只显示 non-clickable Domain chip。
- 工具结果新增 handle 是否需要立刻反馈给当前模型回合，还是下一轮 prompt block 足够。
- Registry snapshot 是否每次全量 emit，还是只 emit delta。第一版建议全量，少写合并逻辑。
- 是否需要为 handle 设计更短格式如 `[U1]`。第一版沿用 `[[U1]]`，和现有 wiki 风格一致。
