# v1.5.0 理解画布需求与计划

> 日期：2026-08-11
>
> 状态：Draft
>
> 范围：删除 Knowledge Wander 力导向图谱，新增顶层「理解画布」模块：无限画布 + 卡片（理解卡 / 文本卡）+ 有向带标签连线
>
> 产品依据：[价值主张](../../references/product/value-proposition.md)、[Feature Set Guide](../../references/product/feature-set-guide.md)

## 0. 状态说明

- 本文是需求形状与技术选型的设计记录，尚未开始实现。
- 模块正式名「理解画布」（Understanding Canvas）已确认；「心智模型 / Mental Model」不作为产品正式概念。
- 最终模块入口由用户重新设计。
- 技术选型已确定：AntV X6；React 19 兼容性作为实现第一步 spike 的验证关卡（见 §2.5）。
- 实现前已确认的决策与剩余开放项见 §7。

## 1. 背景与动机

### 1.1 旧 Knowledge Wander 的问题

现有 Knowledge Wander 是 Capture 内的力导向图谱（Sigma + Graphology）：

- 全部 Understanding 是节点，Connection 是无方向、无类型的边。
- 用户回看时只能看到"连了没有"，看不到"谁依赖谁、谁推导出谁"。
- 关系语义缺失导致图谱无法承载"理解之间的逻辑结构"。

### 1.2 重做决策

- **完全删除** Knowledge Wander（代码 + 入口 + E2E + Feature 文件），入口由用户重新设计。
- 新增**顶层模块**「理解画布」（路由 `/understanding-canvas`）：
  - 一张画布 = 一个心智结构。
  - 画布上的卡片 = 元素（理解卡引用理解库；文本卡为画布局部元素）。
  - 卡片之间的连线 = 用户手动标记的**有向**关系 + **自由文本标签**。
- 设计参考 Heptabase：卡片库是唯一事实来源，白板（画布）承载结构化理解；关系必须来自用户显式标记，不来自系统推断（符合产品原则"关系是理解的一部分"）。

## 2. 技术选型

### 2.1 采用 `@antv/x6@^3.x` + `@antv/x6-react-shape@^3.x`

X6 作为唯一画布引擎，直接覆盖：

- 无限画布、平移缩放、背景网格。
- 自定义 React 节点（`x6-react-shape`）→ 理解卡 / 文本卡用 shadcn 样式实现。
- **History（撤销/重做）** 插件：基础编辑体验的硬需求。
- **Snapline（参考线对齐）** 插件：拖动卡片时的对齐参考线，硬需求。
- **Dnd** 插件：从理解库面板拖入画布。
- 边标签（多标签、增删改查 API）、方向箭头、贝塞尔边。
- 键盘、剪贴板、框选、minimap 等成熟能力。

### 2.2 为什么不采用 tldraw

tldraw SDK v4.0+ 为自定义源可用许可，默认仅授权开发环境：

- 生产使用必须持有许可 key；商业 key 需联系销售且价格不透明。
- Hobby key 仅限非商业项目，申请制（团队审核、不保证通过），且画布强制显示水印。
- "无 key 直接跑"依赖 `file://` 协议被判定为 development 的检测漏洞：技术上可用，但属于**未授权生产分发**，且画布常驻「Get a license for production」水印按钮；tldraw 已有 `NATIVE_LICENSE` 规划（原生应用许可），收紧判定后正式包会 5 秒后白屏（`LicenseGate`）。
- 结论：授权过于麻烦且地基不稳，不采用。tldraw 3.8（带水印免费版）版本冻结亦不采用。

### 2.3 为什么不采用 React Flow（备选）

React Flow（MIT）能力与 React 生态集成优秀，但不满足"基础编辑体验一件不能少"的硬约束：

- 撤销/重做需要自研（1-2 天）。
- **参考线对齐需要自研（2-4 天，边界情况多）**，而这是明确需求。
- 依赖 zustand v4，与项目 zustand v5 形成双版本。
- 结论：作为 X6 验证失败的备选方案保留。

### 2.4 关于 AntV 性能的澄清

- X6 为 SVG 渲染，官方与社区确认 **600+ 节点明显变慢、万级会卡死**。
- 该问题出现在**大规模图**场景；理解画布的规模是 **5-50 张卡片**，该量级下 X6 无性能问题。
- 大数据量官方建议 G6（另一个库），不影响 X6 在本场景的适用性。

### 2.5 React 19 兼容性（spike 已验证通过）

