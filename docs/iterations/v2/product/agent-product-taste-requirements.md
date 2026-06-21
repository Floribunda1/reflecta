# Agent Product Taste Requirements

> 状态：Draft
>
> 目标：系统性梳理成熟 Agent Chat 产品应该呈现出的体验效果，以及 Reflecta 为什么会做成现在这种“能跑但 taste 不对”的形态。
>
> 范围：只讨论前台体验、message rendering、thinking/tool/proposal/evidence 的呈现。这里不讨论模型效果、tool schema、后端执行架构。

## 1. 核心判断

Reflecta 当前的问题不是“缺几个 UI 细节”，而是用了错误的渲染模型。

成熟 Agent Chat 不是：

```text
assistant text
tool log
tool log
tool log
composer
```

成熟 Agent Chat 应该是一个按时间顺序渲染的 assistant turn：

```text
assistant turn
  thinking / plan summary
  tool activity group
  assistant text
  tool activity group
  assistant text
  proposal / approval card
  evidence footer
```

也就是说，前台不应该把 assistant 文本先合并成一个大块，再把所有 tool 统一丢到底部。Tool、thinking、reasoning summary、text、proposal 都是同一条 assistant turn 里的 parts。它们应该按照发生顺序、相邻关系和用户语义被组织。

这也是为什么现在截图里的体验很差：回答已经写完了，下面突然堆了四张 “AI 搜索了 X 条” 的卡片。用户看到的不是 Agent 工作过程，而是回答后的日志残留。

## 2. 社区共识：Agent UI 是 Turn Renderer，不是 Chat Log

### 2.1 Message part 是一等 UI 单元

AI SDK 的 `UIMessage` 把 assistant message 拆成 text、reasoning、tool、source、data 等 part。Tool part 代表 tool invocation 和 result，source part 代表被引用的材料，data part 可以承载应用自定义 UI 数据。

assistant-ui 也不是简单渲染一段文本。它的 `MessagePrimitive.Parts` 支持按不同 part 类型渲染，并且明确支持 `ToolGroup`、`ReasoningGroup`，或者把 reasoning 和 tool-call parts 合成一个 collapsible Chain of Thought 区域。

结论：

- 正确抽象不是 `messageText(message)` + `message.parts.filter(tool)`。
- 正确抽象是 `renderMessagePartsInOrder(message.parts)`。
- 连续相邻的 tool / reasoning 应该 group，不应该变成多个重复卡片。

### 2.2 Tool call 是一个生命周期，不是一条完成日志

AG-UI 把 tool call 描述成类似文本流的生命周期：start、args、end。CopilotKit 也把工具、状态渲染、Human-in-the-Loop 作为 agent frontend 的核心概念。

这说明 tool UI 至少要表达：

- tool 开始了。
- tool 正在输入/执行。
- tool 完成了。
- tool 失败了。
- tool 需要用户确认。
- 多个相邻 tool 属于同一个工作阶段。

结论：

- Tool 不能只在完成后显示 `完成`。
- Running 和 completed 的文案要不同。
- 多个连续 read/search tools 要折叠成一个 activity group。
- 工具详情可以展开，但默认应该是摘要。

### 2.3 Thinking 应该可见，但不是原始推理链

成熟产品不会默认展示模型原始 chain-of-thought，但会展示用户可理解的 thinking / activity summary。

ChatGPT Agent 的产品叙述是让用户看到屏幕上的执行过程，并能随时 interrupt、pause、stop、take control。assistant-ui 的 reasoning / grouped parts 也说明 reasoning 和 tool calls 经常需要一个可折叠的壳。

结论：

- Thinking 不是 `...`。
- Thinking 也不是原始推理链。
- Thinking 是一组可展开/收起的过程摘要。
- 默认运行中展开或半展开，完成后折叠成一行 summary。

### 2.4 HITL 的核心是控制权，而不是按钮数量

CopilotKit 对 Human-in-the-Loop 的定义是：Agent 暂停，向用户收集输入、确认或选择，然后带着用户答案恢复。用户保留 steering wheel。

Reflecta 已定语义：

| 动作 | 是否写入 | 下一步控制权 |
| ---- | -------- | ------------ |
| 确认 | 是       | 系统完成写入 |
| 拒绝 | 否       | 交给 AI      |
| 忽略 | 否       | 交给用户     |

结论：

