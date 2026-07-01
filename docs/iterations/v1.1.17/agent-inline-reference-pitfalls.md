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

## 1. 方案分类

这里按方案族分类，不按 commit 时间线分类。`AgentTextPart[]` 是最终存储和渲染目标，不单独算一种生成方案。

### 1.1 方案一：让 AI 直接在 content 里输出引用语法

典型形式：

- `[[type:title#id]]`
- `[[title#id]]`
- `<entity_ref type="understanding" entityId="..." fallbackText="..." />`
- 其他 JSON / YAML / markdown token 变体

想解决的问题：让前端直接 parse Agent 正文，把匹配到的片段渲染成可点击引用。

实际问题：

- Agent 输出不稳定，经常把 A 的 title 配到 B 的 id。
- 格式会漂移：今天 XML，明天 JSON，后天普通 markdown。
- 前端 parser 会被迫追着模型输出补格式。
- 格式没被 parse 时，用户会直接看到 raw 协议文本。
- 这种协议一旦进入历史消息，下一轮模型会继续复制，形成运行时兼容包袱。

结论：**拒绝。不能让模型自由正文承担机器协议。**

### 1.2 方案二：收集本轮 entity 并分配 ref 编号

共同思路：

```text
本轮对话 / 工具结果出现实体
  -> 系统分配一个 ref
  -> Agent 在正文里引用 ref
  -> 系统再把 ref 映射回真实 entityId
```

这个方向的根本风险是：ref 很容易从“展示层临时符号”变成“系统身份”。

#### 1.2.1 使用短编号，例如 `S1` / `S2` / `U1` / `D1`

想解决的问题：让模型少写复杂格式，不暴露真实 id。

实际问题：

- Agent 有时候不按 `[S1]` 或 `[[S1]]` 格式输出，而是直接在正文里写 `S1`。
- 用户下一轮也可能直接说“修改 S1”，系统必须解释它是不是上一轮短号。
- 模型会把短编号当成实体身份，在后续工具调用或正文里继续使用。
- 短号太像正常内容，流式和 markdown 场景里更难稳定识别。

结论：**短编号不能作为 Reflecta 实体身份。**

#### 1.2.2 使用无意义编号，例如 `ref:nanoid`

想解决的问题：避免 `S1` / `D1` 看起来像真实语义对象，也避免短编号太容易和正文混淆。

实际问题：

- Agent 会以为 `ref:nanoid` 就是真实 entity id。
- 工具调用时它会一直拿这个 `ref_id` 传参。
- 工具层本来应该只接受真实稳定 `entityId`，结果被 display ref 污染。
- 一旦历史里出现这些 ref，恢复、迁移和下一轮上下文都要解释它。

结论：**无意义 ref 也不能成为工具参数或持久身份。**

### 1.3 方案三：title 自动匹配

方案：Agent 只输出普通标题，系统在正文里扫描标题并自动替换为 `entity_ref`。

这个方案在方案阶段就被否定。

原因：

- 有些笔记名可能只有一个字或一个高频词。
- `AI`、`产品`、`设计` 这类标题和普通正文词重合度极高。
- 同名、别名、旧标题、父子 Domain 都会制造歧义。
- 权限、候选集和用户意图无法从标题字符串判断。

结论：**直接 pass。不要做 title matcher。**

### 1.4 方案四：当前 Final Answer Object Generator / finalizer 二次全文生成

当前方案大致是：

```text
Pi Agent 先生成普通答案
  -> Reflecta finalizer 再读一遍答案、toolResults、entityCatalog
  -> finalizer 输出 JSON parts
  -> renderer 展示 AgentTextPart[]
```

它试图解决：

- 不让主 Agent 在正文里手写引用语法。
- 最终持久化仍然落到 `AgentTextPart[]`。
- invalid `entity_ref` 可以通过 catalog 校验拦住。

实际问题：

- finalizer 成了“第二个作者”，会重写正文，而不是只做引用绑定。
- 主 Agent 已经写完答案后，用户还要等第二次模型生成。
- 当前 test 日志里，主模型约 44s 已经写完，finalizer 又追加约 17s。
- finalizer 输入还带完整 `toolResults`，最新 test 工具结果约 8.1 万字符，造成二次生成明显变慢。
- JSON mode 只保证“是 JSON”，不保证符合 schema，更不保证引用语义正确。
- 即使 schema 通过，也可能只是末尾补几个 `entity_ref`，正文里的关键实体仍然没有引用。
- 最新 test 里最终 parts 只有 5 段：前 3669 字是普通 text，末尾 4 个 domain `entity_ref`；正文里的高质量 Understanding 标题没有变成引用。
- 为了等 finalizer，有 catalog 的回答不会直接展示主模型正文流，流式体验变差。

结论：**这不是清晰方案。它把“引用绑定”做成了“第二次全文生成”，所以又慢又容易语义漂移。**

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

- final answer parse failed
- entity id 不在 catalog
- required reference 缺失
- provider 不支持当前结构化能力

不能悄悄把坏引用变普通文本假装成功。

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
