# Design Decision: Capture / Domain Workspace

> 日期：2026-06-13
>
> 状态：Current
>
> 输入依据：
>
> - `../../../3-frontend/UI Review 规范.md`
> - `../process/ui-spec-guide.md`
> - `../product/value-proposition.md`
> - `../product/pmf-mvp-scope.md`
> - `../product/domain-workspace-product-spec.md`
> - `./pmf-mvp-information-architecture.md`
> - `./domain-workspace-detail-ux-path.md`
>
> 命名说明：v0 产品语义使用 `Understanding / Source / Domain / Relation`，当前 capture 模块代码仍使用 `Thought / Context / Category / Connection`。本文以用户可见语义“理解 / 来源 / 领域 / 双链关系”为准，组件名沿用当前代码模块边界。

## 页面目标

持续学习、实践、复盘和 AI 对话的深度思考者，在桌面端高频写下、回看和修正某个领域里的个人理解。页面要让用户先稳定领域语境，再扫描理解索引，最后在同一工作台里编辑正文、追溯来源和查看正文双链关系。

---

## Template

页面级布局和区块排列顺序。

```text
CapturePage
  w-full h-full max-w-none
  px-0 py-0
  overflow-hidden

  WorkspaceShell
    grid h-full
    grid-cols-[248px_minmax(0,1fr)]
    gap-4
    bg-background/45 backdrop-blur-2xl

    CategoryNavigation
      h-full min-w-0
      px-4 pt-10 pb-4

    WorkspaceStage
      grid h-full min-w-0
      grid-cols-[minmax(280px,360px)_minmax(0,1fr)]
      bg-card/95 backdrop-blur-sm
      rounded-xl border shadow-sm overflow-hidden

      ThoughtIndex
        h-full min-w-0
        border-r

      ThoughtDocument
        h-full min-w-0
        overflow-hidden

  SourceDetailSheet
    从右侧覆盖 Document 层
```

排列逻辑：领域是语境层，必须放在最左侧并常驻；窗口背景采用 Electron 透明窗口 + macOS vibrancy，BrowserWindow 使用 `titleBarStyle: hiddenInset` 保留红绿灯，AppLayout 作为 drag region，所有交互控件和滚动区标记 no-drag。WorkspaceShell 使用 `bg-background/45 backdrop-blur-2xl` 形成 Cursor 式半透明底层材质；只有左侧 CategoryNavigation 通过 `pt-10` 给红绿灯和顶部拖动区域留空间，右侧 WorkspaceStage 不留上下间距，贴近窗口顶部和底部。右侧主工作区整体作为一个浮起的 WorkspaceStage，通过更实的 `bg-card/95`、轻量 blur、圆角、边框和 `shadow-sm` 获得比左侧导航更强的视觉权重。页面不使用 `bg-muted` 做大面积底色。理解索引在 WorkspaceStage 内作为盘点层，理解正文、来源和双链关系作为主工作层占据剩余空间。全局只定义这一套桌面 layout，不再另设布局分支；SourceDetailSheet 只从某条来源摘要临时打开，不改变底层两层结构。

对齐逻辑：CategoryNavigation 与 macOS 红绿灯共享顶部节奏；右侧 WorkspaceStage 贴顶贴底，不跟随左侧 titlebar padding。ThoughtIndex 的 IndexHeader 和 ThoughtDocument 的 DocumentHeader 在 WorkspaceStage 内部对齐。

---

## Organisms

每个独立功能区块的内部结构。页面主层级采用 Linear 式结构：左侧导航贴在应用背景上，右侧 WorkspaceStage 是浮起 surface；重复条目、可选中 row/card 和复杂表单在所属 Organism 下用 Detail 展开。

### WorkspaceShell

```text
div
  CategoryNavigation
  WorkspaceStage
    ThoughtIndex
    ThoughtDocument
    EmptyDocumentState
  SourceDetailSheet
```

- 状态规则：
  - `selection-sync` → 左侧领域、右侧索引和当前理解的选中状态保持一致
- 约束：不跳转到独立创建页、来源页、关系页或图谱页

### CategoryNavigation

