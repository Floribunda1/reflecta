# UI Design Decision: Graph / Contemplate 页面

> 日期：2026-06-16
>
> 状态：Draft for discussion
>
> 输入文档：
>
> - `docs/iterations/v1.0.0/product/graph-value-proposition.md`
> - `docs/iterations/v1.0.0/product/graph-feature-set.md`
> - `docs/iterations/v1.0.0/product/graph-functional-prd.md`
> - `docs/references/product/ui-spec-guide.md`

## 1. 页面目标

用户在桌面端高频回看自己的 Understanding 如何通过 Connection 形成结构，并从图谱进入原 Understanding 继续整理。
页面第一任务是看图、筛范围、点节点、打开原笔记，不承担统计、评分或复杂关系管理。
整体体验必须像熟悉的笔记图谱工作区：画布安静、控制轻量、节点状态清楚、详情持续可见。

页面还需要承载 Domain-scoped wander：用户先锁定一个领域，再通过视觉结构自己发现哪些 Understanding 值得回看。产品不做“值得回看”的自动推荐，只提供清楚的空间组织。

---

## 2. Template

```text
GraphPage
  h-full w-full overflow-hidden bg-background

  CanvasLayer
    absolute inset-0
    GraphCanvas                 → h-full w-full

  OverlayControls
    absolute left-4 top-3 z-20
    max-w-[min(920px,calc(100vw-2rem))]
    FilterBar                   → 单行优先，必要时第二行展开

  CanvasUtility
    GraphToolbar                → absolute left-4 bottom-4 z-10
    GraphLegend                 → absolute right-4 bottom-4 z-10

  NodeInspector（仅 selected）
    absolute right-0 top-0 bottom-0 z-30
    w-[min(560px,42vw)] min-w-[420px] max-w-[640px]

  EmptyStateLayer（仅 empty）
    absolute inset-0 z-10
    center content，避开 FilterBar 和 GraphLegend
```

排列逻辑：画布是唯一页面主体，所有控制都叠在画布上但不能遮挡主叙事。顶部只放缩小范围的轻控制；右侧详情只在选中节点后出现，并保持为持续面板而不是 modal；图例和缩放工具放底部两角，承担辅助解释和画布操作，不抢第一眼注意力。

---

## 3. Organisms

### GraphCanvas

- 容器 token：
  - Surface：`bg-background`
  - Spacing：无内部 padding；G6 画布使用自身 `padding: 96`
  - Border / Radius / Shadow：无 border、无 radius、无 shadow

```text
main
  G6Canvas
    UnderstandingNode
    ConnectionEdge
```

- 状态规则：
  - `default` → 所有可见 Understanding 节点与两端均可见的 Connection 边同时展示。
  - `domain-wander` → 当前 Domain 内 Understanding 是主视觉；局部 cluster、孤岛和桥接关系必须可扫视；外部 Domain 相关概念只作为边缘 ghost / chip 出现。
  - `selected` → 选中节点使用 primary stroke 和轻 halo；直接 Connection 边加粗加深；其他节点不因邻接关系改变样式。
  - `without-context` → 节点使用低饱和暖色边界表达缺少 Context，同时不使用 destructive 语义。
  - `dense graph` → label 允许裁剪，但节点圆点不能缩小到低于 28px；默认边保持可读，不能弱到需要依赖节点状态判断连接。
- 布局规则：
  - 先根据可见 Connection 计算 connected component；有连接的节点按 component 成组。
  - 无连接节点按首个 Category 成组；无 Category 的节点进入 uncategorized 组。
  - 组之间使用稳定的 spiral / golden-angle seeding，不能从均匀圆环开始。
  - 组内 connection count 只影响布局位置：连接多的节点更靠近局部中心；不改变节点大小、颜色或业务状态。
  - 节点较多时，overview 只保留连接节点、少量代表节点和小组节点 label；其余节点通过 hover preview 读取内容。
  - Domain wander 模式下，不能把当前 Domain 的节点平均网格铺开；应使用显式 Connection 形成局部 cluster，让用户自己看见哪些理解成组。
  - Domain wander 模式下，其他 Domain 的相关概念不能进入主 cluster，只能放在边缘，作为可望见但不抢主视觉的线索。
