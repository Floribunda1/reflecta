# Design Decision: Capture / 知识漫步

> 日期：2026-07-19
> 状态：Accepted
> 输入依据：[v1.2.0 知识漫步计划](../knowledge-wander-plan.md)、当前 Capture design system

## 1. 页面目标

持续积累个人 Understanding 的桌面端用户，低频进入某个领域，连续阅读自己已经写下的完整内容，并在需要时观察真实 Connection 形成的知识形状。知识漫步是 Capture 内的观察模式，不建立回顾方法、任务流程或新的顶层页面。

## 2. Template

```text
CapturePage
  w-full h-full max-w-none
  px-0 py-0
  overflow-hidden

  WorkspaceShell
    grid h-full
    grid-cols-[248px_minmax(0,1fr)]
    bg-background/45 backdrop-blur-2xl

    DomainNavigation
      flex h-full flex-col
      DomainHeader
      DomainTreeScroll
      KnowledgeWanderEntry

    WorkspaceStage
      h-full min-w-0
      bg-card/95 backdrop-blur-sm border-l

      KnowledgeWanderPanelGroup
        KnowledgeWanderSurface
          WanderHeader
          WaterfallView | GraphView
        UnderstandingDetailPanel (conditional)

      ContextualAgentDock (existing, conditional)
```

排列逻辑：DomainNavigation 继续作为稳定语境层并保持 248px；知识漫步入口固定在领域树底部，不参与树滚动。进入知识漫步后，普通 Capture 的索引与文档两栏合并为连续观察面；只有用户点击卡片时，右侧才通过现有 resizable panel 打开 UnderstandingDetail。ContextualAgentDock 继续位于 Capture main 最右侧，知识漫步不改变其既有层级。

## 3. Organisms

### DomainNavigation

- 容器 token：
  - Surface：沿用 Capture 外层 `bg-background/45 backdrop-blur-2xl`，不增加独立背景
  - Spacing：header 和 tree 完全沿用现状；footer 使用 `p-2`
  - Border / Radius / Shadow：footer 仅使用 `border-t`；不使用圆角容器或阴影

```text
aside
  Existing DomainHeader
  Existing DomainTreeScroll
  KnowledgeWanderEntry
    Button(icon: Compass, label: 知识漫步)
```

- 状态规则：
  - `inactive` → `Button ghost variant`，与 DomainNodeRow 相同的低权重导航语义
  - `active` → `bg-muted text-foreground font-medium`，并设置 `aria-pressed=true`
- 约束：进入知识漫步后领域树仍可选；入口不显示计数、说明、new badge 或随机图标；再次点击同一入口退出知识漫步

#### Detail: KnowledgeWanderEntry

- 组成：Button + Lucide Compass + 文案
- 布局：`w-full justify-start gap-2`
- 间距：footer `p-2`；Button 使用 shadcn `size="sm"` 默认内部间距
- 状态规则：active 只增加 muted 背景和字重，不使用 primary 填充、border 或 shadow
- 约束：图标与文案常驻，不在 active 时改成「退出」或「返回」

### KnowledgeWanderSurface

- 容器 token：
  - Surface：`bg-transparent`
  - Spacing：header 固定；内容区占据剩余高度
  - Border / Radius / Shadow：不使用外层圆角和阴影

```text
main
  WanderHeader
  WaterfallView | GraphView
```

- 状态规则：
  - `waterfall` → 显示完整正文瀑布流
  - `graph` → 显示 G6 图谱
  - `empty` → 两种视图共享同一轻量 Empty
  - `loading` → Waterfall 使用卡片 Skeleton；Graph 使用居中的 Skeleton
- 约束：模式切换不改变领域范围；打开和关闭详情不重建底层视图或丢失 scroll/viewport

### WanderHeader

- 容器 token：
  - Surface：`bg-transparent`
  - Spacing：`h-14 px-4 flex items-center justify-between gap-3`
  - Border / Radius / Shadow：`border-b`，无圆角和阴影

```text
header
  ScopeLabel
    current Domain title
    count meta
  ToggleGroup(multiple: false)
    ToggleGroupItem(icon: Columns3, 瀑布流)
    ToggleGroupItem(icon: Share2, 图谱)
```

- 状态规则：
  - `view-selected` → 使用 ToggleGroupItem 现有 selected state
