# v2.0.0 理解画布前端实现设计

> 日期：2026-08-15
>
> 状态：Skeleton（骨架文档，待前端设计步骤填充；当前仅承接共识待办）
>
> 职责：定义理解画布模块的前端实现设计——渲染层（X6 集成）、只读画布渲染器（三用）、Agent 协作前端（draft 块 / 引用 Modal / artifact panel）、模块组件结构
>
> 前置：PRD、服务端设计（接口契约）、UI/UX 设计（交互形态）、共识记录

## 待办（承接共识，Frontend 归口）

> 以下为共识文档标记归口本层的待办；本文档步骤内解决并展开为具体设计。

### F1 只读画布渲染器（C15 / M8-5 / M8-6，需调研）

- **来源**：C15 画布展示 tool；M8-5 draft-preview；M8-6 引用 Modal。
- **已定约束**：**一个组件三个用途**——`[[cv:]]` 引用只读 Modal、sketch / draft 提案预览、对话内 draft 内联块，共用同一个只读 canvas renderer；渲染结构化画布数据（CanvasDocument 形状：元素 / 连线 / 分组），纯展示不写入。
- **待调研**：代码库**无 preview tool 先例**；参考 mermaid「文本块 → 渲染」模式，确定 Agent 输出结构化数据的序列化契约（与服务端 §6.2 preview tool 数据契约对齐）与前端渲染实现。
- **待设计**：只读渲染的交互（缩放 / 查看 / 无编辑）、与 X6 的关系（复用 X6 `interacting: false` 或独立轻量渲染）。

### F2 X6 集成要点（承接 spike 结论，实现时落地）

- **来源**：C11 技术选型 + spike 验证（14/14 + 9/9 + minimap）。
- **已定实现要点**：
  - 运行时依赖 `tslib` 需加入 `packages/ui`；
  - 插件全在核心包（Dnd / Snapline / Selection / Keyboard / History / MiniMap），History 需 `graph.use(new History({ enabled: true }))`；
  - `dnd.start()` 传节点实例；embedding 用 `addTo`（`setParent` 只设单向）；交互拖组子元素自动跟随；
  - CAD 框选需自定义 marquee（`getNodesInArea(rect, { strict })` 按拖拽方向切换）；
  - 连线样式映射（routing → connector/router，线型 → strokeDasharray，箭头 → targetMarker）。
- **待设计**：CanvasGraph 组件（X6 生命周期封装 + 语义事件桥）、shapes（理解卡 / 文本卡 / 组 / 画布引用 / 图形）、Storybook Showcase。

### F3 模块组件结构（模块一~八的前端承载）

- **待设计**：画布列表、工作区（工具栏 / 左下控制 / minimap / 搜索）、单面板（库 / 详情）、draft 内联块、引用 Modal、artifact panel 的组件拆分与状态架构（react-query + zustand + X6 分层）。

## 关联文档

- PRD：`understanding-canvas-prd.md`（模块二、五、六、八）
- 服务端设计：`understanding-canvas-server-design.md`（§6.2 preview tool 数据契约）
- UI/UX 设计：`understanding-canvas-ui-ux-design.md`
- 共识记录：`understanding-canvas-consensus.md`（C11 / C15）
