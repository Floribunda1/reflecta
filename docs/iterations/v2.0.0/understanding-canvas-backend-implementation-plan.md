# 理解画布 · 后端实现 Plan

> 日期：2026-08-15
>
> 状态：待用户确认后实施
>
> 范围：**后端逻辑**（`packages/server` + Electron main 的 agent 服务 + CLI）。前端（renderer / E2E UI 断言）归口 Frontend plan，不在此列；但作为回归门禁纳入验收。
>
> 依据：`understanding-canvas-server-design.md`（§1-§5 设计、§6.1 实施清单）、`understanding-canvas-consensus.md`（TBD-3 / TBD-2 / C13 / C15）。
>
> 测试设施（现状）：
>
> - `packages/server`：vitest（`bun run test`），typecheck `tsgo --noEmit`，lint `oxlint`
> - Electron main：vitest（`bun run test:main`，`pi-readonly-tools.test.ts` 模式）
> - E2E：playwright + feature 文件（`bun run test:e2e:acceptance`，capture 套件）
> - 迁移集成：`db/migration.test.ts`（空库 / 已有数据幂等）

---

## 依赖图与原则

```
Phase 0 (TBD-3 降级) ──┬──> Phase 1 (Canvas 域) ──> Phase 2 (Agent 工具) ──> Phase 3 (TBD-2 + 回归)
                       └─────────────> Phase 2 的描述重写依赖 Phase 0 的措辞
```

- **严格顺序执行**：Phase 0 先行保证新代码不落在旧命名（connection/relation/graph）上；Phase 1 表结构不依赖 connection 改名（elements FK 直指 `understandings`），但命名卫生要求先降级。
- **每 phase 独立可合并、可验证**：phase 结束时测试全绿 + commit（Angular 约定）。
- **测试与实现同 phase 推进**：核心算法（对账、校验、search 语义）先写单测再实现（TDD 节奏），迁移与注册类测试随实现同步补。

---

## Phase 0：TBD-3 wiki-link 降级（理解域重构 + graph 移除）

> 目标：弱引用与结构关系彻底分离的命名基线；删除 wiki-link graph 全部后端痕迹。

### 任务清单

1. **迁移 v2.0.0（表改名）**：`understanding_connections` → `understanding_mentions`，数据原样迁移（建新表 + 复制 + 删旧表），幂等（`IF NOT EXISTS` 语义对齐 `_migrations` 机制）。
2. **类型改名**（`domains/understanding/types.ts`）：
   - `UnderstandingConnection` → `UnderstandingMention`
   - `UnderstandingSummaryDTO.connectionCount / connectionIds` → `mentionCount / mentionIds`
   - `UnderstandingRelation` → 引用语义字段（字段名去除关系暗示，如 `source/target` 语义保留但命名对齐 mention）
   - `GetUnderstandingOptions.includeRelations` → `includeMentions`
3. **core.ts 同步**：`getUnderstandingConnectionCounts` 改名 + 查询表同步；`UnderstandingCore` 内 relations 查询同步。
4. **删除 graph 后端**：`domains/graph/` 整目录、`GraphCliBff`（`services/core.ts` 的 `graphCliService`）、`understanding CLI` 中 graph 子命令、`pi-readonly-tools.ts` 的 `graph` tool。
5. **工具描述重写**：`domain_inspect` / `understanding_get` 描述中 "wiki-link relations" / "relations" → "wiki-link mentions (weak citations, **not structural relations**)"——工具级必要提示。
6. **CLI 措辞**：`UnderstandingCliBff` 输出字段与帮助文案对齐 mention 语义。

### 测试

| 层            | 测试文件（新建/修改）                 | 关键用例                                                                                        |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 迁移集成      | `db/migration.test.ts`                | v2.0.0 空库幂等；已有数据改名后完整保留（行数、内容、FK 完好）；重复执行幂等                    |
| unit          | `domains/understanding/types.test.ts` | 编译级改名断言（DTO 字段名）；`includeMentions` 参数名                                          |
| unit          | `domains/understanding/core.test.ts`  | counts 查询改名后语义不变（reference/referencedBy 计数）                                        |
| electron-main | `pi-readonly-tools.test.ts`           | graph tool 不存在；domain_inspect / understanding_get 描述含 "mentions" 且不含 "relations" 误导 |
| electron-main | `services/core.test.ts`               | `graphCliService` 已移除                                                                        |

### 验收

- `bun run test`（server）全绿；`bun run test:main` 全绿；`tsgo --noEmit` 无类型错误。
- grep 确认：代码库无 `understanding_connections` / `UnderstandingConnection` / `graphCli` / `"graph"` tool 残留（迁移历史 SQL 除外）。

