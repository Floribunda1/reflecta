# Design Decision: Capture / 知识漫步连续阅读页

> 日期：2026-07-20
>
> 状态：Accepted
>
> 输入依据：[知识漫步价值主张](../knowledge-wander-value-proposition.md)、[Reflecta Value Proposition](../../../references/product/value-proposition.md)、当前 Capture design system

## 1. 页面目标

持续积累 Understanding 的桌面端用户，会经常打开一个 Domain，连续翻阅自己已经形成的理解，并在值得停留的地方回到 Context 或修改原文。页面通过具体内容提供熟悉感和清晰感，不承担成就激励、复习任务或知识结构生成。

## 2. Template

```text
CapturePage
  w-full h-full max-w-none p-0 overflow-hidden

  WorkspaceShell
    grid h-full grid-cols-[248px_minmax(0,1fr)]
    DomainNavigation
      ExistingDomainTree
      KnowledgeWanderEntry

    WorkspaceStage
      KnowledgeWanderPanelGroup
        KnowledgeWanderSurface
          ReadingHeader
          ReadingViewport
            UnderstandingReadingSection[]
        UnderstandingDetailPanel (conditional)
      ContextualAgentDock (existing, conditional)
```

DomainNavigation 继续承担领域选择；进入知识漫步只替换 Capture 主工作区，不创建新路由。阅读页从上到下连续排列当前领域内的全部 Understanding；打开详情或 Agent 时从右侧分栏，不改变底层阅读位置。

## 3. Organisms

### DomainNavigation

- 容器 token：
  - Surface：沿用 Capture 窗口底层 `bg-background/45`
  - Spacing：树区域完全沿用现状；footer 使用 `p-2`
  - Border / Radius / Shadow：footer 仅使用 `border-t`

```text
aside
  ExistingDomainHeader
  ExistingDomainTreeScroll
  KnowledgeWanderEntry
    Button(icon: BookOpenText, label: 知识漫步)
```

- 状态规则：`active` 时使用与 Domain row selected 相同的 muted 语义，并设置 `aria-pressed=true`
- 约束：领域树始终可操作；再次点击入口退出知识漫步；不显示进度、徽章、提示语或随机图标

#### Detail: KnowledgeWanderEntry

- 组成：Button + Lucide BookOpenText + 文案
- 布局：`w-full justify-start gap-2`
- 间距：footer `p-2`；Button 使用 `size="sm"`
- 状态规则：active 只使用 muted 背景和字重，不增加边框或阴影
- 展示规则：始终显示「知识漫步」，active 时不改成「退出」
- 约束：使用 shadcn Button 的 ghost variant，不创建新导航组件

### KnowledgeWanderSurface

- 容器 token：
  - Surface：`bg-background`
  - Spacing：header 固定，viewport 占据剩余高度
  - Border / Radius / Shadow：无外层圆角和阴影

```text
main
  ReadingHeader
  ReadingViewport
    UnderstandingReadingSection[]
  Empty | Skeleton[]
```

- 状态规则：领域切换后回到阅读页顶部；打开详情时当前 Understanding 使用低权重 selected 背景
- 约束：只存在一个连续阅读视图；无瀑布流、图谱、视图切换、搜索、排序、随机、推荐或完成操作

### ReadingHeader

- 容器 token：
  - Surface：`bg-background/95 backdrop-blur-sm`
  - Spacing：`h-14 px-5 flex items-center`
  - Border / Radius / Shadow：`border-b`，无圆角和阴影

```text
header
  ScopeLabel
    current Domain title
    Understanding count
```

- 展示规则：标题为空时回退「全部领域」；数量统一为「N 条理解」
- 约束：数量只是当前内容范围，不表达完成率或成就；header 不增加任何操作按钮

### ReadingViewport

- 容器 token：
  - Surface：`bg-background`
  - Spacing：页面级 `px-5`；每条内容通过 section 自身 padding 形成纵向节奏
  - Border / Radius / Shadow：无容器边框、圆角和阴影

```text
section
  VirtualizedReadingList
    UnderstandingReadingSection[]
```

- 状态规则：切换 Domain 时滚动到顶部；打开和关闭详情时保持 scrollTop
- 约束：使用项目已有 TanStack Virtual 处理长列表；只渲染 viewport 邻近正文；不引入新的布局或滚动依赖

#### Detail: UnderstandingReadingSection

