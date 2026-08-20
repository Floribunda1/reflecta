# IPC 传输层模块边界设计（v2.0.0）

> 状态：Decided（D5 落地形态）
> 日期：2026-08-20
> 配套决策：`index.md`（同目录，D5）
> 硬性约束（发起方拍板）：**模块 isolated、对外暴露面最小、可整体替换（后续可能被替换）**

## 1. 职责边界

本模块只做一件事：**把 Electron 的 `ipcMain.handle` / `ipcRenderer.invoke` 管道，暴露为 Effect 的 typed RPC（typed request + typed domain error），并保持可整体替换。**

**实现路线（2026-08-20 修订）**：不自行实现重协议（官方 `RpcServer/RpcClient` 的 `Protocol` 为网络/HIT.st 流设计）；**直接用现成薄库 `electron-effect-rpc`**（peerDeps 已跟进 `effect ^4.0.0-rc.109`，与锁定 rc 兼容，已装并 typecheck 通过），并外包一层薄门面达成隔离/可替换。

| 属于谁                              | 内容                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `electron-effect-rpc`（依赖，不写） | 契约（`createIpcKit`）、Schema 双向校验、typed domain error 入 Effect 错误通道、流、生命周期                         |
| 本模块（薄门面，自写仅一层）        | 隔离 electron-effect-rpc：对外固定 `setupIpcTransport` / `createIpcClient` 两个函数 + 契约类型；封住信道命名与替换点 |
| 业务域（不在此模块）                | 领域 Effect 程序、服务、renderer 组件——一律不感知传输细节                                                            |

**它不包含任何业务逻辑**；被替换时唯一影响面是薄门面本身。

## 2. 结构：一个目录，两个公开导出

```
apps/electron/src/ipc/
├── contract/          # 共享契约：electron-effect-rpc 的 createIpcKit 配置（双端类型唯一来源）
│   └── <domain>.ts    # 每个域一组：方法/事件/流 + 输入/输出/错误 Schema
└── transport/
    ├── index.ts       # ★ 唯一公开面：2 个导出（薄门面）+ 契约类型
    ├── main.ts        # 门面→ electron-effect-rpc 主进程侧（注册 handler、生命周期）
    └── renderer.ts    # 门面→ electron-effect-rpc 客户端侧
```

公开 API 全部（没有第三项）：

```ts
// main 进程：注册处理器（handlers 为 Effect，可注入服务），纳入 app 生命周期
setupIpcTransport(handlers: Handlers): Promise<LifecycleHandle>

// renderer 进程：拿到类型化客户端（typed domain error 随契约走）
createIpcClient(): IpcClient
```

renderer 业务代码只依赖 `createIpcClient` 的返回类型，main 只依赖 `setupIpcTransport` 的参数类型；两者都来自 `contract/` 的共享 `createIpcKit` 契约。

## 3. 隔离规则（"换什么动什么"）

**可替换的（封装在薄门面之后，替换时不动外部）：**

- 底层库本体：`electron-effect-rpc` ↔ 官方 `Protocol` 包/自写/未来官方件
- 传输协议：`ipcMain` ↔ WebSocket / HTTP / MessagePort
- 契约载体：`createIpcKit` ↔ 官方 `RpcGroup` / 其它（若底层库停更，薄门面可改成底层它，最小回退）

**不可泄漏的（替换时也不该动）：**

- 领域 Effect 程序与服务层
- renderer 组件与查询层（React Query + effect-query）
- 薄门面公开的两个函数签名

**替换场景示例**：若 `electron-effect-rpc` 停更或与 v4 正式版不适配，仅重写 `transport/` 薄门面内部（可换回官方 `unstable/rpc` 自写，或换其它），`main`/`renderer` 调用处签名不变——业务文件零改动。

## 4. 为什么"暴露面小"是硬约束

- 暴露面 = 共享契约类型 + 2 个函数 → 测试面、review 面、学习面都小；
- 替换成本 ≈ 重写一个文件，而不是重构半套 IPC；
- 契约仍是官方 `RpcGroup`，与 effect-query / HttpApi / 未来官方传输天然兼容，不产生"第二套 RPC 范式"（符合"无并行技术栈"约束）。

## 5. 验收标准（落地时核对）

1. main 与 renderer 业务代码不 import `transport/` 内部符号，只经公开 API + 契约类型；
2. 模拟一次"换传输实现"（如同接口下加 ws 实现），业务改动为 0；
3. 传输层单测只覆盖：信封编解码、typed error 往返（`TaggedError` 结构化 payload 跨进程还原）、失败路径、请求 id 关联；
4. 与现有 `services/index.ts` 的 `ipcMain.handle` 包裹层（请求日志 / 错误折叠）职责交接明确：日志与追踪移到 Effect annotations / spans，模块不再负责业务侧诊断。

## 6. 与现状的交接点

| 现状（electron-ipc-decorator）                               | 迁移去向                                             |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| `IpcService` + `@IpcMethod` 装饰器类（各 `*Service.ts`）     | 消失；变 `RpcGroup.makeHandler` + 领域 Effect 程序   |
| `MergeIpcService` 类型生成 + `createIpcProxy`                | 消失；变 `RpcGroup` 契约 + `createIpcClient`         |
| `services/index.ts` 的 `{__isIpcError, code:"UNKNOWN"}` 包裹 | 消失；变 Schema 错误通道（`TaggedError` 结构化往返） |
| 同文件 requestId / 诊断日志 wrapper                          | 迁移到 Effect spans/annotations                      |
| preload `contextBridge` 暴露 `ipcRenderer`                   | 保留（纯 Electron 安全管道，非 IPC 方案）            |
| agent-session-feed 手推事件通道                              | 可迁移为 rpc Stream 响应（后续按需）                 |
