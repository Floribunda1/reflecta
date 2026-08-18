# 理解画布前端实现计划（v2.0.0）

> 日期：2026-08-16
>
> 状态：计划（待评审）
>
> 职责：把 PRD（`understanding-canvas-prd.md`）模块一～七 + 模块八的非 Generative UI 部分，拆成前端可执行的 phase 序列；每个 phase 含功能范围（PRD 映射）、实现要点、依赖与验收。承接 `understanding-canvas-frontend-design.md` 的 F1（只读渲染器）/ F2（X6 集成）/ F3（组件结构）待办并落地。
>
> 前置：PRD（产品要求）、服务端设计（接口契约，本计划只列前端配合点）、前端实现设计（`understanding-canvas-frontend-design.md`，F1/F2/F3）、UI/UX 设计文档（信息架构 0.x 已定项）、共识记录（C1/C2/C5/C7/C11/C13/C14/C15/C16）

---

## 0. 范围与边界

### 0.1 本计划覆盖

| 范围                            | 内容                                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 模块一                          | 画布管理（列表 / 新建 / 重命名 / 删除 / 空状态 / 进入与视口恢复）                                                                                                                                                      |
| 模块二                          | 画布工作区（工具栏 / 无限画布 / 网格 / 左下控制 / 缩略图 / 搜索 / 演示 / PNG 导出）                                                                                                                                    |
| 模块三                          | 元素体系（理解卡 / 文本卡 / 图形 / 组 / 画布引用）                                                                                                                                                                     |
| 模块四                          | 关系与连线（有向连线 / 标签 / 吸附重路由 / 多连 / 样式）                                                                                                                                                               |
| 模块五                          | 理解库面板（库模式：过滤 / 搜索 / 排序 / 列表 / 拖入画布）                                                                                                                                                             |
| 模块六                          | 理解详情联动（详情模式：编辑 / 同步 / 互斥 / 画布归属）                                                                                                                                                                |
| 模块七                          | 编辑体验与数据（参考线 / 撤销重做 / 框选 / 删除语义 / 锁定 / 持久化）                                                                                                                                                  |
| 模块八（非 Generative UI 部分） | 实体第 4 类 canvas（catalog / composer / citation）、`[[cv:]]` 只读 Modal（M8-6）、工具活动分组（0.3b）、artifact panel（U2 / M8-7）、画布侧「沉淀」接收端（U4 接收侧）、referencedByCanvases 展示（M8-8 / M6-6 共用） |

### 0.2 本计划排除（Generative UI，归 UI/UX 设计文档 U1 / U5）

- **U1 Inline Widget 机制**：消息内联 widget 注册表、`canvas-draft` 草稿卡在消息流中的内联渲染。
- **M8-5 draft-preview**：Agent 结构提案的「消息内联只读小画布 + 应用 / 修改 / 拒绝」审批交互（含 M8-4 写操作的**消息内提案卡**审批 UX）。
- 依赖以上触发端的 **U4 对话内沉淀按钮**（触发形态待 widget 机制定型后接）。

> 边界说明：M8-4 的 agent 写工具本身属服务端（服务端设计文档），不在前端范围；前端只需提供「审批通过后画布数据的**接收与刷新**」能力（Phase 5 的接收端），审批交互本体归 Generative UI。

### 0.3 已定约束（直接采用，不再讨论）

- 路由三模块已就绪（`/understanding-canvas` 已注册、rail 三段含画布入口），页面顶栏沿用 `PageTopBar` 自管模式（0.6 shell 现状）。
- **渲染引擎：AntV X6 3.x + `@antv/x6-react-shape`（C11 定案，spike 14/14 + 9/9 + minimap 全部通过）**；tldraw 因许可排除。X6 集成要点见 `understanding-canvas-frontend-design.md` F2，本计划各 phase 承接落地。
- 画布删除硬删不进回收站（C1）；全局搜索不索引画布（已定）；设置无新增项。
- 画布内 IA = 空间 + 组层级，不是树（C1 定死）；组嵌套深度为 UX 问题，后置。
- 画布连线是「信念 / 结构网」，与 wiki-link「事实 / 溯源网」分层共存；画布连线不写回 `understanding_mentions`（C16）。
- Capture 内联 agent dock 的 @ 搜索 v1 不加 canvas（0.4 待定，v1 建议不进）。
- 只读画布渲染器 = **一个组件三用途**（F1：`[[cv:]]` Modal / draft 提案预览 / 对话内 draft 块）；本计划先建组件（服务 cv Modal 与 artifact），对话内 draft 块（Generative UI）后接。

