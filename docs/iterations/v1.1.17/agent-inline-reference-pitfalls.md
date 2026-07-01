# Agent 正文引用踩坑复盘

这份文档只记录踩过的坑和判断边界，不是实现计划。后续任何正文引用方案都必须先过这份清单，避免继续把同一类问题换个名字重做一遍。

## 0. 先把问题说清楚

Reflecta 要解决的不是“让模型写一个好看的引用格式”。

真正的问题是：

```text
Agent 最终答案的正文里，需要出现可点击的 Reflecta 实体引用；
这些引用必须绑定到真实 Understanding / Context / Domain；
同时不能污染工具调用、候选写入、历史消息和下一轮上下文。
```

这里有三层东西，不能混：

| 层级           | 归谁负责 | 稳定身份                            |
| -------------- | -------- | ----------------------------------- |
| 工具调用和存储 | 系统     | 真实 `entityId`                     |
| 模型正文表达   | 模型     | 只能表达“我想引用哪个候选”          |
| UI 渲染        | 系统     | `AgentTextPart[]` 里的 `entity_ref` |

我们反复出错，就是把这三层串在一起了。

## 1. 时间线

### 1.1 手写 wiki / ref token

早期思路是让模型在正文里写类似：

- `[[title#id]]`
- `[[type:title#id]]`
- `[[ref:S1]]`
- `rf_*`

想解决的问题：正文可点击，同时不让用户看到裸 id。

实际问题：

- 模型会把 A 的 title 配到 B 的 id。
- `ref` 变成了一个看似稳定的身份，被带进工具参数、审批、恢复和下一轮上下文。
- 一旦历史里有 `rf_*`，后面所有链路都要做兼容和迁移。

结论：**display token 不能成为 identity。**

### 1.2 工具接受 `ref`

曾经想让工具参数也接受 `ref`，让模型不用处理真实 id。

实际问题：

- 这是最核心的身份污染。
- 工具层本来应该只接受真实稳定 id，却开始接受会话内 display alias。
- Agent 会把正文引用、工具参数、历史 source map 混成一套东西。

结论：**工具参数永远只能吃真实 `entityId`，不能吃 `ref`、短号、display token。**

### 1.3 暴露真实 id 给正文

后来把工具输出里的真实 id 暴露出来，让模型直接用真实 id 引用。

实际问题：

- 正文里出现裸 id，用户体验差。
- 模型会把 id 当普通文本或 markdown link 写出来。
- 真实 id 进入可见正文后，后续模型会继续复制它，变成历史包袱。

结论：**真实 id 可以进入工具参数，但不应该变成自然语言正文格式。**

### 1.4 `U1` / `D1` / `[1]` 短 citation

这个方向借鉴 numbered citations，把本轮候选变成短号。

实际问题：

- 它本质仍然是会话内短身份。
- 模型可能在后续工具调用里继续传 `U1` / `D1`。
- 用户也可能在下一轮直接说“修改 U1”，系统必须再解释它是不是上一轮短号。
- 这会重演 `ref` 污染工具身份的问题。

结论：**短号不能作为 Reflecta 实体身份。若使用，也只能是单轮最终答案里的临时渲染标记，并且必须立刻消解。**

### 1.5 title 自动匹配

曾经考虑过让模型只写标题，系统在正文里扫描标题并自动变引用。

实际问题：

- 宽标题会误链，比如 `AI`、`产品`、`设计`。
- 同名、别名、旧名、父子域都会造成歧义。
- 权限、可见性、候选集边界无法从普通标题判断。
- 模型写“AI”可能只是普通词，不一定是引用。

结论：**不要做 title matcher。漏引用比错引用好。**

### 1.6 prompt 要求模型写 `entity_ref`

曾经让模型在普通正文里写：

```text
<entity_ref type="understanding" entityId="..." fallbackText="..." />
```

实际问题：

- 模型可能写 XML、JSON、YAML、markdown token，格式会漂移。
- parser 永远追着模型输出补格式。
- 用户会直接看到 raw XML。
- 下次模型可能换一种格式，继续坏。

结论：**不能把机器协议放进模型自由正文里。**

### 1.7 optional `reflecta_final_answer` tool

后来做了 structured final-answer tool / parts，想让最终答案走结构化出口。

实际问题：

- 只要它是 optional，模型就可以不调用。
- 模型仍然可以直接输出普通 assistant text。
- tool 参数失败或实体 id 无效时，如果 UI 没有稳定失败状态，用户看到的是“已确认但没生效”。

结论：**optional structured tool 不是 hard final answer protocol。**

### 1.8 `AgentTextPart[]` 方向本身是对的，但出口没锁死

`AgentTextPart[]` 这个数据模型解决的是最终渲染协议：

```ts
type AgentTextPart =
  | { type: "text"; text: string }
  | { type: "entity_ref"; entityType: "understanding" | "context" | "domain"; entityId: string };
```

它本身没有问题。

问题是：

- 模型可以绕过它输出普通 text。
- invalid id 曾经会 fallback 成普通文本，错误不显式。
- renderer 能显示 parts，不代表 Agent 一定会产生正确 parts。

结论：**最终存储用 parts 是对的，但生成链路必须保证 parts 是唯一落点。**

### 1.9 streaming finalizer

v1.1.17 做过一版 finalizer：

```text
Pi Agent 先写普通答案
Reflecta finalizer 再把答案重写成 JSON parts
```

想解决的问题：

- 不让模型在主正文里手写引用格式。
- 让最终答案统一变成 `AgentTextPart[]`。

实际问题：

