# IPC 传输层模块边界设计（v2.0.0）

> 状态：Decided（D5 落地形态）
> 日期：2026-08-20
> 配套决策：`index.md`（同目录，D5）
> 硬性约束（发起方拍板）：**模块 isolated、对外暴露面最小、可整体替换（后续可能被替换）**

## 1. 职责边界

本模块只做一件事：**把官方 RPC 语义（`effect/unstable/rpc`）绑定到 Electron 的 `ipcMain.handle` / `ipcRenderer.invoke` 管道上。**

| 属于谁                     | 内容                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| 官方 RPC 层（依赖，不写）  | 契约（`RpcGroup` / `Rpc` / `Schema`）、校验、typed errors、Stream 响应、序列化层 |
| 本模块（自写，唯一自写件） | Electron 传输适配：信封编解码、channel 接线、请求 id、错误 Cause 往返映射        |
| 业务域（不在此模块）       | 领域 Effect 程序、服务、renderer 组件——一律不感知传输细节                        |

**它不包含任何业务逻辑**；被替换时唯一影响面是传输本身。

## 2. 结构：一个目录，两个公开导出

```
apps/electron/src/ipc/
├── contract/          # 共享 RpcGroup 契约（双端类型唯一来源）
│   └── <domain>.ts    # 每个域一组：输入/输出/错误 Schema
└── transport/
    ├── index.ts       # ★ 唯一公开面：2 个导出 + 契约类型
    ├── main.ts        # 内部：ipcMain.handle 接线、信封编解码、错误映射
    └── renderer.ts    # 内部：ipcRenderer.invoke 协议层、请求 id
```

公开 API 全部（没有第三项）：

```ts
// main 进程：注册处理器，返回可启动的 Effect（纳入 app 的 Layer/Scope 生命周期）
setupIpcTransport<R extends RpcGroup.RpcGroup>(
  handlers: RpcGroup.Handlers<R>
): Effect<Scope, never, void>

// renderer 进程：拿到类型化客户端（RpcClient，错误类型随契约走）
createIpcClient<R extends RpcGroup.RpcGroup>(
  group: R,
): Effect<never, never, RpcGroup.Client<R>>
```

renderer 业务代码只依赖 `createIpcClient` 的返回类型，main 只依赖 `setupIpcTransport` 的参数类型；两者都来自 `contract/` 的共享契约。

## 3. 隔离规则（"换什么动什么"）

**可替换的（封装在模块内部，替换时不动外部）：**

- 传输协议：`ipcMain` ↔ WebSocket / HTTP / MessagePort
- 信封格式、channel 命名、请求 id 生成
- 错误序列化细节（Cause → JSON 的映射策略）

**不可泄漏的（替换时也不该动）：**

- 领域 Effect 程序与服务层
- renderer 组件与查询层（React Query + effect-query）
- 共享契约本身的语义

**替换场景示例**：日后若改走 electron-effect-starter 式"本地 server + 官方 WS 传输"，仅需新增一个 `transport/ws.ts` 实现同一 socket，`main`/`renderer` 调用处签名不变——业务文件零改动。

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
