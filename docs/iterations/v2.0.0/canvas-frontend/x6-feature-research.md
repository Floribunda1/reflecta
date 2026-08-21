# X6 内置能力调研（对照 React Flow）

> 调研日期：2026-08-21
> 基准版本：`@antv/x6@3.1.8` + `@antv/x6-react-shape@3.0.1`（仓库已安装）
> 事实来源：本仓库 `packages/ui/node_modules/@antv/x6/src/**` 源码 + X6 官方插件文档
> 性质：`docs/iterations/**` 历史/背景文档，作为「是否从 React Flow 换回 X6」的决策材料

## 1. 背景

现状：Reflecta Canvas 当前在 React Flow（`@xyflow/react@12.11.3`）上实现，行为权威与接缝见 react-flow 系列文档。React Flow 的定位是最小 node-renderer——基础节点/边之外，打组、undo/redo、copy/paste、辅助线、自动布局、可编辑边等「图编辑器该有的能力」全部是 Pro 或自研。这导致 Reflecta 在 COMMAND（打组）、BRIDGE（undo/reconnect 等）、WORKSPACE（导出/搜索）上自写大量逻辑。

本调研回答一个问题：**切到 X6 后，哪些需求能直接用内置能力，哪些仍要自研。** 结论全部落到本仓库安装的 X6 3.1.8 源码，不依赖官网宣称。

## 2. 内置插件清单（源码确认）

`@antv/x6/src/plugin/` 以 `graph.use(new Xxx())` 使用，3.x 全部并入主包统一导出：

| 插件              | 源码路径                         | 能力                                           |
| ----------------- | -------------------------------- | ---------------------------------------------- |
| `Stencil` / `Dnd` | `plugin/stencil/`、`plugin/dnd/` | 侧边栏模板库（内置分组/折叠/搜索）+ 拖拽入画布 |
| `History`         | `plugin/history/`                | undo/redo                                      |
| `Snapline`        | `plugin/snapline/`               | 对齐参考线                                     |
| `Clipboard`       | `plugin/clipboard/`              | 跨画布复制粘贴                                 |
| `Keyboard`        | `plugin/keyboard/`               | 快捷键注册                                     |
| `Selection`       | `plugin/selection/`              | 框选 / 橡皮筋 / 多选                           |
| `MiniMap`         | `plugin/minimap/`                | 缩略图                                         |
| `Scroller`        | `plugin/scroller/`               | 滚动画布 / 平移 / 虚拟渲染                     |
| `Transform`       | `plugin/transform/`              | 节点缩放 / 旋转                                |
| `Export`          | `plugin/export/`                 | 导出 SVG / PNG / JPEG                          |

核心模型另提供：`Grid`（网格 + 吸附）、`ports`（连接桩）、`embedding`（父子嵌套）、`translating.restrict`（子节点限父内）、`Anchor`/`ConnectionPoint`（连线端点）、`Tools`（节点/边小工具）、`graph.toJSON()/fromJSON()`（序列化）。

## 3. 需求 → 内置 / 自研 映射

