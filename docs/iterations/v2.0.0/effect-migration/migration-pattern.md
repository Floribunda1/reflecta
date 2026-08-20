# Effect 迁移模式（已验证范式，固化约定）（v2.0.0）

> 状态：Decided（已端到端验证）
> 日期：2026-08-20
> 配套：`index.md`（D5/D11）、`ipc-transport-boundary.md`、P1 E2E（`e2e/integration/effect/pilot.spec.ts`）
> 用途：后续所有域迁移（P3 及以后）的统一模板。**不照此写的迁移不合并。**

## 0. 一句话

**每个域 = 一个 electron-effect-rpc `createIpcKit` 契约（typed error 进契约）+ main 侧 Effect handlers + preload 暴露 `window.api` + renderer 用 `ipc.renderer(window.api).client`；迁移按总纲删除式（旧 Service 类 + 旧调用方一次移除，不留兼容层）。**

## 1. 契约层（双端类型唯一来源）

```ts
// apps/electron/src/ipc/contract/<domain>.ts
import * as S from "effect/Schema";
import { createIpcKit, defineContract, rpc } from "electron-effect-rpc";

// typed domain error：作为 `rpc` 第 4 参，跨进程结构化往返（P1 E2E 已验证）
export class TrashListError extends S.TaggedError<TrashListError>()("TrashListError", {
  reason: S.String, code: S.Number,
}) {}

export const TrashList = rpc("trash.listTrashed", S.Struct({}), S.Array(...), TrashListError);
// ...
export const trashIpc = createIpcKit({ contract: defineContract({ methods: [...], events: [], streamMethods: [] }) });
```

- 契约放 `apps/electron/src/ipc/contract/`（main/preload/renderer 经相对路径复用）。
- 名称用 `<域>.<动作>` 风格；错误用 `Schema.TaggedError`；成功/入参用 `Schema.Struct`。
- `@shared/*` 的现有 DTO 类型逐步并入 Schema（D6），过渡期允许先以 schema 承载等价形状。

## 2. main 侧（Effect handlers + 生命周期）

```ts
const mainRpc = trashIpc.main({
  ipcMain,
  handlers: {
    "trash.listTrashed": () =>
      Effect.gen(function* () {
        const svc = yield* TrashServiceTag;      // 依赖走 Effect Context（可测）
        return yield* svc.list();
      }).pipe(Effect.mapError(() => new TrashListError(...))),
    // ...
  },
  context: appRuntime.context,   // 注入领域服务
  getWindows: () => BrowserWindow.getAllWindows(),
});
mainRpc.start();
app.once("before-quit", () => mainRpc.dispose());
```

- handlers 是 Effect，领域服务经注入的 `Context` 提供（不要闭包裸单例，除非已定 final）。
- 迁移期可薄包既有 `*Service` 逻辑；但**旧 `@IpcMethod` 类必须在本 PR 内删除**。

## 3. preload

```ts
import { trashIpc } from "../ipc/contract/trash";
import { contextBridge, ipcRenderer } from "electron";
trashIpc.preload({ electronModule: { contextBridge, ipcRenderer } }).expose(); // 暴露 window.api
```

- `expose()` 在 `process.contextIsolated` 分支内调用（P1 已验证）。
- 多 kit 共用一个全局 `window.api` 桥（electron-effect-rpc 按 channel 前缀复用），无需每域一个全局。

## 4. renderer

```ts
import { trashIpc } from "../../ipc/contract/trash";
const { client: trashClient } = trashIpc.renderer(window.api);
// 调用：const items = await Effect.runPromise(trashClient["trash.listTrashed"]({}))
```

- 客户端封装成**一个 renderer 侧模块**（如 `modules/<domain>/queries.ts` 之上），组件不直接碰 window.api。
- 与 TanStack Query 协同用 `effect-query`（D2）；typed error 用 `error.match`/`catchTag` 分发。
- window 类型：`preload/index.d.ts` 的 `Window.api: IpcBridgeGlobal<typeof XxxIpc>`。

## 5. E2E 约定（P1 验证过的关键点）

- **不要依赖 `app.firstWindow()`**：它偶发返回未导航的 about:blank；用轮询 `app.windows()` 找真实导航窗口（`navigatedPage` 模式）。
- 先 `resetAgentFixtures()`（空库可能不渲染 `capture-page`）。
- `window.api.invoke` 返回**桥层信封**：成功 `{ type:"success", data }`；失败 **resolve** 为 `{ type:"failure", error:{ tag, data:{...} } }`（不 throw；typed error 的结构化字段在 `error.data`）。断言据此写。
- typed error 往返 = 核心验收；见 `e2e/integration/effect/pilot.spec.ts`。

## 6. 删除式迁移步骤（每域一个 PR）

1. 加 `ipc/contract/<domain>.ts`（含 typed errors）；
2. main：加 handlers（Effect），注册 kit，`start()`/`dispose()`；
3. preload：`expose()`（复用 `window.api` 桥）；
4. renderer：新 client 替换 `ipcClient.<domain>.*` 全部调用点；
5. **删除旧 `*Service.ts extends IpcService` 及其在 `services/index.ts` 注册**；若本域是最后一个 `@IpcMethod`，移除 `electron-ipc-decorator` 依赖；
6. typecheck + 单测 + `feature:check` + 相关 E2E 全绿；PR 附"顺手清理项 / 发现但不动项"两栏。

## 7. 已落地样例（可直接照抄）

- 契约 + typed error：`apps/electron/src/ipc/pilot/contract.ts`
- main assets 的注册、preload expose、renderer 类型：见 P1 各提交
- E2E 往返断言：`e2e/integration/effect/pilot.spec.ts`
