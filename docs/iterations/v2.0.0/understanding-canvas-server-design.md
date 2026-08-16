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

| 字段                        | 类型    | 约束                              | 说明                                                           |
| --------------------------- | ------- | --------------------------------- | -------------------------------------------------------------- |
| `id`                        | TEXT    | PK                                | 与 X6 cell id 一致（前端直用）                                 |
| `canvas_id`                 | TEXT    | NOT NULL, FK→canvases **CASCADE** | 删除画布级联清元素                                             |
| `kind`                      | TEXT    | NOT NULL                          | `understanding` / `text` / `shape` / `group` / `canvas_ref`    |
| `understanding_id`          | TEXT    | FK→understandings **SET NULL**    | 理解卡引用（跨实体引用 → 列）；理解被删置空 → 前端占位         |
| `canvas_ref_id`             | TEXT    | FK→canvases **SET NULL**          | 嵌套画布引用（跨实体引用 → 列）；目标被删置空 → 占位           |
| `props`                     | TEXT    | NOT NULL DEFAULT '{}'             | 呈现 / kind 专属载荷 JSON（见 ElementProps，共享列之外的一切） |
| `parent_id`                 | TEXT    | FK→elements **SET NULL**          | 所属组；删组 = 解组保留子元素                                  |
| `x` / `y`                   | REAL    | NOT NULL                          | X6 模型坐标（组内子元素为相对坐标）                            |
| `width` / `height`          | REAL    | NOT NULL                          | 尺寸                                                           |
| `z_index`                   | INTEGER | NOT NULL DEFAULT 0                | 图层顺序（跨会话保持叠放）                                     |
| `created_at` / `updated_at` | TEXT    | NOT NULL                          | 时间戳                                                         |

索引：`canvas_id`、`understanding_id`、`parent_id`。

**ElementProps（props JSON，kind 专属载荷——判别联合，kind 为判别字段）**：

```ts
// 1. kind → 专属载荷映射（lookup）：每个 kind 只有自己的合法载荷，无意义组合在类型层面不可能
type WithLocked<T> = T & { locked?: boolean }; // 呈现状态（防误拖锁定）随 props 走，非业务状态

type ElementPropsMap = {
  understanding: WithLocked<Record<string, never>>; // 引用在 FK 列，无载荷（DB 存 {}）
  text: WithLocked<{ text: string }>; // 文本卡内容（Markdown）
  shape: WithLocked<{ shapeType: "rect" | "circle" }>; // 图形
  group: WithLocked<{ label: string }>; // 组名
  canvas_ref: WithLocked<Record<string, never>>; // 引用在 FK 列，无载荷（DB 存 {}）
};

// 2. 元素共享字段（列）
type CanvasElementBase = {
  id: string;
  canvasId: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
};

// 3. DTO 判别联合（映射类型自动生成：kind 收窄 props 与引用字段）
type CanvasElementDTO = {
  [K in CanvasElementKind]: CanvasElementBase & {
    kind: K;
    understandingId: K extends "understanding" ? string | null : null;
    canvasRefId: K extends "canvas_ref" ? string | null : null;
    props: ElementPropsMap[K];
  };
}[CanvasElementKind];
```

**划分逻辑（C5）**：共同字段（位置/尺寸/z/锁定/父级/时间戳）→ 列（需排序 / 索引 / 约束）；跨实体引用（`understanding_id` / `canvas_ref_id`）→ 引用 FK 列（FK 完整性 + 可查询）；kind 专属载荷 → `props` JSON（不被 SQL 查询，新增 kind / 字段无需迁移）。**props 内不重复 kind**——判别字段在 DTO 层（DB 的 kind 列即判别）。

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

| 决策                                             | 理由                                                                                                                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **文档级写回（前端权威）**                       | 编辑器（X6）是交互 / 语义权威，`saveCanvas(document)` 整文档同步，服务端按 id 机械对账落行；画布小（几 KB）整文档便宜；级联 / 解组等联动不复制到服务端（社区标准：tldraw / Excalidraw 均为整文档持久化） |
| **FK 一律 SET NULL / CASCADE，不硬删除业务字段** | 理解被删 → 置空占位（不静默丢卡）；删组 → 子元素解组保留；删画布/卡片 → 级联清理                                                                                                                         |
| **`z_index` 持久化**                             | 白板 shape 模型标配，跨会话保持叠放次序                                                                                                                                                                  |
| **呈现 / 锁定状态一律进 `props` JSON**           | 元素 kind 专属字段、连线样式、`locked`（防误拖锁定）都是呈现状态，不是业务状态——不被 SQL 查询、不被 Agent / CLI 感知；进 JSON 后新增字段无需迁移；语义字段（引用 FK、连线 label）留在列                  |
| **组内子元素为相对坐标**                         | 对齐 X6 embedding 语义（子坐标相对父，随父移动），避免每次移动重算绝对坐标                                                                                                                               |
| **元素 id == X6 cell id**                        | 事件回写零映射成本                                                                                                                                                                                       |