- 容器 token：
  - Surface：不设置独立 background，直接贴在 WorkspaceShell 的 `bg-background/45 backdrop-blur-2xl` 底层材质上
  - Spacing：外层固定使用 `px-4 pt-10 pb-4`，其中 `pt-10` 只服务 macOS 红绿灯和顶部 drag region；HeaderRow 和 CategoryNodeRow 共用 `size-6` leading slot，tree list 使用 `pt-4 space-y-0.5`；不跟随右侧 WorkspaceStage 贴顶
  - Border / Radius / Shadow：不使用 `border`、`rounded-*` 或 `shadow-*`，避免左侧导航获得和 WorkspaceStage 相同的浮起权重

```text
aside
  HeaderRow
    title「领域」
    Button(icon: Plus)
  ScrollArea
    CategoryRootButton
      icon: Layers
      label「全部领域」
    CategoryTree
        CategoryNode
          ContextMenuTrigger
            Button(row, action: select)
              span(icon: ChevronRight / ChevronDown, action: expand / collapse, stopPropagation)
              label
  CategoryModal(Dialog)
  DeleteCategoryConfirm(AlertDialog)
```

- 状态规则：
  - `selected-category` → 点击领域后 ThoughtIndex 切换到该领域，当前理解选择清空或切到可见第一条
  - `destructive-confirm` → 删除领域必须使用 `AlertDialog`
  - `disabled` → CategoryModal 名称为空时确认按钮 disabled；导航区常驻新建按钮不使用 disabled 状态
- 约束：领域导航是方位层，不展示来源统计、关系健康度、掌握度评分或 AI 总结；CategoryNode 的 select 和 expand / collapse 必须拆开，点击文字区域只切换领域，点击 chevron 只展开或收起；不展示 more 按钮，节点操作只通过右键 ContextMenu 触发；新建 / 编辑领域名称为空时确认按钮 disabled

#### Detail: HeaderRow

- 组成：标题 / 弱 meta + 右侧主操作
- 布局：`flex h-8 items-center justify-between gap-1`
- 间距：标题左侧保留 `size-6` leading slot，与 CategoryRootButton 和 CategoryNodeRow 的 label 起点对齐；不额外添加横向 padding
- Button：新建领域入口使用 shadcn `Button ghost variant` + `size="icon-sm"`；hover、active、focus-visible 沿用 Button 默认行为；图标按钮只表达添加动作，不承载选中或展开状态
- 约束：右侧主操作只放 1 个高频按钮；更多操作进入菜单；左右栏 HeaderRow 的标题 baseline 必须对齐

#### Detail: CategoryNodeRow

- 组成：single Button + inline chevron + label
- 布局：`flex min-w-0 items-center gap-2`
- 间距：节点行使用 `h-8 px-2`；每行左侧固定保留 `size-6` chevron 槽位；层级缩进使用 `padding-left: calc(0.5rem + level * 0.875rem)`
- Button：整行使用 shadcn `Button ghost variant` + `size="sm"` 承载 select；chevron 是同一个 Button 内的固定 `size-6` 图标点击区，点击时 `stopPropagation` 并只触发 expand / collapse；hover、active、focus-visible 沿用 Button 默认行为；`ContextMenuTrigger` 绑定整行 Button，不额外放 more Button
- 状态规则：
  - `hover / selected` → 使用同一个 `bg-muted text-foreground` 背景和文字色；selected 只额外增加 `font-medium` 表示持久选中
  - `expanded / collapsed` → 只改变 chevron 方向和子树显隐，不在 row Button 上设置 `aria-expanded`，避免触发 shadcn `ghost` 的 expanded 背景；不增加独立背景、边框、阴影或文字权重
- 约束：无子节点时保留 chevron 等宽占位，避免同层文字错位；点击 chevron 不得触发行 select，点击 label / row 不得触发 expand / collapse；ContextMenuTrigger 绑定整行 Button，节点操作只通过右键菜单触发

### ThoughtIndex

```text
section
  IndexHeader
    current-domain title / path
    Button(icon: Plus, text: 新建)
  Input(search)
  ScrollArea
    ThoughtCard[]
    EmptyIndexState
```

