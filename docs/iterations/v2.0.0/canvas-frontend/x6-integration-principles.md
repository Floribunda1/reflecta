# X6 集成与行为基准原则

> 状态：v2.0.0 决策中（换回 X6 评估）
> 日期：2026-08-21
> 适用版本：`@antv/x6@3.1.8` + `@antv/x6-react-shape@3.0.1`
> 适用范围：Reflecta 画布前端自 React Flow 迁往 X6 的集成、行为基准、偏差登记与升级审计

## 1. 一句话原则

**X6 覆盖的通用图编辑行为默认继承 X6；Reflecta 只定义业务语义与必要偏差，并对所有能改变 X6 行为的集成接缝做机械穷举。每个非默认配置都必须进偏差账本并说明理由，没有理由与验证方式的不并入。**

继承「启用 built-in 插件/选项」不等于偏差——启用 `graph.use(new History())` 不是覆盖，是使用 X6 能力。**偏差指：覆盖/装饰插件已管的状态机，或在其之上追加自定义手势逻辑。** 这是本文区别于 React Flow 时代的核心纪律：React Flow 逼着 Reflecta 造能力，X6 让 Reflecta 能直接沿用，偏差因此应大幅收窄。

## 2. 行为权威顺序

发生冲突时按以下顺序判断：

1. 本文登记且说明理由的 Reflecta 偏差；
2. 当前固定版本 X6 的 API 契约、默认 Graph options 与插件行为；
3. X6 官方教程 / 示例 / registry 预置能力（可证明“可实现”，不证明“默认开启”）；
4. React Flow 已登记项——仅作为「迁移前的 Reflecta 自有逻辑」参照，不作为 X6 默认。

完整能力盘点见 [X6 内置能力调研](./x6-feature-research.md)。

## 3. 能力归属

| 所有者           | 范围                                                                                                            | 如何验收                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| X6 Core / Model  | 画布、节点、边、网格、事件、序列化、坐标                                                                        | 不复刻其内部测试；验证我们没有阻断它             |
| X6 插件          | History / Snapline / Clipboard / Keyboard / Selection / MiniMap / Scroller / Transform / Stencil / Dnd / Export | 启用即视为使用内置能力；装饰或覆盖其行为必须登记 |
| X6 注册表        | shape / port / anchor / connectionPoint / tool / edgeTool                                                       | 用 registry 预置项优先；自定义注册必须登记       |
| Reflecta Adapter | document ⇄ X6 cells 双向映射、事件桥、只读策略、命令式调用                                                      | 接缝级自动化测试                                 |
| Reflecta Domain  | 理解卡、画布引用、边样式语义、分组命令、搜索、持久化、审批                                                      | Feature / Acceptance 测试                        |
| react-shape 组件 | 四类卡片的 React 渲染（`component` + `effect` 重渲染声明）                                                      | RENDER 测试                                      |
| 外部系统         | 导出编译、搜索索引、浏览器平台能力                                                                              | 按各自契约单独验收                               |

## 4. 可机械穷举的集成接缝

以下七类是目前能改变 X6 行为的完整入口。代码 Review 与升级审计必须逐项扫描：

1. **Graph 构造 options**：`grid` / `background` / `embedding` / `translating` / `connecting` / `interacting` / `panning` / `mousewheel` / `virtual` / `async` / `highlighting`；
2. **插件注册**：`graph.use(...)` 的 11 类插件（History/Snapline/Clipboard/Keyboard/Selection/MiniMap/Scroller/Transform/Stencil/Dnd/Export）；
3. **模型事件订阅**：`graph.on(...)` 的 `cell:*` / `node:*` / `edge:*` / `history:*` 事件；
4. **命令式 API**：`addNode` / `addEdge` / `removeCell` / `toJSON` / `fromJSON` / `undo` / `redo` / `getCellById` / `screenToLocal` 等；
5. **注册表**：`Graph.registerNode` / `registerEdge` / `registerPortLayout` / `registerNodeTool` / `registerEdgeTool` / anchor / connectionPoint；
6. **react-shape 组件**：`register({ shape, component, effect })`，`effect` 声明哪些属性变更触发重渲染；
7. **外部手势与业务**：delegateGraph 的 DnD 拖入、键盘快捷键到业务命令（分组/搜索/解组）、边样式面板、导出、saveCanvas 文档同步。

“完整”的定义：仓库中所有 `@antv/x6` / `@antv/x6-react-shape` import、所有 `graph.use`、所有 `graph.on`、所有覆盖的 Graph options 都位于已知 Canvas 模块内并可在一张接缝清单中找到。

## 5. 默认继承规则

- **启用插件 = 继承，不重复实现其内部**；`History` 的 undo/redo、`Snapline` 参考线、`Clipboard`、`Keyboard`、`Transform`、`Selection` 直接沿用，不写业务版。
- 不覆盖 registry 已提供的能力：能用预置 anchor / connectionPoint / tool 就用，不自写等价物。
- 不为“明确”重复设置与默认值相同的 option；重复配置会冻结旧默认并制造升级歧义。
- 不过滤不认识的模型事件；adapter 先完整应用 X6 模型变更，仅为业务持久化挑选需落库的字段。
- 不把 React Flow 时代的自研手势当 X6 默认/要求：X6 缺、React Flow 自研的（如内容搜索）仍按业务逻辑实现，不冒充 X6 内置。

## 6. 自定义节点与交互的最低义务

继承插件行为不等于不写业务反馈。X6 对交互状态提供默认高亮（`highlighting.default/nodeAvailable/magnetAvailable/embedding`），优先沿用；视觉层若需自定义 selected / connecting，必须登记且不得破坏 X6 的可用性状态。

