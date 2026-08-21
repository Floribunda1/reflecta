# Canvas 集成测试定义（X6 架构）

> 适用：`apps/electron/e2e/integration/canvas/`
> 引擎基准：`@antv/x6@3.1.8` + `@antv/x6-react-shape`（已替换 React Flow）
> 配套：`apps/electron/e2e/README.md`（整体 E2E 三套件约定）、`docs/iterations/v2.0.0/canvas-frontend/x6-integration-principles.md`

## 1. 本套件的定位

`integration` 是独立 Playwright 项目（`playwright.config.ts` → `testDir ./e2e/integration`），
只测**画布自身的引擎定制逻辑**（自定义节点/边/组/配置差异），**不挂 Feature ID**（不被
`feature:check` 拦），也**不归 regression 的技术风险门禁**。

运行：`bun run test:e2e:integration`。

## 2. test case 骨架（不变）

```ts
import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { nodeInGraph, edgesInGraph, boxSelect, connectOutToIn, … } from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const FIXTURE = { id: "canvas", title: "CANVAS", elements: [...], edges: [...] } as const;

test("打组后成员位置不跳变且被组包围", async () => {
  seedCanvas(FIXTURE);
  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "CANVAS");
    // 交互 → 断言
  } finally { await app.close(); }
});
```

骨架与旧 RF 版一致，变化全在**「如何定位 / 如何交互」**这两层（见 §3、§4）。

## 3. X6 的 DOM 定位模型（这是与 RF 最大的差异）

X6 渲染到容器内的 SVG/HTML 结构，类名是 `x6-*` 前缀：

| 目标            | X6 选择器                                     | 说明                                             |
| --------------- | --------------------------------------------- | ------------------------------------------------ |
| 图容器/视口     | `.x6-graph`、`.x6-graph-svg`                  | 平移/缩放/尺寸断言                               |
| 节点视图        | `.x6-node`                                    | 每个节点一个 `<g>`                               |
| 边视图          | `.x6-edge`                                    | 含 `.connection`、`.connection-wrap`             |
| 连线路径        | `.x6-edge .connection`                        | 样式/可见性断言（替代 `.react-flow__edge-path`） |
| 磁吸点（ports） | `.x6-node [magnet="true"]`                    | 出/入连接点                                      |
| 节点缩放句柄    | `.x6-node .tool-*`（Transform 插件）          | 尺寸断言选 `.x6-edge`/`.x6-node` bbox            |
| 选中态          | `.x6-node.x6-node-selected`（Selection 插件） | 替代 RF 的 `.selected`                           |

**节点身份**：X6 默认不在 DOM 上暴露 cell id，因此统一约定：
每个 react-shape 卡片根元素同时带 `data-node-id={element.id}`（与其余 `data-testid`/
`data-*` 并存）。测试按 `data-node-id` 定位具体节点：

```ts
const nodeInGraph = (page: Page, id: string) =>
  page.getByTestId("canvas-graph").locator(`.x6-node[data-node-id="${id}"]`);
```

> 现状：卡片已带 `canvas-*-card` data-testid 与部分 data 属性，但**尚未统一挂
> `data-node-id`**。重写 helper 前先给四类卡片根元素补 `data-node-id`。

**边身份**：同理由边数据定位，建议 `data-edge-id`（或在 `.x6-edge` 上加 data 属性）。

## 4. helper 重写对照（canvas-integration.ts）

| helper         | RF 版（弃）                                    | X6 版                                                                                              |
| -------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 打开 seed 画布 | `openSeededCanvas`                             | 不变（走 acceptance `canvas-e2e`）                                                                 |
| 定位节点       | `.react-flow__node[data-id]`                   | `.x6-node[data-node-id="id"]`                                                                      |
| 边             | `.react-flow__edge` / `.react-flow__edge-path` | `.x6-edge` / `.x6-edge .connection`                                                                |
| 视口           | `.react-flow__viewport[style]`                 | `.x6-graph-svg[transform]`（或读 graph 实例）                                                      |
| 连线           | `.react-flow__handle.source/.target` drag      | `source .x6-node[data-node-id="a"] [magnet="true"]` → target                                       |
| 打组触发       | `Meta+g` 热键                                  | **页面按钮/右键**（热键已删）：选区工具条 `canvas-selection-group-button`、组右键 `canvas-group-*` |
| 框选           | `boxSelectNodes` + `selectionOnDrag`           | 依赖 Selection 插件 rubberband（见 §6 配置要求）                                                   |
| 选边           | `.x6-edge` 点击 + `canvas-edge-toolbar`        | 选中边 → 底部 `canvas-edge-toolbar` 断言样式/标签                                                  |

