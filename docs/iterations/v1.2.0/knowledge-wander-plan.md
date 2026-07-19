# v1.2.0 知识漫步计划

> 日期：2026-07-19
> 状态：Implemented
> 范围：Electron Capture、Contemplate 退役、知识瀑布流、Understanding 关系图谱

## 1. 结论

v1.2.0 删除独立的 Contemplate 产品入口，将其仍然有价值的「按领域回看内容」和「观察知识关系」能力合并进 Capture 内部的「知识漫步」模式。

知识漫步不是一套回顾方法，也不是随机推荐。它只提供同一批 Understanding 的两种表达：

- 瀑布流回答「这个领域里我已经写清楚了什么」。
- 图谱回答「这些 Understanding 通过真实 Connection 形成了什么形状」。

用户仍然通过左侧领域树选择范围，通过现有 Understanding 详情阅读、编辑和追溯 Context。产品顶层只保留 Capture 和 Agent。

## 2. 用户目标

用户会低频但持续地进入某个领域，重新阅读已经积累的 Understanding，恢复记录时的语境和心智，并逐渐形成对自己知识网形状的感知。

成功体验应当让用户：

1. 大致感知选中领域内已经积累了多少 Understanding。
2. 不进入逐条操作流程，也能连续读到每条 Understanding 的完整正文。
3. 在需要时切换图谱，查看真实 Connection，而不是被领域层级或系统推断出的结构主导。
4. 点击任意卡片后，在不丢失漫步位置的前提下打开原 Understanding。

## 3. 产品边界

### 3.1 本期包含

- Capture 领域栏底部新增「知识漫步」入口。
- Capture 内部增加普通模式与知识漫步模式，不新增顶层页面。
- 知识漫步沿用左侧当前选中的领域；选择父领域时包含其子领域。
- 瀑布流展示范围内全部 Understanding 的标题和完整正文，不截断、不总结。
- 瀑布流与图谱可以切换，瀑布流为默认视图。
- 图谱只展示 Understanding 及其真实 Connection；没有 Connection 的 Understanding 仍然出现。
- 两种视图点击卡片后，都在右侧打开现有 Understanding 详情区域。
- 从全局菜单和路由入口移除 Contemplate；旧 `/contemplate` 路径兼容跳转到 `/capture`。

### 3.2 明确不做

- 不做随机抽取、随机排序、换一批或自动游走。
- 不做每日回顾、回顾任务、进度、掌握度、评分或固定问题。
- 不做 AI 摘要、AI 聚类、语义关系或 AI 推荐下一条笔记。
- 不把 Domain、Context、状态或统计信息绘制成图谱一级节点。
- 不在图谱中创建或编辑 Connection。
- 不增加新的筛选器、图例、Dashboard 或保存视图。
- 不为瀑布流或图谱自研布局、虚拟滚动、缩放平移或拖拽引擎。
- 不保留 Contemplate 作为隐藏入口或平行实现。

## 4. 信息架构与交互

### 4.1 Capture 的两种内部模式

```text
Capture
├── 普通模式
│   └── Understanding list + Understanding detail
└── 知识漫步
    ├── 瀑布流 + optional Understanding detail
    └── 图谱 + optional Understanding detail
```

左侧 Domain tree 在两种模式中保持常驻并共享同一个 `selectedDomainId`。知识漫步不是新路由，切换模式不重载 Capture，也不复制领域选择状态。

领域栏底部放置一个常驻的「知识漫步」Button：

- 点击后进入知识漫步。
- 知识漫步激活时 Button 使用现有 selected/active 语义，并通过 `aria-pressed` 表达状态。
- 再次点击退出知识漫步，回到普通 Capture。
- 退出后保留最后打开的 Understanding，普通 Capture 直接在列表和详情中定位它。
- `captureMode` 只保留在本次应用会话，不持久化；重新打开应用仍从普通 Capture 开始。

### 4.2 领域范围

知识漫步只受左侧领域选择影响：

| 左侧选择 | 知识漫步范围                         |
| -------- | ------------------------------------ |
| 全部领域 | 全部 Understanding                   |
| 某个领域 | 该领域及其所有子领域的 Understanding |

知识漫步不读取普通列表当前的搜索词，避免隐藏筛选导致内容莫名缺失。瀑布流沿用 Capture 当前 Understanding 排序偏好，但不加入任何随机性；相同数据和排序设置必须得到相同顺序。

切换领域时：