- 约束：
  - 第一屏只出现 Node 和 Edge，不出现 Context 节点、Category 节点、统计卡片或 cluster 标题。
  - 画布背景不能使用装饰渐变、网格纹理、大面积品牌色或图片。
  - 节点业务状态只表达 Context：有 Context、无 Context；Connection 通过边表达；选中只是交互态。
  - Connection 边只能表达用户已确认关系，不能通过虚线、推荐色或 AI 标记表达未确认关系。
  - 不能通过 AI 推荐、评分、排序或“值得回看”标签替用户决定探索入口。

#### Detail: UnderstandingNode

- 组成：G6 node + label
- 布局：圆形节点居中，label 固定在节点下方
- 间距：label offset `6px`；label 与节点不重叠
- 状态规则：
  - `normal` → 实心节点 + 稳定描边，作为默认更高可信状态。
  - `without-context` → 不填强色，只使用低饱和暖色描边；不使用 `text-destructive` 或红色系。
  - `selected` → primary stroke + halo；label 使用 foreground
- 展示规则：
  - label 只展示 title；无 title 时展示 body 截断。
  - label 最长 18 个字符，超出用省略号。
  - 连接状态不改变节点形态；未连接只通过没有边体现。
- 约束：
  - 不用图标塞进节点内部，避免与状态编码冲突。
  - 不用节点尺寸表达 Connection 数量，V1 不做数量强弱叙事。

#### Detail: ConnectionEdge

- 组成：G6 edge
- 布局：节点间单线连接，可保留方向箭头
- 间距：由布局引擎决定，不手写 edge label 间距
- 状态规则：
  - `normal` → 使用中等对比线条，默认即可读。
  - `active` → 与 hover / selected 节点直接相连的边加粗加深。
  - `inactive` → 仅边降低 opacity，不改变任何节点状态，不使用 destructive 或 warning 色。
- 展示规则：
  - 默认不常驻显示 relation label；relation 进入 hover preview 或详情连接列表。
  - 边只有两端节点都在当前筛选范围内时展示。
  - 未连接节点不额外做 dashed、warning 或其他节点状态。
- 约束：
  - 不用边粗细表达关系强度。
  - 不使用动画流线表达关系活跃度。

### FilterBar

- 容器 token：
  - Surface：`bg-background`
  - Spacing：`px-2 py-2 gap-2`
  - Border / Radius / Shadow：`border border-border rounded-md shadow-sm`

```text
section
  Button                 收起 / 展开筛选
  Button                 新建 Understanding
  FilterControls（expanded）
    IconButton           状态筛选
    Button               重置筛选
    CategoryTreeSelect   Category 筛选
    IconButton           当前类 / 包含子类
  Badge（collapsed + active filters）
```

- 状态规则：
  - `expanded` → 状态、Category、包含子类在同一个控制面内出现；状态和包含子类使用低权重 icon button，Category 保留文字入口。
  - `collapsed` → 只显示展开按钮、新建按钮；有筛选时显示 secondary Badge 说明筛选数量。
  - `active filter` → 对应触发器可使用 `bg-muted text-foreground` 表达已生效，不能使用 primary 填充。
  - `reset disabled` → 没有状态或 Category 筛选时，重置按钮 disabled。
- 约束：
  - FilterBar 最大宽度不能超过 `720px`，避免截图中左上浮层成为第一视觉主体。
  - 控制条不能出现 PageHeader、说明段落或功能教学文案。
  - 新建入口保留在 FilterBar 左侧，但不得比筛选更抢眼。

#### Detail: StatusFilter

- 组成：Button ghost icon-sm + DropdownMenu + DropdownMenuRadioGroup
- 布局：按钮 `size-8`；菜单 `w-36`
- 状态规则：
  - `all` → 按钮保持 ghost variant，不显示状态文字。
  - `filtered` → 按钮增加 `bg-muted text-foreground`。
