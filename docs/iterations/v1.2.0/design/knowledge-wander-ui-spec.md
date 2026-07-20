# Design Decision: Capture / Obsidian 式知识漫步图谱

> 日期：2026-07-20
>
> 状态：Accepted
>
> 输入依据：[知识漫步价值主张](../knowledge-wander-value-proposition.md)、[Reflecta Value Proposition](../../../references/product/value-proposition.md)、当前 Capture design system

## 1. 页面目标

持续积累 Understanding 的桌面端用户，可以在当前 Domain 中直接看见一张可平移、缩放和探索的图谱。用户通过节点重新辨认自己的 Understanding，点击后在右侧进入现有详情和 Context，再回到保持原视口的图谱继续探索。

页面不承担顺序阅读、复习进度、成就激励或自动知识结构生成。

## 2. Template

```text
CapturePage
  w-full h-full max-w-none p-0 overflow-hidden

  WorkspaceShell
    grid h-full grid-cols-[248px_minmax(0,1fr)]
    DomainNavigation
      ExistingDomainTree

    WorkspaceStage
      UnderstandingListHeader
        DomainSummary
        KnowledgeWanderIconButton
      KnowledgeWanderPanelGroup
        KnowledgeGraphSurface
          GraphHeader
            DomainSummary
            KnowledgeWanderIconButton(active)
          GraphCanvas
            UnderstandingNode[]
            ConnectionEdge[]
          GraphControls
        UnderstandingDetailPanel (conditional)
      ContextualAgentDock (existing, conditional)
```

DomainNavigation 继续承担领域范围选择；理解列表标题栏中的图谱 icon button 进入知识漫步，只替换 Capture 主工作区，不创建新路由。GraphCanvas 始终是主要表面；打开详情或 Agent 时从右侧分栏，不替换图谱。

## 3. Organisms

### DomainNavigation

- Surface：沿用 Capture 现有侧栏材质。
- Spacing：树区域完全沿用现状。
- 不在底部增加知识漫步 footer 或其他全局入口。

```text
aside
  ExistingDomainHeader
  ExistingDomainTreeScroll
```

### KnowledgeWanderEntry

- 入口使用 `Share2` 图标，作为理解列表标题栏右侧 icon toolbar 的第一个操作，位于搜索按钮之前；不单独悬在 Domain 名称与数量旁边。
- 进入图谱后，GraphHeader 的右侧操作区保留该 icon button，并使用现有 `bg-muted text-foreground` active 样式与 `aria-pressed=true`；再次点击退出知识漫步。
- 复用现有 `Button variant="ghost" size="icon-sm"`，仅显示一个图标，通过 aria-label 表达进入或退出。
- 不显示独立文字、进度、徽章、说明文字或随机图标。

### KnowledgeGraphSurface

- Surface：`bg-background`，图谱直接占满工作区。
- Border / Radius / Shadow：无外层圆角和阴影。
- Layout：header 固定在顶部，canvas 占据剩余空间。

```text
main
  GraphHeader
  GraphCanvas
  GraphControls
  Empty | Loading
```

- 当前 Domain 改变时替换图数据并重新运行力导向布局。
- 图谱只存在一种主视图，无瀑布流、连续阅读、卡片列表或视图切换。
- 图谱引擎作为独立命令式画布挂载；React 只传入数据、主题和交互回调，不逐节点渲染 React DOM。

### GraphHeader

- Surface：`bg-background/90 backdrop-blur-sm`。
- Spacing：`h-14 px-5 flex items-center`。
- Border：`border-b`，无圆角和阴影。

```text
header
  ScopeLabel
    current Domain title
    Understanding count
```

- 标题为空时回退「全部领域」。
- 数量统一为「N 条理解」。
- 数量只表示当前范围，不表达进度或成就。
- Header 不增加布局、过滤、搜索或显示设置。

### GraphCanvas

- Surface：使用 design system 的 `background` token。
- Graph engine 的容器绝对铺满剩余区域。
- 节点、边、标签和交互状态由图谱引擎绘制，不叠加 DOM 卡片。

```text
canvas
  force-directed layout
  UnderstandingNode[]
  ConnectionEdge[]
```

#### 数据规则

- 每条当前 Domain 范围内的 Understanding 对应一个节点；父 Domain 包含子 Domain。
- 每条真实 Connection 对应一条无方向边；只保留两个端点都在当前范围内的边。
- 不根据时间、Domain、标题、语义相似度或 AI 结果生成边。
- 孤立 Understanding 正常进入布局，不隐藏、不降级、不标红。

#### 布局规则

- 使用成熟图谱库提供的力导向布局，不自行实现物理模拟。
- 初次进入时节点以短暂可见动画自然展开，收敛后停止持续扰动。
- 布局展开期间保持 hover、选择、缩放和平移可用，不用“布局完成”作为交互锁。
- 布局收敛后不自动执行 fit view；只有用户点击「适应画布」时才改变视口。
- 用户拖动节点时该节点跟随指针，周围布局自然响应；释放后重新收敛。
- 同一份图数据不因无关 React render 重启布局。
- 打开和关闭详情不重建图实例，不改变节点坐标和视口。

#### Zoom / Pan

- 滚轮围绕指针位置连续缩放；拖动画布平移。
- 节点、标签和边属于同一场景坐标系，缩放时视觉尺寸关系一致，不出现标签悬浮在错误位置或与节点分离。
- 缩小时逐步减少标签数量；hover / selected 节点标签始终可见。
- 提供左下角缩小、放大、适应画布三个图标按钮；按钮复用现有 shadcn Button。
- 不显示 minimap，除非真实大规模知识库验证无法定位。

