# Effect TS v4 迁移实施计划（v2.0.0）

> 状态：Planned
> 日期：2026-08-20
> 配套决策：`index.md`（D1~~D10）；总纲：`migration-philosophy.md`；传输边界：`ipc-transport-boundary.md`
> 前置调研：`research-notes.md`
> 执行约束：总纲（拒绝背负技术债 R1~~R3）、每阶段自洽干净、每个迁移 PR 是一个完整可回退单元

## 0. 计划总览

```
Phase 0  收尾决策与基线          （并行，随时可做）
Phase 1  垂直切片 Pilot          （验证 v4 RC 可行性 + 打通全链路，含回退门）
Phase 2  基础设施固化            （共享契约 + IPC 传输层 + 运行时脚手架）
Phase 3  主进程域逻辑迁移        （按模块多 PR，删除式迁移 + 顺手清债）
Phase 4  renderer 数据层迁移     （queryFn 跑 Effect、zustand→atom、清 IPC 遗留）
Phase 5  CLI 与校验统一          （zod 移除，合并到 Schema）
Phase 6  v4 稳定收口 + 全量回归
```

依赖关系：P2 ← P1（P1 产出契约/传输雏形）；P3 ← P2；P4 ← P3（renderer 依赖主进程已迁移）+ P2；P5 ← P3（CLI 依赖域核心）；P6 ← P3~P5。P0 全程并行。

各阶段都可独立交付并保持应用可运行（Electron 可启动、e2e 可跑）。

---

## Phase 0 — 收尾决策与基线（并行）

**目标**：把已冻结的决策补齐到可开工状态。

| 任务       | 说明                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| 定开始时机 | 拍板：现在锁 `4.0.0-rc.110` 起步，还是等 4.0 稳定（见 P1 门）           |
| 锁版本     | 选定精确 RC 版本号并在后续所有 workspace 统一（v4 生态单一版本号）      |
| 存量债基线 | 扫描登记各模块"顺手清理项 / 发现但不动项"，建清单模板                   |
| 规范更新   | 决定 `migration-philosophy.md` 是否同步进 `docs/references`（现行规范） |
| 脚手架     | 建迁移期间的 lint/typecheck 门（保持 oxlint + tsgo 全绿）               |

**退出标准**：版本锁定；债清单模板就绪。

---

## Phase 1 — 垂直切片 Pilot（验证 + 打通全链路）

**目标**：用一条垂直切片低成本验证"v4 RC 在本仓库可行"，并把整条链（域核心 → IPC → renderer）首次打通。**可回退**。

**切片选点**（取最小且高价值的纵切）：一个简单域（候选 `context` 或 `trash`）+ 类型化错误 IPC + renderer 单点调用。

| 任务              | 说明                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| 装 effect@rc      | 精确锁版；建共享契约目录（`apps/electron/src/ipc/contract/`）首个 `RpcGroup`        |
| 写 IPC 传输层雏形 | 按 `ipc-transport-boundary.md`：`setupIpcTransport` / `createIpcClient`，仅此公开面 |
| 迁移切片域核心    | 该域 `core` 变 Effect 程序 + `Schema` + `TaggedError`                               |
| 打通 renderer     | queryFn 内跑该域调用，验证 typed error 跨进程结构化往返                             |
| 测 typecheck 性能 | 基线 vs 引入后 tsgo 耗时，记录为门指标                                              |
| 顺手清理          | 该切片域的 `@IpcMethod` 类壳、dead export、`{__isIpcError}` 依赖点                  |

**退出 / 回退门**（关键）：

- ✅ 通过：typecheck 退化可接受、v4 unstable API 波动可管理 → 进入 P2；
- ⛔ 不通过（typecheck 严重退化 / unstable 漂移过大 / 卡点无法绕过）→ **回退 Pilot**，切换为"等 v4 稳定"策略，本计划相应整体后移。

**产出**：Pilot 报告（可行性结论 + 性能 + 波动观察 + 顺手清理清单）+ 可复用的迁移模式文档。

---

## Phase 2 — 基础设施固化（契约 + 传输 + 运行时）

**目标**：把 P1 验证过的东西固化成正式基础设施，成为所有后续域迁移的同构模板。

| 任务         | 说明                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| 契约层       | 为所有域补 `RpcGroup` + `Schema` 模型（输入/输出/错误），双端类型唯一来源                              |
| 传输层完成   | main + renderer 两端完整实现并单测（信封、错误 Cause 往返、请求 id、失败路径）                         |
| 运行时脚手架 | main 与 renderer 各自的 `ManagedRuntime` + Layer 组装、Scope 生命周期接入                              |
| 迁移模式文档 | 固化"域 core → Effect 程序 / 服务 / TaggedError / 测试"约定，供 P3 参照                                |
| 顺手清理     | `services/index.ts` 的 requestId/日志 wrapper 迁到 Effect spans；`{__isIpcError}` 折叠逻辑从新通道移除 |