- Proposal card 必须出现在它被提出的位置，而不是挪到底部。
- `拒绝` 后要让 AI 继续一小步。
- `忽略` 后 Agent 停住，composer 获得焦点。
- Proposal 不是表单编辑器，用户通过继续聊天说明不满意。

### 2.5 成熟库已经把复杂问题拆好了

这个场景不应该手造复杂交互：

- AI SDK UI：message parts、tool parts、streaming data、approval、source/data parts。
- assistant-ui：Message parts、GroupedParts、ToolGroup、ReasoningGroup、Composer、Thread。
- AI Elements：基于 shadcn/ui 的 AI-native components，覆盖 streaming states、tool calls、reasoning displays。
- CopilotKit / AG-UI：tool lifecycle、state rendering、HITL、generative UI。
- shadcn/cmdk：`@` picker / command palette。
- Streamdown：stream markdown rendering。

Reflecta 可以先不整体迁移 assistant-ui，但渲染模型必须向这些库的抽象靠拢。业务层只做最薄的映射：把 `search_all` 变成“搜索了相关内容”，把 `thought_get` 变成“读取了「标题」”。

## 3. 成熟 Agent Turn 应该长什么样

### 3.1 Turn Anatomy

一条 assistant turn 应该由这些块组成：

| Block               | 作用                                      | 默认状态               |
| ------------------- | ----------------------------------------- | ---------------------- |
| Thinking Summary    | 告诉用户 Agent 当前在理解、计划、整理什么 | 运行中展开，完成后折叠 |
| Tool Activity Group | 展示 Agent 做了哪些查询/读取/写入准备     | 相邻同类 tool 自动合并 |
| Assistant Text      | Agent 对用户说的话                        | 直接流式显示           |
| Evidence Footer     | 展示回答实际基于哪些材料                  | 完成后显示，低视觉权重 |
| Proposal Card       | 写入/修改知识库前的候选结果               | 待用户确认             |
| Error / Recovery    | 某一步失败后的恢复入口                    | 就地显示               |

这些 block 的顺序由 stream parts 的发生顺序决定，不由组件自己把所有 text 合并、所有 tool 后置。

### 3.2 正确的视觉节奏

成熟体验应该像这样：

```text
AI 正在理解问题

▾ 查找相关内容
  搜索了 3 条 Thought / 1 条 Context
  读取了「三观里的恐惧/羞耻」

你刚才提到的“热爱过程”和“风险控制活下去”，其实有一个共同点...

▸ 查看关联
  查看了「热爱过程」附近的 5 条关联

所以我会把它拆成两个层次...

基于：热爱过程 · 风险控制 · 1 条来源
```

而不是：

```text
一大段回答

AI 搜索了 0 条 Thought / 0 条 Context
AI 搜索了 0 条 Thought / 1 条 Context
AI 搜索了 0 条 Thought / 1 条 Context
AI 搜索了 3 条 Thought / 1 条 Context
```

后者的问题是：

- 时间顺序断了。
- Tool 变成回答之后的日志。
- 多次搜索没有被解释成一个工作阶段。
- 用户不知道这些搜索和哪段回答有关。
- 没有 thinking，只有结果和日志。

### 3.3 Thinking 的展开/收起规则

Thinking 应该是“过程摘要”，不是 raw chain-of-thought。

最小内容：

- 当前阶段：`正在理解问题`、`正在查找相关内容`、`正在整理回答`。
- 已完成步骤：`查看了领域目录`、`搜索了相关内容`、`读取了 3 条笔记`。
- 可选短原因：`为了比较这些笔记里的共同模式`。

展示规则：

- Agent 刚开始且没有可见文本：显示 thinking summary。
- Tool running 时 thinking 保持可见，并显示当前动作。
- Assistant text 开始 streaming 后，thinking 可以折叠成一行。
- 用户可以展开查看这轮做过哪些步骤。
- 完成后默认折叠，保留 summary：`查找并读取了 4 条相关内容`。

不做：

- 不展示模型原始推理链。
- 不写长篇“我正在思考……”。
- 不把 thinking 做成聊天正文。

### 3.4 Tool Activity Grouping

连续 tool 不能逐条堆卡片。它们应该按相邻关系和语义分组。

分组规则：