- `@antv/x6-react-shape@3.0.1` peer 声明 `react: >=18.0.0`，React 19 满足，无依赖冲突。
- 源码确认使用 `createRoot`（React 18+ API，React 19 兼容），未使用已移除的 legacy `ReactDOM.render`。

**Spike 验证结论（2026-08-11，14/14 通过）**：

| 验证项                               | 结果                               |
| ------------------------------------ | ---------------------------------- |
| React 19 + x6-react-shape 启动       | ✅ 无错误                          |
| shadcn 风格卡片节点（理解卡/文本卡） | ✅ DOM 渲染、内容正确              |
| 有向连线 + 标签（编辑/联动）         | ✅ 标签创建、选中联动              |
| History 撤销/重做                    | ✅                                 |
| Snapline 参考线（真实拖拽触发）      | ✅ 对齐时出现 `x6-widget-snapline` |
| DnD 从面板拖入画布落点               | ✅                                 |
| 快照序列化 round-trip / localStorage | ✅                                 |

**Spike 发现的实现要点（对正式集成有直接影响）**：

1. **X6 3.x 运行时需要 `tslib`**：其 ESM 构建 `import ... from "tslib"`，但未声明为依赖，需在 `packages/ui` 显式添加（vite 解析失败坑）。
2. **History 在 3.x 是插件**：`graph.use(new History({ enabled: true }))`，不再是 `history: true` 选项；`graph.undo()/redo()` 由插件 API 挂载。
3. **插件全部并入核心包**：`@antv/x6@3.x` 直接导出 `Dnd`/`Snapline`/`Selection`/`Keyboard`/`History`，无需单独安装 `@antv/x6-plugin-*`（那些还是 2.x 且 peer `^2.x`）。
4. **`dnd.start()` 需传节点实例**（`graph.createNode(config)` 后传入），不能传纯配置对象。
5. Snapline 渲染类名为 `x6-widget-snapline`（前缀可配置）。

## 3. 需求形状

### 3.1 JTBD

> 当我已经沉淀了一批理解，但回看时觉得它们像散乱的条目、连了线也看不出逻辑时，
> 我想要在一张画布上亲手摆出这些理解，并标记"谁依赖谁、谁推导出谁"，
> 以便看清一个领域的心智结构，并决定下一步该补哪块。

核心区别于旧图谱：**关系不是系统推断的，是用户亲手标记的**——符合产品原则"关系来自用户显式理解"。

### 3.2 承载要求

1. 呈现：一张画布 = 一个心智结构，卡片 + 有向关系线 + 关系描述。
2. 用户必须能：把理解拖进画布、摆位置、连关系、写标签。
3. 用户必须能判断：哪块结构清晰、哪块还缺、哪块是孤岛。
4. 从画布必须能回到原文（点击卡片打开理解详情）。
5. 编辑体验必须完整：参考线对齐、撤销重做、多选、删除（硬需求，不可省略）。

### 3.3 主对象与形态

| 对象             | 定义                       | 说明                                                                                                                                                |
| ---------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 理解画布（画布） | 一个可命名的无限画布       | 如「行为设计系统」「交易心理」「LLM Agent 架构」                                                                                                    |
| 理解卡           | 引用理解库的 Understanding | 显示理解**正文全文（不截断）**，卡片**尺寸可自由调整**；不显示领域标签 / 上下文数等附加信息；点击在右侧打开详情；一张理解可进多个画布（引用非副本） |
| 文本卡           | 画布内自由文本             | 支持**简单 Markdown**；放临时概念、备注、未沉淀的想法                                                                                               |
| 关系线           | 有向 + 自由文本标签        | 从一张卡指向另一张卡，描述如「推导出」「依赖」「矛盾于」                                                                                            |

信息架构：

```text
/understanding-canvas（顶层模块「理解画布」，入口待设计）
├── 左栏：画布列表 —— 新建 / 重命名 / 删除，按更新时间排序
└── 主区：画布工作区
     ├── X6 画布（无限画布 + 参考线 + 撤销重做 + DnD）
     ├── 右侧理解库面板（搜索理解，拖入画布）
     └── 顶部工具栏（画布标题、添加文本卡、缩放 / 适应视图）
```

### 3.4 核心交互流