- 状态规则：
  - `empty` → 当前领域无理解时展示空态和新建入口
  - `search-empty` → 搜索无结果时展示无匹配空态，保留搜索词和新建入口
  - `selected-card` → 有理解时按最近更新排序；点击卡片后 ThoughtDocument 展示该理解
- 约束：索引只承载扫描线索，不展示完整正文、完整来源或关系管理表单；IndexHeader 不展示“当前领域”这类解释性 label，只展示领域名或路径；列表顶部不再放重复新建入口，新建只保留在 IndexHeader 和空态中
- 复用 Detail：`HeaderRow`

#### Detail: ThoughtCard

- 组成：Card(button) + HeaderRow + MarkdownPreview + MetaRow
- 布局：`flex flex-col gap-2`
- 间距：卡片内部使用 `p-3`
- 状态规则：
  - `hover` → 使用 `ThoughtCard hover state`
  - `selected` → 使用 `ThoughtCard selected state`，表示当前 Document 指针
  - `active` → 使用 `ThoughtCard active state`，不做位移或缩放
  - `focus-visible` → 使用 `focus-visible ring`
- 展示规则：
  - 标题为空但正文不为空 → 用正文第一句作为临时标题
  - 标题和正文都为空 → 展示“未命名理解”
  - 来源 meta → 使用 icon + count 表示来源数量
  - 双链 meta → 使用 icon + count 表示关系数量
  - 0 来源 / 0 关系 → 使用 muted icon + `0`，不写解释性 chip
- 约束：正文 preview 最多 2 行；不放编辑器、不放来源长文；selected 可以有 `shadow-sm`，hover 不能加 shadow 或比 selected 更强；hover / selected / active 不改变尺寸、padding、border width 或位置

### ThoughtDocument

```text
article
  ScrollArea
    DocumentHeader
      MetaRow
        updatedAt
        CategoryTreeSelect(inline)
        Button(icon: Trash2, text: 删除)
      Input(title)
    Textarea(body)
    SourceTraceSection
    RelationSummarySection
  DeleteThoughtConfirm(AlertDialog)
```

- 状态规则：
  - `editing` → 标题、正文、领域归属在原位置直接编辑，变更同步回索引
  - `destructive-confirm` → 删除理解必须使用 `AlertDialog`
- 展示规则：
  - 正文双链未解析 → 只在 RelationSummarySection 中展示轻量提示
- 约束：不展示保存按钮、保存中、已保存、dirty 状态或离开确认

#### Detail: MetaRow

- 组成：Badge / 弱 meta / 小图标按钮
- 布局：`flex min-w-0 flex-wrap items-center gap-2`
- 间距：内部使用 `gap-2`
- 约束：只表达定位和线索，不承载主标题层级

### SourceTraceSection

```text
section
  SectionHeader
    title「来源」
    Button(icon: Plus, text: 添加来源)
  SourcePreviewCard[]
  EmptySourceState
```

- 状态规则：
  - `empty` → 没有来源时展示添加来源入口，不表达质量不足
  - `open-source` → 点击来源摘要打开 SourceDetailSheet，只打开这一条来源
  - `destructive-confirm` → 删除来源必须使用 `AlertDialog`
- 约束：来源摘要默认不展开完整长文，不进入来源库或全部来源 reader
- 复用 Detail：`MetaRow`

#### Detail: SectionHeader

- 组成：小标题 + 可选说明 + 可选操作
- 布局：`flex items-start justify-between gap-3`
- 间距：与区块内容使用 `mb-3`
- 约束：说明文字默认不展示；只有空态引导或用户需要理解操作后果时才允许出现，且最多 1 行

#### Detail: SupportSection

- 组成：SectionHeader + repeated cards / empty state
- 布局：`flex flex-col gap-3`
- 间距：区块间使用 `mt-8`
- 约束：只用于 SourceTraceSection 和 RelationSummarySection，不用于页面主容器

#### Detail: SourcePreviewCard

