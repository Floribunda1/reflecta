# 理解画布前端实现计划（v2.0.0）

> 日期：2026-08-16
>
> 状态：计划（待评审）
>
> 职责：把 PRD（`understanding-canvas-prd.md`）模块一～七 + 模块八的非 Generative UI 部分，拆成前端可执行的 phase 序列；每个 phase 含功能范围（PRD 映射）、实现要点、依赖与验收。
>
> 前置：PRD（产品要求）、服务端设计（接口契约，本计划只列前端配合点）、UI/UX 设计文档（信息架构 0.x 已定项）、共识记录（C1/C2/C5/C7/C13/C14/C15/C16）

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
- 画布删除硬删不进回收站（C1）；全局搜索不索引画布（已定）；设置无新增项。
- 画布内 IA = 空间 + 组层级，不是树（C1 定死）；组嵌套深度为 UX 问题，后置。
- 画布连线是「信念 / 结构网」，与 wiki-link「事实 / 溯源网」分层共存；画布连线不写回 `understanding_mentions`（C16）。
- Capture 内联 agent dock 的 @ 搜索 v1 不加 canvas（0.4 待定，v1 建议不进）。

---

## 1. 技术选型与关键决策（实现前拍板）

> 下列决策直接决定 phase 结构与组件拆分，建议在 Phase 0 开工前逐项确认（★ = 推荐项）。

| #   | 决策             | 选项                                                                                                   | 建议与理由                                                                                                                                                                                                                                                                                              |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | 画布渲染技术     | ① 自研 DOM transform（延续 wireframe）★<br>② 引入 react-flow 等图库                                    | **①**：需求里「卡片 = 真实 React 组件（就地编辑、右键、占位态）、组嵌套空间语义、连线承载语义标签」与 flow 库的图编辑模型不完全匹配；样式定制会大量覆盖默认皮肤（违背「少定制」）；元素量级本地应用 <500，自研成本可控，wireframe 已验证可行。②仅在需要复杂正交自动重路由时局部引入路由算法，不引入整库 |
| T2  | 带参跨模块跳转   | ① hash router query 参数 + `location.state` 携带来源 ★<br>② 全局跳转命令（zustand intent store）       | **①**：react-router `useSearchParams` 即可承载 `?canvas=<id>`；canvas 模块入口统一解析并打开指定画布。封装 `navigateToCanvas({ canvasId, from })` 单一入口，M6-6 / M3-E3 / U4 接收端共用；来源路径（back 语义）v1 用 `location.state` 记录、不扩机制                                                    |
| T3  | 文档状态与持久化 | zustand 画布文档 store + 防抖 `saveCanvas(document)` + `updateViewport`；撤销重做 = **文档快照历史** ★ | 元素/连线层级浅（扁平数组 + parentId），快照序列化成本低且天然覆盖 M7-2 要求的全部变更类型（位置/尺寸/增删/文本/标签/分组/锁定）；上限 ~100 步，大画布按 diff 存储（演进项）                                                                                                                            |
| T4  | 画布理解卡变体   | 新组件 `CanvasUnderstandingCard` ★（不复用 Capture `UnderstandingCard`）                               | PRD M3-A2 要求**全文展示不截断**、无领域/上下文计数元数据、可自由缩放重排、占位态（M3-A5）、锁定态——与 Capture 卡片（5 行截断 + 元数据 + 右键菜单）语义不同；新组件同族同风格（border / bg-card / 选中 ring）                                                                                           |
| T5  | 连线样式配置 UI  | ① 右侧单面板复用详情槽位（选中连线 → 渲染样式表单）★<br>② 连线就近 popover                             | 保持「右侧单面板 = 库 / 详情」的简单 IA（PRD 只定义两态，连线样式作为详情态的第三内容形态）；popover 就近编辑适合快速微调，可作 v1.x 增强                                                                                                                                                               |
| T6  | PNG 导出（M2-8） | ① 原生 Canvas 2D 离屏绘制 ★<br>② 引入 dom-to-image 类库                                                | 画布元素为矩形 + 文本 + 线，2D 绘制成本可控、像素精确、无新依赖；导出前按内容边界 + 固定 2x 缩放出图。①保真不足时（如 markdown 排版）再评估 ②                                                                                                                                                           |

**演进项（不阻塞 v1）**：AI 提案排布需要「自动布局」（PRD 模块八导语：位置由前端自动排开）——独立于画布编辑渲染的纯计算函数（如简单网格 / 树状排布），Phase 5 再评估是否需要引入布局算法库。

---

## 2. 数据层与状态模型（Phase 0 落地，贯穿全程）

