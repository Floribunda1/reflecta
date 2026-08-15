# v2.0.0 理解画布服务端实现设计

> 日期：2026-08-11
>
> 状态：Draft
>
> 范围：理解画布模块的服务端实现设计——数据层（表结构 + 迁移）、Electron Renderer IPC 接口、Agent 能力与 tool 设计、CLI 接口。前端渲染层不在本文范围。
>
> 前置文档：[PRD](understanding-canvas-prd.md)（产品要求）、[实现设计](understanding-canvas-implementation-design.md)（状态架构与事件映射）

## 1. 表结构设计与迁移逻辑

### 1.1 三张表定义

#### `understanding_canvases`（画布 = 一个心智结构）

| 字段          | 类型 | 约束     | 说明                                                            |
| ------------- | ---- | -------- | --------------------------------------------------------------- |
| `id`          | TEXT | PK       | 服务端 `createEntityId()` 生成                                  |
| `title`       | TEXT | NOT NULL | 画布标题（默认「未命名画布」，可改名）                          |
| `description` | TEXT | 可空     | 预留描述，v1 未用                                               |
| `viewport`    | TEXT | 可空     | 视口 JSON `{"x":number,"y":number,"zoom":number}`，重进画布恢复 |
| `created_at`  | TEXT | NOT NULL | ISO 时间戳                                                      |
| `updated_at`  | TEXT | NOT NULL | 每次变更刷新                                                    |

索引：`idx_canvases_updated_at(updated_at)`（画布列表按更新时间排序）。

#### `understanding_canvas_elements`（画布元素 = 卡片 / 图形 / 组）

| 字段                        | 类型    | 约束                              | 说明                                                        |
| --------------------------- | ------- | --------------------------------- | ----------------------------------------------------------- |
| `id`                        | TEXT    | PK                                | 与 X6 cell id 一致（前端直用）                              |
| `canvas_id`                 | TEXT    | NOT NULL, FK→canvases **CASCADE** | 删除画布级联清元素                                          |
| `kind`                      | TEXT    | NOT NULL                          | `understanding` / `text` / `shape` / `group` / `canvas_ref` |
| `understanding_id`          | TEXT    | FK→understandings **SET NULL**    | 理解卡引用（跨实体引用 → 列）；理解被删置空 → 前端占位      |
| `canvas_ref_id`             | TEXT    | FK→canvases **SET NULL**          | 嵌套画布引用（跨实体引用 → 列）；目标被删置空 → 占位        |
| `props`                     | TEXT    | NOT NULL DEFAULT '{}'             | kind 专属载荷 JSON（见 ElementProps，共享列之外的一切）     |
| `parent_id`                 | TEXT    | FK→elements **SET NULL**          | 所属组；删组 = 解组保留子元素                               |
| `locked`                    | INTEGER | NOT NULL DEFAULT 0                | 元素锁定（防误拖）                                          |
| `x` / `y`                   | REAL    | NOT NULL                          | X6 模型坐标（组内子元素为相对坐标）                         |
| `width` / `height`          | REAL    | NOT NULL                          | 尺寸                                                        |
| `z_index`                   | INTEGER | NOT NULL DEFAULT 0                | 图层顺序（跨会话保持叠放）                                  |
| `created_at` / `updated_at` | TEXT    | NOT NULL                          | 时间戳                                                      |

索引：`canvas_id`、`understanding_id`、`parent_id`。

**ElementProps（props JSON，kind 专属载荷——共享列之外的一切）**：

```ts
ElementProps = {
  // kind = "text"：文本卡内容（Markdown）
  text?:      string;
  // kind = "shape"：图形类型
  shapeType?: "rect" | "circle";
  // kind = "group"：组名
  label?:     string;
  // kind = "understanding" / "canvas_ref"：无载荷（引用在 FK 列）
}
```

**划分逻辑（C5）**：共同字段（位置/尺寸/z/锁定/父级/时间戳）→ 列（需排序 / 索引 / 约束）；跨实体引用（`understanding_id` / `canvas_ref_id`）→ 引用 FK 列（FK 完整性 + 可查询）；kind 专属载荷 → `props` JSON（不被 SQL 查询，新增 kind / 字段无需迁移）。