---

## 1. 技术选型与关键决策（已定 + 实现前拍板）

> T1/T3/T6 为已定项（C11 + spike + 服务端设计），直接采用；T2/T4/T5 为需拍板项（★ = 推荐项）。

| #   | 决策             | 结论 / 选项                                                                                                                                                                  | 说明                                                                                                                                                                                                                                                                                  |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | 画布渲染技术     | **AntV X6 3.x（已定，C11）**：`@antv/x6` + `@antv/x6-react-shape`（React 卡片渲染）                                                                                          | 能力最强且 MIT；React 19 兼容（createRoot）、带标签有向连线、参考线、撤销重做、DnD、打组（embedding `addTo`）、图形、minimap、快照 round-trip 均已 spike 验证。此前用于形态讨论的演示代码已删除，渲染层直接以 X6 实现；X6 SVG 大规模性能问题（600+ 节点）不适用本场景（画布 5-50 卡） |
| T2  | 带参跨模块跳转   | ① hash router query 参数 + `location.state` 携带来源 ★<br>② 全局跳转命令（zustand intent store）                                                                             | **①**：react-router `useSearchParams` 即可承载 `?canvas=<id>`；canvas 模块入口统一解析并打开指定画布。封装 `navigateToCanvas({ canvasId, from })` 单一入口，M6-6 / M3-E3 / U4 接收端共用；来源路径（back 语义）v1 用 `location.state` 记录、不扩机制                                  |
| T3  | 文档状态与持久化 | **X6 为交互 / 语义权威，zustand 文档 store 镜像 + 防抖 `saveCanvas(document)` + `updateViewport`（已定，服务端设计 §文档级写回）**；撤销重做 = **X6 History 插件（会话内）** | 元素 / 连线 id == X6 cell id（零映射）；X6 手势后的完整文档状态 → 前端发目标文档，服务端按 id 机械对账（画布几 KB，整文档便宜）；X6 history 在会话内处理撤销重做，每次状态变更 → 防抖 saveCanvas                                                                                      |
| T4  | 画布理解卡变体   | 新组件 `CanvasUnderstandingCard` ★（作为 X6 react-shape 节点）                                                                                                               | PRD M3-A2 要求**全文展示不截断**、无领域/上下文计数元数据、可自由缩放重排、占位态（M3-A5）、锁定态——与 Capture 卡片（5 行截断 + 元数据 + 右键菜单）语义不同；以 React 组件实现、`@antv/x6-react-shape` 挂载为 X6 节点，同族同风格（border / bg-card / 选中 ring）                     |
| T5  | 连线样式配置 UI  | ① 右侧单面板复用详情槽位（选中连线 → 渲染样式表单）★<br>② 连线就近 popover                                                                                                   | 保持「右侧单面板 = 库 / 详情」的简单 IA（PRD 只定义两态，连线样式作为详情态的第三内容形态）；popover 就近编辑适合快速微调，可作 v1.x 增强                                                                                                                                             |
| T6  | PNG 导出（M2-8） | **X6 内置导出（已定）**：`graph.toPNG` / `toDataURL`（背景配置不绘网格）                                                                                                     | X6 导出能力（toPNG / toSVG / toDataURL）已覆盖「全内容导出」；按内容边界 + 固定倍率出图，走系统保存对话框；无需自绘或引入截图库                                                                                                                                                       |

**演进项（不阻塞 v1）**：AI 提案排布需要「自动布局」（PRD 模块八导语：位置由前端自动排开）——独立于 X6 的纯计算函数（简单网格 / 树状排布 → 生成节点坐标），Phase 5 再评估是否需要引入布局算法库。

---