**决策记录：`locked` 为何移入 props（不是业务状态）**

- **触发**：初版把 `locked` 设计为独立列（理由是「可查询、可被 Agent / CLI 感知」），用户质疑「locked 作为业务状态无意义」。
- **推理**：防误拖锁定是**编辑 / 呈现状态**，不是语义内容——Agent 不感知（Agent 不做布局）、CLI 不需要、不被任何 SQL 查询；把它做成列 + DTO 字段 + 校验项，是「把呈现状态建模成业务状态」的过度建模。
- **结论**：`locked` 随 `props` 走（`WithLocked<T>` 包装，各 kind 载荷可带 `locked?: boolean`），从共享列 / DTO 顶层字段 / UpdateCanvasElementInput 移除。

### 1.3 迁移逻辑（v2.0.0）

#### 迁移前的 wiki-link 语义（现状基线）

本次迁移的 B 部分重命名 `understanding_connections`，因此先明确这条表**迁移前**承载的语义：

- **机制**：Understanding 正文中的 `[[u:<id>]]` 在写入 / 更新时由 `wiki-links.ts` 自动解析，落成 `understanding_connections` 行（`source_id` → `target_id`，无方向、无类型、无标签、无时间戳）。
- **语义定性（C16）**：这是**弱引用**（"A 的正文提到了 B"），属于**事实层**（文本状态，机器可判），不是结构信念——不承诺"A 与 B 在用户心智中什么关系"。
- **产品可见面**：理解列表行徽标「N 个双链关系」（`connectionCount`）；理解详情的 relations（wiki-link 邻域）。
- **Agent 面**：`understanding_get` 的 includeRelations（wiki-link relations）、`graph` tool（wiki-link graph，本版删除）。
- **问题**：表名 / 字段 / 工具命名（connection / relation / graph）把弱引用暗示成结构关系——这正是 TBD-3 修正的对象。

#### 迁移内容（两部分）

**A. 新增三张画布表**（本模块）：

- `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS`（SQL 列名用 snake_case，与 drizzle schema 列定义一致）；幂等，与 v1.0.0 建表风格一致。

**B. TBD-3 表名迁移（wiki-link 降级，understanding domain）**：

- `ALTER TABLE understanding_connections RENAME TO understanding_mentions;`（SQLite 支持，索引随表保留）——同一迁移内完成，避免两次数据版本升级。
- 同步：schema.ts 的 `understandingConnections` → `understandingMentions`（understanding domain），全部代码引用改名（`UnderstandingConnection` → `UnderstandingMention`；`connectionCount` / `connectionIds` → `mentionCount` / `mentionIds`；`UnderstandingRelation` 改为引用（mention）语义）。
- 产品可见同步：UI 文案「N 个双链关系」→「N 条引用」。

**注册**：`migration.ts` 的 `codeMigrations` 数组追加 `v200`（版本排序自动处理，大于最新已执行版本即生效）。

- **无检索索引影响**：本模块内容不进全文检索（不调用 `requestRetrievalIndexRebuild`）；表名重命名不影响 FTS（FTS 只关联 understandings / contexts）。
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

**写路径为文档级（前端是交互 / 语义权威，服务端只做机械 diff 持久化）**——画布编辑器（X6）知道手势之后的完整文档状态，前端发目标文档，服务端按 id 对账落行；级联删组、解组、多选删等联动逻辑全部在前端文档模型中天然发生，服务端不感知手势语义（社区标准：tldraw / Excalidraw 均为整文档持久化）。