1. 新建画布 → 命名 → 进入空画布（空状态引导：拖入理解或新建文本卡）。
2. 拖入理解卡：右侧面板搜索理解 → 拖到画布落点（或点击加入画布中心）。
3. 新建文本卡：工具栏按钮 / 双击空白处。
4. 连线：从卡片拖出箭头到目标卡 → 编辑标签。
5. 编辑体验：移动卡片（参考线对齐）、**调整卡片尺寸**、框选多选、撤销重做、删除（确认）。
6. 回到原文：点击理解卡 → **右侧打开理解详情（复用现有 UnderstandingDetail）**，编辑在详情内进行；画布内卡片只读。
7. 持久化：位置 / 尺寸 / 文本 / 连线 / 标签落库，视口（缩放平移）恢复。

### 3.5 Shape Rules（形态不变量）

- 一张画布只表达**一个**心智结构，不追求全量关系网。
- 理解卡是**引用**不是副本；文本卡是画布局部的。
- **画布内卡片只读**；理解卡的编辑统一在右侧详情面板（复用 UnderstandingDetail）。
- 关系线**只存在于画布内**（画布与画布之间的结构各自独立）。
- 画布不绑定 Domain（v1 独立对象）。

### 3.6 Not Now

- 多人协作、画布导出、跨画布关系视图。
- 画布内自由绘制 / 画笔（X6 可能有，但不作为卖点）。
- AI 自动建图 / 自动连线（违背"关系来自用户显式理解"）。

## 4. 数据模型草案

```text
understanding_canvases           id, title, description?, createdAt, updatedAt
understanding_canvas_elements   id, canvasId→canvases(CASCADE), type: "understanding"|"text",
                                understandingId→understandings(可空), text?, x, y, width?,
                                zIndex?, createdAt, updatedAt
understanding_canvas_edges      id, canvasId→canvases(CASCADE),
                                sourceElementId→elements(CASCADE), targetElementId→elements(CASCADE),
                                label?, createdAt
```

- 同一理解卡可进多个画布（各自有位置）。
- 删除元素级联删除其连线。
- 被引理解删除后：元素保留、显示「（已删除）」占位，不静默丢卡（加载时处理）。
- 删除画布：v1 硬删除 + 确认对话框（不进回收站）。

## 5. 删除面（Knowledge Wander）

| 位置                                | 内容                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `modules/capture/knowledge-wander/` | 整个目录（index.tsx、graph-data.ts、测试）                                                         |
| `packages/ui/src/knowledge/`        | 整个目录（KnowledgeGraph、state、stories、测试）                                                   |
| `capture/store.ts`                  | `captureMode`、`CaptureMode`、`toggleKnowledgeWander`                                              |
| `understanding-list/index.tsx`      | 「打开知识漫步」入口按钮                                                                           |
| `capture/index.tsx`                 | lazy import 与 wander 分支                                                                         |
| E2E                                 | `knowledge-wander.spec.ts`、`knowledge-wander-hover.spec.ts`                                       |
| Feature                             | `explore-knowledge.feature`（KW-GRAPH-\*）；`manage-connections.feature` 的 CP-CONNECTION-003 改写 |

**保留**：CLI `reflecta graph`（文本命令，非力导向图谱，属另一功能）；wiki-link Connection 录入机制（那是"建立关系"的录入方式，图谱只是它的可视化）。

## 6. 测试与文档计划

- 新增 understanding-canvas Feature（Gherkin 按 test-case-principles）+ 对应 acceptance spec。
- `docs/references/technical/biz/understanding-canvas/` 记录模块语义与跨层流程。
- 画布组件按 storybook-principles 建立 Showcase（画布节点、连线标签、空/长/边界状态）。
- 版本号与 CHANGELOG 按 release-process 在发版时统一处理。

## 7. 决策记录与剩余开放项

### 已确认决策

1. **理解卡点击行为**：右侧打开理解详情（复用现有 UnderstandingDetail），不离开画布语境。
2. **卡片显示内容**：理解正文全文（不截断），卡片尺寸可自由调整；不显示领域标签 / 上下文数等附加信息。
3. **卡片可编辑性**：画布内卡片只读；编辑在右侧详情面板进行（复用）。
4. **文本卡能力**：支持简单 Markdown（加粗 / 列表等）。
5. **画布列表形态**：纯列表足够，不做排序 / 分组。
6. **画布能力扩展**：图形元素（矩形 / 圆形）与打组（可命名容器）纳入元素体系（F16 / F17）；依据画布体验调研（canvas-experience-research §8），将连线重路由、画布内搜索、元素锁定、嵌套画布引用、演示模式、PNG 导出纳入范围（F18-F23）。

### 剩余开放项

1. 最终模块入口：正式名「理解画布」已确认，入口由用户设计。