#### `understanding_canvas_edges`（连线，画布局部）

| 字段                | 类型 | 约束                              | 说明                              |
| ------------------- | ---- | --------------------------------- | --------------------------------- |
| `id`                | TEXT | PK                                | 与 X6 edge id 一致                |
| `canvas_id`         | TEXT | NOT NULL, FK→canvases **CASCADE** |                                   |
| `source_element_id` | TEXT | NOT NULL, FK→elements **CASCADE** | 删卡片级联删其连线                |
| `target_element_id` | TEXT | NOT NULL, FK→elements **CASCADE** |                                   |
| `label`             | TEXT | 可空                              | 自由文本关系描述（语义字段 → 列） |
| `props`             | TEXT | NOT NULL DEFAULT '{}'             | 样式载荷 JSON（见 EdgeStyle）     |
| `created_at`        | TEXT | NOT NULL                          |                                   |

索引：`canvas_id`、`source_element_id`、`target_element_id`。

**EdgeStyle（props JSON，社区连线样式四维模型）**：

```ts
EdgeStyle = {
  routing?:    "straight" | "curve" | "orthogonal"; // 拐点类型：直线 / 贝塞尔弧线 / 正交直角
  lineStyle?:  "solid" | "dashed" | "dotted";       // 线型：实线 / 虚线 / 点线
  color?:      string;                                  // 颜色：预设色板 key 或 hex
  width?:      "thin" | "medium" | "thick";           // 粗细
  arrowhead?:  "arrow" | "block" | "none";           // 箭头：默认 arrow（有向），可去
}
// 默认：straight + solid + 灰 + medium + arrow
```

### 1.2 关键设计决策

| 决策                                             | 理由                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **元素 / 连线为行，增量写回**                    | 拖一次卡只更新 x/y，不整文档重写；与社区 node/edge 关系表路线一致（见调研文档）                                                                  |
| **FK 一律 SET NULL / CASCADE，不硬删除业务字段** | 理解被删 → 置空占位（不静默丢卡）；删组 → 子元素解组保留；删画布/卡片 → 级联清理                                                                 |
| **`z_index` 持久化**                             | 白板 shape 模型标配，跨会话保持叠放次序                                                                                                          |
| **呈现载荷一律进 `props` JSON**                  | 元素 kind 专属字段与连线样式都是纯展示、不被 SQL 查询；进 JSON 后新增样式字段（箭头样式、圆角等）无需迁移；语义字段（引用 FK、连线 label）留在列 |
| **组内子元素为相对坐标**                         | 对齐 X6 embedding 语义（子坐标相对父，随父移动），避免每次移动重算绝对坐标                                                                       |
| **`locked` 独立列而非 X6 attrs 内嵌**            | 锁定是业务状态，可查询、可被 Agent / CLI 感知                                                                                                    |
| **元素 id == X6 cell id**                        | 事件回写零映射成本                                                                                                                               |

### 1.3 迁移逻辑（v2.0.0）

采用项目既有**版本化代码迁移**机制（`packages/server/src/db/migration/code/`）：

- 新增 `v2.0.0.ts`：`CodeMigration { name: "v2.0.0.sql", version: [2,0,0], up(ctx) }`，通过 `ctx.sql` 执行三张表的 `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS`（SQL 列名用 snake_case，与 drizzle schema 列定义一致）。
- **幂等**：全部 `IF NOT EXISTS`；重复执行安全（与 v1.0.0 建表风格一致）。
- **注册**：`migration.ts` 的 `codeMigrations` 数组追加 `v150`（版本排序自动处理，大于 v1.3.5 即生效）。
- **无检索索引影响**：本模块内容不进全文检索（不调用 `requestRetrievalIndexRebuild`）。
- **schema.ts 同步**：drizzle 表定义（`understandingCanvases` / `understandingCanvasElements` / `understandingCanvasEdges`）与迁移 SQL 保持一致，供 ORM 查询与类型推导使用；`real` 类型从 drizzle 导入。

### 1.4 查询装配（getCanvas）

`getCanvas(id)` 一次装配画布详情：