## 2. 数据层与状态模型（Phase 0 落地，贯穿全程）

- **IPC hooks**（react-query）：`useCanvasList` / `useCanvasDetail(id, { includeBodies: true })` / `useCreateCanvas` / `useRenameCanvas` / `useDeleteCanvas` / `useSaveCanvas` / `useUpdateViewport`，对齐现有 IPC 服务（`ipcClient.understandingCanvas.*`），queryKey 前缀 `["understandingCanvas.*"]`。
- **文档 store**（zustand，X6 文档的镜像数据源）：
  - `selectedCanvasId` / `document { elements, edges }` / `viewport` / `selection`；
  - **X6 是交互 / 语义权威**（T3）：元素 / 连线 id == X6 cell id，X6 变更事件（`node:change:*` / `edge:change:*` / 增删）回写 store，防抖（~800ms）调 `saveCanvas` 全量提交（server 契约即为全量 document，画布几 KB 便宜）；
  - 视口变更单独 `updateViewport`（settle 后提交，实现 M1-5 恢复）；撤销重做由 X6 History 插件在会话内处理，不落库。
- **失效策略**：
  - 理解详情保存（M6-3）→ invalidate 画布 detail（卡片内容同步刷新）；
  - 画布保存 → invalidate Capture 理解详情的 M6-6 归属块（反向 join 数据）；
  - 理解删除 → 画布 detail 返回 `deleted` 占位（M3-A5，`understandingRefs[].deleted` 已就绪）。
- **跨模块刷新**：Phase 5 审批应用后由聊天侧触发 canvas detail invalidate（接收端）。

---

## 3. Phase 划分

> 每个 phase 可独立交付并进入验收；phase 内顺序按「用户可见闭环」优先。
> **F3 组件结构落地**：前端设计文档 F3 的组件拆分与状态架构不单独成章，随 phase 落地——P0 定状态架构（文档 store + 事件桥签名）、P1 定渲染层组件（CanvasGraph / shapes / chrome / 只读渲染器）、P2 定单面板两态、P5 定对话侧组件（citation / artifact）；各 phase 的「验收」含 Storybook 与 feature 文件。
> M# → Phase 映射汇总见文末附录 A。

### Phase 0 — 地基：数据层 + 导航跳转 + 画布列表真实化

**目标**：画布模块从占位页进入真实数据实现；打通跨模块定位能力；画布模块具备真实列表管理。

**范围**：M1-1（列表，按更新时间排序）· M1-2（新建，默认标题，标题可在工作区顶部改，落 Phase 1）· M1-3（删除确认「将删除画布及其全部内容」）· M1-4（空状态引导）· 带参跳转机制（T2）· X6 依赖引入与骨架落地（T1/T3/T4，承接 F2）。

**要点**：

- 画布列表用真实 IPC hooks 替换占位页；行交互（重命名 / 删除 / 搜索）沿用既有 shell 语言（与 Capture 领域树同族）。
- 路由入口统一解析 `?canvas=<id>`：canvas 模块挂载后若带参 → 自动选中并进入编辑模式；`navigateToCanvas` 封装放 `shared/navigation`。
- Capture 理解详情侧预留 M6-6 跳转调用点（实际 UI 在 Phase 2）。
- **X6 骨架（F2 承接）**：依赖引入（`@antv/x6@^3.x` + `@antv/x6-react-shape`，与 X6 代码同包——`packages/ui`，运行时依赖 `tslib`）；建 `CanvasGraph` 空壳（X6 生命周期封装 + 语义事件桥签名）；React 19 `createRoot` 渲染验证；确认插件（Dnd / Snapline / Selection / Keyboard / History / MiniMap 均在核心包）。

**验收**：

- Feature：`canvas-manage.feature`（列表 / 新建 / 重命名 / 删除确认 / 空状态）；跳转用例并入 `cross-module-navigation.feature`。
- 单测：数据 hooks、navigateToCanvas 参数解析（单元）。

**依赖**：server IPC 已就绪；`location.state` 不引入新机制。

---

### Phase 1 — 工作区与元素基础（画布「能看能摆」）

