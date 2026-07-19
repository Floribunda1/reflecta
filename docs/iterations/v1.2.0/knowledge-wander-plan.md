# v1.2.0 知识漫步改版计划

> 日期：2026-07-20
>
> 状态：Implemented
>
> 范围：删除首版瀑布流与全局图谱，在干净的 Capture 基础上重建连续阅读页
>
> 产品依据：[知识漫步价值主张](knowledge-wander-value-proposition.md)
>
> UI 依据：[知识漫步连续阅读页 UI Spec](design/knowledge-wander-ui-spec.md)

## 1. 改版结论

知识漫步不再提供瀑布流和全局图谱。用户选择 Domain 后，右侧只展示一张从上到下连续排列的阅读页：每条 Understanding 同时呈现标题、完整正文、更新时间、Context 数量和 Connection 数量。

阅读页通过普通滚动同时支持慢读与快扫。用户点击某条 Understanding 时，右侧复用现有 UnderstandingDetail 进入编辑和 Context；关闭详情后仍停留在原阅读位置。

这一版不设计成就感，不显示完成率、阅读进度、连续天数、掌握度或回顾任务。正向反馈只来自重新看见、想起和说清楚用户自己的内容。

## 2. 删除首版实现

在实现新版之前完整删除：

- `capture/knowledge-wander/` 下现有瀑布流、G6 图谱、Graph adapter、专用 Markdown renderer 和样式。
- Capture store 中的 `wanderView` 与 `setWanderView`。
- 瀑布流/图谱 E2E 场景及其实现细节测试。
- `@antv/g6` 与 `masonic` 依赖。

删除后先恢复一个不包含知识漫步的可构建 Capture 基线，确认不存在旧组件、旧 test id、旧依赖或隐藏入口，再开始新版实现。

## 3. 新版范围

### 包含

- Capture 领域栏底部保留「知识漫步」入口。
- 知识漫步沿用当前 Domain；父领域包含子领域；全部领域显示全部 Understanding。
- 单一连续阅读页展示完整 Understanding，不截断、不总结。
- 全部领域范围显示每条 Understanding 的 Domain path。
- 每条内容显示更新时间、Context 数量和 Connection 数量。
- 使用现有 MarkdownPreview 渲染正文。
- 使用项目已有 TanStack Virtual 只挂载 viewport 邻近内容。
- 点击内容打开现有 UnderstandingDetail 侧栏。
- 打开和关闭详情保持阅读位置。
- 旧 `/contemplate` 继续重定向 Capture；顶层菜单只保留 Capture 与 Agent。

### 不包含

- 瀑布流、卡片网格或多列排布。
- 全局图谱、局部图谱或任何布局引擎。
- 逐条/滚动视图切换。
- 随机、AI 推荐、AI 摘要或自动阅读路径。
- 上次阅读进度、已读状态、完成率、连续天数或掌握度。
- 新的 Markdown parser、renderer、样式表或阅读器依赖。
- 新建、搜索、筛选、排序或批量操作。

## 4. 技术结构

```text
capture/
├── index.tsx
├── store.ts
├── domain/components/DomainTree.tsx
└── knowledge-wander/
    └── index.tsx
```

`knowledge-wander/index.tsx` 直接组合：

- `useCaptureUnderstandingList`
- `sortUnderstandingSummaries`
- `MarkdownPreview`
- `UnderstandingDetail`
- `@tanstack/react-virtual`
- Capture store 中既有的 Domain / Understanding selection

不新增 adapter、view model、专用 hook 或样式文件。只有当稳定业务规则无法被现有查询和排序覆盖时，才新增纯函数。

## 5. 实施顺序

### Task 1：冻结新版 UI 决策

- 用当前价值主张重写 UI spec。
- 确认连续阅读页是唯一主视图。
- 明确图谱、Masonry、进度激励和专用 Markdown renderer 全部退出范围。

### Task 2：清空首版实现

- 删除现有 knowledge-wander 模块、入口、mode/view state 与测试。
- 删除 `@antv/g6`、`masonic` 并更新 lockfile。
- 运行 renderer tests、typecheck 和 build，证明 Capture 基线独立成立。
- 以单独 commit 保存删除后的干净基线。

### Task 3：重建连续阅读页

- 恢复 Capture 会话级 browse / wander mode 和 DomainTree 入口。
- 获取当前领域及子领域的 Understanding，并沿用 Capture 排序偏好。
- 用 TanStack Virtual 渲染单列 ReadingSection。
- 用现有 MarkdownPreview 展示完整正文。
- 复用 UnderstandingDetail 与 resizable panel。

### Task 4：定义并自动化用户场景

- 重写 `knowledge-wander.feature`，只描述连续阅读和深入详情。
- E2E 验证完整正文、领域范围、内容 meta、详情打开与位置保持。
- store unit test 只保留 browse / wander mode 的稳定状态规则。

### Task 5：视觉与工程验证

- 使用真实 Electron 窗口检查全部领域、短领域、长正文、空正文和详情打开状态。
- 检查宽窗口与详情压缩后的单列布局。
- 运行 renderer tests、typecheck、lint、format、build 和知识漫步 E2E。

## 6. 验收标准

- 代码和依赖中不存在 G6、Masonic、Graph data、Waterfall 或知识漫步专用 Markdown renderer。
- 知识漫步只有一个连续阅读视图，没有视图切换控件。
- 页面按当前领域范围稳定展示全部完整 Understanding。
- 每条 Understanding 清楚展示标题、正文、更新时间、Context 数量和 Connection 数量。
- 正文复用现有 MarkdownPreview，仓库没有第二套知识漫步 Markdown 样式。
- 大量 Understanding 通过 TanStack Virtual 渲染，不一次挂载全部 Milkdown preview。
- 点击某条内容打开既有 UnderstandingDetail；关闭详情后保持原滚动位置。
- 页面没有完成、掌握、已读、连续天数或其他成就表达。
- 顶层仍只有 Capture 与 Agent；旧 Contemplate 地址安全回到 Capture。
- renderer tests、typecheck、lint、format、build 和知识漫步 E2E 通过。