- 展示规则：领域标题为空时回退「全部领域」；数量统一为「N 条理解」
- 约束：不增加搜索、排序、包含子领域、刷新、创建、随机或 AI 操作；两个视图入口显示图标与短文案，不让用户猜图标含义

### WaterfallView

- 容器 token：
  - Surface：`bg-background/35`
  - Spacing：viewport `p-4`；列间距和行间距统一为 `gap-3`
  - Border / Radius / Shadow：无外层 border、radius 或 shadow

```text
section
  Masonic
    UnderstandingWanderCard[]
  Empty
```

- 状态规则：
  - `empty` → EmptyDescription「这个领域还没有理解」
- 约束：卡片最小目标列宽 320px、最大 4 列；由 masonic 负责高度测量、列平衡和虚拟化；正文不截断

#### Detail: UnderstandingWanderCard

- 组成：clickable card surface + title + full SimpleMarkdownPreview + meta
- 布局：`flex w-full flex-col gap-3 text-left`
- 间距：`p-4`
- 状态规则：
  - `hover` → 只使用 `bg-muted/20`
  - `focus-visible` → 使用现有 focus-visible ring
  - `selected` → 详情已打开时使用 `border-primary ring-1 ring-ring/20`
- 展示规则：标题使用现有 Understanding fallback；正文为空时显示「空理解，可以直接开始写。」；正文使用 `SimpleMarkdownPreview` 且不传 `lineClamp`；全部领域范围才显示领域路径，始终显示更新时间
- 约束：使用 `rounded-lg border bg-card shadow-xs`；不显示 Context/Connection 数量、操作按钮、摘要、评分或状态点；hover/selected 不改变尺寸和位置

### GraphView

- 容器 token：
  - Surface：`bg-background/35`
  - Spacing：canvas 填满剩余空间；controls 距左下 `m-3`；minimap 距右下 `m-3`
  - Border / Radius / Shadow：canvas 无边框；controls 和 minimap 使用 `border rounded-md shadow-xs bg-card`

```text
section
  G6Canvas
    UnderstandingRectNode[]
    ConnectionEdge[]
    G6Minimap
  ViewportControls
    Button(icon: ZoomIn)
    Button(icon: ZoomOut)
    Button(icon: Maximize2, action: fitView)
  Empty
```

- 状态规则：
  - `node-selected` → 节点使用 primary stroke；直接相连边使用 primary stroke；其他内容保持可见
  - `node-hover` → 节点 stroke 提升为 foreground/弱透明语义，不加动画或位移
  - `layout-running` → 不额外展示进度 UI；布局完成后节点停止漂移
- 约束：G6 使用内置 `rect` node、line edge、D3 Force、drag-canvas、zoom-canvas、drag-element-force 和 MiniMap；不使用 React node extension、自定义 node class、Domain lane、Context node 或图例；节点固定紧凑尺寸，只显示最多 3 行标题

#### Detail: UnderstandingRectNode

- 组成：G6 built-in rect + wrapped label
- 布局：固定 `220 × 72`，label 居中，最多 3 行
- 状态规则：default / hover / selected 全部从当前 CSS semantic tokens 解析到 G6 style
- 展示规则：标题使用与瀑布流相同 fallback；不显示正文、领域、计数和状态点
- 约束：节点视觉对应 Capture 卡片的 border/radius/typography，但不模拟完整 DOM Card

#### Detail: ViewportControls

- 组成：三个 shadcn Button
- 布局：`absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-md border bg-card shadow-xs`
- 间距：组内 `gap-0`，Button 保持 `size="icon-sm"`
- 约束：使用 shadcn Button 调用 G6 viewport API；不启用 G6 Toolbar plugin，避免第二套按钮样式

### UnderstandingDetailPanel

- 容器 token：
  - Surface：`bg-background`
  - Spacing：沿用现有 UnderstandingDetail
  - Border / Radius / Shadow：左侧使用 ResizableHandle / `border-l`；无圆角和阴影

```text
ResizablePanel
  Button(icon: X, close)
  UnderstandingDetail(existing)
```

- 状态规则：
  - `open` → 占知识漫步工作区约 40%，可在 34%–56% 调整
  - `closed` → 底层视图恢复完整宽度并保留原 scroll/viewport
