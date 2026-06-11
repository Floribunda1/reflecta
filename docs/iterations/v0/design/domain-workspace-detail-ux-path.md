# Domain Workspace Document UX Path

> 日期：2026-06-11
>
> 状态：Current
>
> 主题：Domain Workspace 右侧 Understanding Document 的阅读、来源追溯和双链跳转路径。
>
> 输入依据：
>
> - `../product/domain-workspace-product-spec.md`
> - `./pmf-mvp-information-architecture.md`
> - `./design-detail.md`
> - 真实数据库 `<projectRoot>/.local/reflecta-prod/reflecta.db` 中的 `thoughts`、`contexts` 样例数据。
>
> 本文职责：定义右侧 Document 的 UX 路径和信息显隐。本文不定义数据模型、保存策略、关系解析规则或视觉 token。

## 1. 设计问题

右侧 Document 不能按“数据库字段展示区”设计。它要帮助用户回到一条理解的现场：

> 我当时形成的理解是什么？它从哪些来源长出来？它在正文中通过哪些双链连接到其他理解？

因此，Document 的设计重点不是把标题、正文、来源、关系都平铺出来，而是组织一条自然路径：

1. 先恢复理解本身。
2. 再感知来源。
3. 需要时打开单条来源。
4. 在正文中看到双链并可跳转。
5. 必要时直接修改正文、来源或领域归属。

本文只讨论右侧 Document，不讨论左侧领域导航、中间 Index、图谱或 AI 能力。

## 2. 用户任务

### 2.1 回看理解

用户从 Index 点开一条理解后，首先想确认：

- 这是不是我要找的那条理解？
- 我当时到底想明白了什么？
- 这条理解现在读起来是否仍然成立？

Document 的第一视觉焦点必须是理解标题和正文。来源、关系、领域归属和操作入口都要从属于这个焦点。

### 2.2 追溯来源

用户读完或读到某句话时，可能想恢复这条理解从哪里长出来：

- 它来自一次实践、一本书、一段视频、一篇文章、一个观点，还是一次 AI 对话？
- 来源内容大概是什么？
- 我是否需要打开完整来源重新读一遍？

来源必须可见，但不能默认抢走正文。它应该像证据和现场线索，而不是把 Document 变成资料阅读器。

### 2.3 通过双链继续阅读

用户在正文中看到 `[[双链]]` 时，预期是：

> 点击后跳到那条理解。

双链应该作为正文表达的一部分出现。它不是关系表单，也不是手动建边入口。

### 2.4 修正理解

用户回看后可能意识到：

- 标题不准确。
- 正文表达需要改写。
- 需要补充或修改来源。
- 某个双链应该增加、删除或改写。
- 这条理解应该属于另一个领域。

这些修正应该贴着当前 Document 发生，不让用户跳到管理后台。

## 3. 真实内容约束

真实数据库里的来源内容不是短备注。

`contexts` 里的主要字段是：

- `source_type`
- `source_name`
- `content`

来源类型是固定选项：

- `experience`
- `video`
- `book`
- `article`
- `opinion`
- `ai`

历史样例中的来源长度说明，来源不能被当成一行 metadata：

| source_type | 数量 | 平均 content 长度 | 最大 content 长度 |
| ----------- | ---: | ----------------: | ----------------: |
| experience  |   20 |               352 |              1773 |
| video       |    8 |               182 |               439 |
| ai          |    5 |              1526 |              2001 |
| article     |    4 |              5682 |              8721 |
| opinion     |    2 |               805 |              1424 |

单条理解的来源总长度可能很长。因此 Document 必须同时满足：

1. 正文不被长来源淹没。
2. 用户能在正文下方感知来源存在。
3. 点击某条来源时，能阅读这一条完整来源。
4. 关闭来源后，能回到原理解现场。

## 4. Document 默认结构

