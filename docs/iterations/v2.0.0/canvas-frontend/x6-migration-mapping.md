# React Flow → X6 迁移映射

> 日期：2026-08-21
> 范围：Canvas 前端自 `@xyflow/react@12.11.3` 迁往 `@antv/x6@3.1.8` + `@antv/x6-react-shape@3.0.1`
> 用途：先删干净所有 React Flow 逻辑、再按本映射重建，防止移植期留下双引擎屎山
> 原则：X6 能白嫖的内建/模型一律不写自定义等价物；纯业务逻辑保留并改型；数据契约（document.ts）不动

## 处置标记

| 标记       | 含义                                                    |
| ---------- | ------------------------------------------------------- |
| `删除`     | RF 专属机制，X6 模型直接取代，删无对应                  |
| `内建接管` | 删自定义代码，换 X6 插件 / 选项 / 模型 API              |
| `业务保留` | 引擎无关业务逻辑 / UI，保留并改接 X6                    |
| `改型重建` | 逻辑保留，改目标类型（RF node/edge → X6 cell / 纯 DTO） |

## A. `packages/ui/src/canvas/` 逐文件

| 文件                     | 实现内容                                                             | X6 对应                                   | 处置                 |
| ------------------------ | -------------------------------------------------------------------- | ----------------------------------------- | -------------------- |
| `CanvasGraph.tsx`        | RF 包裹 + 受控桥 + 事件桥 + SelectionToolbar + export                | X6 `Graph` 实例 + 插件                    | 内建接管 / 改型重建  |
| `nodes.tsx`              | 4 类自定义节点(理解卡/文本卡/组/引用卡) + Handle + Resizer + Toolbar | react-shape 注册 + Ports + Transform      | 业务保留 / 内建接管  |
| `edges.tsx`              | 自定义边 + 路径工具 + 样式菜单 + 标签编辑                            | X6 边 attrs + router/connector + 边 tools | 业务保留 / 内建接管  |
| `graph-document.ts`      | document ⇄ nodes/edges 映射 + 序列化                                 | X6 `toJSON/fromJSON` + `getData`          | 改型重建             |
| `graph-operations.ts`    | 打组/解组/删组级联（纯函数）                                         | X6 父子模型 + `removeCells`               | 改型重建（改纯 DTO） |
| `canvas-graph-bridge.ts` | `applyNodeChanges/applyEdgeChanges` + connection                     | （X6 模型即状态，无此层）                 | 删除                 |
| `dnd.ts`                 | HTML5 DnD payload 暂存                                               | X6 `Stencil` 插件（拖入统一走 Stencil）   | 删除                 |
| `shape-context.tsx`      | 展示数据 + 元素/边回写通道                                           | react-shape 同一 React 树，context 仍穿透 | 业务保留             |
| `document.ts`            | CanvasDocument/DTO 类型契约                                          | 引擎无关，不变                            | 业务保留（不动）     |
| `color-swatches.tsx`     | 色板 token → CSS                                                     | 引擎无关                                  | 业务保留             |
| `CanvasReadOnlyView.tsx` | 只读渲染（F1 三用）                                                  | X6 只读配置（禁拖/连/嵌/transform）       | 业务保留             |
| `CanvasZoomControls.tsx` | 缩放控件                                                             | 接 X6 `zoomIn/Out/zoomToFit`              | 业务保留             |
| `index.ts`               | 导出面                                                               | 改导出 X6 句柄；删 `toFlow*`              | 改型重建             |

### A1. `CanvasGraph.tsx`（核心，先拆再建）

RF 侧功能 → X6 落点：