**退出标准**：传输层单测过、一个最小端到端 demo 通过、迁移模式文档可指导 P3。

---

## Phase 3 — 主进程域逻辑迁移（多 PR，删除式）

**目标**：全部域导出为 Effect 程序 + Schema 类型化错误，`electron-ipc-decorator` 退出。

**迁移顺序**（先简单后复杂，每步可提交可回退）：

| 序  | 域 / 模块                                           | 重点                                                                             |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| 3.1 | `context`、`domain`、`trash`                        | 薄 CRUD，先跑通同构模板                                                          |
| 3.2 | `understanding`、`understanding-canvas`、`search`   | 中等复杂度；validation 转 Schema                                                 |
| 3.3 | `settings/config`、`asset-storage`、`canvas-export` | 主进程本地服务转 Effect                                                          |
| 3.4 | `retrieval`（coordinator）、embedding worker        | **状态机 → supervised fiber + `Schedule.recurs(1)` + 中断**；进度可走 rpc Stream |
| 3.5 | `agent/*` 调用链（LLM provider）                    | retry / timeout / provider fallback 用官方 Schedule                              |
| 3.6 | `updater`、`diagnostics`、`about`                   | 收尾                                                                             |

**每个 PR 的硬性内容**（对齐总纲）：

- 删除该模块的 `*Service.ts extends IpcService` 类壳 → 换 `RpcGroup.makeHandler`；
- 旧实现连同调用方一次性移除，无兼容 shim；
- 该模块的"顺手清理项 / 发现但不动项"两栏附在 PR 说明；
- oxlint + tsgo + 相关单测 +（涉及 e2e 的）`feature:check` 全绿。
- 当最后一个 `@IpcMethod` 类删除时，**从 package.json 移除 `electron-ipc-decorator`**，并从 `tsconfig.*` 的 paths 清理 `createIpcProxy`/`MergeIpcService` 引用。

**退出标准**：主进程无 `IpcService` 类、无 `@IpcMethod`、无 `{__isIpcError}`；IPC 全链路 Schema 类型化。

---

## Phase 4 — renderer 数据层 / 状态层 / 逻辑层迁移

**目标**：renderer 完全跑在 Effect 上（React 作 view、Effect 作 program），清理数据层与逻辑层技术债。

> **依赖序（重要，走歪教训 2026-08-20）**：P4③（逻辑层）**依赖 ② atoms 先落位 + renderer `ManagedRuntime` 脚手架**（D11 明确）。此前曾跳过前置、直接对单个并发原语做"仅替换内部实现 + 保留命令式 React 壳 + 散落 `Effect.runSync`/全局 runtime"——这是**反模式**（Effect 官方 LLMS 要求 build one runtime from application Layer，逻辑以 `Context.Service`+`Layer` 表达，非散装命令式工厂）。结论：**P4 必须按 P4-0→P4-4 顺序推进**，每单元自洽可回退；不建 runtime/atoms 就动逻辑层＝顺序错误。

### P4-0｜renderer `ManagedRuntime` 脚手架（P2 欠账，所有单元的前置）

- 建 renderer 根 runtime：`ManagedRuntime`（由应用 `Layer` 组装，LLMS 明确要求）。
- 导出 `runPromise` / `runFork` 等接入点；后续服务的 `Layer` 依次 `Layer.provide` 进去。

### P4-1｜引入 `@effect/atom`（D7）＋ zustand → atoms

- 新增官方 `@effect/atom` 依赖；本地状态迁到 atoms。
- 现 4 个 zustand store：`theme` / `capture` / `chat-ui` / `canvas`。
- ③ 逻辑层的 React 对接（`useAtom` / `useSyncExternalStore`）由此落位。

### P4-2｜③ 逻辑层 → Effect services（在 P4-0/1 之上）

| 原语（旧命令式模块）                      | Effect 形态                                                                      | 备注                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| `useUnderstandingDraftSave` 的 save queue | `Context.Service`（内部 `Queue` + 单 worker fiber + `Deferred` + revision 门控） | 删除式：旧命令式队列随调用方一次移除        |
| `debounced-latest-saver`                  | `Context.Service`（timer fiber + `Fiber.interrupt` + revision）                  | 调用方 `CanvasWorkspace` 改纯绑定           |
| `AgentSessionReplica`                     | `Context.Service`（per-session 生命周期 → fiber/Scope 中断、refcount）           | 🔴 最险：chat 流式依赖，独立评估可单独立 PR |

