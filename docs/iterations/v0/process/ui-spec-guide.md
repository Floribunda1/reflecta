# UI Design Decision Spec

## 文档目的

在 AI 生成任何 UI 代码之前，必须先输出一份设计决策文档。示例见 [UI Spec Example](./ui-spec-example.md)

目标是把模糊需求转化为可执行约束，让 AI 从「猜你想要什么」变成「执行你已经决定的事」。

**规则：没有设计决策文档，不输出任何 UI 代码。**

---

## 核心原则

**1. 从大到小，就地展开**
阅读和书写顺序永远是 Template → Organisms → Token Review → Atoms 索引。
先定义页面长什么样，最后才汇总用了哪些组件。
Organism 内部复杂、重复或高风险的交互单元，在所属 Organism 下用 `Detail` 展开，不单独提升成顶层章节。

**2. 选择，不设计**
Atoms 层不做设计决策。shadcn 已经定义好了所有原子组件的形态，
这一层只做两件事：选择用哪个组件、选择用哪个 variant。
默认优先使用 shadcn 已有的 hover、active、focus-visible、disabled、destructive 等状态，不重新定义这些基础状态。

**3. 约束优先于描述**
每一层的重点不是「长什么样」，而是「必须这样 / 不能那样」。
描述外观是在帮 AI 猜，写约束是在帮 AI 执行。

---

## 文档结构

每份设计决策文档包含以下 6 个部分，顺序固定，不可省略：

```
1. 页面目标
2. Template
3. Organisms
4. Token Review
5. Atoms 索引
6. 不做的决策
```

---

## 各部分格式规范

---

### 1. 页面目标

**格式：** 3 句以内的纯文字

**必须回答：**

- 用户是谁，要完成什么任务
- 操作频率（高频 / 低频）
- 主要使用场景（桌面 / 移动 / 两者）

**禁止：**

- ❌ 不写功能列表
- ❌ 不写技术实现细节
- ❌ 不超过 3 句话

---

### 2. Template

**定义：** 页面级骨架，包含布局容器、区块排列顺序、整体节奏。

**格式：** 代码块（树形结构）+ 排列逻辑说明

**必须包含：**

```
PageName
  容器约束        → max-w-xx、margin、padding（分移动端/桌面端）
  PageHeader      → 标题样式、与内容区间距
  内容区
    └─ 区块排列   → 列出所有 Organism，标注间距
```

**排列逻辑必须单独说明**，写清楚为什么是这个顺序。

**禁止：**

- ❌ 不在 Template 层定义组件内部结构
- ❌ 不写具体颜色值，只写语义 Token 名
- ❌ 容器最大宽度必须是明确的 Tailwind 类，不写「居中布局」这种模糊描述

---

### 3. Organisms

**定义：** 页面内独立的功能区块，每个 Organism 对应一个完整的用户任务。
Organism 下可以用 `Detail` 展开内部复杂、重复或高风险的交互单元。

**格式：** 每个 Organism 使用三级标题，包含容器 token、树形结构、必要状态规则、约束和可选 Detail。

```
### OrganismName

- 容器 token：
  - Surface：...
  - Spacing：...
  - Border / Radius / Shadow：...
```

树形结构（使用 shadcn 组件名）

```
- 状态规则：
  - 状态 A → 反馈方式
  - 状态 B → 反馈方式
- 约束：...
```

如果 Organism 内有需要单独约束的内部单元，在同一个 Organism 标题下追加四级标题：

```
#### Detail: DetailName

- 组成：Atom / 业务组件组合
- 布局：具体 Tailwind 布局类
- 间距：具体 gap / padding 值
- 状态规则：只写超出 shadcn 默认行为、或需要业务语义映射的交互状态
- 展示规则：只写影响视觉或用户理解的内容裁剪、placeholder、fallback
- 约束：...
```

**规则：**

- Organism 标题必须使用 `### OrganismName`，不能写成列表项或加粗文本；Detail 必须使用 `#### Detail: DetailName`
- Organism 的容器 token 必须写在 Organism 自己下面，包括 surface、padding、gap、border、radius、shadow 等会影响区块边界的样式
- 树形结构只写组件名和内容语义，不写样式；具体布局和间距进入 Organism 容器 token 或对应 Detail
- 状态规则不是固定清单，只写会影响视觉、布局、交互反馈或用户理解，且不能直接由 shadcn 默认 variant 表达的状态
- 常见状态包括但不限于：`empty`、`disabled`、`hover`、`active`、`focus-visible`、`selected`、`expanded / collapsed`、`open / closed`、`editing`、`dragging`、`destructive-confirm`
- `loading`、`error` 只在页面确实存在远程请求、异步等待、失败恢复或系统异常展示时才写；local-only 页面不要为了完整性添加这类状态
- 如果某个状态完全沿用 shadcn 默认行为，或对当前模块没有额外设计约束，必须不写
- 每个 Organism 必须有明确的容器组件，例如 `aside`、`section`、`main`、`Card`、`Sheet`
- 重复出现的 Card、Row、ListItem、TreeNode 必须优先作为 Detail 展开
- 即使只出现一次，只要它有独立状态、内部布局复杂、组合了多个 atoms 或实现风险高，也应该作为 Detail 展开
- 一次性的简单 HeaderRow / MetaRow，如果没有独立状态或实现风险，可以直接写在树形结构里，不必展开
- 可交互、可选中、可展开、可聚焦的 Detail，必须优先 review shadcn 默认 variant 是否已经足够；只有默认行为不足以表达业务状态时才写状态规则
- 如果某个 Detail 被多个 Organism 共用，在第一次出现处定义，后续写 `复用 Detail: DetailName`