| 方法                                           | 输入             | 返回                      | 说明                                                                                             |
| ---------------------------------------------- | ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `listCanvases()`                               | —                | `CanvasDTO[]`             | 画布列表，按 updatedAt 倒序                                                                      |
| `listCanvasesByUnderstanding(understandingId)` | `string`         | `CanvasDTO[]`             | 反向查询：该理解出现在哪些画布（M6-6 画布归属）                                                  |
| `getCanvas(id)`                                | `string`         | `CanvasDetailDTO \| null` | 详情：canvas + elements + edges + understandingRefs + referencedCanvases                         |
| `createCanvas(input)`                          | `{ title }`      | `CanvasDTO`               | 新建画布                                                                                         |
| `updateCanvas(id, input)`                      | `{ title? }`     | `CanvasDTO`               | 改名（元数据，不参与文档 diff）                                                                  |
| `deleteCanvas(id)`                             | `string`         | `void`                    | 硬删除（级联）                                                                                   |
| `updateViewport(id, viewport)`                 | `{ x, y, zoom }` | `void`                    | 视口持久化（元数据）                                                                             |
| `saveCanvas(canvasId, document)`               | `CanvasDocument` | `void`                    | **文档级写（唯一的内容写接口）**：事务原子，按 id 对账（存在 upsert / 缺失删除）；不感知手势语义 |

> **已移除的 per-gesture 接口**：createElement / updateElement / deleteElement / createEdge / updateEdge / deleteEdge —— 这些不再是外部 API；前端文档模型的每次变更（含撤销 / 重做 / Agent 提案应用）统一经 `saveCanvas` 落库。

### 2.3 DTO 定义

```ts
CanvasDTO            { id, title, description, viewport, createdAt, updatedAt }
CanvasElementDTO     // 判别联合（见 §1.1 ElementProps）：kind 收窄 props / understandingId / canvasRefId
CanvasEdgeDTO        { id, canvasId, sourceElementId, targetElementId, label, style: EdgeStyle | null, createdAt }
EdgeStyle           { routing?, lineStyle?, color?, width?, arrowhead? }
CanvasUnderstandingRef  { id, title, body, deleted }
CanvasReferencedCanvas  { id, title, deleted }
CanvasDetailDTO      { canvas: CanvasDTO, elements: CanvasElementDTO[],
                       edges: CanvasEdgeDTO[], understandingRefs: CanvasUnderstandingRef[],
                       referencedCanvases: CanvasReferencedCanvas[] }
```

**决策记录：不设 `CanvasSummaryDTO`（无 elementCount / edgeCount）**

- **触发**：初版设计了 `CanvasSummaryDTO = CanvasDTO & { elementCount, edgeCount }`，用户质疑「我要 node 和 edge count 有啥用」。
- **推理**：① PRD 画布列表（M1）只要求标题 + 更新时间排序，无计数展示；② 计数是「数量」——value-proposition 明确 Never「用输入量/打卡/收藏量作为核心激励」「把知识边界做成抽象分数或仪表盘」，展示计数是把价值导向数量统计，画布的价值在结构（为什么/怎么连）不在数字；③ 计数可推导（Agent 需要时 read_canvas 即得）。
- **结论**：砍掉计数后 `CanvasSummaryDTO` 与 `CanvasDTO` 完全同构，**合并为 `CanvasDTO` 一个类型**；`listCanvases()` / `listCanvasesByUnderstanding` / `list_canvas` 均返回 `CanvasDTO[]`，CLI 列表输出去计数。

**写接口载荷（CanvasDocument——`saveCanvas` 的唯一参数，与读出的 `CanvasDetailDTO` 内容同构）**：

```ts
type CanvasDocument = {
  elements: CanvasElementDTO[]; // 判别联合；含 id / kind / props / parentId / x / y / w / h / zIndex
  edges: CanvasEdgeDTO[]; // 含 id / sourceElementId / targetElementId / label / style
};
// 对账语义：按 id——文档中存在的行 upsert；DB 中缺失于文档的行删除；级联删组、解组、多选删等
// 联动已在前端文档模型中体现（目标文档即结果态），服务端只做机械对齐。
```

### 2.4 校验与错误边界（domain core 层）

文档级写路径下，**服务端只做机械校验，不做手势语义校验**（级联删组 / 解组 / 多选删等联动由前端文档模型保证，服务端按目标文档对账）：