- **IPC hooks**（react-query）：`useCanvasList` / `useCanvasDetail(id, { includeBodies: true })` / `useCreateCanvas` / `useRenameCanvas` / `useDeleteCanvas` / `useSaveCanvas` / `useUpdateViewport`，对齐现有 IPC 服务（`ipcClient.understandingCanvas.*`），queryKey 前缀 `["understandingCanvas.*"]`。
- **文档 store**（zustand，wireframe store 升级为真实数据源）：
  - `selectedCanvasId` / `document { elements, edges }` / `viewport` / `selection`；
  - 变更一律先进本地 store（交互零延迟），防抖（~800ms）调 `saveCanvas` 全量提交（server 契约即为全量 document，元素数百量级可接受）；
  - 视口变更单独 `updateViewport`（settle 后提交，实现 M1-5 恢复）。
- **失效策略**：
  - 理解详情保存（M6-3）→ invalidate 画布 detail（卡片内容同步刷新）；
  - 画布保存 → invalidate Capture 理解详情的 M6-6 归属块（反向 join 数据）；
  - 理解删除 → 画布 detail 返回 `deleted` 占位（M3-A5，`understandingRefs[].deleted` 已就绪）。
- **跨模块刷新**：Phase 5 审批应用后由聊天侧触发 canvas detail invalidate（接收端）。

---

## 3. Phase 划分

> 每个 phase 可独立交付并进入验收；phase 内顺序按「用户可见闭环」优先。
> M# → Phase 映射汇总见文末附录 A。

### Phase 0 — 地基：数据层 + 导航跳转 + 画布列表真实化

**目标**：替换 wireframe mock 的数据源；打通跨模块定位能力；画布模块具备真实列表管理。

**范围**：M1-1（列表，按更新时间排序）· M1-2（新建，默认标题，标题可在工作区顶部改，落 Phase 1）· M1-3（删除确认「将删除画布及其全部内容」）· M1-4（空状态引导）· 带参跳转机制（T2）· T1/T3/T4 选型落地。

**要点**：

- 画布列表用真实 IPC hooks，移除 wireframe mock 列表；行交互（重命名/删除/搜索）保留 wireframe 已验证形态。
- 路由入口统一解析 `?canvas=<id>`：canvas 模块挂载后若带参 → 自动选中并进入编辑模式；`navigateToCanvas` 封装放 `shared/navigation`。
- Capture 理解详情侧预留 M6-6 跳转调用点（实际 UI 在 Phase 2）。

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
- M7-6 持久化（位置 / 尺寸 / 文本 / 分组 / 视口，防抖 saveCanvas + updateViewport）；M1-5 视口恢复。

**要点**：

- 自研渲染层从 wireframe 继承：transform 视口、点阵网格、`RenderedElement` 按 kind 分发；增加**拖拽创建**（工具栏图标 → 画布 ghost 落点）、**8 向 resize 手柄**、**移动**（含组内坐标换算 child.x - group.x）、**组入组判定**（拖拽过程中 hit-test 组容器）。
- 编辑器句柄（resize / 连线锚点）用 `data-` 属性 + `closest()` 判断，避免与画布平移手势冲突（沿用 wireframe 的手势隔离方案）。
- 元素组件全部 memo + 稳定 identity，选中态只重渲受影响的节点（性能基线：≥300 元素流畅）。
- `CanvasUnderstandingCard`（T4）：全文渲染、无元数据行、占位态「（已删除）」、锁定态样式预留。
- 渲染层与「只读渲染」解耦：`CanvasElementsView`（只读，供 M8-6 Modal / 导出复用）与编辑器层分开——只读层本轮就抽出来，避免 Phase 5 返工。

**验收**：

- Feature：`canvas-workspace.feature`（平移缩放 / 网格不导出 / 控制与缩略图 / 标题编辑）、`canvas-elements.feature`（五类元素的创建 / 编辑 / 移动 / 缩放 / 删除 / 占位 / 跳转）、`canvas-persistence.feature`（重进还原位置与视口、文本完整还原）。
- 单测：canvas-geometry（视口 / fit / 吸附 / 入组判定）、store（保存防抖、占位逻辑）。
- 本 phase 结束时**移除 wireframe mock**（`modules/canvas/wireframe/` 删除，可复用代码迁入正式目录：geometry、手势方案、chrome 组件雏形），路由目标切到真实页面。

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
- 详情槽位复用 wireframe 已搭的 `CanvasRightPanel` 两态切换；`UnderstandingDetail` 直接挂载（其上下文 / AI 能力完整保留，M6-2 免费获得）。
- 画布卡同步：理解保存 → invalidate `useCanvasDetail`（§2 失效策略）。
- M6-6 跳转后回到 capture 的来源路径用 `location.state` 支持「返回」体验（T2）。

