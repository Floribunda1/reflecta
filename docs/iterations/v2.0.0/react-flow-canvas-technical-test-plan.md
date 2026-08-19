# React Flow Canvas 技术测试计划

> 日期：2026-08-19
>
> 被测基线：`react-flow-current-canvas-integration.md`
>
> 性质：Canvas / React Flow integration 的技术保护网；不属于产品 Feature Acceptance，不使用 `CV-*` ID

## 1. 覆盖目标

测试全集是集成清单中“已经集成”和“修改默认行为”的全部原子能力。“还没有集成”的能力不生成测试，但必须登记为 `excluded`。

每项能力必须且只能指定一个 primary evidence：

```text
integrated capability
  → 一个技术 capability ID
  → 一个且仅一个主测试域
  → 一个 primary evidence 或明确 disposition
```

Disposition 只有四种：

- `covered`：由当前自动化测试直接证明。
- `delegated`：行为属于固定版本 React Flow，只通过 Reflecta seam smoke test 证明没有被 adapter 破坏。
- `deferred`：已经集成，但只有达到明确触发条件才值得测试，例如大规模性能基准。
- `excluded`：尚未集成，不属于当前测试全集。

## 2. MECE 测试域

按照能力最先进入的 Reflecta 自有 seam 分类，六个域互斥且合起来覆盖当前集成：

| 域          | 唯一职责                                              | 主要层级                             |
| ----------- | ----------------------------------------------------- | ------------------------------------ |
| `DOC`       | CanvasDocument 与 React Flow nodes / edges 的静态互转 | Vitest                               |
| `BRIDGE`    | React Flow change 如何更新受控状态并发出 callback     | Vitest + 一条 DOM smoke              |
| `ROUTE`     | 真实浏览器输入被路由成哪一种画布操作                  | Electron regression E2E              |
| `RENDER`    | 自定义节点、边和反馈状态                              | Vitest DOM / Electron regression E2E |
| `COMMAND`   | 打组、解组、级联删除等确定性图变换                    | Vitest                               |
| `WORKSPACE` | 保存、恢复、搜索、面板联动、导出等应用编排            | Vitest + Electron regression E2E     |

同一能力可以有辅助测试，但只能有一个主域，避免重复统计覆盖率。

## 3. `DOC`：数据适配矩阵

主文件：`packages/ui/src/canvas/graph-document.test.ts`

| ID        | 输入空间                                        | 证明内容                            |
| --------- | ----------------------------------------------- | ----------------------------------- |
| CG-DOC-01 | understanding / text / group / canvas_ref       | kind 专属字段和共享字段均正确映射   |
| CG-DOC-02 | x / y / width / height / parentId / zIndex      | 几何与层级字段 round-trip 不丢失    |
| CG-DOC-03 | width 与 measured width 同时存在                | React Flow 实测尺寸优先写回         |
| CG-DOC-04 | 父子元素乱序输入                                | 输出始终 parent 在 child 前         |
| CG-DOC-05 | root / 一层 group / 嵌套 group                  | 相对坐标与 parentId 保持            |
| CG-DOC-06 | edge endpoints / label / id                     | 连线业务字段保持                    |
| CG-DOC-07 | routing / lineStyle / color / width / arrowhead | 每个样式维度独立映射正确            |
| CG-DOC-08 | 平行边 / 自环                                   | round-trip 不去重、不拒绝           |
| CG-DOC-09 | 完整 document                                   | document → flow → document 语义等价 |
| CG-DOC-10 | selected / dragging / measured 等临时字段       | 不写入 CanvasDocument               |

样式维度相互独立，因此逐维覆盖枚举值，不做无意义的笛卡尔积。

## 4. `BRIDGE`：受控状态桥矩阵

主文件：`packages/ui/src/canvas/canvas-graph-bridge.test.ts`

### NodeChange

| change type   | nodes state                        | document callback |
| ------------- | ---------------------------------- | ----------------- |
| position      | 更新                               | 触发              |
| dimensions    | 更新                               | 触发              |
| remove        | 更新                               | 触发              |
| select        | 更新                               | 不触发            |
| add / replace | 明确支持或登记为不会从该 seam 发生 | 不允许未定义      |

### EdgeChange

| change type   | edges state                        | document callback |
| ------------- | ---------------------------------- | ----------------- |
| remove        | 更新                               | 触发              |
| select        | 更新                               | 不触发            |
| add / replace | 明确支持或登记为不会从该 seam 发生 | 不允许未定义      |

### 其他桥接入口