1. `ReactFlowProvider` + `useNodesState/useEdgesState` + 受控 `<ReactFlow>` → `new Graph({ container })` 命令式实例；**状态来自 X6 model，不再用 React state 镜像节点/边**（这是最大的架构变化）。
2. `handleNodesChange/handleEdgesChange` + `reduceCanvasNodeChanges/EdgeChanges`（applyChanges） → **删除**。X6 model 即状态；改为订阅模型事件（`node:change:position`、`cell:added/removed`、`node:change:size`）→ 回写 document。
3. `handleConnect` + `appendCanvasConnection` → X6 连线交互（`connecting` 配置）后监听 `edge:connected`（或模型 `cell:added` 判 edge）→ 回写 document。
4. viewport 回写 → X6 视口事件（`graph.on('scale'...)`/`translate`）→ 存 viewport。
5. selection 回写 → `Selection` 插件 + `selection:changed` 事件 → cell id 数组给 `onSelectionChange`。
6. DnD（`onDragOver/onDrop` + drop 预览 + `screenToFlowPosition`）→ **删除**。拖入统一走 X6 `Stencil` 插件（自带侧边栏、拖拽、落点），不手写 HTML5 DnD，也不保留 dnd.ts 暂存 hack。
7. `SelectionToolbar`（多选打组/删除） → 业务 UI 保留；位置由 X6 `node.getBBox()` 屏幕坐标 + 视口计算（替代 `useViewport`+`getNodesBounds`）。
8. 初始视口恢复 / fitView → X6 `graph.zoomToFit()`、`graph.zoom()+pan()`（恢复已存视口）、`graph.centerCell()`（新增节点定位）。
9. `exportPng`（`toPng` 抓 `.react-flow__viewport` + `getNodesBounds`/`getViewportForBounds`）→ `Export` 插件 `graph.exportPNG()`。**删 html-to-image + 两个 bounds 工具**。
10. `deleteKeyCode=Backspace`、`panOnDrag`、`panOnScroll`、`snapToGrid`、`selectionOnDrag`、`SelectionMode.Partial`、`onlyRenderVisibleElements` → X6 `interacting` 交互默认 + `Grid` 吸附 + `Selection` rubberband + `virtual:true`。
11. 句柄方法（`reload/addElement/updateEdge/deleteElement/deleteEdge/groupSelection/ungroupSelection/deleteGroup/exportPng`）→ X6 实例方法 + graph-operations（业务）+ Export 插件。命名保持，调用方（workspace）改动最小。
12. 只读 （`nodesDraggable/nodesConnectable/elementsSelectable=false`） → X6 `interacting` 全局 / `node.setInteracting` 禁拖禁连禁嵌 + `Transform` 关闭。
13. `Background`（gap20/size1）+ `MiniMap` → X6 `grid` 选项（可见网格）+ `MiniMap` 插件。

### A2. `nodes.tsx`

RF 专属部分逐个替换，卡片内容本身是业务 React：

| RF 使用                           | X6 对应                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `nodeTypes` + `NodeProps`         | react-shape `register({ shape: kind, component, effect })`                  |
| `Handle`（左 target / 右 source） | X6 `ports` 分组（left/right）+ `magnet:true`                                |
| `NodeResizer`                     | `Transform` 插件（resizing）                                                |
| `NodeToolbar`                     | X6 `node tools`（boundary/button）或保留业务工具栏，用 `node:selected` 显隐 |
| `selected/dragging` props         | X6 `node:change:selected` / 拖拽事件 + react-shape `effect` 重渲染          |
| `nodrag/nopan/nowheel`            | X6 `magnet`（port）、`interacting` 配置、port 的 `navigable`                |
| Group 右键菜单 + 组名徽章         | 业务保留；组 = X6 parent node，`ContextMenu` trigger 改接 X6 事件           |
| 理解卡/文本卡/引用卡 占位/正文    | 业务保留，`useCanvasShapeData` context 不变                                 |

### A3. `edges.tsx`

| RF 使用                                                        | X6 对应                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `BaseEdge` + `getBezierPath/getStraightPath/getSmoothStepPath` | X6 边内建渲染 + `connector`/`router`（curve/straight/orthogonal）           |
| `EdgeToolbar`                                                  | X6 边 tools（`vertices`/`segments`）或保留业务样式菜单                      |
| `EdgeLabelRenderer` + contenteditable 标签编辑                 | X6 边 label（`edge.setLabels`）+ 标签工具（X6 有 label 编辑/`node-editor`） |
| `markerEnd`（MarkerType）                                      | X6 `marker-start/end` attrs（color 一并）                                   |
| 样式（color/width/linestyle）                                  | X6 `stroke/strokeWidth/strokeDasharray` attrs                               |
| EdgeStyleMenu（routing/线型/线宽/箭头）                        | 业务 UI 保留，写回 X6 attrs + `connector/router`                            |

### A4. `graph-document.ts`（改型重建，数据契约不变）