**验收**：

- Feature：`canvas-library-panel.feature`（过滤 / 搜索 / 排序 / 拖入创建）、`canvas-detail-linkage.feature`（点击进详情 / 编辑保存同步 / 互斥 / 关闭 / 画布归属跳转）。
- 集成：拖拽创建（组件级），同步失效（query invalidation）。

---

### Phase 3 — 关系与连线（结构网核心）

**目标**：有向、带标签、带样式的连线全能力；结构语义（谁依赖谁 / 谁推导出谁）可表达。

**范围**：M4-1 创建（卡片 / 组边缘拖出箭头 → 目标）· M4-2 方向 · M4-3 标签（双击就地编辑，随连线移动，持久化）· M4-4 吸附（端点吸附元素边界）与重路由（连线绕行避开遮挡元素）· M4-5 多连（同对卡片多条不同标签）· M4-6 删除（选中后 Delete/Backspace）· M4-7 连线样式（拐点直线/贝塞尔/正交、线型实线/虚线/点线、颜色色板、粗细、箭头开关、一键重置）。

**要点**：

- 锚点交互：元素 hover 显示连线把手（从边框拉出）；线端可重连到其它元素。
- 路由：v1 至少实现直线 + 贝塞尔 + 简单正交（曼哈顿绕行），「绕开遮挡」先做元素包围盒避让，复杂路由算法评估期放演进（T1 备注）。
- 样式 UI 按 T5：选中连线 → 右侧面板详情槽位渲染样式表单（色板用预设色板，避免魔法色值）。
- 连线数据进入 `saveCanvas` document（edges 已含 style / label / 方向）。
- 边缘 label 命中与编辑：label 文本命中区放大，双击进入编辑。

**验收**：

- Feature：`canvas-edges.feature`（创建 / 方向 / 标签 / 吸附 / 多连 / 删除 / 样式配置与重置 / 持久化）。
- 单测：edgeAnchors / 正交路由 / 样式归一化（重置逻辑）。

---

### Phase 4 — 编辑体验与展示型功能

**目标**：进阶编辑（对齐 / 撤销重做 / 框选 / 删除语义 / 锁定）+ 搜索 / 演示 / 导出收口。

**范围**：

- M7-1 参考线（拖拽中显示与其它元素边缘 / 中心对齐的参考线，松手落齐）。
- M7-2 撤销 / 重做（⌘/⌘⇧+Z；覆盖位置 / 尺寸 / 增删 / 文本 / 标签 / 分组 / 锁定；快照历史 T3）。
- M7-3 CAD 框选（左→右仅全包含；右→左相交即选；Shift 追加；多选整体移动）。
- M7-4 删除语义（删除卡 → 连带其连线；删除组 = 级联；解除组独立，右键）。
- M7-5 锁定（选中锁定防误拖；不可拖动 / 不可被框选移动；可解锁）。
- M2-6 画布内搜索（⌘/Ctrl+F 浮层；范围：卡标题 / 正文、组名、连线标签；点击结果平移缩放定位；Esc 关闭）——正文 / 连线标签范围依赖 Phase 2/3 数据就绪。
- M2-7 演示模式（按组逐个走查：动画聚焦组内容，prev / next / 退出；无组退化为适应视图浏览）。
- M2-8 PNG 导出（全内容，系统保存对话框；T6）。

**要点**：

- 撤销重做与持久化解耦：历史只存在内存 store，不随 saveCanvas 落库（落库仍全量防抖）。
- 框选在「世界层」做拖拽选择框（viewBox 内矩形），选区判定用 world 坐标。
- 导出（T6 ①）：离屏 2D 绘制（背景不含网格，M2-3），按内容边界 + 2x；走 Electron 系统保存对话框。

**验收**：

- Feature：`canvas-editing.feature`（参考线 / 撤销重做 / 框选多选与整体移动 / 删除语义 / 锁定）、`canvas-workspace.feature` 补充搜索 / 演示 / 导出场景。
- 单测：撤销栈、框选判定（左→右 / 右→左）、锁定约束。

---

### Phase 5 — Agent 协作（非 Generative UI 部分）

**目标**：画布进入 Agent 实体体系；对话产出可见（artifact panel）；画布侧接收外部落地变更。

**范围**（均不含消息内联 widget，见 §0.2）：

