# v2.0.0 理解画布 UI/UX 设计

> 日期：2026-08-15
>
> 状态：Skeleton（骨架文档，待 UI/UX 设计步骤填充；当前仅承接共识待办）
>
> 职责：定义理解画布模块与 Agent 协作的 UX / UI 形态（画布工作区、单面板、draft-preview 内联块、artifact panel、就地 Chat 等交互与视觉）
>
> 前置：PRD（产品要求）、服务端设计（接口契约）、共识记录（决策依据）

## 待办（承接共识，UI/UX 归口）

> 以下为共识文档标记归口本层的待办；本文档步骤内解决并展开为具体设计。

### U1 Inline Widget 机制（消息内联富组件，头号待办）

- **来源**：C15 画布展示 tool 的渲染形态讨论——用户明确要"Inline Widget 的感觉（如天气卡片）"，非代码块转渲染。
- **已定约束**：
  - 消息 part / 工具结果携带 `widgetType` + 结构化 payload；聊天渲染器按 **widget 注册表**（`{ widgetType → React 渲染器 }`）路由到自定义富组件；
  - 这是**聊天渲染基建**（不仅画布——天气卡、理解卡等任何工具可用），非画布专属；
  - 首个 widget：`canvas-draft`（画布草稿预览，只读画布卡，三用组件之一）；
  - 数据契约见 Server 文档 §6.2（CanvasDocument payload）。
- **待设计**：注册表的形态与扩展方式（新增 widget 的成本）、widget 的布局 / 密度 / 与消息流其它元素的层级、加载 / 失败 / 流式状态、是否支持交互（如画布 widget 内的"应用 / 修改 / 拒绝"）。
- **待调研**：现有聊天渲染器（agent-turn-view / AgentToolActivityView）改造点；Generative UI 模式（Vercel AI SDK genUI、Anthropic show_widget）的可借鉴形态。

### U2 artifact panel 的 UX/UI 形态（C14，待调研）

- **来源**：C14 成果可见性。
- **已定约束**：只聚合本对话**已落地**的产出（approve 并保存的 understanding / 新建 context / sketch 应用后的 canvas）；pending 提案留在消息流，panel 只显示已落地；随 v1 发布。
- **待设计**：面板形态（侧栏 / 底部 / 折叠）、列表内容与排序、点击跳转行为、与消息流 proposal 卡的视觉区分。
- **待调研**：同类产品（对话产出聚合）的 UX 先例。

### U3 画布侧就地 Chat 的 UX（C7 入口二，v1.x）

- **来源**：C7 协作主张「两种协作入口并存」——画布侧就地协作：画布里打开 Chat 侧边栏，AI 以当前画布为作用域，边看画布边聊边组织。
- **已定约束**：与全局 Chat 形态同构；AI 自动读当前画布（scope 注入，无需手动贴 id）。
- **待设计**：侧边栏形态、与右侧单面板（库/详情）的关系、选中元素与对话的联动。
- **版本**：v1.x（v1 只保证对话侧沉淀入口）。

### U4 沉淀入口的 UX（对话 → 画布）

- **来源**：C7 协作主张「对话侧沉淀」+ C14 成果可见性。
- **已定约束**：对话中形成的结构可一键沉淀为画布（或更新画布）；低摩擦（不是用户主动想起来"画个图"）。
- **待设计**：入口位置与触发时机、与 M8-5 draft-preview 的关系（沉淀 = draft 应用？）。

### U5 draft-preview 内联块的 UX（M8-5 / C15，并入 U1 widget 机制）

- **来源**：C15 画布展示 tool。
- **已定约束**：Agent 消息内联渲染只读小画布（mermaid 式），用户在此诊断后「应用 / 修改 / 拒绝」。
- **待设计**：内联块的形态（大小 / 缩放 / 展开）、「应用 / 修改 / 拒绝」交互、与应用后反馈。

### U6 其他待 UI/UX 步骤检视的已定项

- M6-6 画布归属在理解详情的展示与跳转（已定跳转画布模块打开编辑模式）。
- M8-6 引用 `[[cv:]]` 的只读 Modal 形态（与 draft-preview 共用渲染组件）。
- 理解列表「N 条引用」文案（TBD-3 修正，已定）。

## 关联文档

- PRD：`understanding-canvas-prd.md`（模块二、五、六、八）
- 服务端设计：`understanding-canvas-server-design.md`
- 共识记录：`understanding-canvas-consensus.md`（C7 / C14 / C15）