## 5. 交互范式（X6 语义）

- **选中/多选**：单击选中；`Selection` 插件支持 rubberband + 多选。多选后顶部出
  `canvas-selection-toolbar`（打组/删除）。
- **连线**：从一个节点的出桩（`[magnet="true"].x6-port`）拖到另一节点入桩；`connecting.snap`
  自动吸附。自环与平行边默认允许（`allowLoop/allowMulti`）。
- **打组/解组/删组**：全部走**页面入口**（不复用热键）。`groupElements/ungroupGroups/
deleteGroupBranch` 是纯文档变换，其单元行为由 `graph-operations.test.ts` 覆盖；E2E 只验
  「画布位置不跳变、组包围成员、级联删边」等真实渲染结果。
- **边样式/标签**：选中边 → 底部 `canvas-edge-toolbar`（`canvas-edge-label` +
  形状/线型/线宽/箭头菜单）。
- **文本卡编辑**：双击进入内联 Markdown（卡片内 `canvas-text-card`），失焦提交。
- **组名编辑**：双击 `canvas-group-label` → `textbox[name="组名"]` → Enter 提交。
- **导出 PNG**：`canvas-export-png` → 断言触发了下载（X6 `Export` 插件）。
- **只读**：`CanvasReadOnlyView`（chat inspector 等）只留平移/缩放，禁拖/连/嵌/resize。

## 6. 配置前提（写测试前先在 adapter 对齐，否则用例红/假绿）

1. **平移 vs 框选（X6 内置，无需配中键）**：`panning` + `Selection rubberband` 组合下，左键拖拽 = 框选，**Space+拖拽 / 滚轮 = 平移**（见 `panning.js` `allowRubberband` 逻辑）。保持 `panning: { eventTypes: ["leftMouseDown"] }` + `rubberband:true`，勿配不存在的中键事件类型。
2. **拖拽入画布**：用 X6 `Dnd`（`handle.startDrag`）从工具栏文本按钮 / 理解库条目拖入；`getDropNode` + `createElementForDrop` 生成新元素，避免与源共用 id。
3. **节点可定位**：见 §3，需补 `data-node-id`。
4. **解组热键已删**：任何 `Meta+g`/`Meta+Shift+g` 用例改为「选区工具条打组按钮」/「组右键解组」。旧 `canvas-group-semantics` 中热键用例作废重写。

## 7. 断言原则

- 几何断言用 `.x6-node/.x6-edge` 的 `boundingBox()`（真实 DOM 尺寸），不用像素魔法数。
- 业务语义（打组不跳位、级联删边）走产品结果断言；X6 内置行为（吸附、对齐线）不逐条抄成产品用例。
- 一个 capability 一个主断言，不重复统计；N 元交互序列不在此保证。

## 8. 全部 test case（嵌套清单）

> 以下为 X6 架构下集成套件应覆盖的全部用例，按能力域嵌套组织。每叶为一条 `test()`。

### 8.1 节点（四类卡片）

- **文本卡**
  - 从工具栏「文本」按钮**拖拽入画布**创建文本卡（X6 `Dnd`）
  - 双击进入内联 Markdown 编辑
  - 失焦提交后卡片保留新内容，切走重进仍保留
  - Escape 取消不改动
  - 设置 / 清除卡片颜色
  - 从卡片操作菜单删除文本卡
  - 文本卡缩放（Transform 句柄）后尺寸持久化
- **理解卡**
  - 从理解库条目**拖拽入画布**创建理解卡（X6 `Dnd`）
  - 卡片展示引用理解全文
  - 引用理解被删除后显示占位
  - 点击卡片联动右侧理解详情面板
