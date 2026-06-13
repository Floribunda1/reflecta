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

每个独立功能区块的内部结构。页面主层级采用 Linear 式结构：左侧导航贴在应用背景上，右侧 WorkspaceStage 是浮起 surface；重复条目、可选中 row/card 和复杂表单在 Molecules 中展开。

- **WorkspaceShell**

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

- **CategoryNavigation**

  ```text
  aside
    HeaderRow
      title「领域」
      Button(icon: Plus)
    ScrollArea
      CategoryRootButton「全部领域」
      CategoryTree
        CategoryNode
          ContextMenuTrigger
            Button(icon: ChevronRight / ChevronDown, action: select + expand, render/asChild)
    CategoryModal(Dialog)
    DeleteCategoryConfirm(AlertDialog)
  ```

  - 状态规则：
    - `selected-category` → 点击领域后 ThoughtIndex 切换到该领域，当前理解选择清空或切到可见第一条
    - `destructive-confirm` → 删除领域必须使用 `AlertDialog`
  - 约束：领域导航是方位层，不展示来源统计、关系健康度、掌握度评分或 AI 总结；CategoryNode 整行必须由一个 `Button` 承载，chevron 只是 Button 内的状态图标，点击整行完成 select + expand / collapse；不展示 more 按钮，节点操作只通过右键 ContextMenu 触发；新建 / 编辑领域名称为空时确认按钮 disabled

- **ThoughtIndex**

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

- **ThoughtDocument**

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

- **SourceTraceSection**

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

- **SourceDetailSheet**

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

- **RelationSummarySection**

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

- **EmptyDocumentState**

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

## Molecules

Organism 内部需要单独展开的交互单元、重复单元或复杂组合，定义内部结构、间距、交互状态和实现约束。

- **HeaderRow** = 标题 / 弱 meta + 右侧主操作
  - 布局：`flex items-center justify-between gap-2`
  - 间距：容器内部使用 `px-3 py-3`
  - 约束：右侧主操作只放 1 个高频按钮；更多操作进入菜单；左右栏 HeaderRow 的标题 baseline 必须对齐

- **MetaRow** = Badge / 弱 meta / 小图标按钮
  - 布局：`flex min-w-0 flex-wrap items-center gap-2`
  - 间距：内部使用 `gap-2`
  - 约束：只表达定位和线索，不承载主标题层级

- **SectionHeader** = 小标题 + 可选说明 + 可选操作
  - 布局：`flex items-start justify-between gap-3`
  - 间距：与区块内容使用 `mb-3`
  - 约束：说明文字默认不展示；只有空态引导或用户需要理解操作后果时才允许出现，且最多 1 行

- **SupportSection** = SectionHeader + repeated cards / empty state
  - 布局：`flex flex-col gap-3`
  - 间距：区块间使用 `mt-8`
  - 约束：只用于 SourceTraceSection 和 RelationSummarySection，不用于页面主容器

- **SourceMetaForm** = Select + Input + content length
  - 布局：`grid grid-cols-[128px_minmax(0,1fr)] gap-2`
  - 间距：与 SheetTitle 使用 `mt-3`
  - 约束：来源类型固定宽度，来源名称占剩余宽度；全局只使用这一种布局

- **CategoryNodeRow** = single Button + inline chevron + label
  - 布局：`flex min-w-0 items-center gap-2`
  - 间距：节点行使用 `h-9 px-2`，层级缩进使用 `padding-left: calc(0.5rem + level * 0.875rem)`
  - 状态规则：
    - `hover` → 整行 Button 使用 `CategoryNode hover state`
    - `selected` → 整行 Button 使用 `CategoryNode selected state`
    - `focus-visible` → 保留 Button 的键盘焦点 ring，可与 selected 叠加
    - `expanded / collapsed` → 改变 chevron 方向和子树显隐，可与 selected 同时发生
  - 约束：无子节点时保留 chevron 等宽占位，避免同层文字错位；整行只能有一个 Button，不展示 more 按钮；ContextMenuTrigger 绑定整行 Button，节点操作只通过右键菜单触发

- **ThoughtCard** = Card(button) + HeaderRow + MarkdownPreview + MetaRow
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

