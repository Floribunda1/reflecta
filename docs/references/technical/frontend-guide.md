# 前端规范

## 技术栈

- react（view）
- effect（program：单一 `AppRuntime`、typed errors、atoms 状态、并发编排）
- shadcn
- tailwindv4
- vite
- @tanstack/react-query（数据层缓存/加载/重取）
- effect-query（React Query 与 Effect 的接缝：queryFn/mutationFn 是 Effect 程序）
- @effect/atom + @effect/atom-react（UI 本地状态）
- electron-effect-rpc（IPC：typed domain error 跨进程往返，经 `lib/effect-rpc` 调用）
- lodash-es
- date-fns

## 开发 Rules

- 在开发新模块/功能时，优先利用项目现有的三方依赖完成功能（见上面的技术栈），除非没有替代**不要自己造轮子**
  - 页面搭建优先使用 shadcn + tailwind
  - **UI 本地状态**优先使用 `@effect/atom`（`useAtomValue`/`runAtom`），不再引入 zustand 等并行状态库
  - **数据请求**优先使用 `@tanstack/react-query`，queryFn/mutationFn 写 Effect 程序、经 `effect-query` 接缝跑在单一 `AppRuntime` 上
  - **重逻辑/并发/错误处理**写 Effect（`Context.Service` + `Layer`、`Effect.gen`、`catchTag`/`match`），React 只当 view
  - 功能函数优先使用 lodash-es、date-fns

## Effect TS

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

## React 性能相关

- 减少过多的 `useMemo` 优化，只有当确定某处为性能瓶颈时才考虑使用 `useMemo`

## UI 相关

- 在设计页面的时候不要自己去造 **通用组件如 select 等**，能用 shadcn 就必须要用 shadcn
- 减少过多的 shadcn 本身的样式定制，尽量让整体的设计符合 shadcn 的 design system
- **不允许对 shadcn 里的任何组件进行修改**

### 样式设计原则（minimalist）

- 能不手动写 style token 的地方就不要手动写 style token
- 组件库能覆盖的样式就不要自己手动写（例如 ghost 按钮的 hover 态、icon-sm 的尺寸，组件已内置）
- 所有手动写的 style token 都需要被 carefully reviewed：每一处都有存在理由，且理由不能是"方便"或"顺手"
- 优先使用语义 token 与组件默认样式，重复组件默认行为的 className 直接删除
- **token 值一旦变更，必须重新扫描该 token 的所有消费点**：表面 token（如 popover、card）的可见性可能因画布变化而翻转，之前"不可见所以无害"的用法可能变成"可见但不该存在"

## Review 检查顺序

在 review 前端模块时，按下面顺序逐项扫描，避免只看 UI 层而漏掉状态和 hook：

1. 技术栈复用：检查是否优先使用了项目已有依赖和组件能力，避免重复实现。
2. 状态与请求：检查 UI 本地状态是否用 atoms；请求是否走 React Query + effect-query 接缝；是否残留散装 `Effect.runSync` 或手写 query 层。
3. 错误处理：检查 rpc/域错误是否用 `renderError` 或 typed `catchTag`/`match` 分发，是否还有 message 兜底。
4. UI 组件：检查 select、menu、dialog、drawer 等通用组件是否优先使用 shadcn 或项目已有 `use-drawer`、`use-modal`。
5. React 性能：检查 `useMemo` 等优化是否有明确性能瓶颈依据。
6. 功能函数：检查日期、集合、对象处理是否优先使用 lodash-es、date-fns。
