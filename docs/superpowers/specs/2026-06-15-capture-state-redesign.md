# Capture 模块状态管理重设计

## 背景

`capture` 模块目前的状态管理把几类不同性质的状态混在一起：

- React Query 既保存服务端数据，又被组件和 mutation hook 手动 patch 成 UI 草稿。
- Jotai atom 同时承载页面选择、持久化偏好、跨组件协作状态。
- `ThoughtDetail` 内部有本地 draft state，再通过 effect 从 query data 同步。
- 自动保存、列表 preview 更新、详情更新、列表排序稳定性靠多个局部 workaround 互相补偿。

这些边界混乱导致两个直接问题：

- 编辑笔记时左侧列表会因为 `updatedAt` 和 cache patch 产生视觉跳动。
- preview 可能被旧的保存响应回写成旧内容，再被新响应改回来。

这次重设计不保留现有 state management 结构。目标是重新定义状态归属，让组件只面对清晰的 domain API。

## 目标

1. 明确区分 server state 和 client state。
2. 用 Zustand 管理 `capture` 页面交互状态和编辑会话状态。
3. 用 React Query 作为唯一已保存数据缓存。
4. 删除分散的 query cache patch、effect 同步 draft、列表稳定排序 workaround。
5. 减少重渲染：组件通过 Zustand selector 订阅小 slice，不使用普通大 Context。
6. 保持用户选择的行为：左侧列表 preview 只展示已保存版本，不展示未保存草稿。

## 非目标

- 不重写 Electron IPC 或服务端 thought/category/context domain。
- 不引入路由 URL 状态。
- 不实现多人协作、冲突合并或离线编辑队列。
- 不把所有 React Query 数据搬到 Zustand。
- 不改 UI 布局和视觉设计，除非状态边界需要少量结构调整。

## 技术选型

采用 **Zustand + React Query**。

React Query 负责：

- `category.listCategories`
- `thought.listThoughts`
- `thought.getThoughtById`
- context/thought/category mutation 后的 query invalidation
- 已保存数据的 loading/error 状态

Zustand 负责：

- 页面 UI/session 状态
- 当前编辑 draft
- 自动保存状态
- 选择状态和 category tree 展开状态
- 组件事件 action

不使用普通 React Context 作为主状态容器，因为它会让消费者默认订阅整个 value，容易造成粗粒度重渲染。Zustand selector 可以让组件只订阅 primitive 或小对象 slice。

## 状态归属

### Server State

Server state 是数据库中已经保存的数据。它只存在于 React Query cache 中。

包括：

- category list
- category tree 的输入数据
- thought summaries
- thought detail
- thought contexts
- thought connections / referencedBy

规则：

- Query hook 只 fetch 和返回数据，不读取 Zustand UI 状态以外的草稿。
- Mutation 成功后使用明确的 invalidation。
- 不再用 `setQueryData` 把未保存草稿写入 list/detail cache。
- 不再用 query cache 承载 saving/error/draft 状态。

### Client State

Client state 是当前页面交互状态。它只存在于 Zustand store 中。

包括：

- `selectedCategoryId`
- `selectedThoughtId`
- `searchOpen`
- `searchQuery`
- `includeDescendants`
- `expandedCategoryIds`
- `activeSourceId`
- 当前 thought draft
- 当前 thought save status

持久化规则：

- 持久化 `selectedCategoryId`。
- 持久化 `includeDescendants`。
- 持久化 `expandedCategoryIds`。
- 不持久化 `selectedThoughtId`，避免恢复到已删除或过滤条件下不可见的 thought。
- 不持久化 draft，避免启动后展示过期未保存内容。
- 不持久化 `searchQuery` 和 `searchOpen`。

## Zustand Store 设计

文件：`apps/electron/src/renderer/src/modules/capture/store.ts`

核心类型：

```ts
type CaptureDraft = {
  thoughtId: string;
  title: string;
  body: string;
  baseTitle: string;
  baseBody: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  lastSavedAt: string | null;
};

type CaptureState = {
  selectedCategoryId: string;
  selectedThoughtId: string | null;
  searchOpen: boolean;
  searchQuery: string;
  includeDescendants: boolean;
  expandedCategoryIds: Record<string, boolean>;
  activeSourceId: string | null;
  draft: CaptureDraft | null;
};
```

核心 actions：

```ts
type CaptureActions = {
  selectCategory: (categoryId: string) => void;
  selectThought: (thoughtId: string | null) => void;
  selectThoughtFromSearch: (input: { thoughtId: string; categoryIds?: string[] }) => void;
  reconcileSelectedThought: (visibleThoughtIds: Set<string>) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setIncludeDescendants: (include: boolean) => void;
  toggleCategoryExpanded: (categoryId: string) => void;
  reconcileExpandedCategories: (validIds: Set<string>) => void;
  expandCategoryAncestors: (categoryIds: string[]) => void;
  setActiveSourceId: (sourceId: string | null) => void;
  initializeDraft: (input: { thoughtId: string; title: string; body: string }) => void;
  updateDraftTitle: (title: string) => void;
  updateDraftBody: (body: string) => void;
  markDraftSaveStarted: (thoughtId: string) => void;
  markDraftSaveSucceeded: (input: {
    thoughtId: string;
    title: string;
    body: string;
    savedAt: string;
  }) => void;
  markDraftSaveFailed: (input: { thoughtId: string; error: string }) => void;
  resetAfterThoughtDeleted: (thoughtId: string) => void;
  resetAfterCategoryDeleted: (deletedCategoryIds: Set<string>) => void;
};
```