- **SourcePreviewCard** = Card + button(open source) + MetaRow + MarkdownPreview + InlineActionGroup
  - 布局：`flex flex-col gap-2`
  - 间距：卡片内部使用 `p-3`
  - 状态规则：
    - `hover` → 使用 `SourcePreviewCard hover state`
    - `focus-visible` → 打开来源的 button 使用 `focus-visible ring`
  - 展示规则：
    - 来源名称为空 → 使用来源类型作为 placeholder
    - 来源内容为空 → 展示“空来源，可以直接补充内容。”
  - 约束：只表达来源线索；删除按钮放在 InlineActionGroup；不做来源评分、来源筛选或跨理解来源管理

- **RelationItem** = Card(button) + Badge(direction) + title + optional MarkdownPreview
  - 布局：`flex flex-col gap-2`
  - 间距：卡片内部使用 `p-3`
  - 状态规则：
    - `hover` → 使用 `RelationItem hover state`
    - `focus-visible` → 使用 `focus-visible ring`
  - 约束：只负责跳转到相关理解，不表达关系类型编辑、不提供手动建边或删边

- **InlineActionGroup** = 次要 Button[]
  - 布局：`flex items-center gap-1.5`
  - 间距：只用于卡片或支撑区内部
  - 约束：删除动作使用 `ghost + destructive`，不使用填充 destructive 按钮

---

## Design Tokens 使用表

本页面使用的语义 token 及其边界，用来检查跨区块一致性。

