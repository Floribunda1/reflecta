# UI Design Decision Spec

## 文档目的

在 AI 生成任何 UI 代码之前，必须先输出一份设计决策文档。示例见 [UI Spec Guide](./ui-spec-guide.md)

目标是把模糊需求转化为可执行约束，让 AI 从「猜你想要什么」变成「执行你已经决定的事」。

**规则：没有设计决策文档，不输出任何 UI 代码。**

---

## 核心原则

**1. 从大到小**
阅读和书写顺序永远是 Template → Organisms → Molecules → Design Tokens 使用表 → Atoms 索引。
先定义页面长什么样，最后才汇总用了哪些组件。

**2. 选择，不设计**
Atoms 层不做设计决策。shadcn 已经定义好了所有原子组件的形态，
这一层只做两件事：选择用哪个组件、选择用哪个 variant。

**3. 约束优先于描述**
每一层的重点不是「长什么样」，而是「必须这样 / 不能那样」。
描述外观是在帮 AI 猜，写约束是在帮 AI 执行。

---

## 文档结构

每份设计决策文档包含以下 7 个部分，顺序固定，不可省略：

```
1. 页面目标
2. Template
3. Organisms
4. Molecules
5. Design Tokens 使用表
6. Atoms 索引
7. 不做的决策
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

**格式：** 每个 Organism 一个条目，包含树形结构 + 必要状态规则

```
- **OrganismName**
```

树形结构（使用 shadcn 组件名）

```
- 状态规则：
  - 状态 A → 反馈方式
  - 状态 B → 反馈方式
- 约束：...
```

**规则：**

- 树形结构只写组件名和内容语义，不写样式
- 状态规则不是固定清单，只写会影响视觉、布局、交互反馈或用户理解的状态
- 常见状态包括但不限于：`empty`、`disabled`、`hover`、`active`、`focus-visible`、`selected`、`expanded / collapsed`、`open / closed`、`editing`、`dragging`、`destructive-confirm`
- `loading`、`error` 只在页面确实存在远程请求、异步等待、失败恢复或系统异常展示时才写；local-only 页面不要为了完整性添加这类状态
- 如果某个状态完全沿用 shadcn 默认行为，或对当前模块没有额外设计约束，可以不写
- 每个 Organism 必须有明确的容器组件，例如 `aside`、`section`、`main`、`Card`、`Sheet`

**禁止：**

- ❌ 不在 Organism 层定义间距数值，间距在 Molecules 层定义
- ❌ 不创造 shadcn 没有的容器组件
- ❌ 不为了填表写“成功 / 失败 / 加载中”这类无设计信息的空状态

---

### 4. Molecules

**定义：** Organism 内部需要单独展开的交互单元、重复单元或复杂组合。
Molecule 可以跨 Organism 复用，也可以只服务一个 Organism。

**格式：** 每个 Molecule 一个条目

```
- **MoleculeName** = 组成元素列表
  - 布局：具体 Tailwind 布局类
  - 间距：具体 gap / padding 值
  - 状态规则：只写需要额外约束的交互状态
  - 约束：...
```

**规则：**

- 只组合 shadcn 已有组件，不创造新的原子组件
- 必须写明内部间距（这是 Molecules 层唯一需要写数值的地方）
- 可交互、可选中、可展开、可聚焦的 Molecule，必须 review 是否需要写状态规则；不需要额外设计约束时可以省略
- 重复出现的 Card、Row、ListItem、TreeNode 必须优先作为 Molecule 展开
- 即使只出现一次，只要它有独立状态、内部布局复杂、组合了多个 atoms 或实现风险高，也应该作为 Molecule 展开
- 一次性的简单 HeaderRow / MetaRow，如果没有独立状态或实现风险，可以不提升为 Molecule

**禁止：**

- ❌ 不重新定义 shadcn 组件的外观
- ❌ 不在 Molecules 层写页面级布局规则
- ❌ 不把业务条件、校验规则或数据解析结果误写成交互状态；这类内容应写在 Organism 的展示规则或约束中

---

### 5. Design Tokens 使用表

**定义：** 本页面用到的语义 token 及其使用边界，用来检查颜色、文字、间距、圆角、边框、阴影是否一致。

**格式：** 固定四列表格

| Token 类型 | Token / Class | 使用场景 | 禁止用法 |
| ---------- | ------------- | -------- | -------- |
| 类型       | 语义 token    | 出现在哪些层级 / 组件 | 不能承担什么语义 |

**必须覆盖：**

- Text：标题、正文、次级说明、错误 / 危险文案
- Surface：页面背景、区块背景、强调区背景（如果有）
- Border / Radius / Shadow：容器边界和层级表达方式
- Spacing：页面级、区块级、组合内部间距
- State：hover、selected、focus-visible、disabled、empty、unresolved、destructive-confirm 等状态 token（如果出现）

**规则：**

- 同一语义必须使用同一个 token，不能在不同 Organism 中临时换写法
- 同一个 token 只能承担一个清晰语义，不能同时表达次级、禁用、错误等冲突含义
- spacing 必须标注层级：页面级、区块级、Molecule 内部，避免 `gap-*` 混用
- shadcn 组件自带的 token 可以写组件语义，例如 `Button destructive variant`
- 页面未使用某类 token 时可以不列，但使用过的 token 必须完整列出

**禁止：**

- ❌ 不把 hard-coded Tailwind 色阶当 token，例如 `bg-blue-500`
- ❌ 不只写 token 名而不写使用边界
- ❌ 不在此处重新定义 shadcn 组件外观

---

### 6. Atoms 索引

**定义：** 本页面用到的所有 shadcn 组件及其配置，是索引而非设计决策。

**格式：** 固定三列表格

| 组件   | Variant / 配置       | 使用位置                       |
| ------ | -------------------- | ------------------------------ |
| 组件名 | variant 名或配置说明 | 出现在哪个 Organism / Molecule |

**规则：**

- 每个用到的 shadcn 组件必须在此出现，不能有遗漏
- Variant 列必须明确，不允许写「默认」这种模糊描述；如果 shadcn variant 名就是 `default`，写 `default variant`
- 如果同一组件在不同位置用了不同 variant，分两行写

**禁止：**

- ❌ 不在此处解释为什么选这个组件（理由在 Organisms / Molecules 层写）
- ❌ 不创造 shadcn 没有的组件，如果需要自定义，在使用位置列注明「自定义」并在 Organisms 层说明实现方式

---

### 7. 不做的决策

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
□ Organism / Molecule 只写了对设计有影响的状态，没有机械填充空状态
□ 可交互、可选中、可展开、可聚焦的单元已 review 是否需要状态规则
□ Molecules 覆盖了需要单独展开的交互单元、重复单元或复杂组合
□ Molecules 写明了内部间距数值
□ Design Tokens 使用表覆盖了所有颜色、文字、间距、边框、圆角、阴影 token
□ 相同语义在不同区块使用同一个 token
□ 同一个 token 没有承担两种冲突语义
□ spacing token 区分了页面级、区块级、Molecule 内部
□ Atoms 索引覆盖了所有用到的 shadcn 组件
□ Atoms 索引没有「默认」这种模糊 variant 描述
□ 不做的决策至少 3 条，每条有理由
□ 全文没有出现硬编码颜色值（#ffffff、bg-blue-500 等）
```

全部勾选后，方可进入代码生成阶段。