```text
canvas 行
  + elements 行（按 canvas_id）
  + edges 行（按 canvas_id）
  + understandingRefs：收集 elements[kind=understanding].understanding_id
      → join understandings（含软删行）
      → 缺失 / 软删 → { deleted: true }（前端占位）
  + referencedCanvases：收集 elements[kind=canvas_ref].canvas_ref_id
      → join canvases → 缺失 → { deleted: true }
```

## 2. 开放给 Electron Renderer 的 IPC 接口

### 2.1 注册链路（沿用既有模式）

```text
packages/server/domains/understanding-canvas/   # domain（core + bff-electron + bff-cli + types）
  └─ packages/server/src/index.ts                # export * from "./domains/understanding-canvas"
apps/electron/src/main/services/core.ts          # understandingCanvasService = createLazy(new UnderstandingCanvasElectronBff(options))
apps/electron/src/main/services/UnderstandingCanvasService.ts  # IpcService, groupName = "understandingCanvas"
apps/electron/src/main/services/index.ts         # createServices([..., UnderstandingCanvasService])
apps/electron/src/preload/typings/understanding-canvas.d.ts    # re-export @reflecta/server 类型
renderer: ipcClient.understandingCanvas.*        # MergeIpcService 自动派生，零手写
```

### 2.2 接口清单

| 方法                                           | 输入                       | 返回                      | 说明                                                                     |
| ---------------------------------------------- | -------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `listCanvases()`                               | —                          | `CanvasSummaryDTO[]`      | 摘要列表（含 element/edge 计数），按 updatedAt 倒序                      |
| `listCanvasesByUnderstanding(understandingId)` | `string`                   | `CanvasSummaryDTO[]`      | 反向查询：该理解出现在哪些画布（M6-6 画布归属）                          |
| `getCanvas(id)`                                | `string`                   | `CanvasDetailDTO \| null` | 详情：canvas + elements + edges + understandingRefs + referencedCanvases |
| `createCanvas(input)`                          | `{ title }`                | `CanvasDTO`               | 新建画布                                                                 |
| `updateCanvas(id, input)`                      | `{ title? }`               | `CanvasDTO`               | 改名                                                                     |
| `deleteCanvas(id)`                             | `string`                   | `void`                    | 硬删除（级联）                                                           |
| `updateViewport(id, viewport)`                 | `{ x, y, zoom }`           | `void`                    | 视口持久化                                                               |
| `createElement(canvasId, input)`               | `CreateCanvasElementInput` | `CanvasElementDTO`        | 新建元素（理解卡 / 文本卡 / 图形 / 组 / 画布引用）                       |
| `updateElement(id, input)`                     | `UpdateCanvasElementInput` | `CanvasElementDTO`        | 位置 / 尺寸 / 文本 / 标签 / 锁定 / 入组出组                              |
| `deleteElement(id)`                            | `string`                   | `void`                    | 删除（级联连线）                                                         |
| `createEdge(canvasId, input)`                  | `CreateCanvasEdgeInput`    | `CanvasEdgeDTO`           | 新建连线                                                                 |
| `updateEdge(id, input)`                        | `{ label?, style? }`       | `CanvasEdgeDTO`           | 改标签 / 样式                                                            |
| `deleteEdge(id)`                               | `string`                   | `void`                    | 删除连线                                                                 |

### 2.3 DTO 定义

```ts
CanvasDTO            { id, title, description, viewport, createdAt, updatedAt }
CanvasSummaryDTO     CanvasDTO & { elementCount, edgeCount }
CanvasElementDTO     { id, canvasId, kind, understandingId, canvasRefId,
                       props: ElementProps, parentId, locked, x, y, width, height, zIndex,
                       createdAt, updatedAt }
// 注意：shapeType / text / label 不再是 DTO 顶层字段，统一在 props 内（与 DB 存储一致）
CanvasEdgeDTO        { id, canvasId, sourceElementId, targetElementId, label, style: EdgeStyle | null, createdAt }
EdgeStyle           { routing?, lineStyle?, color?, width?, arrowhead? }
CanvasUnderstandingRef  { id, title, body, deleted }
CanvasReferencedCanvas  { id, title, deleted }
CanvasDetailDTO      { canvas: CanvasDTO, elements: CanvasElementDTO[],
                       edges: CanvasEdgeDTO[], understandingRefs: CanvasUnderstandingRef[],
                       referencedCanvases: CanvasReferencedCanvas[] }
```