- 组成：Card + button(open source) + MetaRow + MarkdownPreview + InlineActionGroup
- 布局：`flex flex-col gap-2`
- 间距：卡片内部使用 `p-3`
- 状态规则：
  - `hover` → 使用 `SourcePreviewCard hover state`
  - `focus-visible` → 打开来源的 button 使用 `focus-visible ring`
- 展示规则：
  - 来源名称为空 → 使用来源类型作为 placeholder
  - 来源内容为空 → 展示“空来源，可以直接补充内容。”
- 约束：只表达来源线索；删除按钮放在 InlineActionGroup；不做来源评分、来源筛选或跨理解来源管理

#### Detail: InlineActionGroup

- 组成：次要 Button[]
- 布局：`flex items-center gap-1.5`
- 间距：只用于卡片或支撑区内部
- 约束：删除动作使用 `ghost + destructive`，不使用填充 destructive 按钮

### SourceDetailSheet

```text
Sheet
  SheetContent
    SheetHeader
      SheetTitle「来源详情」
      SourceMetaForm
        Select(source type)
        Input(source name)
      content length
    Textarea(full source content)
```

- 状态规则：
  - `open` → Sheet 从右侧覆盖 Document 层，底层工作区保持原上下文
  - `editing` → 编辑来源类型、名称、内容后 local-first 更新
  - `closed` → 关闭后回到原 ThoughtDocument
- 展示规则：
  - 来源名称为空 → 用来源类型作为 placeholder
  - 来源内容为空 → 允许保存并显示空内容 placeholder
- 约束：Sheet 只服务当前单条来源，不展示其他来源列表、来源库导航或筛选器

#### Detail: SourceMetaForm

- 组成：Select + Input + content length
- 布局：`grid grid-cols-[128px_minmax(0,1fr)] gap-2`
- 间距：与 SheetTitle 使用 `mt-3`
- 约束：来源类型固定宽度，来源名称占剩余宽度；全局只使用这一种布局

### RelationSummarySection

```text
section
  SectionHeader
    title「双链关系」
  RelationItem[] outgoing
  RelationItem[] incoming
  UnresolvedLinkItem[]
  IndependentState
```

- 交互规则：
  - 点击相关理解 → Document 切换到目标理解，Index 更新选中指针和领域语境
- 展示规则：
  - 无 outgoing / incoming → 展示“暂时独立”
  - 未解析双链 → 展示“未解析：[[...]]”
  - 自引用或失效目标 → 不自动建关系
- 约束：关系区只展示和导航，不提供手动添加关系、手动删除关系、关系类型或关系后台
- 复用 Detail：`SectionHeader`、`SupportSection`

#### Detail: RelationItem

- 组成：Card(button) + Badge(direction) + title + optional MarkdownPreview
- 布局：`flex flex-col gap-2`
- 间距：卡片内部使用 `p-3`
- 状态规则：
  - `hover` → 使用 `RelationItem hover state`
  - `focus-visible` → 使用 `focus-visible ring`
- 约束：只负责跳转到相关理解，不表达关系类型编辑、不提供手动建边或删边

### EmptyDocumentState

```text
div
  Empty
    title「选择或写下一条理解」
    description
    Button「新建理解」
```

- 状态规则：
  - `empty-selection` → 当前领域没有选中理解时展示，并允许创建空理解
- 约束：不使用大段教育文案、功能介绍页或图谱空画布


---

## Token Review

本节不是 token 全量盘点表，而是代码生成前后都要执行的视觉一致性检查。

#### Surface Hierarchy

- 统一规则：WorkspaceShell 使用 `bg-background/45 backdrop-blur-2xl` 作为透明窗口底层材质；WorkspaceStage 使用 `bg-card/95 backdrop-blur-sm`、`rounded-xl border shadow-sm` 成为唯一浮起主工作区；ThoughtDocument 和 SheetContent 使用更稳定的阅读面，不和 WorkspaceShell 共享材质。
- 禁止：不使用 `bg-muted` 做页面大面积底色；不把 `Card` 当成 WorkspaceStage 的实现组件；不让 CategoryNavigation 和 WorkspaceStage 使用同等权重背景。

#### Typography

