# React Flow 功能全景调研

> 调研日期：2026-08-19  
> 基准版本：`@xyflow/react@12.11.3`（仓库当前锁定版本）  
> 范围：React Flow 官方站点中的 OSS Core、官方示例、React Flow Pro、React Flow UI 与官方推荐的外部生态  
> 事实来源：仅使用 React Flow 官方文档、API Reference、Examples 与产品页面

## 1. 背景

本调研要解决的不是“画布应该有哪些功能”，而是更基础的事实问题：**React Flow 到底承诺了什么，哪些能力只是示例，哪些能力需要 Reflecta 自己拥有。**

React Flow 官方首页将其定义为构建 node-based editor 与 interactive diagram 的 React 组件，开箱能力包括节点拖动、缩放、平移、多选和元素增删。但官方展示页还包含大量需要显式配置、复制示例代码、购买 Pro 或接入第三方库才能得到的能力。若不区分这些层级，“官方有 demo”很容易被误写成“默认已实现”。

本报告因此不以功能名称做简单清单，而以**能力归属**为第一分类维度。

## 2. 调研范围与产品层

| 层级                 | 定义                                                 | 能否作为默认行为基准                   |
| -------------------- | ---------------------------------------------------- | -------------------------------------- |
| OSS Core 默认行为    | `<ReactFlow />` 在未覆盖相关 prop 时提供的行为       | 可以；这是 Reflecta 的首要基准         |
| OSS Core 可配置能力  | Core 已提供，但必须传 prop、组件、数据或事件桥才生效 | 只能以明确配置后的行为为基准           |
| 官方 OSS 示例 / 配方 | Examples / Learn 中的参考实现                        | 不可以；复制后才成为产品能力           |
| React Flow Pro       | 付费示例、模板和支持                                 | 不可以；不是 OSS Core 能力             |
| React Flow UI        | 基于 shadcn/ui 与 Tailwind 的可复制组件 / 模板       | 不可以；是独立 UI 层且会复制代码进项目 |
| 外部生态             | ELK、Dagre、Yjs、浏览器 DnD 等                       | 不可以；React Flow 只提供集成基础      |