- React 侧：hooks 收敛为**纯绑定**（读 atom / `useSyncExternalStore`），不再持有命令式并发对象。
- 删除式（R1）：旧命令式模块连同全部调用方一次移除，不留兼容层。

### P4-3｜③ 状态机/多步流程 → Effect 程序

- `CaptureDraft` 保存态、理解详情流程、chat 流式 → 显式状态 Effect 程序（atoms 承接状态）。

### P4-4｜① typed-error 分发 ＋ ⑤ invalidate 织网

- renderer 用 `catchTag`/`match` 分发域错误，替代 message 兜底。
- 重做 `queries.ts` 等手动 invalidate 链 → 事件驱动（可配合 atom/事件总线）。

### 顺手清理（各单元顺带）

- dead export、旧类型别名、过期注释；`queryFn` 内跑 Effect（P3 已顺带完成，保留 React Query）。

**退出标准**：renderer 无 `createIpcProxy`、无手写 invalidate 网（或已事件化）、无手写并发原语残留；本地状态单一（atoms）；hooks 收敛为纯绑定；逻辑层全部为 Effect services（非散装 `runSync`）。

---

## Phase 5 — CLI 与校验统一（zod 移除）

**目标**：CLI 迁移到同一套域程序与校验体系，`zod` 退出。

| 任务         | 说明                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| CLI bff 迁移 | `bff-cli` 各域适配为 Effect 程序（复用 P2/P3 的共享契约与域核心）          |
| CLI 错误处理 | 用域 `TaggedError` 统一，替换 `cli/error.ts` 的字符串分类                  |
| zod → Schema | CLI 输入校验全量换 `Schema`                                                |
| 移除依赖     | 迁移完成后从 `apps/cli/package.json` 删除 `zod`；全局确认无 `zod` 引用残留 |

**退出标准**：`grep -r zod` 在仓库内零命中；CLI 行为回归通过。

---

## Phase 6 — v4 稳定收口 + 全量回归

**目标**：等 v4 正式发布后收口 API、做全量质量回归。

| 任务          | 说明                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| unstable 收口 | `effect/unstable/rpc`（及涉及模块）晋升后，更新 import 与 API 至稳定路径                                       |
| 锁版升级      | 从 rc 升到 4.0 stable/LTS，按官方迁移指南 + codemod                                                            |
| 全量回归      | 各 workspace typecheck、全量单测、e2e（acceptance/regression/integration）、`feature:check`、bundle 与启动性能 |
| 债清单收尾    | 复核所有"发现但不动项"，决定清或正式豁免                                                                       |
| 规范固化      | 把迁移后的技术栈与模式写进 `docs/references`（现行规范）                                                       |

**退出标准**：v4 stable 全绿；旧范式与新依赖零残留；迁移总纲验收清单全部打钩。

---

## 关键风险与门

| 风险                                              | 触发点      | 响应                                                   |
| ------------------------------------------------- | ----------- | ------------------------------------------------------ |
| v4 RC 不稳定 / typecheck 退化                     | P1 门       | 回退 Pilot，切换"等稳定"策略                           |
| unstable 模块 API 漂移                            | P3~P5 期间  | 锁 rc 版本；专职跟踪官方周报；4.0 发布后集中收口（P6） |
| 迁移期间双栈短暂并存                              | P3 各 PR    | 以"每个 PR 删除式、旧符号零残留"控制，不允许跨 PR 残留 |
| 大模块（agent / retrieval）范围失控               | P3.4 / P3.5 | 拆子任务，配"顺手清理/发现但不动"清单，必要时单独立 PR |
| black-box 依赖（electron-ipc-decorator 内部行为） | P3 起步     | P1/P2 先用最小切片验证 decoupling，再大规模铺开        |

## 边界（不迁移 / 不动的部分）

- UI 视觉层、shadcn/tailwind 样式：不迁移（D9 已定）；
- `packages/ui` 画布组件（CanvasGraph 等）、编辑器：不属本迁移范围；
- `packages/retrieval-eval`：仅在其依赖的域核心变化被波及时才调整；
- 迁移模块边界外的无关 bug/深层重构：按 R3 只登记不动。

## 存量债登记模板（每模块 PR 附两栏）

```md
### 顺手清理项（本次删除/修正）

- [ ] …（dead code / legacy compat / 重复实现）

### 发现但不动项（仅登记，不在本次改）

- [ ] …（与该次迁移无关的债，含出处）
```