- 瀑布流回到顶部。
- 图谱针对新数据重新布局并 `fitView`。
- 当前详情关闭，沿用现有 `selectDomain` 清理 Understanding selection 的行为。
- 顶部范围标题和数量同步更新。

### 4.3 知识漫步工作区

普通 Capture 的中间列表与右侧文档区在知识漫步时合并为一个连续工作区：

```text
CapturePage
  DomainNavigation (248px, existing)
  CaptureMain
    KnowledgeWanderWorkspace
      WanderHeader
      WaterfallView | GraphView
      UnderstandingDetailPanel (conditional, right)
    ContextualAgentDock (existing, conditional)
```

`WanderHeader` 只包含：

- 当前领域名称或「全部领域」。
- `N 条理解`。
- 瀑布流 / 图谱 ToggleGroup。

不增加解释性 banner、引导步骤或第二层筛选工具条。

### 4.4 瀑布流

瀑布流是每次进入知识漫步时的默认视图。只要知识漫步保持打开，切换到图谱后就停留在图谱；退出并再次进入知识漫步时重新从瀑布流开始。

每张卡片展示：

- Understanding 标题；无标题时沿用现有标题 fallback。
- 完整正文，不使用 `line-clamp`，不生成摘要。
- 最小必要 meta：更新时间；在「全部领域」范围下补充所属领域路径。

卡片不展示操作按钮、质量状态或 AI 内容；使用普通 Capture List 已有的图标语言展示 Context 数量和 Connection 数量。点击卡片打开右侧详情；右键行为不在本期扩展。

正文使用知识漫步专用的静态 Markdown renderer，复用 Milkdown 周边已经安装的 unified、remark-parse、remark-gfm、remark-rehype 和 rehype-stringify，并覆盖为舒展阅读样式；保留标题、列表、引用、代码、表格和图片等正文结构，Understanding 双链沿用编辑器的主色浅底标记。卡片负责完整呈现可读文本；Context 和编辑能力仍留在打开后的 `UnderstandingDetail`。

瀑布流使用占满可用宽度的双列阅读面，空间不足时回落为单列，不再随着宽屏扩展到三列以上。阅读面和卡片沿用 Capture 原有的安静背景、边框、hover 与 selected 状态。内容顺序是确定的，但视觉列由布局组件按高度平衡；富文本完成首轮测高后允许 Masonic 重建一次 positioner，使卡片可以跨列重新平衡。它不是从左到右的严格表格，也不承诺卡片在不同窗口宽度下保持同一列。

### 4.5 图谱

图谱只展示当前领域范围内的 Understanding：

- 每条 Understanding 都进入同一张 G6 画布，并对应一个小圆点。
- 每条 Connection 只有在两端节点都处于当前范围时才显示。
- 没有 Connection 的 Understanding 仍作为孤立圆点参与力导向布局。
- Domain 不作为节点或泳道；Context 不作为节点；不展示外部领域的补充节点。
- 节点之间不按层级、时间或领域强行规定方向。

节点只展示标题，不把正文塞入图谱节点。点击节点打开同一个右侧 `UnderstandingDetail`。

图谱交互由 G6 提供：

- 缩放、平移、节点拖动、标题字号固定和初始 `fitView` 使用 G6 内置 behavior 与 viewport API；不增加可见工具栏。
- 节点拖动只改变本次会话中的观察位置，不写回数据库。
- Hover 或选择节点时突出该节点及一跳邻居，其他节点和边降低视觉权重。
- 布局完成后停止力模拟，不让节点持续漂移。
- 只在领域范围或图数据变化时重新运行布局；打开详情不得触发重新布局。
- 同一数据范围内切换详情或瀑布流/图谱时，保留当前图谱 viewport 和已稳定的节点位置。

### 4.6 Understanding 详情

详情区域复用现有 `UnderstandingDetail`，不制作知识漫步专用 reader。

- 使用现有 `ResizablePanelGroup`、`ResizablePanel` 和 `ResizableHandle` 在漫步工作区右侧打开。
- 初始宽度和最小宽度沿用 Capture / Agent 现有面板节奏，不使用 Contemplate 当前的手写鼠标拖拽和像素宽度状态。
- 详情可以编辑正文、领域和 Context，并保留现有自动保存行为。
- 删除 Understanding 后关闭详情，同时从瀑布流和图谱移除对应项。
- 关闭详情后，瀑布流滚动位置或图谱 viewport 保持不变。
- 从详情打开 Contextual Agent 时继续使用现有 Capture Agent dock；知识漫步不创建另一套 Agent 集成。

