# v1.2.0 知识漫步图谱改版计划

> 日期：2026-07-20
>
> 状态：Implemented
>
> 范围：完整删除连续阅读页，再从干净 Capture 基线重建 Obsidian 式领域图谱
>
> 产品依据：[知识漫步价值主张](knowledge-wander-value-proposition.md)
>
> UI 依据：[Obsidian 式知识漫步图谱 UI Spec](design/knowledge-wander-ui-spec.md)

## 0. 完成记录

- 连续阅读实现已在 `0388fcdb` 中完整删除并通过干净 Capture 基线验证。
- 新版图谱已在 `5090e70c` 中实现：G6 `d3-force`、节点拖拽、画布平移缩放、hover / selected 邻域、领域范围切换和右侧现有 UnderstandingDetail。
- 图谱输入只包含当前 Domain（含子 Domain）的 Understanding 与真实 Connection；孤立 Understanding 保留为可进入节点。
- 普通 Capture 继续使用原列表工作区；知识漫步与 G6 通过 lazy import 独立加载。
- renderer / main / server / CLI 单元测试、全仓 typecheck、lint、format、Electron build 和 4 条知识漫步 E2E 均已通过。

## 1. 改版结论

知识漫步只有一个主要表面：当前 Domain 对应的力导向图谱。

每条 Understanding 都是节点，真实 Connection 是无方向边，孤立 Understanding 正常参与布局。用户通过平移、缩放和 hover 辨认内容，点击节点后在右侧打开现有 UnderstandingDetail；关闭详情后保留图谱节点位置、视口和探索上下文。

本轮不保留连续阅读、瀑布流、卡片墙或视图切换，也不增加随机、推荐、阅读路径、进度和成就表达。

## 2. 技术选型

### 采用 `@antv/g6@^5.1.1`

G6 作为唯一图谱引擎，直接覆盖：

- Canvas 渲染和元素命中检测。
- `d3-force` 力导向布局及迭代动画。
- `drag-element-force` 节点拖拽与实时布局响应。
- `drag-canvas`、`zoom-canvas`、`hover-activate` 和 `click-select` 成熟行为。
- 节点、边和标签处于同一场景变换中的缩放。
- `zoomBy`、`fitView` 和 `resize` 视口 API。
- 元素 state 与邻居 degree，用于 Obsidian 式 hover / selected 聚焦。

不再自行实现力导向、相机、缩放、节点拖拽、命中检测或 Canvas renderer。

### 为什么不采用 Sigma + Graphology + ForceAtlas2

Sigma 是成熟的 WebGL 图渲染器，但完整覆盖本轮需求还需要同时组合 Graphology、ForceAtlas2 worker、拖拽和交互 reducers。当前知识库规模约为数百个节点，G6 的单引擎能力已经足够，并能用更少的依赖和更短的生命周期代码覆盖同一结果。

### 官方能力依据

