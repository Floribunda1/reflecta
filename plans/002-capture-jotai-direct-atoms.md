# Capture Jotai 直接订阅重构计划

> **给 agentic workers：** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐项执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪进度。

**目标：** 将 capture 的跨组件 UI 状态改为组件按需直接订阅 jotai atoms，避免 `Context + jotai` 双层包装造成的粗粒度重渲染。

**架构：** `state.ts` 只负责导出 atoms 和必要的派生 atoms；组件通过 `useAtomValue`、`useSetAtom`、`useAtom` 直接读取或写入自己需要的状态。删除 `CapturePageProvider`、`CapturePageContext`、`useCapturePageContext`，不再把多个 atoms 聚合成一个 Context value。

**技术栈：** React、jotai、jotai/utils、@tanstack/react-query、TypeScript。

---

## 背景

原计划 `001-capture-frontend-standard-alignment.md` 提到将 capture UI 状态迁移到 jotai，并允许短期保留 `useCapturePageContext()` 兼容 wrapper。这个方案可以降低迁移风险，但如果作为最终形态，会让组件继续通过一个聚合对象消费状态。

长期保留 `Context + jotai` 的问题：

1. Context value 聚合了 `selectedCategoryId`、`selectedThoughtId`、`expandedCategoryKeys` 和 setters。
2. 任一字段变化都会让依赖该 context hook 的 consumers 面临重渲染。
3. 组件无法只订阅自己真正需要的 atom。
4. 这抵消了 jotai 的主要收益：按 atom 细粒度订阅。

## 范围内文件

- `apps/electron/src/renderer/src/modules/capture/state.ts`
- `apps/electron/src/renderer/src/modules/capture/context.tsx`
- `apps/electron/src/renderer/src/modules/capture/index.tsx`
- `apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/ThoughtCard.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/context.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`

## 范围外事项

- 不重构 `CategoryProvider`、`ThoughtListProvider`、`ThoughtDetailProvider` 的请求数据职责，除非某个状态已经明确不属于请求数据。
- 不改变 localStorage key。
- 不改变用户可见交互行为。
- 不处理 shadcn select/menu、ahooks debounce、query churn 等问题；那些仍属于 `001` plan。

## Task 1：定义 Capture 状态 Atoms

**文件：**
- 新增或修改：`apps/electron/src/renderer/src/modules/capture/state.ts`

- [ ] 使用 `atomWithStorage` 定义 `selectedCategoryIdAtom`，key 为 `capture:selectedCategoryId`，默认值为 `"all"`。
- [ ] 使用 `atomWithStorage` 定义 `selectedThoughtIdAtom`，key 为 `capture:selectedThoughtId`，默认值为 `null`。
- [ ] 使用 `atomWithStorage` 定义 `expandedCategoryKeysAtom`，key 为 `capture:expandedCategoryKeys`，默认值为 `{}`。
- [ ] 如果需要复合操作，定义 write-only atom，例如 `selectCategoryAtom`，内部同时写入 `selectedCategoryIdAtom` 和 `selectedThoughtIdAtom`。
- [ ] 不导出聚合对象 atom，除非它是只读派生并且有明确消费者需要整体读取。

## Task 2：迁移 Page 层状态消费

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/index.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/context.tsx`

- [ ] 在 `CapturePageInner` 中用 `useAtomValue(selectedThoughtIdAtom)` 读取当前 thought。
- [ ] 用 `useSetAtom(selectedThoughtIdAtom)` 和 `useSetAtom(selectedCategoryIdAtom)` 处理搜索选中事件。
- [ ] 移除 `CapturePageProvider` 包裹。
- [ ] 删除 `context.tsx` 中的 `CapturePageContext`、`CapturePageProvider`、`useCapturePageContext`；如果需要保留文件，只从该文件 re-export atoms 或删除该文件并修正 imports。

## Task 3：迁移 CategoryTree 状态消费

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`