## 5. 技术选型

### 5.1 瀑布流：`masonic`

使用 [`masonic`](https://github.com/jaredLunde/masonic) 提供可变高度卡片布局、响应式列数、尺寸测量和虚拟化。

选择理由：

- 完整正文使卡片高度不可预测，不能依赖固定行高。
- Understanding 数量会持续增长，不能一次挂载全部富文本卡片。
- `masonic` 已提供列定位、ResizeObserver 和 viewport virtualization，不在 Reflecta 内维护同类算法。
- v4.1.0 的 React peer requirement 为 `>=16.8`，可以与当前 React 19 工程配合。

不选择：

- 不使用 CSS columns：DOM 阅读顺序会按列流动，且缺少适合长期增长的虚拟化。
- 不用 `@tanstack/react-virtual` 自行拼装 Masonry：仓库虽已有该依赖，但列高平衡和动态尺寸定位会变成自研布局。
- 不使用五年未发布新版本且不虚拟化的 `react-masonry-css`。

### 5.2 图谱引擎：`@antv/g6`

使用 [`@antv/g6`](https://github.com/antvis/G6) v5 作为图谱的单一引擎，负责全部节点和边的渲染、布局、交互与缩放平移。React 只负责画布容器和右侧详情，不再保留 React Flow 适配层。

G6 在本次知识漫步第一次切到图谱时动态加载。随后瀑布流与图谱在知识漫步内部保持挂载，用可见性切换保留滚动位置、节点位置和 viewport；退出知识漫步或 Capture 卸载时调用 `graph.destroy()` 释放资源。Capture 普通模式和从未打开图谱的知识漫步不承担 G6 bundle 与 canvas 生命周期。

节点使用 G6 内置 `circle` 复刻 Obsidian Graph View 的小圆点；标题位于圆点下方，并随缩放阈值出现或隐藏。不引入 `@antv/g6-extension-react`，也不为 V1 编写自定义 G6 node class。节点、边和 selected/highlight state 的颜色从当前 Reflecta CSS semantic token 解析，不维护平行色板。

### 5.3 图谱布局：G6 内置 D3 Force

使用 G6 内置 `d3-force` 复刻 Obsidian Graph View 的整体形态，不直接安装 `d3-force`：

- `link` 让真实 Connection 参与布局。
- `manyBody`、`collide` 和轻量 `x` / `y` 力让全部节点形成稳定云团。
- 孤立节点保留在同一云团中，不额外标记或分区。
- 使用正常模式，不按 Domain 或其他系统属性聚类。
- 布局参数集中在图谱模块，以代表性 fixture 调整，不暴露给用户。
- 节点拖动使用 G6 内置 `drag-element-force` behavior，只改变本次会话的观察位置。
- 默认直接使用 G6 内置实现；只有真实大图性能数据证明主线程布局不足时，才启用 G6 自带 worker，不预先引入 WASM 或额外 layout package。

### 5.4 详情与 Design System

复用：

- `UnderstandingDetail`
- `ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle`
- `ToggleGroup`
- `Button`
- `Empty`
- `Skeleton`
- `Tooltip`
- `SimpleMarkdownPreview`
- Lucide icons

实施 UI 前必须先按 [`docs/references/ui/ui-spec-guide.md`](../../references/ui/ui-spec-guide.md) 产出 `design/knowledge-wander-ui-spec.md`，完成 Template、Organisms、Token Review 和 Atoms 索引后再写 UI 代码。

视觉约束：

- 沿用 Capture 的 `bg-background/45`、`bg-card/95`、`border` 和现有 typography 层级。
- 所有颜色使用语义 token，不出现硬编码色值或新的品牌色。
- Button、ToggleGroup、Empty 等状态优先使用现有 shadcn variant，不重写 hover、active、focus-visible 和 disabled。
- 瀑布流卡片与图谱节点来自同一视觉家族，但不要求同尺寸；都不得建立一套独立于 Capture 的阴影、圆角和字体体系。
- 卡片默认不放显式操作按钮；交互入口只由卡片本身、视图切换和详情关闭按钮承担。
- 保留 Electron titlebar drag/no-drag 约束，不覆盖 traffic light 区域。

## 6. 代码落点

建议新增：

```text
apps/electron/src/renderer/src/modules/capture/knowledge-wander/
├── index.tsx                       # KnowledgeWanderWorkspace
├── knowledge-wander-header.tsx
├── waterfall/
│   ├── index.tsx                   # masonic integration
│   └── understanding-card.tsx
├── graph/
│   ├── index.tsx                   # G6 lifecycle and viewport controls
│   ├── graph-data.ts               # summaries -> nodes/edges
│   └── graph-theme.ts              # Reflecta semantic tokens -> G6 styles
└── understanding-detail-panel.tsx
```

现有模块改动：

| 位置                                       | 改动                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `capture/index.tsx`                        | 根据 Capture mode 渲染普通工作区或 KnowledgeWanderWorkspace                                                   |
| `capture/store.ts`                         | 增加会话级 `captureMode`、`wanderView` 和切换 actions；只将既有 Capture preference 持久化，不持久化 mode/view |
| `capture/domain/components/DomainTree.tsx` | 增加底部「知识漫步」入口并保持 tree 可用高度                                                                  |
| `capture/queries.ts`                       | 复用现有 Understanding summary 查询；不新增 BFF                                                               |
| `router/index.tsx`                         | 顶层 routes 只保留 Capture / Agent；旧 Contemplate route 重定向                                               |
| `shared/layout/AppChromeMenu.tsx`          | 移除 Contemplate 菜单项                                                                                       |
| `modules/contemplate/`                     | 完成迁移后整体删除，不保留并行代码                                                                            |
| `apps/electron/package.json`               | 添加 `masonic`、`@antv/g6`；删除 `@xyflow/react`、`@dagrejs/dagre`、`d3-force`、`@types/d3-force`             |
| `renderer/style.css`                       | 删除 React Flow / Contemplate 专属样式，只保留知识漫步需要的 G6 plugin 容器样式                               |

现有 `UnderstandingSummaryDTO` 已包含完整 `body`、`domainIds`、`connectionIds`、时间和计数，V1 不修改数据库、IPC contract 或 server domain。

## 7. 实施顺序

### Task 1：冻结 UI 决策

1. 创建 `design/knowledge-wander-ui-spec.md`。
2. 以当前 Capture UI 为基准定义工作区、footer 入口、header、卡片、图谱节点和详情面板。
3. 完成 Token Review，确认没有 Contemplate 遗留的独立视觉语言。
4. 用静态 fixture 在真实 Electron 窗口确认 2、3、4 列瀑布流与详情打开状态。

完成条件：UI spec 状态为 Accepted，组件选择全部来自现有 design system 或计划内的布局库。

### Task 2：建立 Capture 内部模式

1. 为 Capture store 增加普通 / 知识漫步模式和瀑布流 / 图谱视图状态。
2. 在 DomainTree footer 增加「知识漫步」入口。
3. Capture main 根据 mode 切换工作区，保留领域树和现有 Agent dock。
4. 添加模式切换和领域切换的 store/component tests。

完成条件：不依赖 Contemplate route 即可进入和退出知识漫步；领域选择在两种模式间一致。

### Task 3：交付可用的瀑布流主路径

1. 安装 `masonic` 并接入 Capture 内部滚动容器。
2. 使用现有 summary query 获取选中领域及子领域的 Understanding。
3. 渲染完整正文卡片、范围标题、数量和空状态。
4. 保证卡片顺序确定，领域切换回到顶部。
5. 验证虚拟化只挂载 viewport 邻近卡片，正文高度变化后布局能重新测量。

完成条件：用户可以从领域树进入知识漫步，连续阅读该领域全部 Understanding 的完整正文。

### Task 4：复用 Understanding 详情

1. 使用现有 resizable primitives 建立右侧详情 panel。
2. 点击瀑布流卡片打开 `UnderstandingDetail`。
3. 关闭、编辑、删除和打开 Contextual Agent 沿用现有 Capture 行为。
4. 验证详情开关不重置瀑布流滚动位置。

完成条件：漫步和编辑之间不发生路由跳转，也不产生第二套详情组件。

### Task 5：交付关系图谱

1. 从 summary DTO 构建当前范围内的 node/edge 数据，只保留两端可见的真实 Connection。
2. 将全部 Understanding 作为小圆点交给 G6，只把真实 Connection 作为细线。
3. 动态加载 G6，并用 G6 内置 D3 Force、behavior 与 viewport API 提供类似 Obsidian Graph View 的画布交互。
4. 点击节点打开同一个详情 panel；选择节点突出一跳关系。
5. 缓存本次会话内稳定位置和 viewport，详情开关不得重新模拟。

完成条件：图谱包含范围内全部 Understanding 和真实 Connection；孤立节点仍在同一画布；标题随缩放出现或隐藏；节点稳定且不持续漂移。

### Task 6：退役 Contemplate

1. 移除全局菜单中的 Contemplate。
2. 删除 Contemplate route element，保留旧路径到 Capture 的兼容重定向。
3. 删除 `modules/contemplate/` 和专属测试。
4. 删除 `@xyflow/react`、`@dagrejs/dagre`、`d3-force`、`@types/d3-force`，确认无残留 import 和样式。
5. 更新受影响的 E2E helper、route snapshots 和版本文档。

完成条件：产品表面只剩 Capture + Agent，代码中不存在第二套漫步/图谱实现。

### Task 7：验证与发布

至少执行：

```bash
bun --cwd apps/electron test:renderer
bun --cwd apps/electron typecheck
bun --cwd apps/electron lint
bun --cwd apps/electron fmt:check
bun --cwd apps/electron build
bun --cwd apps/electron test:e2e
```

使用包含长短正文、空正文、无标题、子领域、孤立节点、环和跨领域 Connection 的 fixture 做人工视觉检查。

## 8. 测试重点

### Store / 数据单元测试

- 进入、退出知识漫步不改变 `selectedDomainId`。
- 知识漫步无随机排序，重复输入得到稳定顺序。
- 选择父领域包含子领域；选择「全部领域」包含全部 Understanding。
- 普通列表搜索词不影响知识漫步数据。
- Graph adapter 只生成真实 Connection，且边的两端必须都在可见范围。
- 孤立 Understanding 仍生成圆点，全部节点都不会丢失。
- G6 只在图数据或容器范围变化时重新 render/layout；详情 selection 改变不重新布局。

### 组件测试

- footer Button 可进入和退出知识漫步，并有可访问的 active state。
- 瀑布流正文没有 line clamp。
- 瀑布流最多双列，富文本测高后两列仍连续铺排。
- Understanding 双链与普通正文具有可辨别的静态样式。
- ToggleGroup 在瀑布流和图谱间切换。
- 两种视图点击卡片都打开相同详情 panel。
- 关闭详情后保留底层 scroll/viewport。
- loading、空领域和查询失败使用现有 Skeleton / Empty / error pattern。

### E2E 主路径

```text
打开 Capture
  -> 选择一个有子领域的 Domain
  -> 点击「知识漫步」
  -> 瀑布流展示该领域范围内完整正文
  -> 点击一张卡片并在右侧打开详情
  -> 关闭详情后仍停留在原位置
  -> 切换图谱
  -> 点击节点打开同一详情
  -> 退出知识漫步
  -> 普通 Capture 定位最后打开的 Understanding
```

另验证 AppChromeMenu 只显示 Capture 和 Agent，访问旧 `/contemplate` 不出现空白页。

## 9. 验收标准

- 顶层模块只有 Capture 和 Agent。
- Capture 领域栏底部存在「知识漫步」，无「随机」相关文案或行为。
- 知识漫步始终使用左侧选中的领域范围，父领域包含子领域。
- 瀑布流默认展示全部完整正文，不截断、不总结、不随机。
- 瀑布流最多双列并限制阅读宽度，不以增加同屏卡片数量换取信息密度。
- 正文中的 Understanding 双链使用与编辑器一致的主色浅底语义。
- 用户可以在瀑布流和关系图谱间切换。
- 图谱不使用 Dagre，不展示 Domain lane，只展示 Understanding 和真实 Connection。
- 图谱布局、渲染和画布交互由 G6 完成；仓库不包含自研布局或缩放平移引擎。
- 瀑布流由 `masonic` 完成布局和虚拟化；仓库不包含自研 Masonry 定位算法。
- 两种视图点击卡片都复用现有 `UnderstandingDetail` 和 resizable panel primitives。
- 打开或关闭详情不会丢失瀑布流滚动位置或图谱 viewport。
- UI 通过知识漫步 UI spec 的 Template、Token Review 和 Atoms 检查，未形成新的视觉系统。
- Contemplate 实现以及 `@xyflow/react`、`@dagrejs/dagre`、`d3-force`、`@types/d3-force` 被删除，旧路径安全重定向。
- renderer tests、typecheck、lint、format、build 和关键 E2E 通过。