- 统一规则：HeaderRow / SectionHeader 标题使用 `text-sm font-medium`；更新时间、来源字数、卡片 icon meta 和空态说明使用 `text-xs text-muted-foreground`；危险操作文案才使用 `text-destructive`；正文摘要使用 `prose prose-sm`。
- 禁止：不把弱 meta 样式用于危险操作；不把危险色用于无来源、无关系、未归类或未解析双链提示；不在 ThoughtCard meta 中写重复解释性 chip。

#### Spacing Rhythm

- 统一规则：页面容器保持 `px-0 py-0`；CategoryNavigation 外层只用 `px-3 pt-10 pb-4` 给 macOS 红绿灯和拖动区留空间；CategoryNavigation 的 HeaderRow 使用 `h-8 px-2`，tree list 使用 `pt-4 space-y-0.5`，CategoryNodeRow 使用 `h-8` + `size-6` chevron 槽位 + label `px-2`；Document 内容区和 EmptyDocumentState 使用 `px-6 py-5`；卡片内部使用 `p-3`；MetaRow / SourceMetaForm 内部使用 `gap-2`。
- 禁止：不把页面级 `gap-4` 用到列表项内部；不把 SupportSection 的 `gap-3` 当作页面主布局间距；不让 CategoryNodeRow 使用 Document 内容区 padding；不把 `pt-10` 复制到 WorkspaceStage 或右侧栏。

#### Interaction State

- 统一规则：shadcn Button 的 hover、active、focus-visible、disabled 沿用所选 variant 的默认行为；CategoryNode selected 作用在整行 Button，并在 `ghost` Button 默认外观基础上增加 `bg-muted text-foreground font-medium`；ThoughtCard hover 使用 `bg-accent/30 border-border shadow-none`，selected 使用 `bg-card border-ring shadow-sm`，active 使用 `bg-accent/20 border-border shadow-none`；SourcePreviewCard 和 RelationItem hover 只使用轻量 `bg-accent/30 border-border`。
- 禁止：不重写 shadcn Button 默认 hover / active / focus-visible；自定义 hover 不加 shadow、不位移、不缩放、不改变 padding / border width / 尺寸；focus-visible ring 只表达键盘焦点，不表达 selected；disabled 只用于表单确认不可提交，不用于常驻导航按钮；SourcePreviewCard / RelationItem hover 不能比 ThoughtCard selected 更强。

#### Component Variants

- 统一规则：EmptyDocumentState / EmptyIndexState 的主创建入口使用 `Button default variant`；CategoryNavigation 新建领域入口使用 `Button ghost variant` + `size="icon-sm"`；CategoryNodeRow 使用 `Button ghost variant` + `size="sm"` 承载整行 select，内部 chevron 点击区用 `stopPropagation` 承载 expand / collapse；常规次要操作使用 `Button ghost variant`；删除入口使用 `Button ghost + destructive`；删除确认使用 `AlertDialog` destructive action；来源详情使用 `SheetContent`。
- 禁止：不使用填充 destructive 按钮做普通删除入口；不在 CategoryNodeRow 内额外放 more Button；不把 AlertDialog 用于普通保存、切换领域或关闭 Sheet；不把 Sheet 变成常驻侧栏或来源库。

#### Hard-coded Values

- 统一规则：颜色语义统一来自 shadcn token、组件 variant 和本节列出的少量业务状态组合。
- 禁止：不引入 `#ffffff`、`bg-blue-500`、`text-gray-500` 等脱离 token 系统的硬编码颜色；不为单个 Organism 临时发明新的基础组件状态色阶。

---

## Atoms 索引

本页面使用的 shadcn 组件及 variant 配置，不在此处做设计决策。