---

## Phase 1：Canvas 域核心（表 + 文档级读写）

> 目标：画布后端本体——三表 schema、CanvasDocument 类型、文档级 saveCanvas 对账、查询与删除、C13 反向查询。

### 任务清单

1. **schema**（`db/schema.ts` + 迁移 v2.0.0 追加）：
   - `understanding_canvases`（id / title / created_at / updated_at）
   - `understanding_canvas_elements`（id / canvas_id FK / kind / x,y,width,height,z_index / locked / parent_id（组内引用，set null）/ understanding_id FK（set null）/ canvas_ref_id FK（set null）/ props JSON / created_at,updated_at）
   - `understanding_canvas_edges`（id / canvas_id FK / source_element_id / target_element_id / label / style JSON / created_at,updated_at）
   - 索引：`elements(canvas_id)`、`elements(understanding_id)`（C13 反向查询）、`canvases(updated_at)`（列表排序）
2. **类型**（`domains/canvas/types.ts`）：`CanvasDocument`（elements 判别联合 + edges）、`CanvasElement`（kind 收窄 props：understanding/text/shape/group/canvasRef）、`CanvasEdge`、`EdgeStyle`（五维 + 默认值）、`CanvasDTO`。
3. **CanvasCore**（`domains/canvas/core.ts`）：
   - `createCanvas(title)` / `getCanvas(id)`（元素 + 连线 + understandingRefs 装配）
   - **`saveCanvas(canvasId, document)`——文档级对账**：按 id 机械 diff（insert / update / delete / 不动），不动则跳过；`canvases.updated_at` 联动
   - `deleteCanvas(id)`（硬删 + 级联 elements/edges）
   - `listCanvases()`（updated_at 降序）
   - `listCanvasesByUnderstanding(understandingId)`（C13，elements.understanding_id 反向 join 标题）
4. **校验层**（`domains/canvas/validate.ts`）：kind 专属 props 校验（判别联合收窄）；连线同画布 + 禁自环；入组防环（parent 链无环）；`understanding_id` / `canvas_ref_id` FK 存在性校验；被删理解 → 占位标记（server 读侧把 deleted 理解的元素标 `deleted: true` 占位）。
5. **BFF**：`bff-electron.ts`（renderer IPC 装配，getCanvas DTO + referencedCanvases）+ `bff-cli.ts`（CLI 复用同一 CanvasCore）。
6. **IPC**（Electron main）：`canvas:create` / `canvas:get` / `canvas:save` / `canvas:delete` / `canvas:list` / `canvas:listByUnderstanding` 通道注册 + 参数校验。
7. **CLI**：`canvas list / get / create / update / delete` 子命令注册与帮助输出（对齐既有 CLI 模式）。

### 测试

| 层           | 测试文件                                        | 关键用例                                                                                                                       |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| unit（核心） | `domains/canvas/validate.test.ts`               | 校验矩阵：每 kind 合法/非法 props；连线跨画布拒绝；自环拒绝；入组环拒绝；FK 不存在拒绝                                         |
| unit（核心） | `domains/canvas/reconcile.test.ts`              | **对账算法**：新增元素 / 更新元素 / 删除元素 / 未变元素跳过 / 边同样对账 / 空文档清空 / 幂等（两次 save 同文档第二次零写）     |
| unit         | `domains/canvas/search.test.ts`                 | search 语义（若 Phase 1 含 search 基础版）：OR 拆词、字段覆盖（标题/元素标题/文本卡/连线标签/组名/引用理解标题）、大小写不敏感 |
| bff 装配     | `domains/canvas/bff-electron.test.ts`           | getCanvas 装配：元素 + 连线 + understandingRefs + referencedCanvases；列表 updated_at 排序                                     |
| 集成         | `domains/canvas/integration.test.ts`（db 直连） | roundtrip：create → save → get 一致；级联删除（删画布清元素/边）；删理解 → 占位标记；updated_at 随子变更联动                   |
| 迁移         | `db/migration.test.ts`                          | 三表幂等创建；索引存在性                                                                                                       |
| CLI          | CLI 注册测试                                    | `canvas` 子命令注册与帮助输出                                                                                                  |

### 验收

- 对账算法单测覆盖 diff 全分支（含幂等零写断言）。
- `listCanvasesByUnderstanding` 返回 `[{ id, title }]`，被删画布不出现。
- server / main 测试全绿。

---

## Phase 2：Agent canvas 工具 + prompt