| 场景                    | 行为                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 画布不存在              | 抛错（`Canvas not found: <id>`），IPC 包装为错误返回                                                                |
| `saveCanvas` 事务原子性 | 对账（upsert / 删除）在同一事务内完成，失败整体回滚，不产生半状态                                                   |
| 元素 id 唯一性          | 文档内元素 / 连线 id 冲突抛错；与 DB 既有 id 冲突按 upsert 处理（同 id = 同一实体）                                 |
| kind 不变量             | `understanding` 必须带 `understanding_id`；`shape` 的 props 必须带 `shapeType`；`canvas_ref` 必须带 `canvas_ref_id` |
| 连线端点                | 两端元素必须存在于同一文档且属于该画布；禁止自环（source === target）                                               |
| 入组（parent_id）       | 父元素必须是 `group` kind、同一文档、不能是自己或自己的后代（防环）                                                 |
| 理解卡引用              | 校验理解存在（允许引用软删理解——**允许**，占位语义由前端呈现）                                                      |
| 空文档                  | 允许保存空文档（清空画布）——合法操作，不视为错误                                                                    |

### 2.5 决策记录：写路径为何采用「文档级」（saveCanvas）

> 记录完整决策过程，供后续维护者追溯；不只看结论，要看为什么。

#### 触发：接口是 N² 问题（用户洞察）

设计 renderer 写接口时，最初的方案是 **per-gesture 接口**（createElement / updateElement / deleteElement / createEdge / updateEdge / deleteEdge，外加 ungroup 等）。在讨论具体场景时暴露了根本问题：

- **多选删除**：含组的选区怎么删？
- **删除组（级联）与解组**：两个操作，接口怎么表达级联？

用户提出关键质疑：「画布这种操作是可以穷尽的吗？而且还会有联动的逻辑，我觉得通过定义接口是不是一个 N 次方问题？」——**每类手势一个接口 + 每个接口的联动规则（删卡连带线、删组连带成员、入组连带相对坐标、多选与组的交互…），接口数 × 联动规则数是指数级的**；而且更糟的是，联动逻辑被迫在服务端重复实现一遍前端已经做过的判断。

#### 候选方案

| 方案                                    | 做法                                                                                        | 问题                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A. per-gesture 接口（原设计）           | 每个手势一个 IPC，服务端实现联动语义（级联删、解组…）                                       | 接口与联动规则组合爆炸；服务端重复前端逻辑                |
| B. 语义操作列表（operations[]）         | 写接口传一个操作列表（createGroup(members)、deleteGroup(id, {cascade})…），一个操作一个意图 | 比 A 收敛，但仍需枚举操作集合，且语义仍有一半要服务端理解 |
| C. **文档级写（saveCanvas(document)）** | 前端发**目标文档**（手势之后的状态），服务端按 id 机械对账落行，不感知任何手势语义          | 采纳；代价见下                                            |

#### 社区证据（2026-08 调研）

- **tldraw**：响应式 store 为中央模型，持久化是**整文档快照**（IndexedDB / 自定义后端）；增量 delta 只服务内部 undo/redo / 同步。
- **Excalidraw**：Scene 为权威，持久化是**整文档 JSON 序列化**；delta 仅内部 undo/redo。
- **Figma / Miro**：operation-based + CRDT / LWW —— 但那是**多人实时同步**场景（冲突合并），**单用户本地画布不需要**。
- 结论：**单用户画布编辑器的社区标准 = 编辑器模型为权威 → 整文档持久化**；没有任何产品把「删组级联」「打组」做成服务端 API。

#### 推理：为什么文档级是对的

1. **前端本来就是交互 / 语义权威**：X6 知道手势之后的完整状态（删了组，文档里组和成员已没了；打了组，parentId 已连上）——联动逻辑在前端文档模型中**天然发生**，无需也不应复制到服务端。
2. **接口收敛到 O(1)**：一个 `saveCanvas(document)` 覆盖全部内容写；读接口与元数据小接口（改名 / 视口）保持独立，不参与爆炸。
3. **renderer 与 Agent 写路径统一**：Agent 提案本质也是「目标文档」（C15 的 CanvasDocument）——apply = 同一个 saveCanvas，之前卡的 `update_canvas` 参数问题顺带消解（§6.2）。
4. **撤销 / 重做天然跟随**：X6 history 在会话内处理，每次状态变更 → 防抖 saveCanvas。

#### 权衡与代价（诚实记录）