- 相邻 read/search tools 合并成一个 `查找相关内容` group。
- 相邻 graph tools 合并成一个 `查看关联` group。
- 相邻 write proposal tools 合并成一个 `准备候选项` group，但每个 proposal 仍用独立 card。
- 中间出现 assistant text 后，新的 tool group 另起一组。
- 失败的 tool 不和成功结果混成一句，保留失败状态。

示例：

```text
▾ 查找相关内容 · 完成
  搜索了 3 条 Thought / 1 条 Context
  读取了「拖延与自我保护」
  读取了「真正的恶是放弃进步」
```

折叠后：

```text
▸ 查找相关内容 · 搜索 4 条，读取 2 条
```

### 3.5 Tool Activity 文案

默认文案必须是用户语义，不是内部 tool 名。

| Tool 类型           | Running                | Done                     |
| ------------------- | ---------------------- | ------------------------ |
| category list       | 正在查看领域目录       | 查看了领域目录           |
| category inspect    | 正在查看「领域名」     | 查看了「领域名」下的内容 |
| thought search/list | 正在搜索相关想法       | 找到 8 条相关想法        |
| thought get         | 正在读取「标题」       | 读取了「标题」           |
| context search/list | 正在搜索来源           | 找到 3 条来源            |
| context get         | 正在读取来源           | 读取了 1 条来源          |
| graph neighborhood  | 正在查看附近关联       | 查看了「标题」附近的关联 |
| graph path          | 正在查找两条想法的路径 | 查找了两条想法之间的路径 |
| proposal create     | 正在准备候选项         | 准备了候选项             |

展开后可以显示：

- 命中对象列表。
- 查询词。
- 数量。
- 失败原因的用户可读版本。

Raw JSON 只放 dev inspector。

### 3.6 Assistant Text Rendering

Assistant 文本应该像正文，不应该全部是一个厚重气泡。

要求：

- 用户消息可以是 bubble。
- Assistant 消息更接近 markdown document。
- Tool/thinking/proposal 是 assistant turn 内的嵌入块。
- Markdown streaming 时稳定，不因为 token 增长导致大幅跳动。
- 列表、引用、代码块、分隔线有稳定样式。
- 流式过程中有轻量 cursor / shimmer，不要大 spinner。

### 3.7 Evidence Footer

Evidence 应该回答“这段回答基于哪些真实材料”。

规则：

- 只展示 Agent 实际读取过的 Thought / Context / Category。
- 不把用户 `@` 过但 Agent 没读的对象伪装成 evidence。
- 太多时折叠。
- 可以点击跳转。
- 放在 assistant turn 尾部，视觉权重低于正文，高于 debug。

示例：

```text
基于：拖延与自我保护 · 真正的恶是放弃进步 · 1 条来源
```

### 3.8 Proposal / Approval

Proposal 是 assistant turn 里的行动请求，不是普通 tool log。

规则：

- 出现在提出 proposal 的位置。
- 标题是用户对象：`候选想法`、`候选关联`、`候选来源`。
- 状态：`待确认 / 已确认 / 已拒绝 / 已忽略 / 写入失败`。
- 长文本默认折叠。
- `确认 / 拒绝 / 忽略` 三个动作语义明确。
- 不允许用户手动编辑字段；用户用下一条消息说明哪里不满意。

## 4. Reflecta 现在为什么 taste 不对

当前实现的核心问题：

```ts
const text = messageText(message);
const toolParts = message.parts.filter((part) => isToolUIPart(part));
```

然后 UI 先渲染一个合并后的 text block，再 `toolParts.map(...)`。

这会天然导致：

- 所有 text part 被合并，丢失 text/tool 的相对顺序。
- 所有 tool 被后置到底部。
- 连续 tool 无法按相邻关系折叠。
- Thinking / reasoning part 没有独立位置。
- Evidence 无法和具体回答建立关系。
- Proposal 也容易变成“回答之后的附属卡片”。

所以现在不是某张卡片样式不好，而是 turn renderer 错了。

应该改成：

```text
message.parts
  -> normalize parts
  -> group adjacent reasoning/tool parts
  -> render blocks in order
  -> derive evidence footer from actually consumed sources
```

## 5. Reflecta 需要的渲染规则

### P0：先修正 Turn Renderer

必须做到：

- 不再先合并所有 text。
- 按 `message.parts` 顺序渲染。
- 相邻 tool parts 分组。
- 相邻 reasoning/thinking parts 分组。
- tool group 可展开/收起。
- thinking group 可展开/收起。
- tool 默认显示用户语义摘要。
- raw JSON 不进入普通用户默认 UI。