Store action 规则：

- `selectCategory` 设置 category，并清空 selected thought、active source、draft。
- `selectThought` 设置 thought，并清空 active source。draft 是否初始化由 detail query 成功后显式调用 `initializeDraft`。
- `reconcileSelectedThought` 在列表数据变化后运行；如果当前 selected thought 不在可见列表中，清空 selected thought、active source、draft。
- `initializeDraft` 只在 thought id 变化或没有 dirty draft 时从已保存数据初始化。
- 如果当前 draft 已 dirty，重复的 query refetch 不覆盖用户正在编辑的 draft。
- `markDraftSaveSucceeded` 更新 base values，清除 dirty/error/saving。
- `markDraftSaveFailed` 保留 draft 内容，只记录 error。

## Query 和 Mutation 边界

文件：`apps/electron/src/renderer/src/modules/capture/queries.ts`

职责：

- 定义 capture query keys。
- 提供 category/thought/detail query hooks。
- 提供 mutation hooks。
- mutation hooks 只调用 IPC 和 invalidate query。

示例结构：

```ts
export const captureQueryKeys = {
  categories: ["category.listCategories"] as const,
  thoughtList: (filter: ThoughtListFilterKey) => ["thought.listThoughts", filter] as const,
  thoughtListTotal: (filter: ThoughtListTotalKey) =>
    ["thought.listThoughts.total", filter] as const,
  thoughtDetail: (thoughtId: string) => ["thought.getThoughtById", thoughtId] as const,
};
```

Mutation invalidation 规则：

- 更新 thought title/body/category 后 invalidate:
  - 当前 thought detail
  - thought list queries
  - related thought detail queries when body changes, because wiki links can affect connections
- 创建或删除 thought 后 invalidate thought list totals and lists。
- 创建、更新、删除 category 后 invalidate categories and thought lists。
- 更新 context 后 invalidate current thought detail。只有影响 summary count 的 create/delete context 才 invalidate thought lists。

## 自动保存设计

文件：`apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.ts`

职责：

- 订阅当前 draft 的 `thoughtId/title/body/dirty`。
- debounce 350ms 后保存当前 snapshot。
- 同一个 thought 的保存请求串行执行。
- 旧 snapshot 的成功结果不得覆盖新 draft。
- 保存成功后只更新 Zustand draft status，并 invalidate React Query。
- 不向 thought list cache 写入草稿。

保存流程：

```text
用户输入
  -> updateDraftTitle/updateDraftBody
  -> draft.dirty = true
  -> autosave 获取 snapshot
  -> markDraftSaveStarted
  -> ipcClient.thought.updateThought(snapshot)
  -> success: markDraftSaveSucceeded + invalidate queries
  -> failure: markDraftSaveFailed
```

列表 preview 行为：

- `ThoughtList` 只使用 React Query 返回的 `ThoughtSummaryDTO.body/title/updatedAt`。
- 用户输入后列表不变。
- 自动保存成功并 refetch 后列表更新。

## 组件职责

### CapturePage

职责：

- 布局组合。
- 安装 global search event bridge。
- 通过 store action 处理搜索选择。

不做：

- 不直接调用多个 setter 组合状态。
- 不 fetch thought detail 来修补 category，除非 search event 没带 categoryIds。即便需要 fetch，也通过 action 完成最终 selection transition。

### CategoryTree

职责：

- 读取 category query。
- 读取 store 中的 selected category 和 expanded ids。
- 调用 store actions 选择、展开、收起。
- 调用 category mutation hooks 创建、更新、删除 category。

不做：

- 不直接管理 selected thought。
- 不用 effect 保存 derived state。

必要 effects：

- categories 变化后 reconcile expanded ids。
- selected category 变化后展开祖先节点。

这两个 effect 是外部数据变化导致的 UI reconciliation，不是 derived state 存储。

### ThoughtList

职责：

- 读取 store 中的 list filter 和 selected thought。
- 调用 thought list query。
- 渲染已保存 summary。
- 列表数据变化后调用 `reconcileSelectedThought`，确保 selected thought 仍然可见。

不做：

- 不维护 previous order ref。
- 不读取 detail draft。
- 不 patch query cache。
- 不自动选择第一条 thought。

排序规则：

- 默认遵循服务端 list order。
- 编辑当前 thought 不再改变列表，直到保存成功并 refetch。
- 如果保存成功后 `updatedAt` 使服务端排序变化，这是已保存数据导致的真实变化，可以接受。