| ID           | 入口                                  | 证明内容                  |
| ------------ | ------------------------------------- | ------------------------- |
| CG-BRIDGE-01 | 普通 onConnect                        | 新增 edge 并回写 document |
| CG-BRIDGE-02 | 同端点再次连接                        | 保留第二条 edge           |
| CG-BRIDGE-03 | source === target                     | 接受自环                  |
| CG-BRIDGE-04 | 不完整 connection                     | 不修改文档                |
| CG-BRIDGE-05 | node / edge / mixed / empty selection | 只发出完整 selection IDs  |
| CG-BRIDGE-06 | viewport change                       | 只发 viewport callback    |
| CG-BRIDGE-07 | readonly 下的写 change                | 不发业务写 callback       |
| CG-BRIDGE-08 | 外部 document / reload                | 替换图状态且不回发保存    |
| CG-BRIDGE-09 | imperative add / update               | 更新图状态并只回写一次    |

## 5. `ROUTE`：输入路由矩阵

主文件：`apps/electron/e2e/regression/canvas/react-flow-input-routing.spec.ts`

| 交互起点         | 输入               | 唯一预期路由                         |
| ---------------- | ------------------ | ------------------------------------ |
| Pane             | 拖动               | 框选，不移动 viewport                |
| Pane             | 滚轮 / 触控板      | 按已登记配置平移或缩放               |
| Node shell       | 点击               | 选择节点                             |
| Node shell       | 拖动               | 移动节点，不产生框选                 |
| Handle           | 拖动               | 创建连线，不移动节点                 |
| Resizer          | 拖动               | 修改尺寸，不移动节点                 |
| Text editor      | 点击 / 输入 / 拖动 | 编辑文本，不触发画布快捷键或节点拖动 |
| Card scroll area | 滚动               | 滚动正文，不操作 viewport            |
| Edge path        | 点击               | 选择 edge                            |
| Edge label       | 双击               | 编辑 label                           |
| MiniMap          | 点击 / 拖动        | 修改 viewport                        |
| External source  | 拖入               | 通过 screenToFlowPosition 创建节点   |

`selectionOnDrag`、`SelectionMode.Partial`、`multiSelectionKeyCode`、`panOnDrag`、`panOnScroll`、`snapToGrid` 都是 Reflecta 明确配置，必须分别在矩阵中有 evidence；不能以“React Flow 已测试”为由跳过。

## 6. `RENDER`：节点与边矩阵

主文件：

- `packages/ui/src/canvas/canvas-nodes.test.tsx`
- `packages/ui/src/canvas/canvas-edges.test.tsx`

四种 node kind 统一参数化验证：内容、左右 Handle、selected、dragging、focus-visible、NodeResizer、readonly。再覆盖各 kind 的专属分支：

- Understanding：正常引用 / 已删除占位。
- Text：提交 / Escape 取消 / 无变化不回写 / readonly。
- Group：改名 / 解组动作 / 删除动作 / readonly。
- Canvas reference：正常跳转 / 已删除不跳转。

Edge 按独立维度覆盖 routing、lineStyle、color、width、arrowhead、selected、label 提交与取消，不组合穷举。

## 7. `COMMAND`：图变换矩阵

主文件：`packages/ui/src/canvas/graph-operations.test.ts`

| ID        | 操作                     | 不变量                               |
| --------- | ------------------------ | ------------------------------------ |
| CG-CMD-01 | 两个根节点打组           | 新组包围 selection，成员绝对位置不变 |
| CG-CMD-02 | selection 含已有组       | 正确创建嵌套组                       |
| CG-CMD-03 | 少于两个元素             | 不创建组                             |
| CG-CMD-04 | 未知 / 重复 ID           | 不重复、不崩溃                       |
| CG-CMD-05 | selection 同含祖先和后代 | 不重复 reparent、不产生 cycle        |
| CG-CMD-06 | 根级组解组               | 成员回到根级，绝对位置不变           |
| CG-CMD-07 | 嵌套组解组               | 成员回到上一级组，绝对位置不变       |
| CG-CMD-08 | 一次解开多个组           | 每个组独立正确转换                   |
| CG-CMD-09 | 删除组                   | 删除组、直接成员及相关边             |
| CG-CMD-10 | 删除嵌套组               | 递归删除全部后代                     |
| CG-CMD-11 | 删除组                   | 组外节点与无关边不变                 |

共用断言是不变量，而不是屏幕像素：

```text
absolutePositionBefore(element) === absolutePositionAfter(element)
```

## 8. `WORKSPACE`：应用编排矩阵

主文件：

- `apps/electron/src/renderer/src/modules/canvas/workspace/canvas-workspace.test.ts`
- `apps/electron/e2e/regression/canvas/canvas-workspace-boundaries.spec.ts`

### 保存状态机

```text
clean → dirty → saving → clean
                  └→ error → retry → clean
```