**目标**：真实无限画布 + 全部元素种类的展示与基础操作 + 增量持久化；理解卡可经最小库入口拖入创建。

**范围**：

- M2-1 顶部工具栏（画布标题就地编辑 + 「理解库」按钮 + 文本 / 矩形 / 圆形 / 组 图标）；M2-2 无限画布（平移 / 缩放）；M2-3 背景网格；M2-4 左下控制（放大 / 缩小 / 适应视图）；M2-5 右下缩略图（点击定位）。
- M3-A 理解卡（展示全文不截断 / 可缩放 / 只读 / 占位 M3-A5 / 引用同步 M3-A6 / 尺寸重排 M3-A3）；M3-B 文本卡（工具栏拖入创建 M3-B1、双击就地编辑 + 简单 markdown + 失焦保存 M3-B2、持久化 M3-B3）；M3-C 图形（拖入创建 / 移动缩放删除）；M3-D 组（拖入创建空组 / 显式边框标题栏 / 组名双击编辑 / 入组出组拖拽 / 级联删除与解除组 / 嵌套渲染）；M3-E 画布引用（选择目标画布 / 显示标题 / 点击跳转 / 占位）。
- 理解卡创建入口 = 库面板最小闭环（列表 + 拖入，见 Phase 2 补全）。
- M7-6 持久化（位置 / 尺寸 / 文本 / 分组 / 视口，防抖 saveCanvas + updateViewport；连线标签与锁定随各自 phase 落地后由全量文档自动覆盖）；M1-5 视口恢复。

**要点**（X6 承载，承接 F2）：

- **`CanvasGraph` 组件**（X6 生命周期封装 + 语义事件桥）：挂载建图、销毁释放、`node/edge:change:*` 与增删事件 → 回写 zustand 文档 store（T3），供右侧面板 / 搜索 / 持久化消费；外部变更（Phase 5 接收端）反向 `graph.fromJSON` 更新。
- **shapes（`@antv/x6-react-shape`）**：理解卡（`CanvasUnderstandingCard`，T4：全文不截断 / 无元数据 / 占位「（已删除）」/ 锁定态）、文本卡（双击就地编辑 + 简单 markdown + 失焦保存）、图形（矩形 / 圆形）、组（显式边框 + 标题栏 + 组名双击编辑）、画布引用（目标画布标题 + 点击跳转 + 占位）——统一进 Storybook。
- **DnD（工具栏图标 → 画布拖入创建）**：`dnd.start()` 传节点实例（F2 已验证）；理解卡入口 = 库面板最小闭环（库行 draggable → 画布落点）。
- **画布引用（M3-E1）**：创建时弹「选择目标画布」模态（复用画布列表，复用 M1 查询与行交互）；目标画布被删除后显示「（已删除）」占位（M3-E4，`referencedCanvases[].deleted` 已就绪）。
- **画布内空态（M1-4 同级）**：画布无元素时显示引导（「从素材库拖入理解，或从工具栏拖入文本 / 图形」），与模块级空状态（无画布）分开。
- **缩放惯性（M2-2）**：X6 `mousewheel` 插件配置惯性 / 触控板支持需实现期验证（spike 未覆盖触控板手势），不支持则记为增强项，不阻塞 v1。
- **组 = embedding**：`addTo` 双向（F2 已验证，非 `setParent` 单向）；组内子元素为相对坐标、拖组时子元素自动跟随；入组 / 出组 / 级联删除 / 解除组 / 嵌套渲染都在 X6 embedding 上实现。
- **插件**：History（撤销重做，会话内）、MiniMap（右下缩略图）、（Snapline / Selection / Keyboard 在 Phase 4 启用）。
- **只读渲染器（F1 三用组件）**：本轮抽出 `CanvasReadOnlyView`（X6 `interacting: false` 或轻量渲染，待 F1 调研定案）——本 phase 先服务 `[[cv:]]` Modal 与 artifact 缩略，对话内 draft 块后接；保证「所见即所存」。
- 点阵网格（X6 `background` 配置，不参与导出）；左下控制（放大 / 缩小 / 适应视图 → `graph.zoom` / `graph.zoomToFit`）。
- 性能基线：画布 5-50 卡（spike 结论），不做虚拟化；元素变更只影响对应 cell 重渲。

