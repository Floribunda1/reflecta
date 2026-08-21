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

1. **平移 vs 框选**：X6 默认 `panning` 用左键拖动平移，会吞掉左键框选。
   为恢复「左键=框选、中键/滚轮=平移」（对应旧 `selectionOnDrag` + `panOnDrag=[1]`），
   Graph 需配 `panning: { enabled: true, eventTypes: ["middleMouseDown"] }` + Selection `rubberband:true`。
   ——否则 `boxSelect` 类用例（打组）会失败。这是迁移引入的配置缺口，需在 adapter 修正。
2. **节点可定位**：见 §3，需补 `data-node-id`。
3. **解组热键已删**：任何 `Meta+g`/`Meta+Shift+g` 用例改为「选区工具条打组按钮」/「组右键解组」。旧 `canvas-group-semantics` 中热键用例作废重写。

## 7. 断言原则

- 几何断言用 `.x6-node/.x6-edge` 的 `boundingBox()`（真实 DOM 尺寸），不用像素魔法数。
- 业务语义（打组不跳位、级联删边）走产品结果断言；X6 内置行为（吸附、对齐线）不逐条抄成产品用例。
- 一个 capability 一个主断言，不重复统计；N 元交互序列不在此保证。

## 8. 需要重写的 spec 清单

旧 RF 场景 → 新 X6 断言/入口：

| spec                                    | 变更点                                                         |
| --------------------------------------- | -------------------------------------------------------------- |
| `canvas-group-semantics`                | 删 `Meta+g/Shift+g` 用例；打组走选区工具条/组右键              |
| `canvas-node-customization`             | 定位改 `data-node-id`；resize 断言改 Transform 句柄尺寸        |
| `canvas-edge-*` / `canvas-edge-toolbar` | 连线桩改 `[magnet="true"]`；工具栏改底部 `canvas-edge-toolbar` |
| `canvas-selection-toolbar`              | 多选入口不变（已保留 `canvas-selection-toolbar`）              |
| `canvas-viewport-configuration`         | 视口断言改 `.x6-graph-svg[transform]`                          |
| `canvas-export`                         | 导出引擎换 X6 `Export` 插件                                    |
| `canvas-readonly`                       | 禁交互断言改 X6 `interacting`/无插件                           |