- 0.3a 实体第 4 类：`AgentContextRef` 加 canvas；composer @-mention 搜索含画布；citation 渲染画布（复用 understanding 既有模板路径，不单独造）。
- M8-6 `[[cv:]]` 引用：点击打开**只读 Modal**（复用 Phase 1 的只读渲染组件），不跳路由。
- 0.3b 工具活动分组：`canvas_*` 工具在 agent-turn-view 归入 canvas 分组（最小改动：分组映射）。
- U2 / M8-7 artifact panel：对话 header 下「产出条」（本对话已落地产出：理解 / 上下文 / 领域 / 画布），展开按类型分区列表；画布行 = approve 落地后的 canvas（点击行为：跳转画布模块编辑模式，依赖 Phase 0 跳转）。
- U4 接收端：对话沉淀动作落地后 → 打开画布模块（新建画布或更新指定画布编辑模式）；**触发端（对话内按钮）归 Generative UI，此处只做接收**。
- M8-8 / M6-6 数据共用（Phase 2 已落地，此处补齐 agent 侧展示）。

**要点**：

- canvas citation / composer 搜索走既有 entity catalog + `getEntityDisplay` 模式扩展（canvas → 标题取 canvas.title）。
- `ReadOnlyCanvasView`（Phase 1 抽出）是本 phase 的公共渲染底座：Modal / artifact 缩略 / 未来 widget 共用，保证「所见即所存」。
- 画布 detail 的外部失效：审批应用 → invalidate canvas detail（§2）。

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
- **分层**：几何 / 路由 / 撤销栈 / 框选判定 / 入组判定 → unit；拖拽创建、同步失效、外部刷新 → integration；跨窗口 / 系统保存对话框（导出）→ acceptance E2E 或 regression。
- **Storybook**：展示型组件进 Storybook（CanvasUnderstandingCard 各态 / EdgesLayer / ZoomControls / Minimap / SearchOverlay / RightPanel 两态 / ReadOnlyCanvasView），按 storybook-principles MECE case。

---

## 5. 风险与待定项

| #   | 风险 / 待定                           | 说明与对策                                                                                                             |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R1  | 连线重路由复杂度（正交绕行）          | v1 先直线 / 贝塞尔 / 简单曼哈顿避让；复杂路由按演进项，不阻塞连线创建与语义（M4-4 的「自动绕行」以元素包围盒避让兜底） |
| R2  | 撤销重做覆盖全类型（M7-2）            | 快照历史天然全覆盖；大画布内存压力按 diff 存储（演进）；组内移动在快照中是扁平数组坐标，天然可撤销                     |
| R3  | PNG 导出保真                          | 原生 2D 先覆盖矩形 / 文本 / 线；markdown 排版不保真时评估 ②（T6）                                                      |
| R4  | 组嵌套拖拽目标判定（0.2 后置项）      | 入组 hit-test 用「最深层包含元素」+ 嵌套深度上限 v1 建议 3 层内，超深走确认；框选递归语义与入组语义解耦测试            |
| R5  | 性能（元素多时 saveCanvas 全量）      | 防抖 + 全量提交（server 契约），数百元素 OK；超量再上 diff / 局部提交（演进）                                          |
| R6  | wireframe 双实现漂移                  | Phase 1 结束时整体删除 wireframe 目录并迁移可复用代码，避免同一形态两处实现                                            |
| T7  | 理解删除 → 恢复后卡片复活（0.4 待定） | server 是 join 查询，恢复后自然显示回内容，无需额外前端处理；仅需 feature 用例覆盖「占位 → 恢复」                      |
| T8  | 画布列表分组 / 筛选（0.2 结构问题 1） | v1 不做，记演进项（列表多时再议）                                                                                      |
| T9  | 工具栏工具集（M2-1 极简）             | v1 仅：标题编辑 / 理解库 / 文本 / 矩形 / 圆形 / 组；选择 / 连线等工具不占工具栏（连线从元素把手直接拉出）              |

---

## 6. 与现有 wireframe 的关系

- wireframe（`modules/canvas/wireframe/`）是**形态验证**，不是实现起点：数据层（Phase 0）与渲染层（Phase 1）落地后整体删除。
- 可迁移进正式实现：`canvas-geometry.ts`（视口 / fit / 锚点数学）、手势隔离方案（`closest("button")` + pointer capture）、chrome 组件形态（ZoomControls / Minimap / SearchOverlay 的 DOM 骨架）、右侧单面板两态切换骨架。
- 画布理解卡在 wireframe 里复用 Capture 卡，**实现期替换为 T4 的 `CanvasUnderstandingCard`**（全文 / 无元数据 / 占位 / 锁定），这是 wireframe 与实现的已知差异。

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