验收方式：

- 一轮里如果顺序是 `tool -> text -> tool -> text`，UI 必须也是这个顺序。
- 连续 4 个 search/read tools 默认显示为 1 个 group，不是 4 张重复卡片。
- 回答完成后 tool group 仍在它发生的位置，不被统一挪到底部。
- 没有 text 但正在运行时，显示 thinking/activity，而不是 `...`。

### P0：补 Thinking / Activity

必须做到：

- 首 token 前显示 `正在理解问题`。
- tool running 时显示当前 activity。
- 完成后 thinking 折叠成 summary。
- 用户可以展开看这轮执行步骤。

验收方式：

- 用户不会看到空白等待。
- 用户不用看 debug 就知道 Agent 在查找、读取、整理还是准备候选项。
- 展开内容是过程摘要，不是原始 chain-of-thought。

### P0：补 Tool Group Summary

必须做到：

- read/search tools 合并成 `查找相关内容`。
- graph tools 合并成 `查看关联`。
- proposal tools 显示为 proposal card。
- 每个 group 有 running/done/failed 状态。
- 展开后看到对象列表和数量。

验收方式：

- 截图里的四个 “AI 搜索了...” 应该变成一个可折叠 group。
- 如果其中某次搜索失败，group 内显示失败项，但 group 摘要不变成堆栈。

### P0：补 Proposal 控制权

必须做到：

- `确认 / 拒绝 / 忽略`。
- `拒绝` 交给 AI。
- `忽略` 交给用户。
- 卡片状态持久可见。

### P1：Evidence Footer

必须做到：

- 基于实际读取结果生成 evidence chips。
- 可点击跳转对象。
- 不伪造来源。

### P1：Message Actions / Recovery

必须做到：

- copy / retry / stop / continue 都在局部出现。
- stream error 保留 partial result。
- stop 不是 error。

## 6. 不应该继续补的方向

- 不要继续给底部 tool log 美化样式。
- 不要先做右侧 Inspector。
- 不要默认展示 raw JSON。
- 不要做 prompt preset。
- 不要把 thinking 写成长篇自述。
- 不要手写复杂 command palette / markdown streaming / grouped part runtime，优先看 AI SDK、assistant-ui、AI Elements、CopilotKit/AG-UI 已有抽象。

## 7. 具体下一步

最小正确实现顺序：

1. 改 `MessageRenderer`：从 “text + toolParts” 改为 “parts in order”。
2. 加 `groupAdjacentParts(parts)`：只做相邻 tool/reasoning grouping，不做复杂全局归并。
3. 加 `ToolActivityGroup`：连续 read/search tools 折叠成一个 group。
4. 加 `ThinkingGroup`：运行中显示，完成后可折叠。
5. 把现有 proposal cards 接回 ordered parts，而不是跟在 text 之后。
6. 后续再做 evidence footer。

这里不需要一次引入完整 assistant-ui。先把渲染模型修正，taste 会立刻改善。

## 8. Sources

- AI SDK, [UIMessage](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message)
- AI SDK, [Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- AI SDK, [Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- AI Elements, [Vercel Academy](https://vercel.com/academy/ai-sdk/ai-elements)
- AI Elements, [Component Registry](https://elements.ai-sdk.dev/)
- assistant-ui, [Message Part Grouping](https://www.assistant-ui.com/docs/ui/part-grouping)
- assistant-ui, [Message Primitive](https://www.assistant-ui.com/docs/api-reference/primitives/message)
- assistant-ui, [Reasoning](https://www.assistant-ui.com/docs/ui/reasoning)
- assistant-ui, [ChainOfThought Primitive](https://www.assistant-ui.com/docs/primitives/chain-of-thought)
- AG-UI, [Events](https://docs.ag-ui.com/concepts/events)
- AG-UI, [Tools](https://docs.ag-ui.com/concepts/tools)
- CopilotKit, [Human-in-the-Loop](https://docs.copilotkit.ai/agent-spec/human-in-the-loop)
- CopilotKit, [Generative UI](https://docs.copilotkit.ai/concepts/generative-ui-overview)
- Microsoft Design, [UX design for agents](https://microsoft.design/articles/ux-design-for-agents/)
- OpenAI, [Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/)
- Vercel Labs, [personal-agent-template](https://github.com/vercel-labs/personal-agent-template)