**输入类型（与 props JSON 一致）**：

```ts
CreateCanvasElementInput = {
  kind: "understanding" | "text" | "shape" | "group" | "canvas_ref",
  understandingId?: string,   // kind=understanding 必填
  canvasRefId?: string,       // kind=canvas_ref 必填
  props?: ElementProps,       // kind 专属载荷（text / shapeType / label）
  parentId?: string | null,   // 入组
  x: number; y: number; width: number; height: number,  // 前端创建带坐标（agent 创建无坐标，见 §6.2）
}

UpdateCanvasElementInput = {
  x?: number; y?: number; width?: number; height?: number,
  props?: Partial<ElementProps>,  // 文本 / 图形类型 / 组名更新
  parentId?: string | null,        // 入组 / 出组
  locked?: boolean,
}

CreateCanvasEdgeInput = {
  sourceElementId: string,
  targetElementId: string,
  label?: string | null,
  style?: EdgeStyle | null,
}

UpdateCanvasEdgeInput = {
  label?: string | null,
  style?: EdgeStyle | null,
}
```

### 2.4 校验与错误边界（domain core 层）

| 场景                     | 行为                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 画布 / 元素 / 连线不存在 | 抛错（`Canvas not found: <id>` 等），IPC 包装为错误返回                                                             |
| kind 不变量              | `understanding` 必须带 `understanding_id`；`shape` 的 props 必须带 `shapeType`；`canvas_ref` 必须带 `canvas_ref_id` |
| 连线端点                 | 两端元素必须存在且属于同一画布；禁止自环（source === target）                                                       |
| 入组（parent_id）        | 父元素必须是 `group` kind、同一画布、不能是自己或自己的后代（防环）                                                 |
| 理解卡引用               | 创建时校验理解存在（允许引用软删理解？——**允许**，占位语义由前端呈现）                                              |
| 空更新                   | 无有效字段时抛「No canvas element fields to update」类错误                                                          |

## 3. 给 Agent 开放的能力与 tool 设计

> ⚠️ **本节为未确认提案**：tool 清单未经用户拍板（见共识记录 C9），仅作讨论材料；协作形态已确认（AI 提案者 / 用户裁判者，见 PRD §1.4）。

### 3.1 能力定位

Agent（AI 对话）对理解画布**只读**：

- **用户是大脑**：画布的结构、连线、分组必须由用户亲手标记；Agent 不创建 / 不修改画布内容。
- Agent 的价值是**读懂用户的心智结构**：在对话中引用某张画布的结构、指出孤岛、结合理解库讨论。

与现有只读工具集（`pi-readonly-tools.ts` 的 `domain_list` / `understanding_get` 等）一致，本版只加读取工具；修改类（如"帮我把这张卡连到那张"）作为提案制后续版本，需配合用户审批流程。

### 3.2 Tool 设计（2 个）

挂载于 `pi-readonly-tools.ts`，由 `canvasCliService`（CliBff）支撑，纳入 `PI_READ_ONLY_TOOL_NAMES`：

| Tool          | 参数                   | 返回                                                                | 用途                                     |
| ------------- | ---------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `canvas_list` | `{}`                   | `CanvasSummaryDTO[]`（标题 + 元素/连线计数 + 更新时间）             | Agent 知道用户有哪些心智结构、哪些活跃   |
| `canvas_get`  | `{ canvasId: string }` | `CanvasDetailDTO`（元素 + 连线标签 + 引用理解标题/正文 + 被删占位） | Agent 读取一张画布的结构，识别孤岛与关系 |

- 语言风格沿用现有工具（英文 description + 中文 label）。
- 输出经既有 `createToolResult` 包装（诊断日志 / 实体目录统一处理）。

### 3.3 后续（不在本版）

- `canvas_suggest_edit`：提案式修改（入组 / 连线 / 加文本卡），走现有 proposal + 审批链路——需要前端提案渲染支持，独立排期。

## 4. CLI 接口

### 4.1 命令清单（`reflecta canvas <action>`）