#### Node / Edge visual

- 默认节点是无描边的中性圆点，颜色使用 `muted-foreground` 语义，保持足够点击热区。
- 节点视觉半径可在很小范围内随真实 Connection 数量变化；孤立节点保留明确的最小尺寸。
- 默认边使用 `muted-foreground` 语义细线并保持可辨识，不显示箭头。
- 标签使用 UI sans 字体和 foreground 语义，不使用卡片背景、边框或阴影。
- 默认只让当前缩放级别下可读的标签出现，避免满屏文字。
- 图谱保持 Obsidian 式单色视觉；默认、hover 与 selected 只改变同一中性色系的明度、透明度和尺寸，不混用 primary 色。

#### Hover state

- Hover 节点自身变为 foreground 强调色并显示标签。
- 直接邻居与相连边保持清晰；无关节点、标签和边降低透明度，但仍能感知其存在。
- 移开后恢复默认状态。
- Hover 只用于预览，不打开详情，不改变持久 selection。
- Hover、移出和邻域透明度变化使用图谱引擎的短时状态动画，不瞬时跳变。

#### Selected state

- 点击节点后将其设为 selected，并在右侧打开对应 UnderstandingDetail。
- selected 节点使用 foreground 强调；邻居和相连边保持清晰；无关内容退后。
- Hover 其他节点时，selected 及其邻域持续可见，同时显示 hover 节点及其邻域；hover 不覆盖 selected。
- 点击画布空白或关闭详情都会关闭详情并清除 selected。
- 点击另一个节点直接切换右侧详情和 selected。

### GraphControls

```text
div.absolute.bottom-4.left-4
  Button(ZoomOut)
  Button(ZoomIn)
  Button(FitView)
```

- 使用一个纵向 `ButtonGroup` 语义容器。
- Button 使用 icon-only outline/ghost 现有变体，具备 aria-label 和 tooltip。
- 不加入布局参数、斥力、边长、标签开关或过滤设置。

### UnderstandingDetailPanel

- 复用现有 `UnderstandingDetail`、`ResizablePanel` 和 `ResizableHandle`。
- 默认占知识漫步工作区约 40%，可在 34%–56% 调整。
- 打开详情时图谱实例、节点坐标、相机状态和 selected 节点全部保留。
- 面板宽度变化只触发图谱容器 resize，不重新 fit view。
- 关闭详情后图谱恢复完整宽度，视口不跳回中心。

## 4. Token Review

### Surface Hierarchy

- DomainNavigation 使用窗口底层材质；图谱和详情使用 background。
- 图谱靠节点、标签、真实边和交互状态形成层次，不增加彩色背景、渐变或卡片 surface。

### Typography

- Header 领域名使用 `text-sm font-medium`，数量使用 `text-xs text-muted-foreground`。
- 图谱标签保持接近 Obsidian 的小号 UI 文本，并随 zoom 进入同一视觉变换。
- 不用超大标题、粗体统计或数字制造成就感。

### Interaction State

- 默认：中性节点 + 清晰但不抢眼的中性边。
- Hover：当前邻域清晰，无关元素退后。
- Selected：foreground 节点 + 持久邻域，直到切换、点击空白或关闭详情；hover 不覆盖它。
- Focus：图谱控制按钮使用现有 `focus-visible`；画布本身具备可访问名称。
- 禁止 hover 位移、外发光、矩形选中背景或覆盖整条边的粗色带。

### Hard-coded Values

- React 层不写死颜色，统一从 CSS semantic tokens 解析后传给图谱主题。
- 图谱引擎必须使用数值的物理和缩放参数；这些参数集中在单一配置对象，不散落在事件处理器中。

## 5. Atoms 索引

| 组件                | Variant / 配置             | 使用位置                    |
| ------------------- | -------------------------- | --------------------------- |
| Button              | `ghost`, `size="icon-sm"`  | KnowledgeWanderEntry        |
| Button              | icon-only existing variant | GraphControls               |
| Tooltip             | existing configuration     | GraphControls               |
| Empty               | `className="h-full"`       | 空领域 / 查询失败           |
| EmptyMedia          | `variant="icon"`           | 空状态图标                  |
| ResizablePanelGroup | `orientation="horizontal"` | KnowledgeWanderPanelGroup   |
| ResizablePanel      | percentage constraints     | Graph / UnderstandingDetail |
| ResizableHandle     | `withHandle`               | 详情分隔                    |

## 6. 不做的决策

- ❌ **不保留连续阅读页** → 它把探索变成系统规定的线性阅读，缺少主动选择与领域整体感。
- ❌ **不保留瀑布流或卡片墙** → 它强调同屏内容密度，没有形成稳定的空间探索体验。
- ❌ **不提供视图切换** → 知识漫步只有图谱这一个明确入口，避免再次把未经验证的模式并列给用户。
- ❌ **不自行实现力导向、缩放或命中检测** → 使用成熟图谱引擎覆盖物理模拟和画布交互。
- ❌ **不推断 Connection** → 图上的边只表达用户已经建立的真实关系。
- ❌ **不增加配置面板** → 先复刻成熟的默认体验，真实需要出现后再暴露参数。
- ❌ **不显示进度或完成状态** → 图谱支持探索和回想，不承担复习任务或成就激励。