| 需求                  | X6 3.1.8                                                                        | 落地凭据（源码）                                                                  | React Flow 现状                          |
| --------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| **DnD 拖入**          | ✅ 内置 `Stencil`(含分组/折叠/搜索) / `Dnd`                                     | `plugin/stencil/index.ts`、`plugin/dnd/index.ts`                                  | 自研 screenToFlowPosition + HTML5 DnD    |
| **History undo/redo** | ✅ 内置                                                                         | `plugin/history/index.ts:191-196` 监听 model 事件                                 | ❌ 自研/未做                             |
| **参考线 Snapline**   | ✅ 内置                                                                         | `plugin/snapline/`                                                                | ❌ 未做                                  |
| **copy/paste**        | ✅ 内置                                                                         | `plugin/clipboard/`                                                               | ❌ 未做                                  |
| **节点缩放/旋转**     | ✅ 内置 `Transform`                                                             | `plugin/transform/index.ts`                                                       | 半自研 NodeResizer                       |
| **MiniMap**           | ✅ 内置                                                                         | `plugin/minimap/index.ts`                                                         | 内置                                     |
| **框选/多选**         | ✅ 内置 `Selection`(rubberband)                                                 | `plugin/selection/`                                                               | 内置/自配                                |
| **网格+吸附**         | ✅ 内置 `Grid` + `snapToGrid`                                                   | `graph/options.ts:92-99`、`api/graph/grid`                                        | 自配 Background + snapToGrid             |
| **键鼠快捷键**        | ✅ 内置 `Keyboard`                                                              | `plugin/keyboard/`                                                                | 内置事件                                 |
| **虚拟渲染**          | ✅ 内置 `virtual: true` + `async`                                               | `graph/options`、`graph/grid`、视图 API                                           | 已开 onlyRenderVisibleElements，无 async |
| **连线端点/吸附**     | ✅ 内置 Anchor/ConnectionPoint/`connecting.snap`                                | `graph/options.ts`、registry                                                      | 自写 Handle/port                         |
| **节点/边小工具**     | ✅ 内置 `button`/`button-remove`/`boundary`/`node-editor`/`vertices`/`segments` | `src/registry/node-tool`、边 tools                                                | 自研 NodeToolbar/EdgeToolbar             |
| **Export**            | ✅ 内置                                                                         | `plugin/export/index.ts`（⚠️ React 节点 PNG 需调 `copyStyles`/`serializeImages`） | 自研 html-to-image                       |
| **Group 打组**        | ⚠️ 半内置                                                                       | embedding 原语有（`options.ts:267-284`），「打组命令/解组/级联删」业务 UX 自研    | 全自研                                   |
| **画布内容搜索**      | ❌ 无内置                                                                       | `searchCell` 是遍历 API 非内容搜索；Stencil.search 只搜模板项                     | 自研                                     |

## 4. 关键源码结论

### 4.1 History 覆盖到「打组/解组/级联删除」

`plugin/history/index.ts` 通过 `/plugin/history/index.ts:191-196` 监听 model 事件 `batch:start/stop` + `add/remove/change`（含 `change:parent`、`change:position`）。因此：

- 增删节点/边、移动、改 parent（打组/解组）、级联删除都自动进入 undo/redo 栈；
- 支持 `batch`（一次撤销一批）与 `beforeAddCommand` 过滤（可不记录纯视图变更）。
- 结论：**undo/redo 是原生能力，且天然覆盖组操作** —— 这是 React Flow 时代最大的自研缺口。

### 4.2 坐标模型：原生相对坐标转换

`src/model/node.ts` `getPosition({relative:true})` / `setPosition(...,{relative:true})`：

- 相对 = 绝对 − 父节点位置；
- 因此「组内子元素为相对坐标」的文档模型可直接在 adapter 用 `relative` 选项转换，**无需改数据模型**。

（修正早前基于文档的错误判断：X6 官网说「不提供相对定位」，但源码实际提供 `relative` 选项。）

### 4.3 React 卡片渲染

`@antv/x6-react-shape` `register({ shape, component, effect })`，组件收到 `{ node, graph }` props，`effect: string[]` 声明哪些属性变更触发重渲染。理解卡/文本卡/组/引用卡 = 注册若干 React 组件。

## 5. 换到 X6 后仍需自研（诚实清单）

这些是纯业务，任何引擎都躲不掉；不把红利算过头。

1. **画布内容搜索**：按文本遍历 cells 匹配 + 结果定位 UI（X6 无内置）。
2. **打组命令 UX**：页面按钮建父节点/解组（不走快捷键）+ 删组级联删成员、坐标转换接线。embedding 只给原语。
3. **卡片组件本体**：理解卡/文本卡/组/引用卡的 React 组件（react-shape 的 `component`）。
4. **业务面板 / 保存协议**：边样式面板、理解详情面板、saveCanvas 文档同步。
5. **React 节点导出调优**：Export 插件内置，但 React 节点 PNG 样式需 `copyStyles`/`serializeImages` 调优（community 高频反馈点）。

## 6. 结论

X6 能把 React Flow 时代自研或缺失的一大半「通用图编辑器样板」收归原生：undo/redo（含组操作）、参考线、copy/paste、Transform、Stencil/DnD、虚拟渲染、Anchor/连接桩、节点/边 Tools、Export。剩余自研项均为纯业务逻辑，与引擎无关。

首次通过 `graph.use(new Xxx())` 一行启用；要遵守「减少偏离、每项定制说明理由」的采纳纪律，集成基准与偏差账本见 [x6-integration-principles](./x6-integration-principles.md)。
