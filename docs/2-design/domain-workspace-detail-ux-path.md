# Domain Workspace Detail UX Path

> 日期：2026-06-10
>
> 状态：Draft
>
> 主题：Domain Workspace 中右侧详情区的 UX 交互路径设计。
>
> 输入依据：
>
> - `docs/1-product/value-proposition.md`
> - `docs/1-product/pmf-mvp-prd.md`
> - `docs/2-design/pmf-mvp-information-architecture.md`
> - 真实数据库 `<projectRoot>/.local/reflecta-prod/reflecta.db` 中的 `categories`、`thoughts`、`contexts` 结构与样例数据。

---

## 1. 本文解决什么问题

右侧详情区不能继续按“有哪些数据字段，就把哪些字段铺上去”的方式设计。

Reflecta 的核心价值不是让用户查看一条数据库记录，而是帮助用户回到一个领域里的个人理解现场：

> 我当时形成的理解是什么？它是从哪些上下文里长出来的？它和哪些已有理解在正文中自然发生了连接？

因此，右侧详情区要设计的是一条用户阅读、追溯、修正的交互路径，而不是 Thought / Context / Connection 的字段布局。

本文只讨论 Domain Workspace 右侧详情区，不讨论左侧领域树、中间理解流、全局图谱或 AI 能力。

---

## 2. 用户当前任务

用户进入右侧详情区时，可能处在三种任务中。

### 2.1 回看理解

用户从中间理解流点开一条理解，首先想确认：

- 这是不是我要找的那条理解？
- 我当时到底想明白了什么？
- 这条理解现在读起来是否仍然成立？

这一任务里，用户的主注意力应该落在 Thought 的标题和正文上。

### 2.2 追溯来源

用户读完或读到某句话时，想恢复这条理解从哪里长出来：

- 它来自一次实践、一本书、一段视频、一篇文章，还是一次 AI 对话？
- 当时具体发生了什么？
- 哪段材料或经历真正触发了这条理解？

这一任务里，Context 是必要的，但不应该默认抢走 Thought 的第一视觉焦点。

### 2.3 修正知识

用户回看后可能意识到：

- Thought 正文表达不准确，需要改写。
- 需要补充一个新的 Context。
- 正文里应该通过 `[[双链]]` 引用另一个已有理解。
- 某个旧的 `[[双链]]` 不再准确，需要删除或改写。

这一任务里，编辑入口应贴近当前阅读对象，但不能让默认阅读态变成编辑器或管理后台。

---

## 3. 用户进入时的认知状态

目标用户不是第一次使用笔记或 PKM 工具。他大概率理解：

- 领域 / 分类树。
- 列表和详情。
- Markdown 或近似文本编辑。
- `[[双链]]` / wiki link。
- 来源材料可能很长，不等同于短备注。

但用户进入详情区时，不一定已经完整记得这条理解。他通常只是通过中间列表里的标题或摘要被唤起一点记忆。

因此，右侧第一屏的职责不是展示完整数据，而是帮助用户快速恢复：

> 这条理解是谁？它在说什么？我为什么会留下它？

这决定了右侧详情区的第一视觉焦点必须是 Thought，而不是 Context 列表、来源类型、连接数量或操作按钮。

---

## 4. 真实数据约束

真实数据库里的 Context 不是短字段。

`reflecta-prod` 中的 `contexts` 结构是：

- `source_type`
- `source_name`
- `content`

来源类型是固定选项，而不是自由文本：

- `experience`
- `video`
- `book`
- `article`
- `opinion`
- `ai`

真实长度分布说明 Context 必须按长材料设计：

| source_type | 数量 | 平均 content 长度 | 最大 content 长度 |
| --- | ---: | ---: | ---: |
| experience | 20 | 352 | 1773 |
| video | 8 | 182 | 439 |
| ai | 5 | 1526 | 2001 |
| article | 4 | 5682 | 8721 |
| opinion | 2 | 805 | 1424 |

单条 Thought 的 Context 总长度最高约 `17003` 字。

这意味着：