- 展示规则：
  - 筛选项固定为：全部 Context、有 Context、无 Context。
  - Toolbar 上不常驻显示「全部 Context」这类 meta description；具体文字只在菜单和无障碍标签中出现。
- 约束：
  - 不增加掌握度、质量、重要性等筛选项。

#### Detail: CategoryFilter

- 组成：CategoryTreeSelect inline + Button ghost icon-sm toggle
- 布局：`flex w-full min-w-0 items-center gap-2 border-t border-border pt-2`
- 间距：CategoryTreeSelect `min-w-64 max-w-[460px] flex-1`
- 状态规则：
  - `no category` → placeholder「全部 Category」
  - `selected categories` → 使用 Badge secondary 展示已选项
  - `include descendants` → 使用 `GitBranch` icon toggle；默认「包含子类」不高亮，切换为「仅当前类」时增加 `bg-muted text-foreground`
  - `scoped to current category` → 仅当已选择 Category 且切换为「仅当前类」时，计为额外筛选条件
- 展示规则：
  - Category 只作为筛选范围和节点上下文，不作为图中节点。
  - 多选 Category 时，选择结果可换行，但 FilterBar 高度最多两行控制。
- 约束：
  - 不在 Category 选择器内解释 Category 关系。
  - 不使用 Tree panel 常驻侧栏替代轻筛选。

### NodeInspector

- 容器 token：
  - Surface：`bg-background`
  - Spacing：内部交给 ThoughtDetail / 详情组件；面板本身不额外包 Card
  - Border / Radius / Shadow：`border-l border-border shadow-none`

```text
aside
  ResizeHandle
  InspectorHeader
    Title
    MetaBadges
    CloseButton
  ScrollArea
    Summary
    CategorySection
    ContextStatus
    ConnectionSection
  InspectorFooter
    Button 打开原 Understanding
```

- 状态规则：
  - `closed` → 不渲染侧栏，画布占满全屏。
  - `selected` → 侧栏从右侧常驻，画布选中状态保持。
  - `switch node` → 侧栏不关闭，只替换内容，避免用户在图和详情之间丢失上下文。
  - `resizing` → resize handle 显示 primary/10 背景，body 禁止文本选择。
- 约束：
  - 详情不使用 Modal 或居中 Dialog；不能遮断用户对当前节点位置的理解。
  - 侧栏宽度桌面端控制在 `420px-640px`，不能超过视口 42%。
  - 不在详情内直接编辑标题、正文、Context 或 Connection；整理动作回到原 Understanding。

#### Detail: InspectorHeader

- 组成：标题、状态 Badge、更新时间、关闭 Button
- 布局：`flex items-start gap-3 px-5 py-4 border-b border-border`
- 间距：标题和 meta `gap-2`；关闭按钮固定右上
- 状态规则：
  - `without-context` → Badge destructive 不可用；使用 outline / secondary + 低饱和暖色业务类表达缺 Context。
- 展示规则：
  - 标题最多两行。
  - 无标题时展示正文开头作为标题 fallback。
- 约束：
  - 不在 header 放统计数字卡片。

#### Detail: ConnectionList

- 组成：ScrollArea + connection row list
- 布局：`flex flex-col gap-2`
- 间距：row `px-3 py-2`
- 状态规则：
  - `has connections` → 每行可点击定位对端节点。
  - `empty` → 显示普通空状态文案「暂未连接到其他 Understanding」，不使用 warning 或 error。
- 展示规则：
  - 每行展示对端 title、对端 Category、relationLabel（如果存在）。
  - relationLabel 不存在时不占位。
  - 点击对端后，画布选中对端节点，NodeInspector 内容同步切换。
- 约束：
  - 只展示一跳 Connection，不做路径、推荐关系或二跳展开。

### GraphLegend

- 容器 token：
  - Surface：`bg-background`
  - Spacing：`px-3 py-2 gap-2`
  - Border / Radius / Shadow：`border border-border rounded-md shadow-sm`