- 约束：复用现有编辑、自动保存、删除、Context 和 onChat；不创建只读 reader 或知识漫步详情组件

## 4. Token Review

#### Surface Hierarchy

- 统一规则：DomainNavigation 使用窗口底层材质；WorkspaceStage 使用 `bg-card/95`；瀑布流和图谱只用 `bg-background/35` 形成轻微观察面；详情回到 `bg-background`
- 禁止：使用独立大面积 `bg-muted`、渐变、彩色图谱背景或悬浮 dashboard surface

#### Typography

- 统一规则：header 领域名使用 `text-sm font-medium`；数量与 meta 使用 `text-xs text-muted-foreground`；瀑布流标题使用 `text-base font-semibold`；正文使用现有 markdown preview typography；图谱节点只使用一个 label 层级
- 禁止：为图谱另建字体、字号系统，或让 meta 与正文同权重

#### Spacing Rhythm

- 统一规则：页面级无 padding；header 使用 `px-4`；观察面使用 `p-4`；卡片内部使用 `p-4 gap-3`；controls 使用 `m-3`
- 禁止：同一层级混用临时 `gap-1/2/4/6`，或通过卡片 margin 制造 Masonry gutter

#### Interaction State

- 统一规则：DOM 交互使用 shadcn 默认 hover/focus；业务 selected 只映射到 muted/primary semantic tokens；G6 state 从同一 token 解析
- 禁止：hover 位移、缩放、发光、持续动画，或使用颜色表达「未连接即有问题」

#### Component Variants

- 统一规则：入口与 viewport controls 使用 `Button ghost variant`；视图选择使用 `ToggleGroup outline variant`；Empty/Skeleton 沿用现有配置
- 禁止：在同一语义位置混用 default/destructive/secondary variant

#### Hard-coded Values

- 统一规则：DOM 使用 Tailwind semantic classes；G6 canvas 初始化时读取 `--background`、`--card`、`--foreground`、`--muted-foreground`、`--border`、`--primary`、`--ring`、`--radius`
- 禁止：在组件或 G6 options 中写 `#fff`、`#1677ff`、Tailwind 色阶或另一套 dark-mode 常量

## 5. Atoms 索引

| 组件                | Variant / 配置                                       | 使用位置                          |
| ------------------- | ---------------------------------------------------- | --------------------------------- |
| Button              | `ghost variant`, `size="sm"`                         | KnowledgeWanderEntry              |
| Button              | `ghost variant`, `size="icon-sm"`                    | ViewportControls、详情关闭        |
| ToggleGroup         | `multiple={false}`, `variant="outline"`, `size="sm"` | WanderHeader                      |
| ToggleGroupItem     | `outline variant`, `size="sm"`                       | 瀑布流 / 图谱切换                 |
| Empty               | existing default configuration                       | 知识漫步共享空状态                |
| EmptyContent        | existing default configuration                       | 空状态内容                        |
| EmptyMedia          | `variant="icon"`                                     | 空状态图标                        |
| EmptyDescription    | existing default configuration                       | 空状态文案                        |
| Skeleton            | existing default configuration                       | 瀑布流和图谱加载态                |
| ResizablePanelGroup | `orientation="horizontal"`                           | KnowledgeWanderPanelGroup         |
| ResizablePanel      | percentage size constraints                          | Surface、UnderstandingDetailPanel |
| ResizableHandle     | `withHandle`                                         | 详情面板分隔                      |
| Tooltip             | existing default configuration                       | icon-only viewport controls       |

## 6. 不做的决策

- 不新增顶层「知识漫步」或保留 Contemplate。
- 不让点击领域自动退出知识漫步；领域只改变观察范围。
- 不加入随机、推荐、AI 摘要、回顾任务、计分或固定问题。
- 不在 header 增加搜索、排序、筛选、刷新和新建操作。
- 不把瀑布流做成普通 Capture 索引；这里明确展示完整正文卡片。
- 不让瀑布流卡片展示 Context、Connection 健康度或可见操作按钮。
- 不在图谱展示 Domain/Context 节点、Domain lane、外部领域节点或推断关系。
- 不使用 G6 React node extension、自定义 HTML node、G6 Toolbar 或平行 design system。
- 不持久化知识漫步 mode、view、graph node positions 或 viewport。
- 不为不同窗口宽度维护独立页面结构；列数由 masonic 响应式计算。