- Context 不能被当成一行 metadata。
- Context 不能默认完整 inline 展开在 Thought 正文下方。
- Context 也不能完全藏起来，否则用户看不到“理解从哪里长出来”。

右侧详情区必须同时满足：

1. Thought 正文不被长 Context 淹没。
2. 用户能在阅读 Thought 时顺手感知来源。
3. 用户点击某个 Context 时，能直接阅读那一条完整 Context。

---

## 5. 核心交互路径

### 5.1 路径总览

右侧详情区的核心路径应该是：

1. 用户从中间理解流点开一条 Thought。
2. 右侧显示 Thought 详情，标题和正文成为第一视觉焦点。
3. 用户阅读正文，并在正文中自然看到 `[[双链]]`。
4. 用户读到正文下方的 Context 摘影，感知这条理解从哪些来源长出来。
5. 用户点击某一条 Context 摘影。
6. 系统打开这条 Context 的详情阅读面板。
7. 用户阅读完整 Context。
8. 用户关闭 Context 详情，回到 Thought 阅读态。
9. 用户选择继续读 Thought、点 `[[双链]]` 跳转，或进入编辑。

这条路径里有一个关键原则：

> 点具体对象，就打开具体对象；点集合入口，才进入集合视图。

因此，点击某一条 Context 摘影，不应该进入“全部 Context Reader”。它应该直接打开这条 Context 的详情。

### 5.2 默认阅读态

默认阅读态服务“回看理解”。

用户第一眼应该看到：

- Thought 更新时间或弱化元信息。
- Thought 标题。
- Thought 正文。
- 编辑入口。

用户不应该第一眼看到：

- 完整 Context 长文。
- 复杂来源列表。
- 关系管理面板。
- 来源类型筛选。
- 自动评分或知识健康指标。

正文里的 `[[双链]]` 应自然高亮。用户看到它时，会理解这是正文的一部分，而不是独立关系管理模块。

### 5.3 Context 摘影

Context 摘影服务“不断开阅读心流地看到来源”。

它出现在 Thought 正文之后，展示 1-2 条最相关或最近的 Context 摘影。每条摘影包含：

- 来源类型 label。
- 来源标题。
- content 字数。
- content 前几行预览。

Context 摘影不展示完整内容，也不做质量判断。

它应该带来的感受是：

> 这条理解不是悬空结论，它背后有具体材料和经历。

但它不应该让用户觉得：

> 我现在被迫进入资料阅读任务。

### 5.4 Context 详情

Context 详情服务“追溯来源”。

当用户点击某一条 Context 摘影时，系统打开这条 Context 的完整阅读面板。这个面板可以是右侧详情区内部的 overlay / drawer，但它的语义必须是：

> 你正在看刚刚点开的那一条来源。

Context 详情应包含：

- 来源类型。
- 来源标题。
- content 字数。
- 完整 content。
- 关闭入口。

Context 详情不需要默认展示其他 Context 列表。否则用户点击单条 Context 的动作会被误解释成“进入来源管理空间”。

如果后续确实需要查看全部 Context，可以另设明确入口，例如“查看全部来源”。但这个入口不应和点击单条 Context 混在一起。

### 5.5 双链交互

关系由正文中的 `[[双链]]` 表达。

用户点击 `[[某个理解]]` 时，预期是：

> 跳到那条理解。

因此，右侧详情区不应把关系设计成额外的“添加关系”“关系类型”“关系面板”主路径。

双链可以在正文下方有轻量 summary，例如“2 个正文双链”，但这个 summary 是辅助导航，不是关系管理器。

---

## 6. 信息显隐规则

### 6.1 默认完整展示

- Thought 标题。
- Thought 正文。
- 正文里的 `[[双链]]`。

这些是用户回看理解的核心内容。

### 6.2 默认摘影展示

- Context。

Context 默认只展示摘影，因为真实 Context 可能很长。摘影要足够让用户恢复来源感，但不能把 Thought 正文推走。

### 6.3 点击后完整展示

- 单条 Context 完整内容。

点击某条 Context 摘影后，打开该 Context 的详情阅读面板。这个面板独立滚动，关闭后回到 Thought 阅读态。

### 6.4 默认弱化展示