```text
Understanding Document
├── Identity
│   ├── weak meta: updatedAt / current domain
│   └── title
├── Body
│   └── editable prose with [[double links]]
├── Source Trace
│   ├── source preview item
│   └── source preview item
├── Relation Summary
│   ├── outgoing from body links
│   ├── incoming backlinks
│   └── unresolved body links
└── Domain Assignment
    └── current and other domains
```

注意力顺序：

1. `Body`
2. `Identity`
3. `Source Trace`
4. `Relation Summary`
5. `Domain Assignment`

`Source Trace`、`Relation Summary` 和 `Domain Assignment` 都是理解正文的支撑信息，不应该获得比正文更高的视觉层级。

## 5. 核心路径

### 5.1 打开理解

```text
用户点击 Index 条目
  -> Document 切换到该理解
  -> 标题和正文成为第一视觉焦点
  -> 来源摘要和关系摘要出现在正文之后
```

用户第一眼应该看到：

- 更新时间或当前领域等弱 meta。
- 标题。
- 正文。
- 正文中的 `[[双链]]`。

用户第一眼不应该看到：

- 完整来源长文。
- 来源管理界面。
- 关系管理面板。
- 自动评分。
- 大量操作按钮。

### 5.2 阅读来源摘要

```text
用户读完正文
  -> 扫到 Source Trace
  -> 看到来源类型、来源名、字数和短预览
  -> 判断是否要打开完整来源
```

Source preview item 应展示：

- 来源类型。
- 来源名称。
- content 字数或长度感。
- content 前几行预览。

Source preview item 不展示：

- 完整 content。
- 来源质量判断。
- 来源评分。
- 与当前理解无关的来源。

它应该带来的感受是：

> 这条理解不是悬空结论，它背后有具体材料和经历。

但它不应该让用户觉得：

> 我现在被迫进入资料阅读任务。

### 5.3 打开单条来源

```text
用户点击某条 Source preview
  -> 打开 Source Detail Overlay
  -> 阅读这一条完整来源
  -> 关闭 overlay
  -> 回到原 Understanding Document
```

关键原则：

> 点具体对象，就打开具体对象；点集合入口，才进入集合视图。

因此，点击某条来源摘要，只能打开这一条来源的详情。它不应该进入“全部来源 reader”，也不应该进入来源管理后台。

Source Detail Overlay 应包含：

- 来源类型。
- 来源名称。
- content 字数或长度感。
- 完整 content。
- 关闭入口。

Source Detail Overlay 不需要默认展示：

- 其他来源列表。
- 来源筛选器。
- 来源库导航。
- 当前理解之外的来源。

### 5.4 点击正文双链

```text
用户点击正文里的 [[某个理解]]
  -> Document 切换到目标理解
  -> Index 更新当前选中指针
  -> 用户继续阅读目标理解
```

双链的 UX 语义：

- 它是正文的一部分。
- 它是理解之间的阅读跳转。
- 它可以让 Relation Summary 展示 outgoing。
- 它不是“添加关系”按钮。
- 它不是“关系类型”入口。

如果双链未解析，Document 可以在正文附近或 Relation Summary 中给出轻量状态，但不应该打开关系管理器。

### 5.5 修改正文以改变关系

```text
用户编辑正文
  -> 增加 [[双链]]
  -> 关系展示增加 outgoing

用户编辑正文
  -> 删除 [[双链]]
  -> 关系展示移除对应 outgoing
```

用户对关系的心智应该是：

> 我改了正文里的表达，所以关系随之变化。

不应该是：

> 我在一个关系后台里维护边。

## 6. 信息显隐规则

### 6.1 默认完整展示

- 理解标题。
- 理解正文。
- 正文中的 `[[双链]]`。

这些是 Document 的核心内容。

### 6.2 默认摘要展示

- 来源。
- outgoing / incoming 数量或少量标题。
- 未解析双链状态。
- 领域归属。