| 代价                             | 评估                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 服务端校验变薄（不校验手势语义） | 单用户本地应用，前端可信——可接受                                                                                                   |
| 整文档写入量                     | 画布 5-50 卡 = 几 KB，防抖后微不足道——**修订了 C5 的「增量写回」表述**（写路径从 per-op 变文档级；schema / 关系表不变，diff 落行） |
| 对账（diff）正确性               | 按 id 机械对齐（存在 upsert / 缺失删除），确定性强；`saveCanvas` 单事务保证原子性                                                  |

#### 决策

- **renderer 写接口 = `saveCanvas(canvasId, document)`（文档级、事务原子）** + 元数据接口（改名 / 视口）+ 读接口。
- **移除** per-gesture 接口（createElement / updateElement / deleteElement / createEdge / updateEdge / deleteEdge / ungroup）。
- **删除组（级联）与解组**在前端文档模型中表达（目标文档即结果态），服务端只做机械对账。

---

## 3. 给 Agent 开放的能力与 tool 设计

> 工具集已定（见共识 C9/TBD-1 与 PRD 模块八）；`update_canvas` 参数与 preview tool 数据契约已定（见 §6.2）。

### 3.1 能力定位

Agent 对理解画布：**读 + 写（内容级、审批制）+ 展示**：

- **用户是大脑**：画布的结构、连线、分组由用户认可后落地——**写操作全部经用户审批**（Agent 画，用户验收；验收界面 = C15 展示 tool）。
- **Agent 不做布局**：写操作不携带坐标，位置由前端自动排开。
- Agent 的价值：读懂用户的心智结构（读），结合线头提出结构提案（写，审批制），在对话中引用画布（`[[cv:]]`）。
- **引用**（C8）：Agent 回答可引用画布 `[[cv:<id>]]`（与其他实体同一引用体系）；点击不跳路由，打开只读 Modal 展示画布元素。

### 3.2 Tool 设计（已定工具集）

读工具挂载于 `pi-readonly-tools.ts`；写工具走现有审批机制（requireApproval，Agent 提案 → 用户审批 → 应用）。语言风格沿用现有工具（英文 description + 中文 label）；输出经既有 `createToolResult` 包装（诊断日志 / 实体目录统一处理）。

| Tool             | 参数                                                                         | 返回                                                                             | 用途                                                          |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `canvas_read`    | `{ canvasId, includeBodies? }`                                               | `CanvasDetailDTO`（结构骨架：元素 / 连线 / 分组 / 引用理解标题；正文默认不返回） | 读一张画布结构（讨论 / 审视 / 修改的输入）                    |
| `canvas_list`    | `{ titleSearchKeyword?, limit? }`                                            | `CanvasDTO[]`                                                                    | 简单枚举（review all 场景 = list + 逐个 read）                |
| `canvas_search`  | `{ query?, understandingId?, limit? }`                                       | `CanvasHit[]`（画布 + 命中片段 snippet + reason）                                | 发现定位；query 语义见下                                      |
| `canvas_create`  | `{ title, initial? }`                                                        | `CanvasDTO`                                                                      | 新建画布（审批制）                                            |
| `canvas_update`  | `{ canvasId, document: CanvasDocument }`（**目标文档，与 saveCanvas 同构**） | 变更提案（C15 展示）                                                             | 内容级写：增元素 / 连线 / 分组 / 改内容（审批制）             |
| `canvas_delete`  | `{ canvasId }`                                                               | `void`                                                                           | 删除画布（审批制）                                            |
| 展示 tool（C15） | 结构化画布数据（CanvasDocument 形状）                                        | 只读渲染预览（**数据契约已定，见 §6.2**）                                        | draft-preview：消息内联渲染，用户诊断后「应用 / 修改 / 拒绝」 |

> 命名遵循工具家族惯例 `entity_verb`（domain_list / understanding_get / context_create…），统一为 `canvas_*`；此前草案的 verb_entity（read_canvas 等）已弃用。

**search 的 query 语义（已定稿）**：

- `query`：自由文本 1-5 词；匹配范围 = 画布标题 + 元素标题 + 文本卡内容 + 连线标签 + 组名 + 引用理解标题（引用理解正文后置）；大小写不敏感、空白拆词、任一命中即命中（OR，发现导向）。
- `understandingId`：单个 string（反向查询：哪些画布引用了该理解）；多理解 AND/OR 后置（升级路径 `understandingIds[] + match`）。
- 返回 `CanvasHit[]`：画布 + 命中片段（snippet + reason），便于 Agent 判断相关性。