选择规则：

- 用户点击 thought row 时选择该 thought。
- 搜索选择 thought 时选择该 thought，并切换到对应 category。
- 新建 thought 成功后选择新 thought。
- 切换 category 时清空 selected thought。
- 当前 selected thought 不在当前列表结果中时清空 selected thought。
- 列表加载完成后不自动选择第一条 thought。

### ThoughtDetail

职责：

- 根据 selected thought id 读取 thought detail query。
- query 成功后初始化 draft。
- 输入框和 MarkdownEditor 只绑定 draft。
- 显示 saving/error 状态。
- 调用 autosave hook。
- context source overlay 使用 store 的 `activeSourceId`。

不做：

- 不用 `useEffect(() => setTitle(thought.title), ...)` 同步本地 state。
- 不维护单独的 `title/body` useState。
- 不把 draft 写入 React Query list cache。

## 错误处理

保存失败：

- detail 中保留用户 draft。
- store 记录 `draft.error`。
- UI 显示简短错误状态。
- 下一次编辑或显式 retry 可以再次触发 autosave。

删除当前 thought：

- mutation 成功后 store 清空 selected thought、active source、draft。
- invalidate thought list/detail。

删除当前 category 或其 ancestor：

- store 切回 `selectedCategoryId = "all"`。
- 清空 selected thought、active source、draft。
- reconcile expanded ids。

## 性能策略

- 组件使用 Zustand selector 订阅小 slice。
- selector 返回 primitive 或稳定 action，避免返回每次新建的大对象。
- 需要多个字段时优先拆成多个 selector；如果必须返回对象，使用 shallow compare。
- React Query hooks 只放在需要 server data 的组件或 domain hooks 中。
- 不使用普通 Context 包裹整个 capture state。
- 不用 effect 存储可从当前 props/state 计算出的 derived state。

## 文件结构

新增：

- `apps/electron/src/renderer/src/modules/capture/store.ts`
- `apps/electron/src/renderer/src/modules/capture/queries.ts`
- `apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.ts`
- `apps/electron/src/renderer/src/modules/capture/store.test.ts`
- `apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.test.ts`

修改：

- `apps/electron/src/renderer/src/modules/capture/index.tsx`
- `apps/electron/src/renderer/src/modules/capture/state.ts`
- `apps/electron/src/renderer/src/modules/capture/category/hooks.ts`
- `apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/hooks.ts`
- `apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-detail/hooks.ts`
- `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`

最终删除或清空：

- `apps/electron/src/renderer/src/modules/capture/state.ts` 中的 Jotai atoms。
- `thought-list/hooks.ts` 中的 stable order workaround。
- `thought-detail/hooks.ts` 中的 query cache patch helper 和 latest-only runner。

## 迁移顺序

1. 引入 Zustand 依赖。
2. 新建 `capture/store.ts`，用单元测试覆盖 selection、expanded ids、draft lifecycle。
3. 新建 `capture/queries.ts`，集中 query key 和 invalidation。
4. 改 `CapturePage`、`CategoryTree`、`ThoughtList` 使用 Zustand store。
5. 改 `ThoughtDetail` 使用 draft store，不再维护 title/body local state。
6. 新建 autosave hook，接入 detail。
7. 删除 Jotai capture state 和旧 workaround。
8. 跑 focused tests、typecheck，并手动验证选择、编辑、保存、删除四条 capture 主路径。

## 测试计划

Store 单元测试：

- 选择 category 会清空 thought、active source、draft。
- 选择 thought 会清空 active source。
- 当前 selected thought 不在 visible ids 中时清空 selection。
- 初始化 draft 不覆盖 dirty draft。
- 更新 draft 设置 dirty。
- save success 更新 base values 并清除 dirty/error/saving。
- save failed 保留 draft 并记录 error。
- 删除当前 thought 清空相关状态。
- 删除当前 category subtree 时回到 all。

Autosave 测试：

- dirty draft debounce 后调用 updateThought。
- 快速连续输入只保存最新 snapshot。
- 旧保存成功不覆盖新 draft。
- 保存失败保留 draft。
- 保存成功触发 query invalidation。

组件/集成测试：

- ThoughtList preview 不随 draft 输入变化。
- 保存成功并 refetch 后 ThoughtList preview 更新。
- 切换 category 后 selected thought 清空。
- 删除 category 后 selection 状态正确恢复。

验证命令：

```bash
cd apps/electron
bun run test src/modules/capture/store.test.ts src/modules/capture/useThoughtDraftAutosave.test.ts --run
bun run typecheck:web
```

## 成功标准

- `capture` 模块中没有 Jotai capture atoms。
- 列表 preview 只来自已保存 query data。
- detail draft 只存在于 Zustand。
- mutation hooks 不再把未保存草稿写入 query cache。
- 组件不再通过多个 setter 手动拼 transition。
- focused tests 通过。
- `typecheck:web` 通过。