- [G6 D3 Force 布局](https://g6.antv.antgroup.com/en/manual/layout/d3-force-layout)
- [G6 Force 节点拖拽](https://g6.antv.antgroup.com/en/manual/behavior/drag-element-force)
- [G6 Hover Activate](https://g6.antv.antgroup.com/en/manual/behavior/hover-activate)
- [G6 Click Select](https://g6.antv.antgroup.com/en/manual/behavior/click-select)
- [G6 Viewport API](https://g6.antv.antgroup.com/en/api/viewport)

## 3. 删除连续阅读实现

任何新图谱代码开始前，先完整删除：

- `capture/knowledge-wander/` 当前连续阅读组件。
- Capture store 中的 `captureMode`、`CaptureMode` 和 `toggleKnowledgeWander`。
- DomainTree 底部的知识漫步入口。
- Capture 页面加载 KnowledgeWanderWorkspace 的分支和 lazy import。
- 当前连续阅读的 feature、E2E spec 和 store test。
- 连续阅读专用 test id、文案和 TanStack Virtual 调用。

`@tanstack/react-virtual` 仍被 Capture UnderstandingList 使用，因此保留该依赖。

删除完成后运行 renderer tests、typecheck、lint、format 和 build，证明普通 Capture 在没有知识漫步的情况下独立成立；以单独 commit 保存这个干净基线。

## 4. 新版代码结构

```text
capture/
├── index.tsx
├── store.ts
├── domain/components/DomainTree.tsx
└── knowledge-wander/
    ├── index.tsx
    ├── graph.tsx
    ├── graph-data.ts
    └── graph-data.test.ts
```

职责保持单一：

- `index.tsx`：查询当前 Domain 数据、组合 Graph 与现有 UnderstandingDetail、处理空态和分栏。
- `graph.tsx`：拥有一个 G6 Graph 实例，配置布局、主题、behavior、视口控制和实例清理。
- `graph-data.ts`：把 UnderstandingSummaryDTO 转成稳定、无重复的 G6 nodes / edges。
- `graph-data.test.ts`：证明孤立节点、范围外 Connection、自连接和双向重复边的规则。

不新增 adapter class、graph store、专用 hook、custom renderer、独立 theme 模块或配置面板。

## 5. 数据规则

### 节点

- 使用 `useCaptureUnderstandingList({ selectedDomainId, includeDescendants: true })` 获取当前范围。
- 每条 UnderstandingSummaryDTO 生成一个节点。
- `id` 使用 Understanding id；`label` 使用现有 `getUnderstandingTitle` fallback。
- 节点尺寸只在有限范围内随当前图中的真实 degree 变化，孤立节点保留明确最小尺寸。
- 节点按 id 排序后交给图谱，确保同一数据集的输入稳定。

### 边

- 只使用 DTO 中已有的 `connectionIds`。
- 只保留两个端点都存在于当前 Domain 范围的 Connection。
- 忽略自连接。
- Connection 在图谱中按无方向关系处理；`A → B` 与 `B → A` 使用规范化端点 key 去重。
- 不生成时间边、Domain 边、语义相似边或 AI 推断边。

## 6. G6 实例边界

### 创建与销毁

- KnowledgeWanderWorkspace 保持 lazy-loaded，G6 不进入 Capture 初始 bundle。
- `graph.tsx` 挂载时创建一个 Graph，卸载时调用 `destroy()`。
- 同一 Domain 内 selected Understanding、详情开关和 React render 不重建 Graph。
- Theme 改变或 Domain 拓扑真正改变时才替换必要配置 / 数据。
- 使用 ResizeObserver 调用 `graph.resize()`；面板 resize 不执行 `fitView()`。

### 布局

- 使用 `d3-force`，开启迭代动画。
- 使用 G6 自带 many-body、link、collide、x / y forces，不创建物理模拟代码。
- 初次 graph render 后只执行一次 fit view。
- 使用 `drag-element-force`；拖拽时重新加热布局，释放后自然收敛。
- 不在 hover、selected、详情打开或普通 resize 时重新 layout。

### 缩放与标签

- 使用 `zoom-canvas` 处理围绕指针的滚轮缩放。
- 节点、边与 label 使用 G6 场景元素，不通过额外 DOM overlay 绘制标签。
- 使用 G6 label visibility / zoom behavior 控制密度；hover 和 selected 节点强制显示 label。
- 左下角控制调用 `zoomBy(0.8)`、`zoomBy(1.25)` 和 `fitView()`。
- 设定合理 zoomRange，避免节点和标签进入不可恢复的极端比例。

### Hover 与 Selected

- 使用 `hover-activate`，`degree: 1`，只对 node 生效。
- Hover 节点、直接邻居和相连边进入 active；其他元素进入 hover-inactive。
- 使用单选 `click-select`，`degree: 1`，selected、selected-neighbor 和 selected-inactive 使用独立 state 名称。
- G6 behavior 负责鼠标状态增删，避免在 React mouse event 中遍历全图。
- 点击回调只负责把 node id 交给 Capture store 并打开详情。
- React selectedUnderstandingId 改变时只同步持久 selection；关闭详情时批量清除 selection states。
- Hover state 优先于当前 selection 进行临时预览，移开后恢复持久 selection。

## 7. 实施顺序

### Task 1：保存删除后的干净 Capture 基线

- 删除第 3 节列出的全部连续阅读实现。
- 搜索确认不存在连续阅读 test id、virtualizer 或组件名。
- 运行 renderer tests、typecheck、lint、format 和 build。
- 单独 commit，确保后续图谱实现可以从该提交完整审计。

### Task 2：引入 G6 与纯数据转换

- 在 Electron package 中加入 `@antv/g6@^5.1.1` 并更新 lockfile。
- test-first 编写 graph-data tests。
- 实现节点、孤立节点和规范化 Connection edge 转换。

### Task 3：实现图谱画布

- 创建单一 G6 Graph 实例。
- 配置 `d3-force`、force drag、pan、zoom、hover 和 click behaviors。
- 从 design system CSS variables 读取 semantic colors，配置默认 / hover / selected states。
- 添加 zoom out、zoom in、fit view 控制。
- 添加可访问的图谱名称和节点入口，不把 Canvas 作为唯一不可访问操作路径。

### Task 4：接回 Capture 与详情

- 恢复最小 `browse | wander` session state 和 DomainTree 入口。
- Capture lazy-load KnowledgeWanderWorkspace。
- 点击节点打开现有 UnderstandingDetail resizable panel。
- 详情开关只 resize 图谱，保留坐标、缩放和 selected。
- Domain 切换清理旧 selection，替换 graph data，并为新范围执行一次布局和 fit view。

### Task 5：自动化与视觉验证

- 重写 feature 与 E2E，只描述图谱探索和详情往返。
- 单元测试 graph-data 与 store toggle 稳定规则。
- E2E 验证 Domain 范围、孤立节点可进入、点击节点打开详情、关闭后 selection 清除、旧 Contemplate 重定向。
- 在真实 Electron 窗口检查初始 force 动画、拖拽响应、滚轮缩放、字体随缩放、hover 邻域和 selected 邻域。
- 分别检查全部领域、只有两个节点的领域、孤立节点为主的领域和详情打开状态。

## 8. 验收标准

- 连续阅读实现已在独立提交中完整删除，新图谱不是在旧组件上改造。
- 知识漫步只有图谱一个主要表面，没有连续阅读、瀑布流和视图切换。
- 当前 Domain 及子 Domain 的全部 Understanding 都出现，包括孤立节点。
- 图上的每条边都对应真实 Connection，且不存在范围外、自连接或双向重复边。
- 初次布局和节点拖拽具有可见、自然且会收敛的 force 动画。
- 滚轮缩放围绕指针发生；节点、边和文字处于同一视觉缩放关系。
- Hover 清晰突出当前节点、邻居和边；移开后准确恢复 selected 或默认状态。
- 点击节点保持 selected 并打开右侧现有详情；切换节点更新详情；关闭详情保持视口并清除 selected。
- 打开 / 关闭详情和普通 resize 不重建 Graph、不重新布局、不自动 fit view。
- 图谱视觉使用当前 design system semantic tokens，同时保持接近 Obsidian 的中性圆点、细边和小标签。
- 没有手写 layout、相机、zoom、drag、hit-test 或 Canvas renderer。
- 顶层仍只有 Capture 与 Agent；旧 `/contemplate` 安全回到 Capture。
- renderer tests、typecheck、lint、format、build 和知识漫步 E2E 全部通过。