> 目标：Agent 侧能力——只读三件套 + 审批制写工具 + prompt 知识模型更新。

### 任务清单

1. **只读工具**（`pi-readonly-tools.ts`）：
   - `canvas_list`（画布清单）
   - `canvas_read`（单画布骨架：元素/连线/分组/标签 + 引用理解标题，默认不带正文——token 预算约束）
   - `canvas_search`（`{ query?, understandingId?, limit? }`：query 拆词 OR 发现导向；understandingId 单值反向）
2. **写工具**（`pi-write-tools.ts`，走现有 `requireApproval` 审批链）：
   - `canvas_create(title)` / `canvas_update({ canvasId, document })`（整目标文档，方案 A）/ `canvas_delete(canvasId)`
3. **描述与 prompt**（`agent-system-prompt.md` + 工具描述）：
   - 知识模型加 Canvas 两条（画布 = 结构网 vs wiki-link = 引用网）
   - `[[cv:<id>]]` 引用语法（同句并列规则）
   - 写入边界两条：draft 提案不直接写入（先展示后审批）；不写坐标（布局由用户/前端定）
   - 画布写工具描述明确"wiki-link mentions (weak citations, not structural relations)"口径
4. **接线**：工具注册进 agent 工具清单；`pi-readonly-tools.test.ts` / write-tools 测试 stub 同步。

### 测试

| 层            | 测试文件                                        | 关键用例                                                                                     |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| electron-main | `pi-readonly-tools.test.ts`                     | 三只读工具注册、参数 schema（TypeBox）、`canvas_read` 默认不含正文、`canvas_search` 参数契约 |
| electron-main | write-tools 测试                                | 三写工具注册、`requireApproval` 接线、`canvas_update` 整文档参数                             |
| electron-main | system-prompt 测试                              | prompt 含 Canvas 知识模型条目、`[[cv:]]` 语法、写入边界两条                                  |
| unit          | `domains/canvas/search.test.ts`（Agent 侧语义） | query OR、understandingId 反向、limit 边界                                                   |

### 验收

- 工具清单与 Server 文档 §3 一致（六工具 + 描述口径）。
- 写工具全部走审批；审批流不落库前画布零变更。
- prompt 断言测试覆盖新增内容。

---

## Phase 3：TBD-2 + 全量回归

> 目标：理解侧可见性（referencedByCanvases）+ 后端全量回归门禁。

### 任务清单

1. **TBD-2**：understanding detail DTO（`understanding_get` 与 UI 共用）加 `referencedByCanvases: Array<{ id, title }>`——`canvas_elements.understanding_id` 索引反向 join 画布标题；`UnderstandingElectronBff` / `UnderstandingCliBff` 装配同步。
2. **understanding_get 描述更新**：告知 Agent 可查画布引用（理解出现在哪些画布）。
3. **回归门禁**：
   - `packages/server`：`bun run test` + `tsgo --noEmit` + `oxlint`
   - Electron main：`bun run test:main`
   - E2E：`bun run test:e2e:acceptance`（capture 套件必须全绿——证明 wiki-link 降级无 UI 行为破坏）
4. **§6.1 验收清单逐项勾核**（TBD-3 六项 / TBD-2 / C13），更新共识文档状态。

### 验收

- 全部测试通道绿；E2E capture 套件零回归。
- `referencedByCanvases` 在 `understanding_get` 与 UI 侧 DTO 均可用。
- §6.1 全项完成，文档状态更新。

---

## 边界与不在本 plan 范围

| 项                                                              | 归口                                          |
| --------------------------------------------------------------- | --------------------------------------------- |
| canvas 渲染器 / widget 注册表 / 只读画布组件                    | Frontend plan（F1-F3）                        |
| 理解详情 UI「出现于 N 张画布」、wiki-link UI 文案（TBD-3 项 5） | Frontend plan                                 |
| E2E 新 feature（画布交互）                                      | M4 验收阶段（PRD 模块八），需 UI 落地后       |
| draft 持久化 / artifact panel                                   | UI/UX 已定不持久化；panel 归 UI/UX + Frontend |

## 风险与备注

- **Phase 0 是现有生产域的 breaking change**：迁移必须在空库与已有数据两条路径都测；发布节奏遵循 release-process。
- **对账算法是全局最核心算法**：`reconcile.test.ts` 的幂等断言（二次 save 零写）是对账正确性的关键信号。
- **`canvas_search` 的"引用理解正文匹配"与多词 AND 已后置**：升级路径 `understandingIds[] + match` 已记录，本 plan 只做基础版（query OR + 单 understandingId）。
