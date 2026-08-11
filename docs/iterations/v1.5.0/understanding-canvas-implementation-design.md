# v1.5.0 理解画布实现设计

> 日期：2026-08-11
>
> 状态：Draft（实现前的设计定稿，作为编码依据）
>
> 范围：理解画布模块（/understanding-canvas）的后端存储、前端状态架构与实现结构
>
> 依据：[需求与计划](understanding-canvas-plan.md)（需求形状、选型决策、spike 结论）

## 0. 本文回答的三个问题

1. 要实现的功能结构列表 —— §1
2. 表结构的定义和存储逻辑 —— §2
3. 前端实现的状态架构流转设计 —— §3

## 1. 功能结构列表

### 1.1 模块总览

```text
/understanding-canvas（顶层模块，入口由用户设计）
├── 左栏：画布列表（新建 / 重命名 / 删除，按更新时间排序）
└── 主区：画布工作区
     ├── 顶部工具栏（极简）：画布标题、理解库（开右侧面板）、文本卡（可拖拽 icon）、矩形（可拖拽 icon）、圆形（可拖拽 icon）
     ├── 画布左下工具栏：放大 / 缩小 / 适应视图
     ├── 画布右下：缩略图（minimap）
     ├── X6 画布（无限画布、点状网格、平移缩放、参考线、框选多选、键盘）
     └── 右侧单面板（互斥切换）：理解库模式（domain filter + 搜索 + 排序 + 理解列表，卡片拖入画布）/ 理解详情模式（点击理解卡打开，复用 UnderstandingDetail）
```

### 1.2 功能清单（含验收要点）

| #   | 功能                | 说明                                                                                                                           | 验收要点                                             |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| F1  | 画布列表            | 新建（默认标题）、重命名、删除（确认）；按更新时间排序                                                                         | 列表操作正确、删除有确认                             |
| F2  | 空画布引导          | 无元素时提示拖入理解 / 新建文本卡                                                                                              | 空状态文案与操作可达                                 |
| F3  | 拖入理解卡          | 工具栏「理解库」打开右侧面板（domain filter + 搜索 + 排序）→ 拖到画布落点                                                      | 落点位置正确、卡内显示标题与正文全文                 |
| F4  | 新建文本卡          | 工具栏「文本卡」icon button，**仅支持拖拽到画布落点创建**（不支持点击创建）                                                    | 创建后可编辑文本                                     |
| F5  | 理解卡只读展示      | 显示理解正文全文（不截断），尺寸可调；不显示领域标签 / 上下文数                                                                | 卡片随理解库内容更新；被删理解显示「（已删除）」占位 |
| F6  | 文本卡编辑          | 简单 Markdown（加粗 / 列表），就地编辑                                                                                         | 保存后持久化、重进画布还原                           |
| F7  | 有向连线            | 从卡片拖出箭头到目标卡（端口连线）                                                                                             | 方向正确、可多连                                     |
| F8  | 连线标签            | **双击连线内联编辑**自由文本标签（工具栏不放标签输入框，配合精简）                                                             | 标签持久化、移动卡片时随动                           |
| F9  | 参考线对齐          | 拖动卡片时与其它卡片边缘 / 中心对齐                                                                                            | 对齐出现指示线、松手后位置落齐                       |
| F10 | 撤销 / 重做         | X6 History：位置、增删、标签、文本；**仅键盘快捷键**（Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z），无工具栏按钮                            | 快捷键可用                                           |
| F11 | 框选多选 / 整组拖动 | 橡皮筋框选、Shift 多选、整体移动                                                                                               | 多选移动后各自位置持久化                             |
| F12 | 删除                | 选中卡片 / 连线后 Delete / Backspace（确认）                                                                                   | 级联删除连线                                         |
| F13 | 打开理解详情        | 点击理解卡 → **右侧单面板切换为详情模式**，复用 UnderstandingDetail，编辑在详情内                                              | 详情可编辑、保存后画布卡片内容同步                   |
| F14 | 持久化与恢复        | 位置 / 尺寸 / 文本 / 连线 / 标签落库；视口（缩放平移）恢复                                                                     | 重进画布完整还原                                     |
| F15 | 画布控制            | **左下工具栏**：放大 / 缩小 / 适应视图；**右下缩略图**（minimap）                                                              | 缩放生效、适应视图回到全部元素、缩略图随视口联动     |
| F16 | 图形元素            | 工具栏「矩形 / 圆形」icon（可拖拽）创建；用于画布内标记；无文字标签（v1）                                                      | 拖入后渲染为对应图形、位置持久化                     |
| F17 | 打组                | 「组」为可命名的容器元素（显式边框 + 标题栏）；元素拖入组即入组、拖出即出组；拖组时组内元素跟随；删除组 = 解组（组内元素保留） | 组名可编辑、分组关系持久化、拖组子元素跟随           |