**禁止：**

- ❌ 不在 Organism 的树形结构里堆 Tailwind class；区块容器 token 写在 Organism 下，内部组合布局和间距写在 Detail 下
- ❌ 不创造 shadcn 没有的容器组件
- ❌ 不重写 shadcn 已经定义好的 Button / Input / Select / Dialog 等基础组件状态
- ❌ 不为了填表写“成功 / 失败 / 加载中”这类无设计信息的空状态
- ❌ 不把业务条件、校验规则或数据解析结果误写成交互状态；这类内容应写在展示规则或约束中

---

### 4. Token Review

**定义：** 页面级视觉一致性检查项。它不是 token 全量盘点表，而是代码生成前后都能执行的 review 标准。

**格式：** 按风险分组的清单。每组必须写清楚“统一规则”和“禁止破坏方式”。

```
#### Surface Hierarchy

- 统一规则：...
- 禁止：...

#### Spacing Rhythm

- 统一规则：...
- 禁止：...
```

**必须 review：**

- Surface Hierarchy：页面背景、主工作区背景、局部辅助面、覆盖层的层级关系
- Typography：标题、正文、弱 meta、危险文案是否各自只有一个清晰语义
- Spacing Rhythm：页面级、区块级、Detail 内部间距是否分层
- Interaction State：业务状态是否清楚映射到 shadcn variant 或少量自定义状态；是否误重写 shadcn 默认 hover、active、focus-visible、disabled
- Component Variants：Button、Card、Sheet、AlertDialog 等 shadcn variant 是否承担稳定语义
- Hard-coded Values：是否出现 `#ffffff`、`bg-blue-500` 等脱离 token 系统的写法

**规则：**

- 只写本页面真正会影响一致性的 token 决策，不追求穷举
- shadcn 默认状态不进入 Token Review；Token Review 只检查组件选择、variant 语义和少量业务态自定义是否一致
- 同一语义必须使用同一个 token / variant / class 组合，不能在不同 Organism 中临时换写法
- 同一个 token 只能承担一个清晰语义，不能同时表达次级、禁用、错误等冲突含义
- spacing 必须标注层级：页面级、区块级、Detail 内部，避免 `gap-*` 混用
- shadcn 组件自带的 token 可以写组件语义，例如 `Button destructive variant`

**禁止：**

- ❌ 不把 Token Review 写成“本页面所有 class 的清单”
- ❌ 不把 hard-coded Tailwind 色阶当 token，例如 `bg-blue-500`
- ❌ 不只写 token 名而不写 review 判断
- ❌ 不在此处重新定义 shadcn 组件外观

---

### 5. Atoms 索引

**定义：** 本页面用到的所有 shadcn 组件及其配置，是索引而非设计决策。

**格式：** 固定三列表格

| 组件   | Variant / 配置       | 使用位置                     |
| ------ | -------------------- | ---------------------------- |
| 组件名 | variant 名或配置说明 | 出现在哪个 Organism / Detail |

**规则：**

- 每个用到的 shadcn 组件必须在此出现，不能有遗漏
- Variant 列必须明确，不允许写「默认」这种模糊描述；如果 shadcn variant 名就是 `default`，写 `default variant`
- 如果同一组件在不同位置用了不同 variant，分两行写

**禁止：**

- ❌ 不在此处解释为什么选这个组件（理由在 Organisms / Detail 层写）
- ❌ 不创造 shadcn 没有的组件，如果需要自定义，在使用位置列注明「自定义」并在 Organisms 层说明实现方式

---

### 6. 不做的决策

**定义：** 明确排除的设计选项，防止 AI 自由发挥。

**格式：** 列表，每条固定格式

```
- ❌ **不做什么** → 为什么不做（一句话）
```

**规则：**

- 最少 3 条，没有上限
- 每条必须有理由，不接受「因为不需要」这种空洞理由
- 优先排除：嵌套层级、额外阴影、Modal 滥用、硬编码颜色、组件层级混用

---

## 完整性检查清单

提交设计决策文档、开始写代码之前，逐项确认：

```
□ 页面目标在 3 句以内，回答了用户/任务/场景
□ Template 包含具体的 max-w、padding、gap 值
□ Template 说明了区块排列逻辑
□ 每个 Organism 有完整的树形结构
□ Organism / Detail 只写了对设计有影响的状态，没有机械填充空状态
□ 可交互、可选中、可展开、可聚焦的单元已 review 是否需要状态规则
□ Detail 覆盖了需要单独展开的交互单元、重复单元或复杂组合
□ Detail 写明了内部间距数值
□ Token Review 覆盖了 surface、typography、spacing、interaction state、component variant 和 hard-coded value 风险
□ 相同语义在不同区块使用同一个 token / variant / class 组合
□ 同一个 token 没有承担两种冲突语义
□ spacing token 区分了页面级、区块级、Detail 内部
□ Atoms 索引覆盖了所有用到的 shadcn 组件
□ Atoms 索引没有「默认」这种模糊 variant 描述
□ 不做的决策至少 3 条，每条有理由
□ 全文没有出现硬编码颜色值（#ffffff、bg-blue-500 等）
```

全部勾选后，方可进入代码生成阶段。