| 组件 | Variant / 配置 | 使用位置 |
| ---- | -------------- | -------- |
| Button | default variant | EmptyDocumentState 新建理解入口、EmptyIndexState 新建理解入口 |
| Button | ghost variant | CategoryNavigation 新建领域、ThoughtIndex 新建、SourceTraceSection 添加来源 |
| Button | ghost + destructive | 删除理解、删除来源、删除领域菜单项或按钮 |
| Button | size="sm" | ThoughtIndex 新建、SourceTraceSection 添加来源、删除来源 |
| Button | size="icon-sm" | CategoryNavigation 新建领域 |
| Input | default variant | ThoughtIndex 搜索、ThoughtDocument 标题、CategoryModal 名称、SourceDetailSheet 来源名称 |
| Textarea | default variant | ThoughtDocument 正文、SourceDetailSheet 来源内容 |
| Badge | outline variant | 来源类型、关系方向、来源 / 关系 meta |
| Card / CardHeader / CardContent / CardFooter | default variant | ThoughtCard、SourcePreviewCard、RelationItem |
| ScrollArea | default variant | CategoryNavigation 树、ThoughtIndex 列表、ThoughtDocument 内容区 |
| Sheet / SheetContent / SheetHeader / SheetTitle | default variant | SourceDetailSheet |
| Select / SelectTrigger / SelectContent / SelectItem / SelectValue | default variant, trigger size="sm" | SourceDetailSheet 来源类型 |
| ContextMenu / ContextMenuTrigger / ContextMenuContent / ContextMenuItem / ContextMenuSeparator | default variant | CategoryNodeRow 右键操作 |
| AlertDialog | default variant | 删除领域、删除理解、删除来源确认 |
| Empty | default variant | EmptyDocumentState、EmptyIndexState |
| CategoryTreeSelect | inline variant / custom business component | ThoughtDocument 领域归属 |
| SimpleMarkdownPreview | lineClamp=2 / custom business component | ThoughtCard 摘要、SourcePreviewCard 摘要、RelationItem 摘要 |
| lucide icons | FileText / Link2 或等价语义图标 | ThoughtCard 来源数量、双链数量 meta |

---

## 不做的决策

- ❌ **不做独立创建页或创建向导** → 新建理解必须立即进入当前工作台的 Document，符合 local-first 和高频沉淀路径。
- ❌ **不把来源做成来源库或 reader 页面** → 来源只解释当前理解从哪里长出来，点击单条来源只打开单条 SourceDetailSheet。
- ❌ **不做关系管理后台** → 双链关系只来自正文，关系区只展示和导航，删除关系必须回到正文删除对应双链。
- ❌ **不把无来源、无关系、未归类做成异常状态** → 这些都是个人理解自然生长过程中的正常边界。
- ❌ **不把右侧强调只做成分割线** → 右侧主工作区需要像 Linear 一样通过背景对比、圆角、边框和轻量阴影形成浮起 surface。
- ❌ **不使用脏感大面积底色** → 页面底层使用透明窗口 + `bg-background/45 backdrop-blur-2xl`，避免 `bg-muted` 把工作台变成灰蒙蒙的底板。
- ❌ **不为桌面端写多套 layout 分支** → 当前 Electron 桌面场景只需要一套稳定 layout，避免实现和验收出现双规格。
- ❌ **不把 CategoryNode 的选择和展开绑在同一次点击上** → 整行 Button 负责 select，chevron 点击区通过 `stopPropagation` 只负责 expand / collapse，更多操作只通过右键菜单触发。
- ❌ **不在卡片上展示完整正文或完整来源** → ThoughtIndex 负责扫描和回忆，完整内容只进入 Document 或 SourceDetailSheet。
- ❌ **不在 ThoughtCard meta 中写重复解释文案** → 来源和双链关系在列表里只用 icon + count，0 值也保持低权重。
- ❌ **不让 ThoughtCard hover 改变层级到超过 selected** → hover 不加 shadow、不做位移，避免点击时出现卡顿或状态跳变。
- ❌ **不在常规 SectionHeader 展示解释性 description** → 规则和约束留在 spec 中，UI 只保留标题、必要操作和空态引导。
- ❌ **不展示保存按钮或 dirty 状态** → v0 明确采用 local-first 编辑模型，编辑结果在原位置直接生效。
- ❌ **不引入硬编码颜色色阶** → 颜色语义统一使用 shadcn token、组件 variant 和状态 token。
- ❌ **不把图谱放入默认主路径** → 图谱可以是后续观察模式，MVP 主路径是领域、索引和文档。