### 1.4 待后续讨论（本轮不定）

本轮待议项已收敛：右侧单面板互斥切换；「文本卡」icon 仅拖拽创建；图形元素（矩形 / 圆形）与「组」为本轮新增需求（见 F16 / F17），交互细节（如组是否可连线）后议。

### 1.3 后端能力（domain + IPC）

新增 domain `understanding-canvas`（`packages/server/src/domains/understanding-canvas/`），主进程注册 IPC group `understandingCanvas`：

| 方法                                                                       | 说明                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------- |
| `listCanvases()`                                                           | 画布摘要列表（含元素 / 连线计数）                 |
| `getCanvas(id)`                                                            | 画布详情：元素 + 连线 + 被引理解的标题 / 正文映射 |
| `createCanvas(input)` / `updateCanvas(id, input)` / `deleteCanvas(id)`     | 画布 CRUD（删除为硬删除级联）                     |
| `updateViewport(id, viewport)`                                             | 保存视口（x / y / zoom）                          |
| `createElement(canvasId, input)`                                           | 新建元素（理解卡 / 文本卡）                       |
| `updateElement(id, input)`                                                 | 更新位置 / 尺寸 / 文本                            |
| `deleteElement(id)`                                                        | 删除元素（级联其连线）                            |
| `createEdge(canvasId, input)` / `updateEdge(id, input)` / `deleteEdge(id)` | 连线 CRUD（标签更新）                             |

## 2. 表结构的定义和存储逻辑

### 2.1 方案取舍（先定存储形态）

|                | 关系表（采用）               | 单表快照 JSON           | localStorage          |
| -------------- | ---------------------------- | ----------------------- | --------------------- |
| 持久化位置     | SQLite 三张表                | SQLite 一张表 + data 列 | renderer localStorage |
| 迁移           | 需要（一次）                 | 需要（一次）            | 不需要                |
| 写入粒度       | 增量（拖一次只改 x/y）       | 整文档重写              | 整文档重写            |
| 查询           | 「哪些画布引用了理解 X」可查 | 需解析 JSON             | 不可查                |
| 与理解库一致性 | 元素级 FK 可置空显示占位     | 加载时遍历 JSON 找引用  | 同左但无索引          |
| 符合应用架构   | ✅ 内容级数据与理解同层      | 部分                    | ❌ 内容脱离数据层     |

**结论**：采用三张关系表。画布数据是「内容」不是「偏好」，应与理解 / 上下文同层；增量写回避免每次拖拽重写整文档；元素级记录保留「哪些画布用了理解 X」的查询能力和被删理解的占位语义。

### 2.1b 社区实践对照（调研 2026-08-11）

| 实践                            | 代表                                                                  | 持久化形态               |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| 整文档 JSON（元素数组 + 状态）  | Excalidraw（.excalidraw JSON）、tldraw（StoreSnapshot + schema 迁移） | 快照为主，元素为同步单元 |
| 关系型 node / edge 表 + 画布 FK | 图 / 流程编辑器（React Flow 类）、CollabBoard（SQLite）               | 元素 / 边为行，增量写回  |

我们的场景属于后者：元素承载真实语义（理解引用）、需要 FK 完整性（被删理解置空占位）、需要查询（哪些画布用了理解 X）——关系表设计成立。

社区通用字段对照：每个元素带 `createdAt / updatedAt`（我们有）；**图层顺序 `z_index` 需补充**（白板 shape 模型的标配字段，跨会话保持卡片叠放次序）。

### 2.2 表定义（Drizzle + 迁移 v1.5.0）