### 3.3 展示与引用（C15 / C8）

- **展示 tool（C15）**：Agent 输出结构化画布数据 → 前端只读渲染（mermaid 式"输出即渲染、纯展示、不写入"）；一个渲染组件三用：`[[cv:]]` 引用 Modal / sketch 提案预览 / 对话内 draft 预览。
- **引用（C8）**：`AgentContextRef` 增加 `canvas` 态；`[[cv:<id>]]` 进 citations / entity catalog；点击 → 只读 Modal（不跳路由）。

### 3.4 审批机制

- 写工具（create / update / delete_canvas）走现有审批链路（与 `pi-write-tools.ts` 的 understanding/context/domain 写工具同构）：Agent 产出候选变更（含 C15 预览数据）→ 用户审批 → 应用。
- **审批应用与 draft 持久化（已定）**：审批通过后，前端将 draft（即目标文档）经 `saveCanvas` 落库（文档级写，与 renderer 同一接口）；**draft 本身不持久化**——它活在对话内（C15 块），apply = 全量写入，无需单独的 draft 存储。

### 3.5 成果可见性（C14，归口说明）

- artifact panel 聚合"本对话已落地的产出"（approve 并保存的 understanding / 新建 context / 应用后的 canvas）——**属于 Agent / 会话层（审批结果 + 实体目录），不是 canvas domain 的新 API**；canvas domain 无需为此新增接口，前端从会话审批结果聚合即可。UX/UI 归口 UI/UX 文档。

### 3.6 prompt 设计（careful design，逐节）

> 原则（用户定）：system-prompt 尽量简洁、precisely-structured，不塞无关或抒情逻辑；工具 description 重新设计；本节逐节定稿，不一句话带过。

#### 3.6.1 知识模型（已定稿）

在现有 `## 知识模型` 节新增两条（保持既有条目风格，不展开哲学）：

```markdown
- Canvas：用户显式搭建的心智结构。卡片引用 Understanding 或承载文本 / 图形 / 组；连线为有向、带标签的结构关系。
- Understanding 正文中的 `[[u:]]` 是弱引用（提到过），不是结构关系；心智结构以 Canvas 连线为准。
```

- 第一条：Canvas 是什么（一句，结构化定义）。
- 第二条：引用 vs 结构的精确区分（C16 落地）——正向行为指导收在"以 Canvas 连线为准"。
- 设计过程：早期草案含"信念层 / 事实层"等哲学表达，被否（抒情、不精确）；收敛为两条条目。

#### 3.6.2 实体引用（已定稿）

在现有「实体引用」节的引用类型列表**同句并列**追加 Canvas：

```markdown
- Reflecta 统一使用 `[[<type>:<id>]]`：Understanding 为 `[[u:<id>]]`，Context 为 `[[c:<id>]]`，Domain 为 `[[d:<id>]]`，Canvas 为 `[[cv:<id>]]`。
```

- 选择同句并列（而非独立一句）：实体引用是机械规则，Canvas 不需要特殊待遇；知识模型层（3.6.1）已用独立条目解释结构语义，这里只需登记格式。
- 现有引用规则（只放稳定 id、不写标题别名、实体 id 参数只传裸 id）对 `[[cv:]]` 同样适用，无需改动。

#### 3.6.3 写入边界（已定稿）

在现有「写入边界」节追加两条（保持既有条目风格）：

```markdown
- 画布结构变更以 draft 提案呈现，等待用户应用 / 修改 / 拒绝；不要直接写入画布。
- 画布提案中不写坐标，位置由用户或自动布局决定。
```

- 不重复知识模型已有的"结构以画布连线为准"（知识模型管"是什么"，写入边界只管"怎么提交"）。
- 不点名展示工具（prompt 不绑死工具名，工具 description 自有）。

#### 3.6.4 工具 description（已定稿）

现有关系相关描述重写（弱引用语义）：

```ts
// domain_inspect
"Inspect a Reflecta domain by stable id and optionally include its Understandings, Contexts, and wiki-link mentions (weak citations, not structural relations).";

// understanding_get
"Get a Reflecta Understanding by stable id. Use includeContexts for its Context and includeRelations for its wiki-link mentions (weak citations, not structural relations).";
```