这些信息重要，但必须从属于正文。它们默认提供线索，不默认展开成完整管理界面。

### 6.3 点击后完整展示

- 单条来源完整内容。

完整来源只在用户点击某条来源摘要后展示。它需要独立滚动空间，避免把正文推到不可见。

### 6.4 默认弱化展示

- 更新时间。
- 当前领域。
- 来源数量。
- 双链数量。
- 次要操作入口。

这些信息帮助用户定位，但不应该成为第一视觉焦点。

### 6.5 默认不展示

- 来源质量评分。
- 掌握度评分。
- 连接数排名。
- 自动生成关系。
- 关系类型分类。
- 手动关系创建入口。
- 手动关系删除入口。

这些都会把 Document 从“理解现场”推向管理后台或系统评价。

## 7. 交互预期表

| 用户动作            | 用户预期         | 系统应该做                 | 系统不应该做           |
| ------------------- | ---------------- | -------------------------- | ---------------------- |
| 点开一条理解        | 看这条理解       | 显示标题和正文             | 先展示来源管理界面     |
| 扫到来源摘要        | 知道理解从哪里来 | 展示类型、名称、短 preview | 展开完整长文           |
| 点击某条来源摘要    | 看这一条来源全文 | 打开该来源详情 overlay     | 进入全部来源 reader    |
| 关闭来源详情        | 回到刚才的理解   | 返回原 Document            | 丢失当前理解上下文     |
| 点击正文 `[[双链]]` | 跳到对应理解     | 切换到目标理解             | 打开关系管理面板       |
| 删除正文 `[[双链]]` | 删除这段正文引用 | 关系展示随正文变化         | 要求去关系后台再删一次 |
| 编辑标题或正文      | 直接修正这条理解 | 保持在当前 Document        | 跳到独立编辑页面       |

## 8. UI 结构建议

### 8.1 Understanding Reading Surface

默认主 surface。

```text
Understanding Document
├── Header
│   ├── weak meta: updatedAt / domain path
│   └── title
├── Body
│   └── editable content with [[wiki links]]
├── Source Trace
│   ├── source preview item
│   └── source preview item
├── Relation Summary
│   ├── outgoing body links
│   ├── incoming backlinks
│   └── unresolved links
└── Domain Assignment
```

### 8.2 Source Preview Item

单条来源摘要。

```text
Source Preview Item
├── source type
├── source name
├── content length
└── first 2-3 lines of content
```

点击后打开这一条来源详情。

### 8.3 Source Detail Overlay

单条来源阅读面板。

```text
Source Detail Overlay
├── Header
│   ├── source type
│   ├── source name
│   ├── content length
│   └── close
└── Scrollable Content
    └── full source content
```

它不是全部来源管理器，也不是新的页面主状态。它是从 Document 临时打开的一条来源详情。

### 8.4 Relation Summary

双链关系摘要。

```text
Relation Summary
├── outgoing: body links from current understanding
├── incoming: backlinks from other understandings
└── unresolved: body links that cannot resolve cleanly
```

Relation Summary 只展示和导航，不创建关系，不删除关系。

## 9. 体验验收

右侧 Document 设计是否成立，用以下问题判断：

1. 用户打开理解后，第一眼是否能明确知道这条理解在说什么？
2. 来源是否让用户感到“这个理解有根”，而不是“我被迫读资料”？
3. 点击某条来源后，系统是否只打开这一条来源？
4. 关闭来源后，用户是否自然回到原理解现场？
5. `[[双链]]` 是否作为正文的一部分自然出现？
6. 点击 `[[双链]]` 是否直接跳到目标理解？
7. 删除 `[[双链]]` 后，关系展示是否随正文变化？
8. 长来源是否有独立滚动空间，而不是把正文推走？
9. 默认界面是否避免了来源评分、关系类型、系统评分等未共识概念？

如果以上任何一条不成立，Document 就可能退回到了字段铺陈、来源后台或关系后台。