```text
aside
  LegendItem 无 Context
```

- 状态规则：
  - `default` → 常驻右下角，pointer-events none。
  - `inspector open` → 自动向左避开 NodeInspector，或跟随右侧面板边缘重新定位。
- 约束：
  - 图例只解释无 Context 节点，不解释选中态或未连接。
  - 不做成大型帮助卡片；宽度以内容为准。

#### Detail: LegendItem

- 组成：icon / dot + text
- 布局：`flex items-center gap-2`
- 间距：item 间距 `gap-2`
- 展示规则：
  - 图例 dot 必须复用无 Context 节点视觉规则。
  - 文案固定为：无 Context。
- 约束：
  - 不在图例里出现评分、质量或推荐关系。

### GraphToolbar

- 容器 token：
  - Surface：`bg-background`
  - Spacing：`gap-1 p-1`
  - Border / Radius / Shadow：`border border-border rounded-md shadow-sm`

```text
nav
  Button 放大
  Button 缩小
  Button 适配画布
  Button 重置布局
```

- 状态规则：
  - 全部按钮沿用 shadcn ghost / icon-sm hover、active、focus-visible。
- 约束：
  - 工具栏只放画布操作，不混入筛选、创建或详情操作。
  - 图标按钮必须有 tooltip 或 aria-label。

### HoverPreview

- 容器 token：
  - Surface：`bg-popover`
  - Spacing：`p-3 gap-2`
  - Border / Radius / Shadow：`border border-border rounded-md shadow-md`

```text
Popover
  Title
  MetaBadges
  SummarySnippet
```

- 状态规则：
  - `hover node` → 未选中任何节点时显示。
  - `selected node` → 不显示 hover preview，避免和 NodeInspector 竞争。
- 展示规则：
  - 宽度 `w-80`，标题最多两行，摘要最多三行。
  - Meta 只展示 Context 数量、Connection 数量和 Category。
- 约束：
  - HoverPreview 不能包含编辑、打开原文或创建连接等操作。
  - 不用 `rounded-xl` 或大 shadow，避免比 FilterBar 和 Inspector 更重。

### EmptyStateLayer

- 容器 token：
  - Surface：透明，不额外创建 Card
  - Spacing：`px-6`
  - Border / Radius / Shadow：无

```text
section
  Icon
  Title
  Description
  OptionalAction
```

- 状态规则：
  - `global empty` → 说明还没有可展示的 Understanding，可提供创建入口或返回主工作区入口。
  - `filter empty` → 保留筛选区，说明当前筛选无匹配，提供清空筛选入口。
  - `no connections` → 画布仍显示孤立节点，不进入全画布空状态；只用轻提示表达暂无 Connection。
- 约束：
  - 空状态不是错误状态，不使用 destructive。
  - 有节点但无 Connection 时不能隐藏节点。

---

## 4. Token Review

#### Surface Hierarchy

- 统一规则：页面背景、FilterBar、GraphLegend、GraphToolbar、HoverPreview、NodeInspector 都使用不透明 surface；画布无卡片边界。
- 禁止：在 Electron 透明窗口里使用 `bg-*/xx` 或 `backdrop-blur` 作为页面主 surface；给画布加 Card、给页面加大渐变背景、在 FilterBar 内再嵌套 Card、用重阴影制造多层浮岛。

#### Typography

- 统一规则：节点 label 使用小号 muted 文本；选中节点 label 可升级为 foreground；详情标题承担最高文本层级；meta 使用 `text-muted-foreground`。
- 禁止：在画布层放页面级 H1；用大标题解释 Graph 功能；用红色或 destructive 文案表达无 Context。

#### Spacing Rhythm

- 统一规则：页面级 overlay 偏移使用 `left-4 top-3 bottom-4 right-4`；浮层容器 padding 使用 `p-2 / px-3 py-2 / p-3`；详情内部区块使用 `px-5 py-4`；Detail 内部 gap 使用 `gap-1.5 / gap-2 / gap-3`。
- 禁止：FilterBar 任意扩张到半屏宽；图例和工具栏贴边；详情侧栏内部再使用大面积 `p-8`。