```sql
-- 画布（一个心智结构）
CREATE TABLE understanding_canvases (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  viewport    TEXT,              -- JSON: {"x": number, "y": number, "zoom": number}，可空
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 画布元素（卡片）
CREATE TABLE understanding_canvas_elements (
  id               TEXT PRIMARY KEY,
  canvas_id        TEXT NOT NULL REFERENCES understanding_canvases(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('understanding', 'text', 'shape', 'group')),
  understanding_id TEXT REFERENCES understandings(id) ON DELETE SET NULL, -- 被删理解置空 → 占位
  shape_type       TEXT CHECK (shape_type IN ('rect', 'circle')),         -- kind='shape' 时必填
  text             TEXT,              -- 文本卡内容（Markdown）；图形的可选标签
  label            TEXT,              -- 组名（kind='group' 时）
  parent_id        TEXT REFERENCES understanding_canvas_elements(id) ON DELETE SET NULL, -- 所属组（解组保留子元素）
  x                REAL NOT NULL,     -- X6 模型坐标（组内子元素为相对坐标）
  y                REAL NOT NULL,
  width            REAL NOT NULL,
  height           REAL NOT NULL,
  z_index          INTEGER NOT NULL DEFAULT 0, -- 图层顺序（社区 shape 模型标配）
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_canvas_elements_canvas        ON understanding_canvas_elements(canvas_id);
CREATE INDEX idx_canvas_elements_understanding ON understanding_canvas_elements(understanding_id);

-- 画布连线（有向、画布局部）
CREATE TABLE understanding_canvas_edges (
  id                TEXT PRIMARY KEY,
  canvas_id         TEXT NOT NULL REFERENCES understanding_canvases(id) ON DELETE CASCADE,
  source_element_id TEXT NOT NULL REFERENCES understanding_canvas_elements(id) ON DELETE CASCADE,
  target_element_id TEXT NOT NULL REFERENCES understanding_canvas_elements(id) ON DELETE CASCADE,
  label             TEXT,              -- 自由文本关系描述，可空
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_canvas_edges_canvas ON understanding_canvas_edges(canvas_id);
```

### 2.3 存储逻辑

- **ID 约定**：元素 / 连线 ID 由服务端 `createEntityId()` 生成，并作为 X6 的 cell id 传入节点 / 边 —— **DB id === X6 cell id**，省去双向映射。
- **坐标**：`x / y` 存 X6 **模型坐标**（与缩放无关），渲染时按视口变换。
- **写回时机（增量）**：

| 用户动作                         | 写入                                                                        |
| -------------------------------- | --------------------------------------------------------------------------- |
| 拖拽卡片结束（drag end）         | `updateElement` x / y                                                       |
| 调整卡片尺寸结束                 | `updateElement` width / height                                              |
| 文本卡编辑失焦（防抖 300-500ms） | `updateElement` text                                                        |
| 连线标签编辑失焦 / 输入防抖      | `updateEdge` label                                                          |
| 从面板拖入 / 新建                | `createElement`（kind + understandingId / text / shapeType + x / y + 尺寸） |
| 连线创建                         | `createEdge`（source / target / label）                                     |
| 元素入组 / 出组（embedding）     | `updateElement` parent_id（组内子元素坐标为相对坐标，随父移动）             |
| 组名 / 图形标签编辑              | `updateElement` label / text                                                |
| 删除卡片 / 连线                  | `deleteElement` / `deleteEdge`（级联）                                      |
| 删除组                           | `updateElement` parent_id 置空（解组，子元素保留），再删组元素              |
| 画布平移缩放停止                 | `updateViewport`（防抖）                                                    |

- **撤销 / 重做**：X6 History 在画布内还原位置 / 增删 / 标签，还原过程同样触发上述 X6 事件 → 事件驱动写回，DB 自然跟随（无需单独处理）。注意与写回防抖窗口配合，避免把撤销过程与普通编辑合并成一次错误落库。
- **被删理解占位**：`getCanvas` 时收集元素里的 `understandingId` → join 理解库；缺失的返回 `deleted: true` 标记，前端渲染「（已删除）」占位卡片（仍可删除 / 连线保留）。`ON DELETE SET NULL` 保证理解删除不级联删画布内容。
- **删除画布**：硬删除 + 确认对话框（v1 不进回收站），CASCADE 清理元素与连线。
- **理解编辑同步**：理解详情保存后 invalidate 画布的 understandingRefs → 卡片标题 / 正文刷新。

## 3. 前端实现的状态架构流转设计

### 3.1 状态分层

