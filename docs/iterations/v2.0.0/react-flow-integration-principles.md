# React Flow 集成与行为基准原则

> 状态：v2.0.0 Current  
> 日期：2026-08-19  
> 适用版本：`@xyflow/react@12.11.3`  
> 适用范围：Reflecta 画布前端的 React Flow 集成、交互验收与升级

## 1. 一句话原则

**React Flow 覆盖的通用画布行为默认继承 React Flow；Reflecta 只定义业务语义与必要偏差，并对所有能改变上游行为的集成接缝做机械穷举。**

这不是声称能穷举所有鼠标、键盘、焦点、平台与状态组合。无限交互序列无法由一份需求文档完整列出。这里保证的是更有用、也可验证的完整性：**Reflecta 所有可能改变 React Flow 行为的入口是有限的，必须全部被发现、分类和验证。**

## 2. 行为权威顺序

发生冲突时按以下顺序判断：

1. 本文登记且说明理由的 Reflecta 偏差；
2. 当前固定版本 React Flow 的 API 契约与默认行为；
3. React Flow 官方无障碍与自定义组件约束；
4. 官方 OSS 示例 / Learn 配方；
5. Pro 示例、React Flow UI 与第三方生态。

后两项只能证明“可实现”，不能证明“默认存在”。完整能力分层见 [React Flow 功能全景调研](./react-flow-feature-research.md)。

## 3. 能力归属

| 所有者           | 范围                                                        | 我们如何验收                         |
| ---------------- | ----------------------------------------------------------- | ------------------------------------ |
| React Flow Core  | 默认选择、拖动、平移、缩放、键盘、命中、连接基础、ARIA 基础 | 不复刻其内部测试；验证我们没有阻断它 |
| React Flow 配置  | `<ReactFlow />` props、内置组件、node/edge options          | 每个非默认值必须进入偏差账本         |
| Reflecta Adapter | 受控 change bridge、文档映射、事件转发、只读策略、实例调用  | 接缝级自动化测试                     |
| Reflecta Domain  | 理解卡、画布引用、持久化、审批、业务删除/分组语义           | Feature / Acceptance 测试            |
| Adopted Recipe   | 拖入、撤销、布局、导出等被正式采用的官方配方                | 采用后视为 Reflecta 自有功能完整测试 |
| 外部系统         | layout engine、CRDT、富文本、浏览器平台能力                 | 按各自契约单独验收                   |

## 4. 可机械穷举的集成接缝

以下七类是 Reflecta 能改变 React Flow 行为的完整入口。代码 Review 与升级审计必须逐项扫描：

1. **组件配置**：`<ReactFlow />`、`<MiniMap />`、`<Background />` 等全部 props；
2. **状态变更桥**：`onNodesChange`、`onEdgesChange`、`onConnect`、选择、viewport 与 delete 回调；
3. **命令式 API**：`useReactFlow()` / `ReactFlowInstance` 的查询与变更调用；
4. **自定义节点与边**：selected、dragging、connectable、Handle、resize、label 与焦点状态如何渲染；
5. **样式接缝**：官方 stylesheet、公开 CSS 变量/class、`nodrag` / `nowheel` / `nopan`；
6. **数据适配**：domain document 与 nodes/edges 的双向映射、id、parentId、坐标、尺寸、选中态；
7. **外部手势与配方**：sidebar DnD、快捷键、undo/redo、布局、导出等 React Flow 之外的事件链。

“完整”的定义是：仓库中所有 `@xyflow/react` import 和上述入口都位于已知 Canvas 模块内，并能在一张接缝清单中找到；不存在散落的隐式覆盖。

## 5. 默认继承规则

- 不为了“明确”而重复设置与默认值相同的 prop；重复配置会冻结旧默认并制造升级歧义。
- 不自定义 React Flow 已经负责的 pane/node/edge 手势状态机。
- 不过滤不认识的 `NodeChange` / `EdgeChange`；adapter 应先完整应用上游 change，再仅为业务持久化挑选需要落库的变化。
- 不把官方示例、Pro 或 React Flow UI 组件写成“React Flow 已支持”。采用前一律视为未实现。
- 不以 Excalidraw、CAD、Figma 或 X6 的手势补充 React Flow 默认行为。产品明确决定偏离时，才登记为 Reflecta 行为。
- 不覆盖 React Flow 内部 class；只使用官方公开状态 class、CSS 变量和 utility classes。

## 6. 自定义节点与受控模式的最低义务

继承默认行为不等于不写 UI。React Flow 对自定义节点提供交互状态，但视觉反馈由我们负责：