- 四类卡片（理解卡/文本卡/组/引用卡）用 `react-shape` 的 `component` 渲染，用 `effect` 精确声明重渲染触发；
- 点击、连接（port/magnet）、嵌入、选中反馈优先用插件默认，缺省状态不得静默;
- port 分组定义左右 target/source（沿用现有语义），`magnet: true` 才可连；
- domain 映射不得把 X6 临时视图状态误写进业务文档，也不得在回映时丢掉交互所需状态。

## 7. 偏差账本

任何非默认配置必须在实现同一变更中补充此表。没有理由与验证方式的偏差不应合入。当前为**预期偏差**（移植时逐行登记确认），行与 X6 默认对照：

| 接缝           | X6 3.1.8 默认                 | Reflecta 决定                                         | 理由                                   | 验证                |
| -------------- | ----------------------------- | ----------------------------------------------------- | -------------------------------------- | ------------------- |
| 网格           | 不绘制（size 10）             | 绘制 20px 网格 + snapToGrid                           | 沿用现有画布空间定位                   | 网格 acceptance     |
| 平移/缩放      | 平移开、滚轮关                | 开启滚轮缩放；缩放范围收敛                            | 画布编辑导航                           | viewport acceptance |
| 只读模式       | 可编辑                        | 禁 node 拖动/连接/嵌入/Transform，保留视口            | 同一 renderer 服务只读预览             | 只读 acceptance     |
| 虚拟渲染       | `virtual:false`，`async:true` | 开启 `virtual:true`                                   | 大画布性能（React Flow 时代 deferred） | 规模压测后验收      |
| 初始视口       | 不自动 fitView                | 无已存 viewport 时 fitView                            | 空间内完整显示                         | viewport acceptance |
| 新增节点       | 无业务新增行为                | 新增后定位并短暂 fit 到节点                           | 拖入后保持可见                         | 拖入 acceptance     |
| 连接           | allowMulti:true 已满足        | 沿用 allowMulti（多线）+ allowLoop（自环）            | 支持同源多边/自环                      | 连线 acceptance     |
| 分组           | embedding 只给原语            | 追加 Cmd+G 打组 / Cmd+Shift+G 解组 / 删组级联命令     | embedding 不含显式命令 UX              | 分组 acceptance     |
| 画布搜索       | 无内置                        | 遍历 cells 按文本匹配 + 结果定位 UI                   | 业务需要（X6 无内置）                  | 搜索 acceptance     |
| React 节点导出 | Export 内置                   | 调 `copyStyles`/`serializeImages` 保证 React 节点样式 | 导出保真                               | 导出 acceptance     |

readonly 相关的拖/连/嵌/缩略组合仍须组合验证；其余覆盖已登记在上表，新增一律在此补行。

## 8. 验证策略

### 8.1 完整性检查

静态回答「所有接缝都找到了吗」：

- 枚举全部 `@antv/x6`、`@antv/x6-react-shape` import；
- 枚举全部 Graph options、`graph.use` 插件、`graph.on` 事件；
- 枚举 registry 注册与 react-shape `register` 调用；
- 对照偏差账本，禁止未登记的非默认行为覆盖。

### 8.2 行为符合性检查

行为测试只覆盖我们拥有的接缝，不重写 X6 测试套件：

- **插件未阻断 smoke**：选择有反馈、多选、平移、缩放、undo/redo、参考线、Transform 缩放；
- **adapter conformance**：事件/模型变更完整进入 X6 状态，业务持久化只接收规定字段；
- **react-shape 渲染**：四类卡片 + `effect` 触发正确、交互状态可见；
- **偏差测试**：账本每行至少一个真实浏览器用例；
- **业务 Feature**：只测 Reflecta 业务语义（分组命令、搜索、保存），不把 X6 默认逐条抄成 Gherkin。

交互符合性用 Playwright/Cypress 真实 DOM（X6 依赖真实 DOM 尺寸与 SVG）；纯 Jest mock 不能证明尺寸、命中和手势组合。

### 8.3 保证边界

能保证：接缝枚举完整、每个偏差有出处、关键插件未被阻断、业务语义有验收。不能数学证明任意事件序列与未来版本无缺陷。发现上游问题时最小复现回报上游，仅在有到期条件时加 workaround。

## 9. 升级规则

X6 升级必须作为行为基准变更处理：

1. 固定目标版本，不依赖浮动官网描述；
2. 阅读官方 changelog / 迁移说明 / API 默认值变化（3.x 曾整并插件、改 panning 默认）；
3. 重跑七类接缝清单，审查已变成默认能力的本地覆盖；
4. 更新偏差账本与本文件适用版本；
5. 运行真实浏览器 conformance 与业务 Acceptance；
6. 能删除的 adapter/workaround 优先删除。

## 10. 非 X6 内置能力

下列除非单独立项，否则不属于 X6 行为基准，由 Reflecta 全权拥有其预期与测试：**画布内容搜索**、**分组命令 UX（Cmd+G/Cmd+Shift+G/级联删）**、边样式面板、理解库面板 / 详情面板、saveCanvas 文档同步、React 节点导出保真调优、业务工具栏。它们在 X6 上有原语或部分能力，但采用后 Reflecta 负责完整预期与测试。

## 11. Definition of Done

涉及 Canvas 交互的改动只有同时满足以下条件才完成：

- 归属层明确；
- 七类接缝扫描无遗漏；
- 非默认配置已登记，或已删除；
- react-shape 渲染与插件状态未阻断；
- 真实浏览器验证覆盖改动接缝；
- 文档没有把 registry 预置 / 示例能力误称为 X6 默认已开启。