```text
┌─────────────────────────────────────────────────────────────┐
│ 数据层  react-query（服务端状态）                              │
│   canvasList / canvasDetail / mutations                       │
├─────────────────────────────────────────────────────────────┤
│ 文档层  CanvasDocument（display-ready 模型，纯数据）            │
│   adapter.buildDocument(canvasDTO) → CanvasDocument            │
│   adapter.extractChange(cell) → 语义变更                       │
├─────────────────────────────────────────────────────────────┤
│ 画布层  X6 Graph（工作状态：位置 / 标签 / 选择 / 历史）          │
│   由 CanvasDocument 渲染；变更通过语义事件上抛                  │
├─────────────────────────────────────────────────────────────┤
│ UI 层  zustand（模块 UI 状态）                                 │
│   selectedCanvasId / 面板开关 / 选中元素与连线 / 详情面板       │
└─────────────────────────────────────────────────────────────┘
```

**CanvasDocument（display-ready 状态）**：

```ts
type CanvasDocument = {
  elements: Array<
    | {
        id: string;
        kind: "understanding";
        understandingId: string;
        deleted: boolean;
        title: string;
        body: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | {
        id: string;
        kind: "text";
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | {
        id: string;
        kind: "shape";
        shapeType: "rect" | "circle";
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | {
        id: string;
        kind: "group";
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
        children: string[]; // 组内元素 id（相对坐标）
      }
  >;
  edges: Array<{ id: string; sourceElementId: string; targetElementId: string; label: string }>;
};
```

### 3.2 X6 事件 → 语义事件 → 持久化映射

| X6 事件                                 | 语义事件（CanvasGraph props 上抛）                                      | 持久化                         |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| `node:change:position`（drag end）      | `onElementMoved(id, x, y)`                                              | `updateElement`                |
| `node:change:size`（resize end）        | `onElementResized(id, w, h)`                                            | `updateElement`                |
| 文本卡 data.text 变化（失焦）           | `onElementTextChanged(id, text)`                                        | `updateElement`                |
| 组 / 图形 data.label / text 变化        | `onElementLabelChanged(id, label)`                                      | `updateElement`                |
| 入组 / 出组（change:parent / children） | `onElementGroupChanged(id, parentId \| null)`                           | `updateElement`                |
| `edge:change:labels`（失焦）            | `onEdgeLabelChanged(id, label)`                                         | `updateEdge`                   |
| DnD 拖入落点                            | `onElementDropped({ kind, understandingId?, text?, shapeType?, x, y })` | `createElement`                |
| 端口连线完成                            | `onConnect(sourceId, targetId)`                                         | `createEdge`                   |
| `node:removed` / `edge:removed`         | `onDeleteElement(id)` / `onDeleteEdge(id)`                              | `deleteElement` / `deleteEdge` |
| 相机变化（停止后）                      | `onViewportChange({ x, y, zoom })`                                      | `updateViewport`               |

实现要点（spike 结论）：

- X6 3.x：插件在核心包（`Dnd / Snapline / Selection / Keyboard / History / MiniMap`），需显式 `graph.use(new History({ enabled: true }))`；`dnd.start()` 传 `graph.createNode()` 实例；运行时依赖 `tslib` 需加入 `packages/ui`。
- 新元素在 DnD 时先用服务端生成的 id 建好 node data（`{ id, kind, understandingId?, text, shapeType? }`），落点后统一走 `createElement`，避免双 id 问题。
- **MiniMap 可用**（spike 验证通过）；右下缩略图直接封装。
- **图形元素**：`rect` / `circle` 为 X6 内置 shape，DnD 直接 `createNode`，无需自定义注册。
- **打组（embedding）**：graph 配置 `embedding: { enabled, findParent: "center", validate }`（只允许 `group` 容器作为父）；入组用 `child.addTo(parent)`（**双向**设置 parent + children，`setParent` 只设单向）；交互拖拽组时子元素自动跟随（内部 `translate` 语义），程序化移动需用 `translate()` 而非 `position()`；快照中 `children` 以 id 数组持久化，round-trip 自动恢复。

### 3.3 数据流转

**加载**：

```text
useCanvasDetail(canvasId)
  → { canvas, elements, edges, understandingRefs }
  → adapter.buildDocument(dto) → CanvasDocument
  → CanvasGraph（X6）渲染 + canvas.viewport 恢复视口
  → 被删理解（deleted: true）渲染占位卡
```

**编辑写回**：

```text
X6 变更 → 语义事件 → 本地乐观更新（可选）→ 防抖 → mutation → react-query 缓存刷新
```

**理解详情联动**：