**验收**：

- Feature：`canvas-workspace.feature`（平移缩放 / 网格不导出 / 控制与缩略图 / 标题编辑）、`canvas-elements.feature`（五类元素的创建 / 编辑 / 移动 / 缩放 / 删除 / 占位 / 跳转）、`canvas-persistence.feature`（重进还原位置与视口、文本完整还原）。
- 单测：X6 文档 ↔ cell 回写（事件桥）、embedding 入组 / 出组 / 级联删除、react-shape 节点数据映射。

---

### Phase 2 — 理解库面板与理解详情联动（进出通道）

**目标**：右侧单面板两态完整落地；理解进出画布形成闭环。

**范围**：

- M5 库模式完整：打开（工具栏「理解库」按钮）/ 领域过滤（含全部领域）/ 搜索 / 排序 / 列表展示（与 Capture 列表体验一致）/ 拖入画布创建理解卡 / 再次点击或 Esc 关闭恢复全宽。
- M6 详情模式：点击画布理解卡 → 复用 Capture `UnderstandingDetail`（右面板槽位内，编辑标题 / 正文 / 上下文）；保存后画布卡同步（M6-3）；库 / 详情互斥（M6-4）；关闭恢复全宽（M6-5）。
- M6-6 画布归属：Capture 理解详情新增「出现于 N 张画布」区块 + 跳转画布模块打开指定画布（依赖 Phase 0 跳转）。
- M8-8：理解详情 / agent 的 `understanding_get` 共用 `referencedByCanvases` 数据（server 已返回）。

**要点**：

- 库面板复用 capture 的领域查询与理解列表能力（排序 / 过滤逻辑抽共享或直接引 capture queries）。
- 拖入画布 = HTML5 拖拽（库行 draggable → 画布 drop 落点），创建理解卡后立即持久化（saveCanvas）。
- 详情槽位按右侧单面板两态切换骨架实现（库 / 详情互斥）；`UnderstandingDetail` 直接挂载（其上下文 / AI 能力完整保留，M6-2 免费获得）。
- 画布卡同步：理解保存 → invalidate `useCanvasDetail`（§2 失效策略）。
- M6-6 跳转后回到 capture 的来源路径用 `location.state` 支持「返回」体验（T2）。

**验收**：

- Feature：`canvas-library-panel.feature`（过滤 / 搜索 / 排序 / 拖入创建）、`canvas-detail-linkage.feature`（点击进详情 / 编辑保存同步 / 互斥 / 关闭 / 画布归属跳转）。
- 集成：拖拽创建（组件级），同步失效（query invalidation）。

---

### Phase 3 — 关系与连线（结构网核心）

**目标**：有向、带标签、带样式的连线全能力；结构语义（谁依赖谁 / 谁推导出谁）可表达。

**范围**：M4-1 创建（卡片 / 组边缘拖出箭头 → 目标）· M4-2 方向 · M4-3 标签（双击就地编辑，随连线移动，持久化）· M4-4 吸附（端点吸附元素边界）与重路由（连线绕行避开遮挡元素）· M4-5 多连（同对卡片多条不同标签）· M4-6 删除（选中后 Delete/Backspace）· M4-7 连线样式（拐点直线/贝塞尔/正交、线型实线/虚线/点线、颜色色板、粗细、箭头开关、一键重置）。

**要点**（X6 连线能力，承接 spike 结论）：