| 命令                                             | 说明                               | mutates            |
| ------------------------------------------------ | ---------------------------------- | ------------------ |
| `reflecta canvas list`                           | 列出画布（标题 / 计数 / 更新时间） | 否                 |
| `reflecta canvas get <canvas-id>`                | 画布详情（元素 / 连线 / 引用理解） | 否                 |
| `reflecta canvas create <title>`                 | 新建画布                           | 是（`--yes` 确认） |
| `reflecta canvas update <canvas-id> --title <t>` | 改名                               | 是                 |
| `reflecta canvas delete <canvas-id>`             | 删除画布（级联）                   | 是                 |

### 4.2 注册链路（沿用既有模式）

```text
apps/cli/src/services.ts                    # ReflectaCliServices 加 canvases: UnderstandingCanvasCliBff
apps/cli/src/actions/canvas/list.ts | get.ts | create.ts | update.ts | delete.ts
    # 每个 action：registerActionMeta(resource, action, {...}) + cli.command(...).action(...)
apps/cli/src/cli.ts                         # registerXxxAction 注册；getActionMeta 自动出帮助
```

### 4.3 输出约定

- 列表输出：表格（id 截断 / title / elementCount / edgeCount / updatedAt）。
- 详情输出：JSON（与 DTO 一致，便于脚本消费）。
- 复用 `runner.ts` 的 `runCommand` / `getCommandOptions` / 全局选项（`--json` 等）。

## 5. 测试计划

| 层               | 覆盖                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| domain core 单测 | CRUD 校验：kind 不变量、连线同画布 / 禁自环、入组防环、级联删除、被删理解 ref 标记 |
| domain bff 单测  | getCanvas 装配（元素 + 连线 + understandingRefs + referencedCanvases）、列表计数   |
| 迁移单测         | v2.0.0 在空库 / 已有数据上执行幂等，schema 与 SQL 一致                             |
| CLI              | `canvas list/get/create/update/delete` 注册与帮助输出（对齐 global.test.ts 模式）  |

## 6. 待办（承接共识 TBD，Server 归口）

> 从共识文档迁移的 Server 层待办。已定的在此实施；未定的在此文档步骤内解决。

### 6.1 已定待实施

- **TBD-3 修正清单（wiki-link 降级）**：
  1. 表名 `understanding_connections` → `understanding_mentions`（v2.0.0 迁移 `ALTER TABLE ... RENAME TO` + schema.ts + 全部代码引用）。
  2. 类型/字段：`UnderstandingConnection` → `UnderstandingMention`；`connectionCount` / `connectionIds` → `mentionCount` / `mentionIds`；`UnderstandingRelation` 改为引用（mention）语义。
  3. Agent tool：**删除 `graph` tool**；`understanding_get` / `domain_inspect` 描述中 "wiki-link relations" / "relations" 改为 "wiki-link mentions / citations（弱引用，非结构）"。
  4. CLI：`reflecta graph` 命令与 `GraphCliBff` domain 一并删除。
- **TBD-2**：understanding detail DTO（agent 侧 `understanding_get` 与 UI 共用）加 `referencedByCanvases: Array<{ id, title }>`——查询 `canvas_elements.understanding_id` 索引反向 join 画布标题。
- **C13**：`listCanvasesByUnderstanding(understandingId)` IPC 方法（反向查询，与 M6-6 共用数据）。

### 6.2 未定待解决（本文档步骤内定）

- **`update_canvas` 参数**：内容级写（增元素/连线/分组/改内容），候选形态 = 分桶变更 `{ addElements, updateElements, removeElements, addEdges, updateEdges, removeEdges, rename? }`；**无坐标字段**（Agent 不做布局，位置由前端自动排开）。
- **search 后置项**：
  - `query` 是否匹配引用理解正文（先只匹配标题，正文命中为增强，需评估 join 成本）；
  - 多词 AND 模式（`understandingIds[] + match: "all" | "any"` 升级路径，先单 id）。
- **preview tool 数据契约**（C15）：Agent 输出结构化画布数据（CanvasDocument 形状：元素/连线/分组）→ 前端只读渲染；契约与序列化格式需在此定义（参考 mermaid "文本块 → 渲染"模式；代码库无先例，需调研）。