| Token 类型 | Token / Class | 使用场景 | 禁止用法 |
| ---------- | ------------- | -------- | -------- |
| Text | `text-sm font-medium` | HeaderRow 标题、SectionHeader 标题 | 不用于 Document 标题输入，避免和用户内容混淆 |
| Text | `text-xs text-muted-foreground` | 更新时间、来源字数、卡片 icon meta、空态说明 | 不用于无效双链或危险操作文案；不用于常规 SectionHeader description |
| Text | `text-destructive` | 删除菜单项、删除确认文案 | 不用于无来源、无关系、未归类或未解析双链提示 |
| Text | `prose prose-sm` | MarkdownPreview 正文摘要和来源摘要 | 不用于页面标题或按钮文本 |
| Text | `lucide icon + text-xs text-muted-foreground` | ThoughtCard 来源数量、双链数量 | 不写成“无来源”“暂时独立”“连接到 N 个理解”等重复文本 chip |
| Surface | `bg-background/45 backdrop-blur-2xl` | CapturePage / WorkspaceShell 底层窗口材质 | 不用于 WorkspaceStage 或重复条目 |
| Surface | `bg-card/95 backdrop-blur-sm` | WorkspaceStage 浮起主工作区背景 | 不用于 CategoryNavigation，避免左侧导航和右侧主区域同权重 |
| Surface | `bg-background/95` | ThoughtDocument 主阅读面 | 不作为 WorkspaceShell 的窗口材质 |
| Surface | `bg-background` | SheetContent 内部阅读面 | 不作为 WorkspaceStage 的强调 surface |
| Surface | `bg-muted/30` | 需要极轻微分层的空态或局部辅助面 | 不做页面大面积底色，不替代 `bg-background` |
| Surface | `Card` 默认背景 | ThoughtCard、SourcePreviewCard、RelationItem | 不作为 WorkspaceStage 的实现组件，避免语义上形成 Card 嵌套 Card |
| Surface | `SheetContent` 默认背景 | SourceDetailSheet | 不替代普通来源摘要，不作为常驻侧栏 |
| Border | `border` | WorkspaceStage 外边界 | 不用作唯一的右侧强调方式，必须和背景对比、圆角、阴影一起出现 |
| Border | `border-r` | WorkspaceStage 内 ThoughtIndex 与 ThoughtDocument 的内部分隔 | 不用于分隔 CategoryNavigation 和右侧主工作区 |
| Border | `Card` 默认 border | ThoughtCard、SourcePreviewCard、RelationItem 边界 | 不叠加额外 shadow 表达同一层级 |
| Radius | `rounded-xl` | WorkspaceStage 外层圆角 | 不用于 CategoryNodeRow 或列表内部 row |
| Radius | `Card` 默认 radius | 重复条目卡片 | 不用于 WorkspaceShell |
| Shadow | `shadow-sm` | WorkspaceStage 的轻量悬浮层级 | 不用于 CategoryNavigation 或普通 CategoryNodeRow |
| Shadow | `Sheet` 默认 shadow | SourceDetailSheet 覆盖层 | 不用于列表卡片表达选中 |
| Spacing | `px-0 py-0` | CapturePage 页面容器 | 不用于栏内内容 |
| Spacing | `px-4 pt-10 pb-4` | CategoryNavigation 外层留白，给 macOS 红绿灯和拖动区留出顶部空间 | 不用于 WorkspaceStage |
| Spacing | `px-3 py-3` | ThoughtIndex HeaderRow | 不用于 Document 正文编辑区 |
| Spacing | `px-6 py-5` | ThoughtDocument 内容滚动区、EmptyDocumentState | 不用于 WorkspaceShell 与 CategoryNodeRow |
| Spacing | `gap-4` | CategoryNavigation 与 WorkspaceStage 的页面级间距 | 不用于列表项内部 |
| Spacing | `gap-3` | SupportSection 内部卡片间距 | 不用于页面级布局 |
| Spacing | `gap-2` | MetaRow、SourceMetaForm 内部 | 不用于 Organism 间距 |
| State | `disabled` | CategoryModal 名称为空时确认按钮 | 不用于只读 meta 文案 |
| State | `CategoryNode hover state = bg-accent/70 text-accent-foreground` | CategoryNodeRow `hover` | 不用于 selected，也不用于右侧内容卡片 |
| State | `CategoryNode selected state = bg-card/90 text-foreground shadow-sm ring-1 ring-border/80 font-medium` | CategoryNodeRow `selected` | 不表达右侧内容指针，不使用 more 按钮辅助识别 |
| State | `ThoughtCard hover state = bg-accent/30 border-border shadow-none` | ThoughtCard `hover` | 不用于 selected 或左侧导航，不加 shadow |
| State | `ThoughtCard selected state = bg-card border-ring shadow-sm` | ThoughtCard `selected` | 不用于普通 hover 或左侧导航 |
| State | `ThoughtCard active state = bg-accent/20 border-border shadow-none` | ThoughtCard `active` | 不使用 translate、scale、padding 变化或 border width 变化 |
| State | `SourcePreviewCard hover state = bg-accent/30 border-border` | SourcePreviewCard `hover` | 不使用 shadow，避免比 ThoughtCard selected 更强 |
| State | `RelationItem hover state = bg-accent/30 border-border` | RelationItem `hover` | 不表达 relation 编辑或关系类型 |
| State | `focus-visible ring` | CategoryNodeRow、ThoughtCard、SourcePreviewCard、RelationItem、表单控件键盘焦点 | 不用来表达 selected |
| State | `Button ghost + destructive` | 删除理解、删除来源、删除领域入口 | 不用于普通次要操作 |
| State | `AlertDialog` destructive action | `destructive-confirm` 删除理解、删除来源、删除领域 | 不用于普通保存、切换领域或关闭来源 Sheet |
| Action | `Button default variant` | EmptyDocumentState / EmptyIndexState 的新建理解入口 | 不用于删除或低风险导航 |
| Action | `Button ghost variant` | CategoryNodeRow、添加来源、次要新建入口 | 不用于页面唯一主 CTA 的空态按钮 |

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
- ❌ **不在 CategoryNode 内放多个点击按钮** → CategoryNode 用单个整行 Button 承载选择和展开，更多操作只通过右键菜单触发。
- ❌ **不在卡片上展示完整正文或完整来源** → ThoughtIndex 负责扫描和回忆，完整内容只进入 Document 或 SourceDetailSheet。
- ❌ **不在 ThoughtCard meta 中写重复解释文案** → 来源和双链关系在列表里只用 icon + count，0 值也保持低权重。
- ❌ **不让 ThoughtCard hover 改变层级到超过 selected** → hover 不加 shadow、不做位移，避免点击时出现卡顿或状态跳变。
- ❌ **不在常规 SectionHeader 展示解释性 description** → 规则和约束留在 spec 中，UI 只保留标题、必要操作和空态引导。
- ❌ **不展示保存按钮或 dirty 状态** → v0 明确采用 local-first 编辑模型，编辑结果在原位置直接生效。
- ❌ **不引入硬编码颜色色阶** → 颜色语义统一使用 shadcn token、组件 variant 和状态 token。
- ❌ **不把图谱放入默认主路径** → 图谱可以是后续观察模式，MVP 主路径是领域、索引和文档。
