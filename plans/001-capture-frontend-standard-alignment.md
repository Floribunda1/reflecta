# Capture 前端规范对齐实施计划

> **给 agentic workers：** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐项执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪进度。

**目标：** 让 `apps/electron/src/renderer/src/modules/capture/` 对齐 `docs/3-frontend/前端规范.md`。

**架构：** 服务端请求数据继续交给 @tanstack/react-query 管理；跨列共享的 capture UI 状态迁移到 jotai atoms；手写的通用 hook、debounce、menu、select 逻辑改用项目规范推荐的 ahooks 和 shadcn primitives。除非任务明确修复已识别的正确性风险，否则保持现有行为等价。

**技术栈：** React、shadcn、Tailwind v4、@tanstack/react-query、jotai、ahooks、lodash-es、date-fns、Vitest/typecheck。

---

## 当前问题

1. `apps/electron/src/renderer/src/modules/capture/context.tsx` 使用项目手写的 `useLocalStorageState` 管理 capture UI 状态，但 ahooks 已经提供 `useLocalStorageState`。
2. `apps/electron/src/renderer/src/modules/capture/` 使用 4 层嵌套 React context provider 管理跨列 UI 状态和 actions。项目已安装 `jotai`，但 renderer 代码中没有任何使用。
3. `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx` 用 `lodash-es/debounce`、`useMemo` 和 cleanup effect 手写 debounce 生命周期；ahooks 已提供 `useDebounceFn`。
4. `apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx` 手写 fixed-position context menu，而不是使用 shadcn `context-menu` 或 `dropdown-menu`。
5. `apps/electron/src/renderer/src/modules/capture/category/components/CreateCategoryModal.tsx` 用原生 `<select>` 做父级分类选择；项目已经有 `apps/electron/src/renderer/src/components/ui/select.tsx` 和 `CategoryTreeSelect`。
6. `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx` 用 `NativeSelect` 做来源类型选择，而 shadcn `Select` 已可用。
7. `apps/electron/src/renderer/src/modules/capture/thought-detail/context.tsx` 在 debounced 编辑更新过程中 broad invalidate/refetch thought queries，可能导致 IPC churn，并让本地编辑 state 被 stale refetch 覆盖。
8. capture 多个文件对廉价计算使用 `useMemo`，缺少明确性能瓶颈依据。

## 验证基线

- 运行 `bun run --cwd apps/electron typecheck:web`。
- 实施完成后的期望：命令退出码为 0。
- 当前已知阻塞：`src/renderer/src/components/ui/calendar.tsx(75,9)` 报错 `table` 不是合法的 `ClassNames` 属性。如果该问题仍存在且与 capture 改动无关，在最终说明中记录为 pre-existing，不要在本计划里修改 calendar 代码。
- 运行 `bun run --cwd apps/electron lint`。
- 实施完成后的期望：命令退出码为 0，或只剩本计划触碰文件之外的 pre-existing 问题。

## 范围内文件

- `apps/electron/src/renderer/src/modules/capture/context.tsx`
- `apps/electron/src/renderer/src/modules/capture/index.tsx`
- `apps/electron/src/renderer/src/modules/capture/category/context.tsx`
- `apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`
- `apps/electron/src/renderer/src/modules/capture/category/components/CreateCategoryModal.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/context.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-list/ThoughtCard.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-detail/context.tsx`
- `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`
- 可选新增文件：`apps/electron/src/renderer/src/modules/capture/state.ts`

## 范围外事项

- 不修改后端 IPC contracts。
- 不重构 chat、contemplate、settings、shared markdown editor 或 calendar 文件，除非 capture 所需 imports 必须调整。
- 不删除 `modules/shared/hooks/use-local-storage-state.ts`；其它模块仍在导入它。
- 不重新设计 capture 布局或文案。

## Task 1：引入 Jotai 管理 Capture UI 状态

**文件：**
- 新增：`apps/electron/src/renderer/src/modules/capture/state.ts`
- 修改：`apps/electron/src/renderer/src/modules/capture/context.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/index.tsx`

- [ ] 为 `selectedCategoryId`、`selectedThoughtId`、`expandedCategoryKeys` 创建 atoms。
- [ ] 使用 `jotai/utils` 的 `atomWithStorage` 管理 localStorage-backed values。
- [ ] 保持现有 localStorage keys 完全不变：`capture:selectedCategoryId`、`capture:selectedThoughtId`、`capture:expandedCategoryKeys`。
- [ ] 临时保留 `useCapturePageContext()` 作为兼容 wrapper，但内部改为基于 `useAtom` 读取和写入，方便子文件逐步迁移。
- [ ] 当兼容 wrapper 不再需要 provider 时，从 `CapturePage` 移除 `CapturePageProvider`。
- [ ] 验证分类选择、thought 选择、分类展开状态在 reload 后仍按原行为保留。