- **画布引用卡**
  - 通过「引用画布」选择器创建
  - 内嵌目标画布小型预览（只读复用）
  - 双击打开目标画布并跳转
  - 目标画布删除后显示占位、不可跳转
- **组**
  - 选区工具条「打组」按钮创建组
  - 打组后成员画布位置不跳变
  - 组包围全部选中成员
  - 组内再打组（嵌套组）
  - 组右键「解组」，成员回到上级位置
  - 组右键「删除组」，级联删除成员与关联边、组外保留
  - 双击组名改名，Enter 提交，重进保留
  - 子成员移动受组边界约束（extent）

### 8.2 连线（边）

- **创建**
  - 从出桩（`[magnet="true"]`×out）拖到入桩（in）建立有向边
  - 同源同目标可建立多条平行边（allowMulti）
  - 自环（source === target）
  - 新连线默认带 canvasId 与默认样式（createEdge 契约）
- **样式**
  - 选中边后：改颜色
  - 改 routing（曲线 / 直线 / 正交）
  - 改线型（实线 / 虚线 / 点线）
  - 改线宽（细 / 中 / 粗）
  - 改箭头（箭头 / 方块 / 无）
  - 样式保存后重进保留
- **标签**
  - 选中边后编辑标签，提交后重进保留
  - 清空标签回到无标签
- **删除**
  - 从边工具栏删除选中边

### 8.3 选择与选区

- 单击选中单个节点（出现选中态）
- 单击选中单条边（出现底部边工具栏）
- 多选（Shift/Ctrl + 点击，或 rubberband 框选）
- 空白处左键拖拽框选（rubberband）；Space+拖拽=平移
- 多选后顶部出现选区工具条（打组 / 删除）
- 单选不出现选区工具条
- 选中变化联动右侧面板（理解 → 详情）

### 8.4 视口 / 网格

- 中键 / 滚轮平移画布
- 滚轮缩放（以鼠标位置为中心）
- 左下缩放控件：放大 / 缩小 / 适应视图
- 节点拖动吸附到 10px 网格
- 无已存视口时初始 fitView
- 有已存视口时恢复（保存后重进不挪动）

### 8.5 只读（F1 三用）

- 只读禁用节点拖动 / 连线 / 打组 / 节点缩放
- 只读保留平移与缩放查看
- 引用 Modal / 提案预览 / artifact 缩略共用同一只读渲染

### 8.6 编辑辅助（内建插件接管）

- **History**
  - 撤销一次移动 / 删除
  - 重做
  - 打组 / 解组可撤销
- **Clipboard**
  - 复制粘贴节点
- **Snapline**
  - 拖动时对齐参考线出现（只验出现，不逐像素）
- **MiniMap**
  - `canvas-graph` 出现缩略图，可平移 / 缩放

### 8.7 导出

- 工具栏「导出 PNG」触发下载（X6 `Export` 插件）
- 导出包含全部节点、排除背景网格

### 8.8 搜索（⌘/Ctrl+F）

- 打开搜索浮层（输入框 / 编辑态内不触发）
- 命中文本卡内容 / 理解标题与正文 / 组名 / 画布引用标题 / 边标签
- 点选结果：定位并居中节点 / 边

### 8.9 持久化往返

- 节点位置 / 尺寸保存后重载一致
- 组 parentId 与子元素相对坐标保存后重载一致
- 平行边 / 自环保存后重载不去重、不丢
- 打组后保存，重进仍是组结构

## 9. 需要重写的 spec

旧 RF spec → X6 位置：`canvas-group-semantics`（删热键用例，改选区工具条 / 右键）、
`canvas-node-customization`（`data-node-id` + Transform resize）、`canvas-edge-*` /
`canvas-edge-toolbar`（`[magnet="true"]` 桩 + 底部 `canvas-edge-toolbar`）、
`canvas-selection-toolbar`（保留现有入口）、`canvas-viewport-configuration`
（`.x6-graph-svg[transform]`）、`canvas-export`（X6 `Export` 插件）、`canvas-readonly`
（X6 `interacting` / 无插件）。按 §8 逐叶重建。