- finalizer 成了“第二个作者”，会重写正文。
- 主 Agent 已经写完答案后，用户还要等第二次模型生成。
- finalizer 可以满足 schema，但语义上把引用放到错误位置。
- 最新 test 日志里，正文 3669 字都是普通 text，只有末尾 4 个 domain `entity_ref`，正文里的高质量 Understanding 标题没有变成引用。

结论：**不要让第二个模型重写整篇答案来补引用。**

### 1.10 JSON mode patch

后来给 OpenAI-compatible / DeepSeek path 加了 `response_format: { type: "json_object" }`。

它解决了：

- provider 返回普通中文正文导致 `Unexpected token '好'` 的低级 JSON parse failure。

它没有解决：

- JSON mode 只保证“是 JSON”，不保证符合 schema。
- 即使符合 schema，也不保证引用语义正确。
- finalizer 仍然可能输出一个大 text part，然后末尾补几个 entity_ref。
- finalizer 输入还带完整 `toolResults`，最新 test 工具结果约 8.1 万字符，造成二次生成明显变慢。

结论：**JSON mode 是格式补丁，不是引用架构。**

### 1.11 流式体验回退

当前实现里，有 tool activity 或 entity catalog 后，主模型正文流不会作为最终正文展示，而是等 finalizer：

```text
有 catalog -> 等 finalizer partial / final answer
```

最新 test 日志显示：

- 主模型约 44s 左右已经生成完正文。
- finalizer 又追加约 17s。
- 用户看到的体验就是慢一档。

结论：**不要为了结构化引用，把已经可用的正文流整段扣住。**

### 1.12 Markdown 渲染被破坏

有一次最终答案里出现了正常 markdown 语法不渲染：

- `---`
- `##`
- `###`
- `**bold**`

根因不是 markdown 本身，而是最终答案链路把正文当作结构化转换材料处理，导致 UI 收到的不是稳定的 markdown text block，或者 partial / preview / parts 状态不一致。

结论：**引用协议不能破坏普通 markdown text 的基本渲染。**

### 1.13 tool failed 状态没显式显示

早期还有“用户确认了工具调用，但最终执行失败却仍显示已确认”的问题。

实际问题：

- approval 状态和 execution 状态混在一起。
- “已确认”不等于“已执行成功”。
- 失败原因没有稳定进入 assistant turn block。

结论：**工具状态必须区分 approval 与 execution；执行失败必须在 UI 里显示失败原因。**

### 1.14 迁移和兼容包袱

历史里出现过 `rf_*`、`[[ref:*]]`、旧 `entity.sources.updated`、旧 tool output 字段等。

实际问题：

- 运行时兼容越多，模型上下文和代码路径越脏。
- 老 token 一旦进入知识库正文或 session，后续每个方案都要解释它。

结论：**能一次性迁移就迁移，运行时不要长期保留老协议兼容。**

## 2. 我们真正反复踩的是同一个坑

这些坑名字不同，但根因基本相同：

```text
把模型的自然语言输出，当成可靠的机器协议。
```

或者：

```text
把临时 display identity，当成系统 identity。
```

具体表现：

- `ref` 从 display token 变成 tool 参数。
- `U1/D1` 从 citation 变成实体身份。
- XML 从渲染提示变成 parser 协议。
- finalizer 从格式化器变成第二个作者。
- JSON mode 从格式约束被误当成语义约束。

## 3. 以后方案 review 的红线

任何新方案只要命中下面一条，就应该直接挡掉。

### 3.1 禁止让模型生成或复用真实身份之外的长期 ID

禁止：

- `ref`
- `rf_*`
- `U1` / `D1`
- `[1]`
- `C01`
- `R01`

这些可以作为单轮临时 token，但不能持久化，不能进入工具参数，不能进入下一轮上下文。

### 3.2 禁止 title 自动链接

禁止从正文里扫标题再自动变 `entity_ref`。

允许：

- 模型明确选择某个候选。
- 系统用本轮候选 map 校验并绑定。

### 3.3 禁止第二个模型重写全文

不再做：

```text
main answer text -> finalizer rewrite whole answer into parts
```

如果需要模型参与最终引用，它只能参与“选择候选引用”，不能重写整篇答案。

### 3.4 禁止把 JSON mode 当 strict structured output

`json_object` 只能说明输出大概率是 JSON。

它不能保证：

- schema 完全正确。
- id 在 catalog 中。
- 引用落在正确正文位置。
- 引用类型正确。

### 3.5 禁止可见失败静默降级

这些都必须显式处理：

- tool execution failed
- final answer parse failed
- entity id 不在 catalog
- required reference 缺失
- provider 不支持当前结构化能力

不能悄悄显示“已确认”或把坏引用变普通文本假装成功。

## 4. 最小心智模型

后续讨论只用这句话校准：

```text
工具和存储永远用真实 id；
模型最多表达它想引用哪个本轮候选；
系统负责验证、绑定、渲染；
最终持久化只存 AgentTextPart[]。
```

这句话没有承诺具体实现。它只是边界。

如果某个方案让临时 token 进入工具、历史、知识库或下一轮上下文，它就是旧坑。

如果某个方案让模型在自由正文里写机器协议，它也是旧坑。

如果某个方案让第二个模型重写整篇答案，它会继续带来速度和语义漂移问题。

## 5. 当前实现的直接教训

当前 `Final Answer Object Generator` 的问题不是 `AgentTextPart[]` 错了。

问题是：

```text
它把“最终引用绑定”实现成了“第二次全文生成”。
```

所以它看起来像结构化，实际引入了三个新问题：

1. 慢：主答案写完后还要等 finalizer。
2. 漂：finalizer 会改写正文。
3. 假成功：只要有一个 `entity_ref` 就算过，但正文里的关键实体可能仍然没有引用。

后续改造必须先删除这三个问题，而不是继续给它加更多 fallback。