- selected、focus-visible、dragging、connecting、valid/invalid 必须有可感知反馈；
- 节点内部按钮/输入使用 `nodrag`，滚动区按需使用 `nowheel`，独立交互区按需使用 `nopan`；
- 每个连接点使用 `<Handle />`；动态 Handle 更新后调用 `useUpdateNodeInternals`；
- 官方 stylesheet 必须且只能被可靠加载，样式层不得抹掉必要状态；
- `onNodesChange` / `onEdgesChange` 必须保留 selection 等非持久化 change，不能因“无需落库”而阻断视觉状态；
- domain 映射不得把 React Flow 的临时 UI 状态误写进业务文档，也不得在回映时丢掉正在交互所需的状态。

## 7. 偏差账本

任何非默认配置必须在实现同一变更中补充此表。没有理由与验证方式的偏差不应合入。

| 接缝     | React Flow 12.11.3 默认 | Reflecta 决定                                | 理由                       | 验证     |
| -------- | ----------------------- | -------------------------------------------- | -------------------------- | -------- |
| 只读模式 | 可编辑                  | 禁止节点拖动、连接和选择；保留 viewport 导航 | 同一 renderer 服务只读预览 | 只读 E2E |

当前实现中出现但尚未由本原则认可的覆盖，应作为审计项处理，而不是倒推为产品预期：

- `selectionOnDrag`：会把框选从 Shift+拖拽改为直接拖拽，并与 `panOnDrag` 组合；
- `deleteKeyCode="Delete"`：覆盖默认 `Backspace`，造成 macOS 物理键盘路径不一致；
- `minZoom` / `maxZoom`、`fitView` 参数：属于体验偏差，需要明确理由；
- readonly 相关 `nodesDraggable` / `nodesConnectable` / `elementsSelectable`：属于已认可的只读策略，但仍须组合验证。

## 8. 验证策略

### 8.1 完整性检查

静态检查只回答一个问题：**所有接缝都找到了吗？**

- 枚举全部 `@xyflow/react` import；
- 枚举所有 `<ReactFlow />` 与内置组件 props；
- 枚举 instance 方法、change/event handler、官方 utility class 与 React Flow CSS selector；
- 对照偏差账本，禁止未登记的非默认行为覆盖。

这部分可以做到机械完整，并应在 React Flow 升级和 Canvas Review 时重跑。

### 8.2 行为符合性检查

行为测试只覆盖我们拥有的接缝，不重写 React Flow 的测试套件：

- **默认未阻断 smoke**：点击选择有反馈、平台多选、Shift 框选、直接拖 pane 平移、Backspace 删除、缩放；
- **adapter conformance**：selection change 不被过滤，节点/边变化完整进入 React Flow state，业务持久化只接收规定字段；
- **自定义节点视觉**：selected/focus/drag/connect 状态可见；
- **偏差测试**：偏差账本每行至少一个真实浏览器用例；
- **业务 Feature**：只测试 Reflecta 业务语义，不把 React Flow 默认行为逐条抄成 Gherkin。

按 React Flow 官方建议，交互符合性使用 Playwright/Cypress 真实 DOM；纯 Jest mock 不能证明尺寸、命中和手势组合。

### 8.3 保证边界

本策略能保证：接缝枚举完整、每个偏差有出处、关键默认行为未被阻断、业务语义有验收。  
本策略不能数学证明：任意长度的事件序列、所有浏览器/设备/输入法和未来 React Flow 版本都无缺陷。发现上游问题时，以最小复现回报上游，并只在必要时增加有到期条件的 workaround。

## 9. 升级规则

React Flow 升级必须作为行为基准变更处理：

1. 固定目标版本，不依赖浮动官网描述；
2. 阅读官方 changelog、迁移说明与 API 默认值变化；
3. 重跑七类接缝清单，并审查已经变成默认能力的本地覆盖；
4. 更新偏差账本与本文件适用版本；
5. 运行真实浏览器 conformance 与业务 Acceptance；
6. 能删除的 adapter/workaround 优先删除。

## 10. 非 React Flow Core 能力

下列事项除非单独立项采用，否则不属于当前行为基准：参考线、undo/redo、copy/paste、自动布局、智能路由、选择成组、实时协作、自由画笔、图片导出、外部拖入、富文本编辑。它们在官方站点可能有 OSS 配方、Pro 示例或外部集成，但采用后由 Reflecta 全权拥有其预期与测试。

## 11. Definition of Done

涉及 Canvas 交互的改动只有同时满足以下条件才完成：

- 归属层明确；
- 七类接缝扫描无遗漏；
- 非默认配置已登记，或已删除；
- 自定义节点反馈与受控 change bridge 未阻断上游状态；
- 真实浏览器验证覆盖改动接缝；
- 文档没有把示例 / Pro / 外部能力误称为 Core feature。