#### Interaction State

- 统一规则：shadcn 默认 hover、active、focus-visible、disabled 不重写；业务状态只补充 without-context、active-filter；连接关系只通过边表达。
- 禁止：把 active filter 做成 primary 填充；把 without-context 做成 destructive；把未连接做成节点状态；用动画表达节点重要性。

#### Component Variants

- 统一规则：主要行动「打开原 Understanding」使用 Button default；低权重图标操作使用 Button ghost + icon-sm；状态筛选触发器使用 Button outline；事实状态标签优先使用 Badge secondary / outline。
- 禁止：为普通筛选创建自定义 select；修改 shadcn Button、Input、DropdownMenu 基础组件样式；用 Dialog 承载 NodeInspector。

#### Hard-coded Values

- 统一规则：React/Tailwind 层使用语义 token；G6 canvas 层通过 `resolveColors()` 读取 CSS vars，仅允许少量业务状态色在 `colors.ts` 集中定义。
- 禁止：在组件里散落 `#ffffff`、`bg-blue-500`、`text-red-500`；在多个文件重复定义无 Context 节点颜色；用单一蓝紫渐变统治整页。

---

## 5. Atoms 索引

| 组件                   | Variant / 配置                 | 使用位置                                                                    |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Button                 | default variant                | NodeInspector / 打开原 Understanding                                        |
| Button                 | ghost variant + size `icon-sm` | FilterBar 收起展开、新建、重置、NodeInspector 关闭、GraphToolbar 图标按钮   |
| Button                 | ghost variant + size `icon-sm` | FilterBar / StatusFilter 触发器、CategoryFilter 范围 toggle                 |
| DropdownMenu           | default variant                | FilterBar / StatusFilter                                                    |
| DropdownMenuRadioGroup | default variant                | FilterBar / StatusFilter                                                    |
| DropdownMenuRadioItem  | default variant                | FilterBar / StatusFilter                                                    |
| Badge                  | secondary variant              | FilterBar collapsed active count、Category selected items、详情普通事实状态 |
| Badge                  | outline variant                | NodeInspector / Context 状态                                                |
| Popover                | default variant                | HoverPreview                                                                |
| ScrollArea             | default variant                | NodeInspector 内容、ConnectionList                                          |
| Separator              | default variant                | NodeInspector 内容分区（如 ThoughtDetail 需要）                             |
| Tooltip                | default variant                | GraphToolbar 图标说明                                                       |
| CategoryTreeSelect     | default variant                | FilterBar / CategoryFilter                                                  |
| G6 Canvas              | 自定义 canvas renderer         | GraphCanvas / UnderstandingNode / ConnectionEdge                            |

---

## 6. 不做的决策

- ❌ **不做 Dashboard 卡片** → V1 Graph 的核心不是数量、比例或完成度，而是个人理解结构。
- ❌ **不把 Context / Category 做成一级节点** → 第一屏主对象必须只有 Understanding 和 Connection。
- ❌ **不使用 Modal 展示节点详情** → Modal 会切断用户对当前节点在图中位置的理解。
- ❌ **不把无 Context 表达为错误** → 它是事实边界和下一步整理入口，不是失败。
- ❌ **不在 Graph 内编辑 Connection** → V1 的整理动作回到原 Understanding，Graph 不变成关系管理后台。
- ❌ **V1 不做搜索入口** → 当前阶段先验证看图、筛范围、点节点、打开原笔记这条主流程。
- ❌ **不使用大面积品牌渐变或装饰背景** → 画布需要服务节点和边的可读性，不能让背景成为视觉主体。
- ❌ **不重写 shadcn 基础组件状态** → 通用 hover、active、focus-visible、disabled 交给 shadcn design system。
- ❌ **不使用节点大小表达重要性或连接数** → V1 不替用户判断权重，节点状态只表达事实。
- ❌ **不展示 AI 未确认关系** → Connection 必须来自用户显式理解或确认。