- "wiki-link relations" → "wiki-link mentions"（弱引用语义）；括注 "weak citations, not structural relations" 是**工具级必要提示**——工具返回的数据语义，Agent 必须知道这不是结构关系。
- 参数改名（`includeRelations`）属 TBD-3 实施项，见 §6.1，不在本节。

---

## 4. CLI 接口

### 4.1 命令清单（`reflecta canvas <action>`，与 Agent `canvas_*` 工具契约一致）

| 命令                                                                     | 说明                                                                     | mutates            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------ |
| `reflecta canvas list [--title-keyword <kw>] [--limit <n>]`              | 列出画布（标题过滤 / 更新时间排序）                                      | 否                 |
| `reflecta canvas get <canvas-id> [--with-bodies]`                        | 画布详情（默认骨架：元素 / 连线 / 引用理解标题；`--with-bodies` 带正文） | 否                 |
| `reflecta canvas search [query] [--understanding-id <id>] [--limit <n>]` | 发现定位（query OR 拆词 / 反向查询），返回 `CanvasHit[]`                 | 否                 |
| `reflecta canvas create <title>`                                         | 新建画布                                                                 | 是（`--yes` 确认） |
| `reflecta canvas update <canvas-id> --title <t> \| --document <json>`    | 改名 / 整文档写（saveCanvas 对账）                                       | 是                 |
| `reflecta canvas delete <canvas-id>`                                     | 删除画布（级联）                                                         | 是                 |

### 4.2 注册链路（沿用既有模式）

```text
apps/cli/src/services.ts                    # ReflectaCliServices 加 canvases: UnderstandingCanvasCliBff
apps/cli/src/actions/canvas/list.ts | get.ts | create.ts | update.ts | delete.ts
    # 每个 action：registerActionMeta(resource, action, {...}) + cli.command(...).action(...)
apps/cli/src/cli.ts                         # registerXxxAction 注册；getActionMeta 自动出帮助
```

### 4.3 输出约定

- 列表输出：表格（id 截断 / title / updatedAt）。
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
  3. Agent tool：**删除 `graph` tool**；`understanding_get` / `domain_inspect` 描述中 "wiki-link relations" / "relations" 改为 "wiki-link mentions / citations（弱引用，非结构）"；参数名 `includeRelations` → `includeMentions`（随降级一并改名）。
  4. CLI：`reflecta graph` 命令与 `GraphCliBff` domain 一并删除。
- **TBD-2**：understanding detail DTO（agent 侧 `understanding_get` 与 UI 共用）加 `referencedByCanvases: Array<{ id, title }>`——查询 `canvas_elements.understanding_id` 索引反向 join 画布标题。
- **C13**：`listCanvasesByUnderstanding(understandingId)` IPC 方法（反向查询，与 M6-6 共用数据）。

### 6.2 未定待解决（本文档步骤内定）

- **`update_canvas` 参数（已定：A 整目标文档）**：`{ canvasId, document: CanvasDocument }`——与 renderer 的 `saveCanvas` 同构；C15 的 draft 本就是目标结构（提案=展示=应用同一形状，零转换）；画布小（5-50 卡），Agent 小改动重发全量的 token 代价被接受；增量方案（没提到=不变 vs 删除）有歧义、语义操作重新引入 N²，均否决。
- **search 后置项**：
  - `query` 是否匹配引用理解正文（先只匹配标题，正文命中为增强，需评估 join 成本）；
  - 多词 AND 模式（`understandingIds[] + match: "all" | "any"` 升级路径，先单 id）。
- **preview tool 数据契约（C15，已定稿——Inline Widget 形态）**：
  - **渲染形态**：消息内联 **widget**（Generative UI 模式）——工具结果 / 消息 part 携带 `widgetType` + 结构化 payload，聊天渲染器按 widget 注册表路由到自定义 React 渲染器；**不是代码块转渲染**（mermaid 式已否决）。
  - **widgetType**：`canvas-draft`（画布草稿预览，只读画布卡，三用组件之一）。
  - **payload**：CanvasDocument（elements 判别联合 + edges）——与 `saveCanvas` 载荷同一形状（提案 = 展示 = 应用同构，零转换）。
  - **widget 注册表**：`{ widgetType → React 渲染器 }`，是聊天渲染基建（不仅画布，天气卡等任何工具可用）；归属 UI/UX 与 Frontend 文档。
  - **校验失败降级**：payload 解析 / 校验失败 → 回退为通用工具活动块，不阻塞消息。