- **创建 / 重连**：元素 hover 显示连线把手（边缘锚点 `port`），拖出到目标落点生成有向边；`source/target` 端点可再次拖拽重连（`edge.getSourceCellId()` 重连语义）。
- **吸附与重路由（M4-4）**：边界吸附（`boundary` connection + 端点吸附）与**曼哈顿正交路由（X6 `manhattan` router）已在 spike 验证**；「绕开遮挡」用 router 的障碍规避配置（`excludeNodeIds` / 包围盒）；复杂路由算法不进 v1。
- **连线样式映射（F2 已定）**：拐点 → `connector`（straight / smooth / jumpover 或 router 选择）、线型 → `strokeDasharray`、箭头 → `targetMarker`、粗细 → `strokeWidth`、颜色 → 预设色板（避免魔法色值）；一键重置 = 回默认样式映射。
- **标签（M4-3）**：X6 edge 标签（`label` 配置），双击就地编辑（edge tool），随连线移动，持久化。
- **样式 UI 按 T5**：选中连线 → 右侧面板详情槽位渲染样式表单（读 X6 cell 数据写回）。
- 连线数据进入 `saveCanvas` document（edges 含 style / label / 方向；id == X6 edge id）。
- 多连（M4-5）：同对节点允许多条边，无额外逻辑；删除（M4-6）走 Keyboard 插件（Delete/Backspace）或选中后右键。

**验收**：

- Feature：`canvas-edges.feature`（创建 / 方向 / 标签 / 吸附 / 多连 / 删除 / 样式配置与重置 / 持久化）。
- 单测：连线样式映射（routing → connector/router、lineStyle → strokeDasharray、arrowhead → targetMarker）、端点重连、样式重置归一化。

---

### Phase 4 — 编辑体验与展示型功能

**目标**：进阶编辑（对齐 / 撤销重做 / 框选 / 删除语义 / 锁定）+ 搜索 / 演示 / 导出收口。

**范围**：

- M7-1 参考线（拖拽中显示与其它元素边缘 / 中心对齐的参考线，松手落齐）。
- M7-2 撤销 / 重做（⌘/⌘⇧+Z；覆盖位置 / 尺寸 / 增删 / 文本 / 标签 / 分组 / 锁定；X6 History 插件，T3）。
- M7-3 CAD 框选（左→右仅全包含；右→左相交即选；Shift 追加；多选整体移动）。
- M7-4 删除语义（删除卡 → 连带其连线；删除组 = 级联；解除组独立，右键）。
- M7-5 锁定（选中锁定防误拖；不可拖动 / 不可被框选移动；可解锁）。
- M2-6 画布内搜索（⌘/Ctrl+F 浮层；范围：卡标题 / 正文、组名、连线标签；点击结果平移缩放定位；Esc 关闭）——正文 / 连线标签范围依赖 Phase 2/3 数据就绪。
- M2-7 演示模式（按组逐个走查：动画聚焦组内容，prev / next / 退出；无组退化为适应视图浏览）——左下控制区的「演示模式」按钮随本 phase 补齐（M2-4 四个按钮收口）。
- M2-8 PNG 导出（全内容，系统保存对话框；T6）。

**要点**（X6 插件 + 自定义，承接 F2）：

- **参考线（M7-1）**：Snapline 插件（`graph.use(new Snapline(...))`，对齐边缘 / 中心，拖拽时显示、松手落齐）。
- **撤销 / 重做（M7-2）**：History 插件（`graph.use(new History({ enabled: true }))`）——会话内覆盖位置 / 尺寸 / 增删 / 文本 / 标签 / 分组 / 锁定，每次状态变更 → 防抖 saveCanvas（T3）。
- **CAD 框选（M7-3）**：自定义 marquee（F2 已定）：左→右 `getNodesInArea(rect, { strict: true })`（全包含），右→左 `strict: false`（相交即选）；Shift 追加；多选整体移动（X6 原生）。
- **删除语义（M7-4）**：Keyboard 插件删除选中（Delete / Backspace）；删除卡片连带其边（X6 原生）；删除组 = 级联（组 + 组内元素 + 其连线）；解除组独立（右键 → 解 embedding 保留子元素回画布自由态）。
- **锁定（M7-5）**：X6 node `lock()/unlock()`（不可拖动、不可被框选移动）；锁定态随 props 持久化（C5：呈现状态随 props 走，`saveCanvas` 全量文档自动覆盖 `props.locked`）；**入口 UI**：右键菜单 + 右侧面板选中态操作区（v1 二选一即可，建议右键）。
- **搜索（M2-6）**：⌘/Ctrl+F 浮层；范围：卡标题 / 正文、组名、连线标签；命中后 `graph.centerCell` + 缩放定位 + 选中。
- **演示模式（M2-7）**：按组顺序遍历，`graph.centerCell`/`zoomToRect` 动画聚焦每组内容；prev / next / 退出；无组退化为适应视图浏览。
- **PNG 导出（M2-8）**：X6 `toPNG` / `toDataURL`（T6），背景不绘网格（M2-3），按内容边界 + 固定倍率，走系统保存对话框。