覆盖首次 dirty、debounce 只保存最新文档、成功清理、失败保留 dirty、重试最新文档、旧请求成功不得清除更新的 dirty、卸载 flush，以及 document / viewport 两套 debounce 相互独立。

### 初始 viewport

| viewportReady | saved viewport | 结果                       |
| ------------- | -------------- | -------------------------- |
| false         | 任意           | 不 setViewport、不 fitView |
| true          | 有             | 恢复保存值                 |
| true          | 无             | fitView                    |

### Selection 路由

穷举 empty、单 Understanding、单 edge、单普通节点、multi-selection，以及 library 已打开六种状态。

### 搜索与导出

- 搜索索引覆盖 text、Understanding 标题与正文、group、canvas reference、edge。
- 结果动作只有 node 定位与 edge 端点定位两条分支。
- PNG 覆盖空画布、非空画布、视口外节点、排除 Background、导出不改变 viewport。
- 图片生成失败在产品定义错误反馈前登记为 `deferred`，不虚构期望。

## 9. 当前集成清单的 disposition

| 集成清单区域                                | Primary domain / disposition                                       |
| ------------------------------------------- | ------------------------------------------------------------------ |
| 基础选择、拖动、缩放、删除                  | `ROUTE`；上游细节 `delegated`，Reflecta seam 由真实 DOM smoke 覆盖 |
| ReactFlowProvider / hooks / apply changes   | `BRIDGE`；不测试函数是否被调用                                     |
| Handle 与连接反馈                           | `ROUTE` + `RENDER`，连接结果主归 `BRIDGE`                          |
| viewport API / Background / MiniMap         | `WORKSPACE`；输入路由主归 `ROUTE`                                  |
| BaseEdge / path helpers                     | `RENDER`；不测试依赖内部实现                                       |
| parentId / relative position / parent-first | `DOC`                                                              |
| nodrag / nowheel / nopan                    | `ROUTE`；不单独断言 class 名                                       |
| readonly                                    | `BRIDGE` 写边界 + `RENDER` 控件状态，用户输入主归 `ROUTE`          |
| 初始视口与新增元素定位                      | `WORKSPACE`                                                        |
| 节点与边视觉反馈                            | `RENDER`                                                           |
| 平行边与自环                                | `BRIDGE`，持久结构由 `DOC` 辅助覆盖                                |
| 外部 DnD                                    | `ROUTE`，结果文档由 `BRIDGE` 辅助覆盖                              |
| 设计工具式选择配置                          | `ROUTE`                                                            |
| extent / expandParent                       | `DOC` 静态映射 + `ROUTE` 一条边界拖动                              |
| onlyRenderVisibleElements                   | `deferred`：出现真实规模门槛后建立性能基准                         |
| 文本 / Group / reference 编辑               | `RENDER`，快捷键与右键 wiring 主归 `ROUTE`                         |
| Group 坐标与级联语义                        | `COMMAND`                                                          |
| 搜索、专属面板、缩放控制、空态              | `WORKSPACE`                                                        |
| PNG 导出                                    | `WORKSPACE`                                                        |
| 集成清单第三部分全部未集成功能              | `excluded`                                                         |

## 10. 实施顺序与完成条件

```text
DOC → COMMAND → BRIDGE → ROUTE → RENDER → WORKSPACE
```

先覆盖可确定穷举的纯逻辑，再用少量真实 Electron 测试证明 DOM、布局和指针 seam。一个域完成必须同时满足：目录中的全部 capability 有 disposition、`covered` 行有可运行 evidence、没有通过重复 E2E 统计同一能力两次。

## 11. 第一阶段 evidence（2026-08-19）

| 域          | 已落 evidence                                                                                | 尚未覆盖                                                                 |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DOC`       | `graph-document.test.ts`：CG-DOC-01～10，共 6 个参数化 / 不变量测试                          | 无                                                                       |
| `COMMAND`   | `graph-operations.test.ts`：CG-CMD-01～11，共 7 个图变换测试                                 | 无                                                                       |
| `BRIDGE`    | `canvas-graph-bridge.test.ts`：NodeChange / EdgeChange union、CG-BRIDGE-01～04，共 12 个测试 | selection / viewport callback、readonly、reload、imperative add / update |
| `ROUTE`     | `react-flow-input-routing.spec.ts`：pane drag 与 node drag 两条真实 DOM 路由                 | Handle、Resizer、editor、scroll、edge、MiniMap、external DnD             |
| `RENDER`    | 尚未开始                                                                                     | 全部                                                                     |
| `WORKSPACE` | 尚未开始                                                                                     | 全部                                                                     |

该表只统计 primary evidence。辅助断言不会把同一 capability 重复计为已覆盖。