- 更新时间。
- Context 数量。
- 双链数量。
- 编辑入口。

这些信息重要，但不是第一视觉焦点。

### 6.5 默认不展示

- 掌握度评分。
- 来源质量判断。
- 连接数量排名。
- 自动生成关系。
- 关系类型分类。

这些都会把产品从“如实反映用户知识网”推向系统评价或系统管理。

---

## 7. 交互预期表

| 用户动作 | 用户预期 | 系统应该做 | 系统不应该做 |
| --- | --- | --- | --- |
| 点开一条 Thought | 看这条理解 | 显示标题和正文 | 先展示来源管理界面 |
| 扫到 Context 摘影 | 知道理解从哪里来 | 展示类型、标题、短 preview | 展开完整长文 |
| 点击某条 Context 摘影 | 看这一条来源全文 | 打开该 Context 详情 | 进入全部 Context Reader |
| 关闭 Context 详情 | 回到刚才的 Thought | 返回 Thought 阅读态 | 丢失当前 Thought 上下文 |
| 点击正文 `[[双链]]` | 跳到对应理解 | 切换到对应 Thought | 打开关系管理面板 |
| 点击编辑 | 修改当前 Thought | 进入 Thought 编辑态 | 进入全局编辑/管理后台 |

---

## 8. 由路径推导出的 UI 结构

右侧详情区建议分为四个层级。

### 8.1 Thought Reading Surface

默认主 surface。

结构：

```text
Thought Detail
├── Header
│   ├── weak meta: updatedAt / category path
│   ├── title
│   └── edit action
├── Body
│   └── markdown content with [[wiki links]]
├── Context Preview
│   ├── context excerpt 1
│   └── context excerpt 2
└── Lightweight Footer
    ├── context count
    └── wiki link count
```

### 8.2 Context Preview Item

单条 Context 摘影。

结构：

```text
Context Preview Item
├── source type label
├── source name
├── content length
└── first 2-3 lines of content
```

点击后打开这条 Context 的详情。

### 8.3 Context Detail Overlay

单条 Context 阅读面板。

结构：

```text
Context Detail Overlay
├── Header
│   ├── source type
│   ├── source name
│   ├── content length
│   └── close
└── Scrollable Content
    └── full context content
```

它不是全部来源管理器，也不是新的页面主状态。它是从 Thought 阅读态临时打开的一条来源详情。

### 8.4 Thought Edit Surface

编辑态暂不在本文展开，但要遵循同一原则：

- Thought 正文编辑优先。
- Context 作为可追加、可编辑的长内容材料。
- 来源类型使用固定选项。
- 双链通过正文输入产生。

---

## 9. 体验验收条件

右侧详情区设计是否成立，可以用以下问题判断。

1. 用户打开 Thought 后，第一眼是否能明确知道这条理解在说什么？
2. Context 是否让用户感到“这个理解有来源”，而不是“我被迫读一堆资料”？
3. 点击某条 Context 后，系统是否只打开这条 Context，而不是进入模糊的集合 reader？
4. 关闭 Context 后，用户是否能自然回到原 Thought 阅读现场？
5. `[[双链]]` 是否作为正文的一部分自然出现，而不是被转成关系管理任务？
6. 长 Context 是否有独立滚动空间，而不是把 Thought 正文向下推到不可见？
7. 默认界面是否避免了来源质量判断、关系类型、系统评分等未共识概念？

如果以上问题有任何一个不成立，就说明右侧详情区又退回到了字段铺陈或管理后台思路。

---

## 10. 当前 demo 的下一步调整方向

当前 demo 可以按本文收敛为：

- 保留 Thought 阅读态作为默认主态。
- 保留正文下方的 Context 摘影。
- 删除全部 Context Reader 集合状态。
- 点击某条 Context 摘影时，打开单条 Context Detail Overlay。
- Context Detail Overlay 独立滚动，关闭后回到 Thought 阅读态。
- 来源类型继续使用固定选项。
- 关系继续从正文 `[[双链]]` 产生。

后续如果需要“查看全部来源”，必须作为明确的新入口讨论，不能混入点击单条 Context 的默认行为。