- 其余映射目标从 RF `Node[]/Edge[]` 改为 X6 cell：
  - `toFlowNode/toFlowEdge/toFlowData` → `toX6Cells(document)`（`graph.fromJSON` 或手动 addNode/addEdge，`node.getData()/edge` 存 element/edge DTO）；
  - `nodeToElement/edgeToEdge/toCanvasDocument` → 从 X6 cell 回读：`node.getData()` + `node.position()/size()/getParent()`；边 `edge.getSource()/getTarget()` + attrs → DTO；
  - id 零映射不变式保留：`element.id == cell id`；
  - 子元素相对坐标：X6 `getPosition({relative:true})`（源码已确认）转换，文档模型不变；
  - `toGroupNodeStyle` → 写 X6 node attrs 而非 CSS 变量。

### A5. `graph-operations.ts`（改型重建：纯逻辑提出来，类型转纯 DTO）

- `groupSelectedNodes/ungroupNodes/deleteGroupBranch` 目前操作 RF `Node[]`（依赖 `measured/width/position/parentId`）。
- 重构为**操作 `CanvasElementDTO[]`（引擎无关）**：几何/parentId 全来自 DTO，`absolutePosition` 计算不变。
- 好处：X6 打组命令直接调用同一批纯函数，且现有 COMMAND 测试几乎不重写。
- X6 只提供 embedding 原语；打组命令 UX（生成父节点/解组/删组级联）+ 落地到 X6 model（`parentId`、`removeCells`）仍由这些纯函数驱动。

### A6. `canvas-graph-bridge.ts`（删除）

`applyNodeChanges/applyEdgeChanges/onConnect 桥` 是 RF 受控模式的专属层。X6 里 model 即状态、变化直接发生在 cell 上，无此桥。改为在 `CanvasGraph` 内订阅 X6 模型事件，做「模型 → document」单向同步。（对应旧测试 suit 一并删，见 §C。）

### A7. `shape-context.tsx`（业务保留）

`CanvasShapeDataProvider / CanvasElementUpdate / CanvasEdgeUpdate` 是 React context 通道，与引擎无关——react-shape 渲染的卡片仍在同一 React 树，context 直接穿透。`editingEdgeId` 概念保留，但触发源从 `onEdgeDoubleClick` 改为 X6 `edge:dblclick` 事件。

## B. `apps/electron/.../canvas/workspace/` 逐文件

| 文件                        | RF 耦合点                                                                        | X6 对应                                                     | 处置                |
| --------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------- |
| `CanvasWorkspace.tsx`       | graphRef 句柄、`graph.getNode/getEdge/fitView/setEdges/zoomIn/Out`、Cmd+G 快捷键 | X6 `getCellById/zoomToFit/centerCell/zoom` + Selection 事件 | 改型重建            |
| `CanvasToolbar.tsx`         | `handle.exportPng`                                                               | X6 `Export` 插件（经新句柄）                                | 业务保留            |
| `CanvasLibraryPanel.tsx`    | HTML5 DnD `setDndElement`                                                        | 拖入走 X6 `Stencil`，删 `setDndElement`                     | 删除 DnD / 业务保留 |
| `CanvasSearchOverlay.tsx`   | 结果定位用 `graph.getNode/getEdge/fitView`                                       | X6 `getCellById` + `center/zoomToFit`                       | 改型重建            |
| `canvas-workspace-model.ts` | 无（document 上的搜索索引 / 面板路由）                                           | —                                                           | 业务保留（不动）    |
| `element-factory.ts`        | id==node id 注释                                                                 | cell id                                                     | 业务保留（不动）    |

### B1. `CanvasWorkspace.tsx` 关键改型

- `graphRef.current.graph.getNode/getEdge`（`onSelectSearchResult`）→ X6 `graph.getCellById(id)`；定位用 `graph.centerCell(cell)` / `graph.zoomToFit`。
- `graph.setEdges`（选中搜索到的边）→ X6 `cell.addTools`/`cell.setSelected`（配合 Selection 插件）。
- `graph.fitView({nodes})` → X6 `graph.zoomToFit({cells})` 或 `centerCell`。
- `zoomIn/zoomOut/fitView`（CanvasZoomControls）→ X6 `graph.zoomIn/zoomOut/zoomToFit`。
- **`useCanvasWorkspaceHotkeys` 的 Cmd+G/Cmd+Shift+G 分组 → 删除**（采纳：分组只用页面按钮/右键，不走快捷键）。Cmd+F 搜索保留与否按需；若保留走页面按钮。
- **删除工具栏文本卡拖入**：`CanvasTextTool` 的 `draggable` + `setDndElement` + `DND_MIME` 一并删，文本/理解/画布引用拖入统一由 X6 `Stencil` 提供（工具栏、库面板不再各自手写 DnD）。
- 事件桥（文档/视口/选中 → atoms + 防抖保存）→ 全部改由 X6 模型/插件事件触发，atoms 与 debounced-latest-saver 逻辑不动。