**验收**：

- Feature：`canvas-editing.feature`（参考线 / 撤销重做 / 框选多选与整体移动 / 删除语义 / 锁定）、`canvas-workspace.feature` 补充搜索 / 演示 / 导出场景。
- 单测：History 会话内撤销 / 重做覆盖、框选判定（左→右 / 右→左）、锁定约束（不可拖动 / 不可被框选移动）。

---

### Phase 5 — Agent 协作（非 Generative UI 部分）

**目标**：画布进入 Agent 实体体系；对话产出可见（artifact panel）；画布侧接收外部落地变更。

**范围**（均不含消息内联 widget，见 §0.2）：

- 0.3a 实体第 4 类：`AgentContextRef` 加 canvas；composer @-mention 搜索含画布；citation 渲染画布（复用 understanding 既有模板路径，不单独造）。
- M8-6 `[[cv:]]` 引用：点击打开**只读 Modal**（F1 `CanvasReadOnlyView` 三用组件，`interacting: false` 或轻量渲染，待 F1 调研定案），不跳路由。
- 0.3b 工具活动分组：`canvas_*` 工具在 agent-turn-view 归入 canvas 分组（最小改动：分组映射）。
- U2 / M8-7 artifact panel：对话 header 下「产出条」（本对话已落地产出：理解 / 上下文 / 领域 / 画布），展开按类型分区列表；画布行 = approve 落地后的 canvas（点击行为：跳转画布模块编辑模式，依赖 Phase 0 跳转）。
- U4 接收端：对话沉淀动作落地后 → 打开画布模块（新建画布或更新指定画布编辑模式）；**触发端（对话内按钮）归 Generative UI，此处只做接收**。
- M8-8 / M6-6 数据共用（Phase 2 已落地，此处补齐 agent 侧展示）。

**要点**：

- canvas citation / composer 搜索走既有 entity catalog + `getEntityDisplay` 模式扩展（canvas → 标题取 canvas.title）。
- `CanvasReadOnlyView`（Phase 1 抽出，F1）是本 phase 的公共渲染底座：`[[cv:]]` Modal / artifact 缩略 / 未来 widget 共用，保证「所见即所存」。
- 画布 detail 的外部失效：审批应用 → invalidate canvas detail（§2）；审批通过后 `graph.fromJSON` 增量更新当前打开的画布。

**验收**：

- Feature：`canvas-citation.feature`（@ 引用 / `[[cv:]]` Modal 只读展示）、`conversation-artifacts.feature`（产出条 / 分区列表 / 画布行跳转）。
- 集成：catalog 扩展、活动分组映射。

---

### Phase 6 — 画布侧就地 Chat（v1.x 预留）

- U3：画布中打开 Chat 侧边栏，AI 以当前画布为作用域（scope 自动注入，无需手动贴 id）；与右侧单面板的关系、选中元素与对话联动待设计。
- 明确 **v1 不做**；依赖：带参跳转（T2 已备）、chat scope 注入（对话侧基建）、widget 机制定型后触发端可复用。
- 若提前，建议先做「作用域注入 + 侧栏形态」最小闭环，联动（选中元素 ↔ 对话）后置。

---

## 4. 测试与验收策略（贯穿）

- **Feature 文件**（按用户能力 MECE 划分，稳定 ID 前缀建议 `@CV-*`，与现有 `@CP-*` / `@AG-*` 并列）：
  - `canvas-manage.feature`（Phase 0）
  - `canvas-workspace.feature`（Phase 1 基础 + Phase 4 搜索 / 演示 / 导出）
  - `canvas-elements.feature`（Phase 1）
  - `canvas-persistence.feature`（Phase 1）
  - `canvas-library-panel.feature`（Phase 2）
  - `canvas-detail-linkage.feature`（Phase 2）
  - `canvas-edges.feature`（Phase 3）
  - `canvas-editing.feature`（Phase 4）
  - `canvas-citation.feature` / `conversation-artifacts.feature`（Phase 5，与 agent 现有 feature 归属协调）