调研依据包括 [React Flow 首页](https://reactflow.dev/)、[API Reference](https://reactflow.dev/api-reference)、[Examples 总览](https://reactflow.dev/examples/overview)、[Pro Examples](https://reactflow.dev/examples/pro-examples)、[React Flow UI](https://reactflow.dev/ui) 及 Learn 文档。

## 3. 调研结果

### 3.1 产品形态基础功能总览

| 能力域 | OSS Core 默认                         | Core 可配置                                                     | 官方 OSS 配方                                 | Pro / 外部                                  |
| ------ | ------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| 节点   | 拖动、点击选择、键盘选择与移动、删除  | 自定义节点、Handle、resize、toolbar、focus、drag handle、extent | 旋转、相交检测、邻近连接、压力测试            | 节点动画、形状库（Pro）                     |
| 边     | 选择、删除、默认 Bezier、创建连接基础 | 5 类内置边、自定义边、标签、marker、重连、校验                  | floating、temporary、edge toolbar、删除时重连 | 智能路由、可编辑边（Pro）                   |
| 视口   | 拖动画布平移、滚轮/捏合缩放、双击缩放 | zoom/pan 开关、范围、fitView、snap grid、visible-only rendering | contextual zoom、触摸、保存恢复               | 服务端图片（Pro）                           |
| 选择   | 点击、Shift+拖拽框选、平台修饰键多选  | selectionOnDrag、full/partial、选择事件、自动平移               | lasso（白板配方）                             | helper lines、selection grouping（Pro）     |
| 结构   | 节点与边渲染                          | parentId、extent、expandParent、z-index                         | 基础 sub-flow                                 | 动态 parent-child、折叠展开（Pro）          |
| 布局   | 无布局引擎                            | 提供测量、坐标和 viewport API                                   | Dagre、ELK、D3 等集成示例                     | 自动/动态/力导向布局（部分 Pro）            |
| 状态   | 受控或非受控模式                      | change handlers、hooks、instance API、JSON 序列化               | save/restore、状态管理指南                    | copy/paste、undo/redo、collaboration（Pro） |
| 白板   | 不是产品定位                          | 可用底层事件与 viewport API 扩展                                | rectangle、eraser、lasso                      | freehand（Pro）                             |
| UI     | 必要基础样式与公开状态 class          | Background、Controls、MiniMap、Panel 等                         | Tailwind / dark / turbo 示例                  | React Flow UI、Workflow Editor 模板         |
| 工程   | DOM 渲染、无障碍基础                  | SSR/SSG 尺寸配置、性能选项、ARIA 文案                           | Playwright/Cypress 测试建议                   | 多人同步需 CRDT/服务（外部）                |

### 3.2 OSS Core：默认行为与可配置面

#### 3.2.1 节点、边与连接

- React Flow 可用受控 `nodes` / `edges`，也可用非受控 `defaultNodes` / `defaultEdges`。受控模式必须正确处理 `onNodesChange` / `onEdgesChange`，否则视觉交互和应用状态会脱节。[Adding Interactivity](https://reactflow.dev/learn/concepts/adding-interactivity)
- 默认节点可拖动、可连接、可聚焦、可选择；节点被选中时默认提高层级。自定义节点由 React Flow 提供交互外壳，但**节点自身视觉完全由应用负责**。[Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- `<Handle />` 定义连接点；多 Handle 需要唯一 id，动态改变位置或数量后需要 `useUpdateNodeInternals`。隐藏 Handle 不能使用 `display: none`，否则尺寸计算失效。[Handles](https://reactflow.dev/learn/customization/handles)
- 内置边型包括 `default`/Bezier、`straight`、`step`、`smoothstep`、`simplebezier`。自定义边可组合 `BaseEdge`、路径工具、`EdgeLabelRenderer` 与 `EdgeToolbar`。[Custom Edges](https://reactflow.dev/learn/customization/custom-edges)
- 边标签通过 viewport 外的 portal 呈现；需要交互的标签要显式开启 pointer events，并使用 `nodrag` / `nopan` 避免手势冲突。[Edge Labels](https://reactflow.dev/learn/customization/edge-labels)
- 连接支持 strict / loose 模式、点击连接、连接校验、连接开始/结束事件和可配置连接半径；边重连需要应用接入 `onReconnect`，不是自动持久化能力。

#### 3.2.2 选择、删除与键盘

当前版本的关键默认值：

| 行为           | React Flow 默认                                             |
| -------------- | ----------------------------------------------------------- |
| 点击节点选择   | 开启（`elementsSelectable=true`、`selectNodesOnDrag=true`） |
| 框选           | `Shift + pointer drag`；`selectionOnDrag=false`             |
| 框选命中       | `SelectionMode.Full`，节点需完全落入选区                    |
| 追加多选       | macOS `Meta`，其他平台 `Ctrl`                               |
| 删除           | `Backspace`（`deleteKeyCode="Backspace"`）                  |
| 平移           | 画布 pointer drag；也可按 Space 临时平移                    |
| 缩放激活修饰键 | macOS `Meta`，其他平台 `Ctrl`                               |
| 键盘无障碍     | 默认开启                                                    |

因此 React Flow 默认是类似地图的 viewport 交互：直接拖动画布平移，Shift+拖拽框选。官方也给出“设计工具式”配置：`selectionOnDrag=true`、`panOnDrag=false`、`panOnScroll=true`、`SelectionMode.Partial`；这是**配置方案，不是默认值**。[ReactFlow API](https://reactflow.dev/api-reference/react-flow)

无障碍默认包括 Tab 聚焦节点/边、Enter 或 Space 选择、Escape 清除、方向键移动节点以及 Shift 加速移动；应用仍需保持可见焦点、合理标签和状态反馈。[Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)

#### 3.2.3 视口与导航

- 默认 viewport 为 `{ x: 0, y: 0, zoom: 1 }`，默认缩放范围 `0.5–2`；滚轮缩放、捏合缩放、双击缩放与阻止页面滚动默认开启。
- `fitView`、`fitBounds`、`setViewport`、`zoomIn`、`zoomOut`、`screenToFlowPosition` 等由 `ReactFlowInstance` 提供。[ReactFlowInstance](https://reactflow.dev/api-reference/types/react-flow-instance)
- `snapToGrid` 默认关闭；`onlyRenderVisibleElements` 是可选性能优化，不等于虚拟化布局系统。
- `Background`、`Controls`、`MiniMap` 和 `Panel` 是可选内置组件，不会仅因渲染 `<ReactFlow />` 自动出现。[Built-In Components](https://reactflow.dev/learn/concepts/built-in-components)

#### 3.2.4 结构、分组与布局

- 子流使用 `parentId` 表达；父节点必须先于子节点出现。`extent: "parent"` 可限制子节点，`expandParent` 可在拖动时扩展父节点。[Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)
- React Flow 没有内置自动布局引擎。官方列出 Dagre、D3-Hierarchy、D3-Force、ELK 等方案，并明确各自约束；接入、增量更新、稳定性与业务布局语义都属于应用责任。[Layouting](https://reactflow.dev/learn/layouting/layouting)

#### 3.2.5 样式、状态反馈与内置组件

- 官方 stylesheet 是正确渲染的必要条件；缺失会导致节点、边和交互样式异常。
- 官方公开 class/状态包括 selected、dragging、connecting、valid 等。可以使用 CSS 变量、公开 class 和 `colorMode` 定制，但覆盖内部 class 可能破坏布局与交互。[Theming](https://reactflow.dev/learn/customization/theming)
- `nodrag`、`nowheel`、`nopan` 是处理自定义节点内部控件、滚动区和可交互标签的官方边界工具。[Utility Classes](https://reactflow.dev/learn/customization/utility-classes)
- 完整内置组件还包括 `BaseEdge`、`ControlButton`、`EdgeText`、`EdgeToolbar`、`Handle`、`NodeResizeControl`、`NodeResizer`、`NodeToolbar`、`ViewportPortal` 等。[Components API](https://reactflow.dev/api-reference/components)

#### 3.2.6 API、事件与工程能力

- 事件覆盖节点/边 mouse、drag、delete、change，连接 start/end/connect，pane click/context/scroll/move，selection start/change/drag/end，以及 init/error/delete/beforeDelete。
- Hooks 覆盖节点、边、连接、选区、viewport、内部 store、node internals 与实例访问；utils 覆盖 change 应用、加边、图关系查询、bounds、坐标和多种边路径。
- SSR/SSG 自 v12 可用，但服务端必须已知节点尺寸与 Handle 位置。[SSR/SSG](https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration)
- 官方建议用 Playwright 或 Cypress 验证真实交互，因为 React Flow 依赖 DOM 尺寸；Jest 环境必须补大量浏览器 API mock。[Testing](https://reactflow.dev/learn/advanced-use/testing)
- 性能最佳实践包括 memoize node/edge type 与回调、避免订阅整个 nodes 数组、折叠大型树、简化昂贵样式。[Performance](https://reactflow.dev/learn/advanced-use/performance)

### 3.3 各产品层画像与差异

#### A. OSS Core

**提供什么**：node-based editor 的渲染、命中、手势、键盘、viewport、连接、选区、事件与扩展 API。  
**不提供什么**：业务文档模型、持久化、undo/redo、copy/paste、自动布局、参考线、协作、富文本、导出产品流程。  
**对 Reflecta 的意义**：默认交互的事实来源；我们越少覆盖，组合状态越多由上游维护。

#### B. 官方 OSS Examples / Learn 配方

官方示例覆盖节点 resize/toolbar/rotatable/intersection/proximity connect，边 animation/label/marker/reconnect/floating/temporary，context menu、drag-and-drop、cycle prevention、save/restore、touch、validation，以及 Dagre/ELK、dark mode、Tailwind、download image、eraser/lasso/rectangle 等。[Examples](https://reactflow.dev/examples)

这些页面证明“可以基于 React Flow 实现”，不证明 Core 默认拥有。尤其：

- 外部拖入不是 React Flow 内建，官方分别演示 HTML DnD 与 Pointer Events，前者在触摸设备上有约束。
- 白板文档明确说明 React Flow 不是为 whiteboard app 设计；rectangle、lasso、eraser 是配方。[Whiteboard Features](https://reactflow.dev/learn/advanced-use/whiteboard)
- 下载图片、save/restore、context menu 等都需要应用代码。

#### C. React Flow Pro

Pro Examples 明确包含 node animation/shapes、edge routing/editable edge、helper lines、collaborative flow、copy/paste、undo/redo、selection grouping、dynamic parent-child、expand/collapse、自动/动态布局、freehand 和 server-side image creation。[Pro Examples](https://reactflow.dev/examples/pro-examples)

它们是付费示例源码与支持，不是 Core feature flag。Reflecta 只有在引入相应实现后才能声明具备这些行为。

#### D. React Flow UI

React Flow UI 是基于 shadcn/ui 与 Tailwind 的 ready-to-use 组件和模板，通过 shadcn CLI 将源码复制到项目中；复制后组件由应用自行修改和维护。它可加速视觉层搭建，但不会改变 Core 的交互契约，也不能作为默认行为来源。[React Flow UI](https://reactflow.dev/ui)

#### E. 外部生态

- 自动布局依赖 ELK、Dagre、D3 等。
- 实时协作依赖同步引擎、网络层与通常的 CRDT（如 Yjs、Automerge、Loro）；官方 Pro 协作示例使用 Yjs。[Multiplayer](https://reactflow.dev/learn/advanced-use/multiplayer)
- 浏览器 DnD、图片导出、富文本编辑器与服务端渲染均有各自平台边界。

这些能力的故障、升级与测试责任不属于 React Flow Core。

### 3.4 能力缺口与误判风险

| 常见声明                  | 实际情况                                                 | 正确验收对象                      |
| ------------------------- | -------------------------------------------------------- | --------------------------------- |
| “React Flow 支持框选”     | 默认是 Shift+拖拽；直接拖拽默认平移                      | 当前 props 下的实际手势与选区反馈 |
| “React Flow 支持删除”     | 默认键是 Backspace；可被 `deleteKeyCode` 覆盖            | macOS/Windows 键盘路径与焦点状态  |
| “React Flow 支持选择”     | Core 管状态与 class；自定义节点视觉由应用负责            | selected state 是否传递且可见     |
| “React Flow 支持分组”     | Core 有 parent/child primitives；选择成组 UI 是 Pro 示例 | 产品的建组、解组、拖入/拖出语义   |
| “React Flow 支持撤销”     | Pro 有示例，Core 无 history 产品能力                     | 应用自己的历史边界与持久化        |
| “React Flow 支持自动布局” | 依赖外部 layout engine                                   | 集成算法、稳定性与增量行为        |
| “React Flow 支持白板”     | 官方明确说不是白板定位                                   | 每个采用的白板配方                |
| “React Flow 支持拖入创建” | 官方提供浏览器事件配方                                   | mouse/touch/坐标转换/失败反馈     |
| “React Flow 支持协作”     | 只有指南和 Pro 示例，需完整同步系统                      | CRDT、网络、冲突与离线语义        |

## 4. 结论

1. React Flow 的可依赖基准是 **OSS Core 在固定版本、固定 props 下的行为**，不是整个官网出现过的功能集合。
2. 对默认交互最稳妥的策略是继承，而不是把默认值重新翻译成一份产品手势清单；任何覆盖都会把相应组合状态转移为 Reflecta 的责任。
3. 自定义节点视觉、受控状态桥、业务数据映射和采用的官方配方天然属于 Reflecta，必须单独定义与验证。
4. “所有 feature”可以按官方产品边界完整盘点，但无法用有限用例证明所有交互序列。可证明的完整性应落在**有限且可机械枚举的集成接缝**上，具体规则见 [React Flow 集成与行为基准原则](./react-flow-integration-principles.md)。

## 5. 来源与可信度

全部事实来自 React Flow 官方网站；API 默认值以仓库使用的 12.11.3 类型与官方 API Reference 为基准。官方示例用于判断“官方提供实现路径”，不用于推断 Core 默认能力。调研时间之后的版本变化不在本报告保证范围内。
