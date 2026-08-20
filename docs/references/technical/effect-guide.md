# Effect 使用规范（现行规范）

> 状态：Decided（Effect Native 迁移完成后的固化约定）
> 来源：`docs/iterations/v2.0.0/effect-migration/`（决策 D1~D11、迁移哲学、migration-pattern）
> 约束等级：**高**——新代码与改造必须符合本规范；旧范式（命令式并发、字符串错误、message 兜底、手写 invalidate 织网）不再新增。

## 0. 一句话原则

**Effect 是本项目的原生技术栈**：域核心/主进程逻辑/renderer 重逻辑都是 Effect 程序（typed errors、依赖注入、结构化并发、可测）；React 只当 view；TanStack Query 只做缓存/加载/重取（与 Effect 互补分工，不是并行栈）。

## 1. 服务端域核心（packages/server）

每个域 = `core.ts`（Effect 程序）+ `types.ts` + `bff-electron.ts`（renderer 侧门面）+ `bff-cli.ts`（CLI 侧 async 门面）。

### 1.1 域 core 形态

- 方法返回 `Effect.Effect<A, DomainError>`；DB 访问用 `Effect.promise`/`Effect.sync` 包 better-sqlite3 同步调用；组合用 `Effect.gen`（注意：gen 回调里不能用 `this`，先 `const method = this.method.bind(this)`）。
- typed error 用 `Schema.TaggedError`，并导出联合类型：

```ts
export class DomainNotFoundError extends S.TaggedError<DomainNotFoundError>()(
  "DomainNotFoundError",
  { id: S.String },
) {}
export type DomainError = DomainNotFoundError | ...;
```

- 失败用 `Effect.fail(new DomainNotFoundError({ id }))`，**不要** `throw new Error("...")`。
- 共享查询助手（如 `resolveDomainRefs`）写成返回 `Effect.Effect<...>` 的自由函数，跨域直接 import。
- **注意**：`Effect.promise` 的 rejection 会变成 defect（不可重试）；需要 typed failure 的异步用 `Effect.tryPromise({ try, catch })` 把 rejection 映射进错误通道（如 retrieval sync 的 `toError`）。

### 1.2 bff 门面

- `bff-electron.ts`：方法返回 Effect，主进程 handler 用 `runXxx` mapper 把服务端 `DomainError` 映射到 IPC 契约错误（`apps/electron/src/main/index.ts` 内 `runDomain`/`runContext`/`runUnderstanding` 模式）。
- `bff-cli.ts`：**async 门面**（`async method() { return Effect.runPromise(...) }`），CLI action 直接 await。注意：与 core 同名的 Effect 方法（如 `deleteDomain`）**不要**在 CliBff 里重写成 async（TS 类型冲突），CLI action 侧用 `Effect.runPromise(services.x.deleteX(...))`。

### 1.3 后台编排（coordinator 类）

- 状态机/后台循环用 **Effect 原生编排**：每次激活 `Effect.runFork` 一个受监督 fiber（同步跑到首个挂起点）、批间 `Effect.suspend` 惰性重建 work + `Schedule.recurs(1)` 重试、idle 用 `Deferred` 通知（flush）、`stop` 用 `Fiber.interrupt`。
- 见 `packages/server/src/domains/retrieval/coordinator.ts`。

## 2. IPC 边界

- 契约（`apps/electron/src/ipc/contract/`）用 electron-effect-rpc `createIpcKit`；typed domain error 进契约，跨进程结构化往返。
- main 侧 handler 是 Effect，错误经 mapper 映射到契约错误；renderer 只经 `lib/effect-rpc.ts` 的 `rpc` client 调用。

## 3. Renderer

### 3.1 运行时与状态

- **单一 runtime**：`lib/effect-runtime.ts` 的 `AppRuntime`（`ManagedRuntime` 由应用 Layer 组装）；非 Effect 侧（queryFn、事件回调）用导出的 `runPromise`。
- **UI 状态用 `@effect/atom`**：模块级 `Atom.make` + 共享 registry（`lib/atoms.ts` 的 `appAtomRegistry`/`runAtom`）；React 读用 `useAtomValue`（`@effect/atom-react`）。不要 zustand、不要散装命令式并发对象。

### 3.2 数据层（React Query + effect-query）

- **queryFn/mutationFn 是 Effect 程序**，经 `lib/effect-query.ts` 的 `effectQuery`（`createEffectQueryFromManagedRuntime(AppRuntime)`）接缝跑在单一 runtime：`useQuery(effectQuery.queryOptions({ queryKey, queryFn }))`、`useMutation(effectQuery.mutationOptions({ mutationFn }))`。
- **query key 工厂**（如 `captureQueryKeys`）是查询与失效的唯一来源，读侧与写侧共用；不要用字符串字面量散落 key。
- **失效规范（社区标准，勿用版本-in-key）**：
  - mutation `onSuccess` 里**定向失效**：层级 key 前缀匹配（如 `["understanding.list"]`），保留 stale-while-revalidate（无 loading 闪烁）；
  - **权威响应 `setQueryData`**：mutation 返回完整实体（如 understanding update 返回 `UnderstandingDTO`）→ 直写 detail 缓存，实体保存零请求零闪烁；派生列表仍定向失效；
  - 失效计划收敛为纯函数/单一驱动点（见 `capture/queries.ts` 的 `applyInvalidations`），不散落副作用；
  - 跨模块共享的失效辅助（如 `invalidateEntityDisplay`）导出供需要处使用。
- **错误**：effect-query 把 Effect 失败包成 `EffectQueryFailure`（`.failure` 存真实 typed error），`renderError`（`lib/errors.ts`）已解包；已知错误用 `error.match` 或 `catchTag` 分发，未匹配走 `renderError` 兜底。

### 3.3 禁止项（迁移踩坑教训）

- 不散装 `Effect.runSync`/模块级全局 runtime/命令式工厂——逻辑以 Service + Layer 表达，经根 runtime。
- 不把"版本号塞进 queryKey"做失效——key 身份变化 = 新缓存条目，丢 stale-while-revalidate，实体保存会闪 loading。
- 不写手写 query 层/自定义缓存（D9）。

## 4. 校验（Schema）

- 输入校验、领域模型、IPC 契约统一 `effect/Schema`（D6）；CLI 已无 zod。
- CLI 错误处理：`apps/cli/src/runner.ts` 把域 `TaggedError`（`_tag` 以 `NotFoundError` 结尾等）映射到 `CliError` 码（NOT_FOUND 等），不再靠字符串匹配。

## 5. 边界（不迁）

- UI 视觉层、shadcn/tailwind 样式：不迁（D9）。
- 纯派生函数（sort/format 等）：保持纯函数，不硬包 Effect（D11）。
- 渲染、组件瞬态、事件绑定：留在 React（view），经 atoms 对接。