## Task 2：移除 Capture 对手写 Local Storage Hook 的依赖

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/context.tsx`

- [ ] 从 capture 中移除 `@renderer/modules/shared/hooks/use-local-storage-state` 的 imports。
- [ ] 如果仍保留兼容 context，确保所有值都来自 jotai atoms，而不是手写 hook。
- [ ] 运行下面命令，确认 capture 内不再导入 `useLocalStorageState`：

```bash
rg "useLocalStorageState" apps/electron/src/renderer/src/modules/capture
```

期望：无匹配结果。

## Task 3：把 Debounce 逻辑迁到 ahooks

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`

- [ ] 将标题、正文、来源名称、来源内容的 `lodash-es/debounce + useMemo + cleanup effect` 替换为 ahooks 的 `useDebounceFn`。
- [ ] 保持 350ms wait 不变。
- [ ] 通过 `useDebounceFn` 返回的 `cancel` 函数保留 unmount 时取消 pending update 的行为。
- [ ] 确保标题、正文、来源编辑器仍然即时更新本地 React state，持久化保持 debounce。
- [ ] 如果本文件不再使用 `debounce`，移除对应 import。

## Task 4：降低编辑过程中的 Refetch Churn

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-detail/context.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-list/context.tsx`

- [ ] 在 `updateThought({ body })` 期间，如果 mutation response 已包含足够数据，使用精确的 `queryClient.setQueryData` / `setQueriesData` patch，替代 broad invalidation。
- [ ] 只在 wikilink 关系重算确实需要时保留 broad invalidation，并对其做 debounce 或缩小 scope，避免每次按键触发。
- [ ] 在 create/update/delete 操作上按需要改用 `useMutation`，让 pending/error handling 和 cache invalidation 更集中。
- [ ] 确保编辑后列表行能更新 title/body/category/count metadata，但不依赖每次按键 full list refetch。
- [ ] 如果 capture 已有测试 harness，新增或更新聚焦测试；如果没有，在最终交付说明中写清楚手动验证步骤。

## Task 5：用 shadcn 替换分类手写 Context Menu

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`

- [ ] 用 `apps/electron/src/renderer/src/components/ui/` 下的 shadcn `ContextMenu` 或 `DropdownMenu` primitives 替换 `menuState` fixed-position JSX。
- [ ] 保留操作：新建子领域、编辑领域、删除领域。
- [ ] 保留分类名称右键打开菜单的能力。
- [ ] 保留行操作按钮打开同一组操作的能力。
- [ ] 验证 outside click、Escape、keyboard focus、viewport collision 由 shadcn primitive 正常处理。

## Task 6：用 shadcn Select 替换 Raw/Native Select

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/category/components/CreateCategoryModal.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`

- [ ] 将 `CreateCategoryModal` 中的原生父级分类 `<select>` 替换为 shadcn `Select`。
- [ ] 保留 `__none__` 对应 `null` parent category 的语义。
- [ ] 保留 nested categories 的缩进展示，或改为等价的 path label 展示。
- [ ] 将来源类型选择的 `NativeSelect` 替换为 shadcn `Select`。
- [ ] 如果 capture 中不再使用 `NativeSelect`，移除相关 imports。
- [ ] 运行下面命令，确认 capture 中不再有 raw `<select>` 或 `NativeSelect`：

```bash
rg "<select|NativeSelect" apps/electron/src/renderer/src/modules/capture
```

期望：无匹配结果。

## Task 7：移除低价值 useMemo

**文件：**
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/thought-list/ThoughtCard.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/category/components/CreateCategoryModal.tsx`
- 修改：`apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`

- [ ] 移除廉价 label/date/menu/option 计算外层的 `useMemo`，除非该值必须保持引用稳定。
- [ ] query-derived sorted lists 只有在 profiling 或列表规模证明必要时才保留 memoization；否则优先直接计算或交给服务端排序。
- [ ] 运行下面命令，确认 capture 中剩余 `useMemo` 都有明确理由：

```bash
rg "useMemo\\(" apps/electron/src/renderer/src/modules/capture -n
```

期望：只剩 provider values、仍需要稳定引用的 debounced/callback 逻辑，或有明确必要的 expensive transforms。

## Task 8：最终验证

- [ ] 运行：

```bash
bun run --cwd apps/electron typecheck:web
```

- [ ] 运行：

```bash
bun run --cwd apps/electron lint
```

- [ ] 在 app 中手动验证：
  - 分类选择 reload 后仍保持。
  - Thought 选择保持或重置行为与之前一致。
  - 分类树展开/折叠 reload 后仍保持，并且快速操作后不会回退。
  - 分类菜单可以通过右键和行操作按钮打开。
  - 新建/编辑分类时，父级分类选择对 root 和 nested categories 都有效。
  - 输入标题、正文、来源内容时流畅，不跳光标，不回退文本。
  - 来源类型 select 更新正确。

## Review Notes

- 按 task 做小提交。
- 如果把 context 替换为 jotai 时发现 chat 或 contemplate 也有类似架构漂移，不要在本计划中重构那些模块。
- 如果现有 calendar typecheck error 仍存在，把它报告为 pre-existing，保持不改。