- **acceptance 目录**：`e2e/acceptance/feature/canvas/` + `e2e/acceptance/spec/canvas/`，按稳定 ID 双向关联（test-case-principles 第 3 节）。
- **分层**：X6 样式映射 / 文档 ↔ cell 回写 / 框选判定 / embedding 入组 / 事件桥 → unit；拖拽创建、同步失效、外部刷新（fromJSON）→ integration；跨窗口 / 系统保存对话框（导出）→ acceptance E2E 或 regression。
- **Storybook**：展示型组件进 Storybook（CanvasGraph / 五类 react-shape 节点各态 / ZoomControls / Minimap / SearchOverlay / RightPanel 两态 / CanvasReadOnlyView），按 storybook-principles MECE case。

---

## 5. 风险与待定项

| #   | 风险 / 待定                           | 说明与对策                                                                                                                                                                                                      |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 连线重路由复杂度（正交绕行）          | **X6 `manhattan` router + boundary connection 已 spike 验证**（M4-4 主路径无风险）；「绕开遮挡」用 router 障碍规避配置，复杂路由不进 v1                                                                         |
| R2  | 撤销重做覆盖全类型（M7-2）            | **X6 History 插件会话内处理**，覆盖全部变更类型（服务端设计已定：每次变更 → 防抖 saveCanvas）；无自研撤销栈                                                                                                     |
| R3  | PNG 导出保真                          | **X6 `toPNG` / `toDataURL` 内置导出**（T6），背景不绘网格；保真不足时评估倍率 / 前置渲染                                                                                                                        |
| R4  | 组嵌套交互判定（0.2 后置项）          | **渲染不限深度**（PRD M3-D6「层级不限」，X6 embedding 原生支持）；受限的是**交互判定**：入组 hit-test 用「最深层包含元素」、框选按递归语义（选中组即含组内元素），v1 不做深度硬上限，超深交互走确认仅作后置演进 |
| R5  | 性能（元素多时 saveCanvas 全量）      | 防抖 + 全量提交（server 契约），数百元素 OK；超量再上 diff / 局部提交（演进）                                                                                                                                   |
| T7  | 理解删除 → 恢复后卡片复活（0.4 待定） | server 是 join 查询，恢复后自然显示回内容，无需额外前端处理；仅需 feature 用例覆盖「占位 → 恢复」                                                                                                               |
| T8  | 画布列表分组 / 筛选（0.2 结构问题 1） | v1 不做，记演进项（列表多时再议）                                                                                                                                                                               |
| T9  | 工具栏工具集（M2-1 极简）             | v1 仅：标题编辑 / 理解库 / 文本 / 矩形 / 圆形 / 组；选择 / 连线等工具不占工具栏（连线从元素把手直接拉出）                                                                                                       |

---

## 附录 A：M# → Phase 映射

| Phase                 | PRD 功能                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Phase 0               | M1-1 / M1-3 / M1-4；跳转机制（0.1 / 0.5-2）                                                                        |
| Phase 1               | M1-2 / M1-5；M2-1/2/3/4/5；M3-A/B/C/D/E；M7-6；库模式最小闭环（拖入创建）                                          |
| Phase 2               | M5 完整；M6-1..6；M8-8                                                                                             |
| Phase 3               | M4-1..7（全部）                                                                                                    |
| Phase 4               | M2-6/7/8；M7-1/2/3/4/5                                                                                             |
| Phase 5               | 0.3a（catalog / composer / citation）；0.3b（活动分组）；M8-6；U2/M8-7（artifact panel）；U4 接收端；M8-8 展示补齐 |
| Phase 6（v1.x）       | U3 画布侧就地 Chat                                                                                                 |
| 排除（Generative UI） | U1 widget 注册表；M8-5 draft-preview 消息内联渲染与审批交互；U4 对话内触发端                                       |