```text
点击理解卡 → store.selectedElementId + detailPanelOpen = true
  → UnderstandingDetail(understandingId)（复用，右侧面板）
  → 保存编辑 → invalidate understanding + canvasDetail → 卡片标题/正文刷新
  → 删除理解 → canvasDetail refetch → 卡片变占位
```

**模块 UI 状态（zustand）**：

```ts
type UnderstandingCanvasStore = {
  selectedCanvasId: string | null;
  rightPanelMode: "closed" | "library" | "detail"; // 单面板，互斥切换
  selectedElementId: string | null; // 选中的卡片（详情 / 删除定位）
  selectedEdgeId: string | null; // 选中的连线（标签编辑联动）
};
```

- X6 内部状态（选择 / 视口 / 历史）由 X6 自己持有，不进 zustand。
- `selectedCanvasId` v1 不持久化，每次从列表进入。

### 3.4 文件结构

```text
apps/electron/src/renderer/src/modules/understanding-canvas/
  index.tsx                      # 页面：左栏列表 + 主区工作区
  store.ts                       # zustand UI 状态
  queries.ts                     # react-query hooks + mutations
  canvas/
    CanvasWorkspace.tsx          # 工具栏 + 画布 + 右侧面板编排
    CanvasToolbar.tsx            # 标题、理解库（开右侧面板）、文本卡 / 矩形 / 圆形（可拖拽 icon）
    CanvasControls.tsx           # 画布左下工具栏：放大 / 缩小 / 适应视图
    CanvasMinimap.tsx            # 画布右下缩略图（封装 X6 MiniMap）
    RightPanel.tsx               # 右侧单面板容器：mode = library | detail 互斥切换
    LibraryPanel.tsx             # 理解库模式：复用 understanding-list 的 domain filter / 搜索 / 排序能力，主动作是拖入画布
    UnderstandingDetailPanel.tsx # 理解详情模式：复用 UnderstandingDetail
  adapters/
    document.ts                  # CanvasDTO ↔ CanvasDocument（纯函数）
    document.test.ts
  model-list/
    ModelList.tsx                # 画布列表（新建 / 重命名 / 删除）

packages/ui/src/understanding-canvas/
  canvas-graph.tsx               # X6 生命周期封装 + 事件桥（props: document + 语义回调）
  shapes/
    understanding-card.tsx       # 理解卡 shape（标题 + 正文全文，只读）
    text-card.tsx                # 文本卡 shape（简单 Markdown，可编辑）
    group.tsx                    # 组容器 shape（显式边框 + 标题栏，组名可编辑）
    shape-rect.tsx / shape-circle.tsx  # 图形元素（X6 内置 rect / circle，可选标签）
  index.ts
  canvas-graph.stories.tsx       # Showcase（基线 / 空 / 长文 / 连线标签 / 选中态）
```

- **UI seam**：`CanvasGraph` 只接收 `CanvasDocument` + 语义回调（display-ready state + semantic callbacks），适配器在 renderer —— 符合 Storybook 验收原则，Storybook 用 fixture 文档驱动。
- **UnderstandingDetail 复用说明**：该组件直接依赖 `useCaptureStore`（draft / context 状态），v1 直接复用（同一 app store，行为一致）；画布保存后 invalidate 画布 refs 保证卡片同步。将来如需解耦可抽 shared，不在本轮范围。
- **文本卡 Markdown**：复用 `@reflecta/ui/editor` 的 markdown 渲染能力（简单子集：加粗 / 列表）。

## 4. 里程碑建议（实现顺序）

1. **M1 后端**：迁移 v1.5.0（三表）+ `understanding-canvas` domain + IPC service + 单测。
2. **M2 UI 包**：`CanvasGraph` + 卡片 shapes + adapter（renderer 侧） + Storybook Showcase + 单测。
3. **M3 模块**：`/understanding-canvas` 路由 + 画布列表 + 工作区 + 理解库面板 + 详情联动。
4. **M4 验收**：mental-model Feature（Gherkin）+ acceptance spec + E2E；`docs/references/technical/biz/understanding-canvas/` 模块文档。

## 5. 引用

- [需求与计划](understanding-canvas-plan.md)：需求形状、选型（X6）、spike 结论、删除面。
- [前端规范](../../references/technical/frontend-guide.md)：技术栈与复用规则。
- [Storybook 验收原则](../../references/technical/storybook-principles.md)：组件 Showcase 与 UI seam。