- 组成：article + title button + Domain/meta + MarkdownPreview + Context/Connection counts
- 布局：宽窗口使用 `grid grid-cols-[minmax(180px,260px)_minmax(0,1fr)]`；窄容器回落为单列
- 间距：section 使用 `gap-6 px-1 py-7`；左侧 meta 使用 `gap-3`；正文内部节奏完全交给现有 MarkdownPreview
- 状态规则：hover 使用轻量 muted surface；selected 使用同一 muted surface 和左侧 primary indicator；focus-visible 只出现在标题 Button
- 展示规则：标题使用现有 fallback；正文为空时显示「空理解，可以直接开始写。」；全部领域范围显示 Domain path；始终显示更新时间、Context 数量和 Connection 数量
- 约束：完整正文由现有 MarkdownPreview 渲染；不创建专用 Markdown parser、renderer 或样式表；section 使用分隔线而不是 Card，不截断、不总结、不显示操作按钮

### UnderstandingDetailPanel

- 容器 token：
  - Surface：`bg-background`
  - Spacing：沿用现有 UnderstandingDetail
  - Border / Radius / Shadow：左侧使用 ResizableHandle / `border-l`，无圆角和阴影

```text
ResizablePanel
  UnderstandingDetail(existing)
```

- 状态规则：打开时占知识漫步工作区约 40%，可在 34%–56% 调整；关闭后阅读页恢复完整宽度并保留位置
- 约束：复用现有编辑、Context、Connection、删除和 Agent 能力；不创建“已读”“完成”或专用阅读详情

## 4. Token Review

#### Surface Hierarchy

- 统一规则：DomainNavigation 使用窗口底层材质；阅读页和详情使用 background；section 只在 hover/selected 时使用 muted
- 禁止：卡片海洋、渐变、彩色背景、额外 surface 层或图谱画布

#### Typography

- 统一规则：header 领域名使用 `text-sm font-medium`；section 标题使用 `text-base font-semibold`；正文沿用 MarkdownPreview；meta 使用 `text-xs text-muted-foreground`
- 禁止：用超大标题、数字或粗体统计制造成就感

#### Spacing Rhythm

- 统一规则：页面级 `px-5`；section 级 `py-7`；section 内部 `gap-6`；meta 内部 `gap-3`
- 禁止：通过 Card margin、Masonry gutter 或不一致 padding 制造节奏

#### Interaction State

- 统一规则：入口 active 与 Domain row selected 共用 muted 语义；section selected 只表达当前详情对象；标题使用 shadcn/Button 可访问 focus
- 禁止：hover 位移、缩放、阴影、发光，或用颜色表达未连接 Understanding 有问题

#### Component Variants

- 统一规则：入口使用 Button ghost；详情使用现有 Resizable primitives；空状态与加载态复用现有 Empty/Skeleton
- 禁止：为阅读页创建新的通用 Button、Card、Tabs 或 Toggle 变体

#### Hard-coded Values

- 统一规则：全部视觉值使用 Tailwind semantic classes 和现有组件 token
- 禁止：硬编码色值、Tailwind 色阶或专属 dark-mode 常量

## 5. Atoms 索引

| 组件                | Variant / 配置                   | 使用位置                     |
| ------------------- | -------------------------------- | ---------------------------- |
| Button              | `ghost variant`, `size="sm"`     | KnowledgeWanderEntry         |
| Button              | `link variant`, `size="default"` | Understanding title          |
| Empty               | `className="h-full"`             | 空领域 / 查询失败            |
| EmptyContent        | base configuration               | 空状态内容                   |
| EmptyMedia          | `variant="icon"`                 | 空状态图标                   |
| EmptyDescription    | base configuration               | 空状态文案                   |
| Skeleton            | `className="h-48"`               | 正文列表加载态               |
| ResizablePanelGroup | `orientation="horizontal"`       | KnowledgeWanderPanelGroup    |
| ResizablePanel      | percentage size constraints      | 阅读页 / UnderstandingDetail |
| ResizableHandle     | `withHandle`                     | 详情分隔                     |

## 6. 不做的决策

- ❌ **不保留瀑布流** → Masonry 强调同屏数量和空间填充，不符合连续进入具体理解的阅读动作。
- ❌ **不保留全局图谱** → 大量孤立 Understanding 无法从图谱获得内容价值，图谱也不能替代阅读。
- ❌ **不提供阅读模式切换** → 同一条连续页面已经允许慢读和快扫，额外模式只会增加选择成本。
- ❌ **不创建 Markdown renderer** → 现有 MarkdownPreview 已覆盖正文展示，重复解析和样式会形成第二套系统。
- ❌ **不显示进度或完成状态** → 知识漫步不是成就或复习模块，位置不能被包装成任务进度。
- ❌ **不提供随机、推荐和自动路径** → 顺序必须稳定可理解，系统不替用户构造知识关系。
- ❌ **不创建卡片视觉系统** → section 分隔足以表达内容边界，并能降低浏览时的视觉噪音。