- [ ] 用 `useAtomValue(selectedCategoryIdAtom)` 替代 `capture.selectedCategoryId`。
- [ ] 用 `useSetAtom(selectedCategoryIdAtom)` 替代 `capture.setSelectedCategoryId`。
- [ ] 用 `useSetAtom(selectedThoughtIdAtom)` 替代 `capture.setSelectedThoughtId`。
- [ ] 用 `useAtom(expandedCategoryKeysAtom)` 读取和写入展开状态。
- [ ] 对展开状态写入使用 functional update，避免旧闭包覆盖快速交互后的新状态。
- [ ] 对只写 thought/category 的地方使用 `useSetAtom`，不要为了 setter 读取 atom value。

## Task 4：迁移 ThoughtList 状态消费

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-list/ThoughtCard.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-list/context.tsx`

- [ ] 在 list context 中用 `useAtomValue(selectedCategoryIdAtom)` 构造 query key 和 filter。
- [ ] 用 `useSetAtom(selectedThoughtIdAtom)` 创建或删除 thought 后更新选择状态。
- [ ] 在 `ThoughtList` 中用 `useAtomValue(selectedThoughtIdAtom)` 判断可见项，并用 `useSetAtom(selectedThoughtIdAtom)` 自动选择第一项。
- [ ] 在 `ThoughtCard` 中只读取 `selectedThoughtIdAtom`，点击时只写 `selectedThoughtIdAtom`。
- [ ] 避免 `ThoughtCard` 订阅 `selectedCategoryIdAtom` 或展开状态。

## Task 5：迁移 ThoughtDetail 状态消费

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`

- [ ] 用 `useSetAtom(selectedThoughtIdAtom)` 处理关系跳转时的 thought 选择。
- [ ] 用 `useSetAtom(selectedCategoryIdAtom)` 处理关系跳转时的分类选择。
- [ ] 如果只写状态，不要使用 `useAtom` 或 `useAtomValue`。
- [ ] 保持 `ThoughtDetailProvider thoughtId={props.thoughtId}` 的请求数据职责不变。

## Task 6：删除 Context 兼容层残留

**文件：**
- 修改或删除：`apps/electron/src/renderer/src/modules/capture/context.tsx`
- 修改：所有仍导入 `useCapturePageContext` 的文件

- [ ] 运行：

```bash
rg "useCapturePageContext|CapturePageProvider|CapturePageContext" apps/electron/src/renderer/src/modules/capture
```

- [ ] 期望：无匹配结果。
- [ ] 如果 `context.tsx` 已无职责，删除文件；如果保留 re-export，文件中不得创建 React Context。
- [ ] 运行：

```bash
rg "createContext|useContext" apps/electron/src/renderer/src/modules/capture/context.tsx
```

- [ ] 期望：无匹配结果，或文件不存在。

## Task 7：性能和行为验证

- [ ] 运行：

```bash
bun run --cwd apps/electron typecheck:web
```

- [ ] 如果仍遇到 `components/ui/calendar.tsx` 的 pre-existing typecheck 错误，记录但不修改 calendar。
- [ ] 运行：

```bash
bun run --cwd apps/electron lint
```

- [ ] 手动验证：
  - 切换分类时，分类树选中态和 thought list 同步。
  - 点击 thought card 时，只有当前选中 thought 改变，分类不被误改。
  - 从全局搜索进入 thought 时，selected thought 和 selected category 正确更新。
  - 展开/折叠分类后 reload，展开状态保留。
  - 快速展开/折叠多个分类，不出现旧状态覆盖新状态。

## Review Notes

- 不要把 atoms 包回 Context。
- 不要创建 `useCapturePageState()` 这类一次性返回所有状态的聚合 hook；这会重新制造粗粒度订阅。
- 可以创建小的动作 atom，但动作 atom 应保持职责明确，例如只处理“选择分类并清空 thought”这一类复合操作。