## C. 测试套件映射

| 旧测试                                                                 | 域              | 对应 X6                                                       |
| ---------------------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `graph-document.test.ts`                                               | DOC             | 改型：目标从 RF nodes/edges 改为 X6 cells / 纯 DTO；断言保持  |
| `graph-operations.test.ts`                                             | COMMAND         | 保留：after 改纯 DTO 后几乎不改                               |
| `canvas-graph-bridge.test.ts` + `canvas-graph.test.tsx`                | BRIDGE          | 删除（RF 受控桥不存在）；新增 X6 模型事件 → document 同步测试 |
| `canvas-nodes.test.tsx` / `canvas-edges.test.tsx`                      | RENDER          | 改型：react-shape 组件渲染 + ports/attrs                      |
| Electron ROUTE/WORKSPACE spec（`react-flow-input-routing.spec.ts` 等） | ROUTE/WORKSPACE | 改型：输入路由改 X6 交互默认；保存/搜索/导出断言保持          |

## D. RF API → X6 API 速查

| React Flow                                | X6                                                  |
| ----------------------------------------- | --------------------------------------------------- |
| `ReactFlowProvider` + 受控 hooks          | `new Graph({ container })`，无 provider             |
| `applyNodeChanges/applyEdgeChanges`       | 删除（model 即状态）                                |
| `onNodesChange/onEdgesChange`             | 订阅 `node:change:*` / `cell:*` 模型事件            |
| `onConnect`                               | `edge:connected`（或模型加边事件）                  |
| `onViewportChange`                        | `graph.on('scale'/'translate')` / `after:pan`       |
| `onSelectionChange`                       | `Selection` 插件 `selection:changed`                |
| `screenToFlowPosition`                    | `graph.clientToLocal`                               |
| `fitView` / `setViewport`                 | `graph.zoomToFit` / `zoom()+pan()`                  |
| `getNodesBounds` / `getViewportForBounds` | `graph.getCellsBBox()` / 交给 Export 插件           |
| `getBezierPath` 等路径工具                | `connector` / `router`（curve/straight/orthogonal） |
| `Handle`                                  | `ports` + `magnet:true`                             |
| `NodeResizer`                             | `Transform` 插件                                    |
| `NodeToolbar` / `EdgeToolbar`             | X6 `tools` / 保留业务 UI                            |
| `nodrag / nopan / nowheel`                | `interacting` / `magnet` / port `navigable`         |
| `Background` + `MiniMap`                  | `grid` 选项 + `MiniMap` 插件                        |
| `onlyRenderVisibleElements`               | `virtual: true`                                     |
| `deleteKeyCode="Backspace"`               | X6 删除默认 / `Keyboard` 插件                       |
| `MarkerType`                              | `marker-start/end` attrs                            |
| `toPng`(html-to-image) 导出               | `Export` 插件 `exportPNG`                           |
| `parentId` + 相对坐标                     | parent/child + `getPosition({relative:true})`       |
| Cmd+G/Cmd+Shift+G 打组解组                | **删除**（改页面按钮 / 右键菜单）                   |

## E. 迁移顺序（防屎山）

1. **删干净 RF**：改 `graph-document` 为纯 DTO 序列化（去 `@xyflow/react`）、删 `canvas-graph-bridge.ts`、`graph-operations` 改纯 DTO、删所有 `@xyflow/react` import 与测试 — 仓库无 `@xyflow/react` 残留；
2. 建 X6 adapter：`CanvasGraph` 用 X6 `Graph` 重建，先接「渲染 + 模型事件 → document 同步 + 视口 + DnD + export」；
3. 接插件：History/Snapline/Clipboard/Selection/MiniMap/Stencil/Keyboard(按需)/Transform；且拖入统一走 `Stencil`（删 dnd.ts / dropPreview / toolbar 与 library 的 `setDndElement`）。
4. react-shape 四类卡片 + ports + Transform 替换 nodes/edges；
5. workspace 改接 X6 句柄、删 Cmd+G 快捷键；
6. 测试按 §C 改型；
7. 删 `@antv/x6` 之外无 `@antv/x6-react-shape` 残留、移除 `@xyflow/react` 依赖。

> 存量文档（react-flow-*.md）保留为历史对照；`x6-feature-research.md` / `x6-integration-principles.md` 为现行依据。
