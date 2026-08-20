# Effect TS 引入决策记录（v2.0.0）

> 状态：Decided（调研定案，落地排期未启动）
> 日期：2026-08-20
> 分支：`docs/effect-migration`
> 适用范围：@reflecta/mono 全仓（packages/server、apps/electron main + renderer、apps/cli）
> 前置调研：`research-notes.md`（同目录，含证据数据与来源）

## 0. 结论摘要（TL;DR）

- **引入 Effect TS，版本锁定 v4**（`4.0.0-rc` 系，官方已进入 RC 阶段）。
- **renderer 数据层保留 TanStack Query**，`queryFn` 内跑 Effect；与 Effect 的接缝用 **`effect-query`**（不自己写 query 层、不写自定义缓存）。
- **UI 本地状态 → 官方 `@effect/atom`**（方向已定，落地时确认排期）。
- **校验统一到 `Schema`**（迁移 CLI 现有 zod 用法，消除双校验体系）。
- **IPC 走官方 RPC 模块 + 自写薄传输层**（不依赖小众第三方包）。
- **明确淘汰**：`foldkit`（pre-1.0）、`@effectify/react-query`、`@effect-react-query`、`electron-effect-rpc`（以依赖形式使用）。
- 保留现金栈中与 Effect 不重叠的成熟件：React Query（缓存/加载/重取）、drizzle + better-sqlite3/libsql（查询构建与存储）、React/shadcn/tailwind（UI）。

## 1. 背景与目标

### 1.1 现状画像

- 仓库为 Bun monorepo：`apps/electron`（Electron main + React 19 renderer）、`apps/cli`（commander CLI）、`packages/server`（领域核心 + BFF 适配层）、`packages/ui`（共享组件）、`packages/retrieval-eval`。
- 技术栈：TypeScript 7（tsgo/native-preview）、oxlint/oxfmt、drizzle-orm + better-sqlite3/libsql、zod（CLI）、TanStack Query + zustand + ahooks（renderer）。
- 现状痛点（本轮调研确认）：
  - domain core 大量 `throw new Error("...")`，错误只有字符串、无结构化类型；
  - IPC 边界把所有异常折叠成 `{ __isIpcError, code: "UNKNOWN", message }`，跨进程错误零类型信息（`apps/electron/src/main/services/index.ts`）；
  - `retrieval/coordinator.ts` 手写后台状态机（重试一次、取消、flush、进度上报），全凭纪律维持；
  - renderer 每个 mutation 手动 invalidate 2~5 个 queryKey（见 `modules/capture/queries.ts`），失效逻辑是织网结构。

### 1.2 决策约束（发起方拍板）

1. **版本用 v4**；
2. **社区风评 / 维护活性优先**（不押小众或低活跃项目）；
3. **技术债最小：不允许并行存在的同类技术栈**（如 zod+Schema、双错误处理、双 DI 同时存在）。

> **迁移总纲（更高优先级，约束全部落地）：拒绝背负技术债**——不写过渡兼容层、顺手清 dead code / legacy compatible / 过渡 shim。详见 `migration-philosophy.md`。

### 1.3 目标

以 Effect 为项目的原生技术栈，系统性改善：typed errors 建模、跨进程错误类型化、后台并发编排、可测试的依赖注入；同时保持"单一范式"的长期可维护性。

## 2. 调研过程（摘要）

完整过程、数据与来源见 `research-notes.md`。收敛路径本身值得记录：

1. **第一轮评估（粗判）**：把 Effect 定位为"只能点状引入、renderer 层别碰"——后被用户纠正：项目目标是 Effect native。
2. **第二轮（native 架构探索）**：确认官方 v4 提供 `@effect/atom` / `@effect/rpc` 等原生件；同时发现 renderer 数据层存在三条路线（桥接 / 官方 atoms / Foldkit），当时因桥接库活跃度偏低误判为"整条桥接路线出局"。
3. **第三轮（社区纠偏）**：深入搜索证明 **Effect + TanStack Query 是社区主流组合**（Reddit 讨论帖、Effect Discord 2023 年起即有成员使用、多个标注 production-tested 的仓库、专门教程视频、`effect-query` 持续适配 v4）。
4. **第四轮（定案）**：确认 Effect 官方虽有 `Cache` / `withRequestCaching` 等原生缓存积木，但均为"需要自行拼装"的原语，不构成现成 query 层——与"不写 query"原则冲突；唯一完整原生框架 Foldkit 仍 pre-1.0。定案：保留 React Query + `effect-query`。

## 3. 关键决策

| #   | 决策            | 结论                                                                                                                          |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D1  | Effect 版本     | **v4（4.0.0-rc 系）**                                                                                                         |
| D2  | renderer 数据层 | **保留 TanStack Query，queryFn 内跑 Effect**（互补分工，非并行栈）                                                            |
| D3  | 接缝胶水        | **`effect-query`**（选项 1，发起方拍板）                                                                                      |
| D4  | 候选淘汰        | foldkit / @effectify/react-query / @effect-react-query / electron-effect-rpc（依赖形式）                                      |
| D5  | IPC 通道        | 官方 RPC 模块 + 自写薄传输层，**模块隔离、暴露面最小（2 个函数 + 共享契约）、可整体替换**（详见 `ipc-transport-boundary.md`） |
| D6  | 校验体系        | 统一到 `Schema`，迁移 CLI zod                                                                                                 |
| D7  | UI 本地状态     | zustand → 官方 `@effect/atom`（落地排期待确认）                                                                               |
| D8  | 主进程后台编排  | retrieval coordinator / agent 调用 / 后台 worker 全部用 Effect 核心（fiber + Schedule + 中断）                                |
| D9  | 不做什么        | 不写自定义 query 层、不写 50 行手搓缓存、不引入 Foldkit                                                                       |

| D10 | 迁移哲学 | **拒绝背负技术债**：不写过渡兼容层；迁移各模块时顺手清 dead code / legacy compat / 过渡 shim（详见 `migration-philosophy.md`） |

## 4. 理由链

### D1：版本选 v4

- 官方生态已完成向 v4 的整合：`@effect/atom`、`@effect/rpc` 等原生件都是 v4 时代产物；主流桥接 `effect-query` 的 peerDeps 已对齐 `effect ^4.0.0-beta`；
- v3 已进入 feature freeze（官方公告），新功能只进 v4；
- v4 官方承诺稳定后为 LTS；
- 已接受代价：rpc / atom 等目前处于官方 `unstable/` 命名空间（17 个 unstable 模块），4.0 正式版前 API 可能漂移 → 通过"锁 RC 版本号 + 跟每周 This Week in Effect + 预留 4.0 稳定收口"对冲。

### D2：数据层保留 TanStack Query（关键说理）

- "无并行栈"约束针对的是**同职能重复**（两套校验、两套错误处理、两套 DI）；React Query 与 Effect 是**互补分工、不重叠**：

  | 职能                                              | React Query |        Effect        |
  | ------------------------------------------------- | :---------: | :------------------: |
  | 缓存 / 加载态 / 重取 / 去重                       |     ✅      | ⚪（官方有意不覆盖） |
  | typed errors / Schema 校验 / 重试策略 / 追踪 / DI |     ⚪      |          ✅          |

- 社区主流证据充分（详见 research-notes）：此组合是 Effect 生态事实上的前端数据层标准答案；
- 接缝成本一行：`queryFn: () => Effect.runPromise(runtime)(program)`；
- **不自己写 query 层**：Effect 官方虽有 `Cache` / `withRequestCaching` 原生原语，但它们是需要自行拼装的积木，用它们等于自己实现 query 编排（cache key、失效时机、加载态六态、并发去重）——直接违反"能不写就不写"原则。

### D3：胶水用 effect-query

- 发起方选择选项 1（现成库），接受"单维护者"风险：
  - 1.0.0、**0 依赖**、代码量极小（unpacked 约 86KB / 10 文件）；
  - 持续适配 v4（有专门 compatibility 更新 commit），GitHub 8 月仍活跃；
  - TanStack Start 官方集成方向（EthanShoeDev/effect-tanstack-start）在 WIP 设计中主动采用；
  - 能力覆盖 query/mutation/错误 match，兼容 Effect RPC 与 HttpApi；
  - **兜底**：即使停更，可无损回退到 ~30 行自写 wrapper（`runPromise` + runtime 注入），风险有界。

### D4：淘汰清单（风评数据见 research-notes §4）

- `foldkit`：pre-1.0、单一主维护者、179 open issues、Show HN 反响平淡（7 票）——理念正确但今天押太早，降级为观察清单；
- `@effectify/react-query`：月下载 ~100、46 open issues > 下载量——红牌；
- `@effect-react-query`（spiko-tech）：0 star、5 月起停更——个人实验品；
- `electron-effect-rpc`：月下载 ~269、1 star——用户群体过小，不足以作为依赖引入。

### D5：IPC 官方 rpc + 自写薄传输

- 官方 `@effect/rpc`（含 v3 版本累计月下载 292 万）提供 Schema 序列化、typed request/response、requestId、错误传播；
- Electron 传输层（ipcMain/ipcRenderer 适配，约 150~200 行）参考 `electron-effect-starter` / `electron-effect-rpc` 的公开设计思路自写，**不引第三方依赖**——风评约束不允许依赖 1 star 包，且 electron-effect-rpc 基于 v3 Schema API、无 v4 支持声明，与我们已拍板的 v4 冲突；
- 自写传输层以**隔离模块**形态落地：对外仅暴露 `setupIpcTransport` / `createIpcClient` 两个函数 + 共享 `RpcGroup` 契约，内部实现（信封/接线/错误映射）可整体替换（如日后改走本地 server + 官方 WS 传输），业务层零改动；
- 直接修复现状“code 永远 UNKNOWN”的结构性缺陷，错误改为 Schema `TaggedError` 结构化跨进程往返。

### D6：校验统一 Schema

- CLI 现有 zod v4 用法一次性迁移到 `Schema`；领域模型、IPC 契约、输入校验全部单来源。

### D7：zustand → @effect/atom

- 官方件（Effect 联创在维护者名单）、月下载 28.7 万；替代 zustand 后 renderer 状态层完全并入 Effect 范式；落地排期待确认（不阻塞 D1~D6）。

### D8：主进程后台编排

- retrieval coordinator 状态机 → 可监督 fiber + `Schedule.recurs(1)` 重试 + 中断语义；
- agent / LLM 调用 → `retry` + `timeout` + provider fallback；
- 全部使用 Effect 官方核心模块，零第三方风险。

### D10：迁移哲学（拒绝背负技术债）

- 明确不采用 Inato 式"compat helpers + 双轨共存"策略：每迁移一个模块，旧实现连同全部调用方一次性移除；
- 迁移是"删除式"的（如 zod 迁移完成后依赖即移除、electron-ipc-decorator 及 `{__isIpcError}` 包裹层全部删除，不留任何残留）；
- 每模块迁移附"顺手清理项 / 发现但不动项"两栏，落实 R1~R3 规则；
- 验收以旧符号零残留、无兼容 shim、dead export 清零为准（详见 `migration-philosophy.md`）。

## 5. 已接受风险

| 风险                                                           | 应对                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| v4 RC / unstable API 漂移（rpc、atom 在 `unstable/` 命名空间） | 锁定 RC 版本；跟踪官方周报；预留 4.0 稳定收口清理工                                                                                   |
| `effect-query` 单维护者                                        | 0 依赖小库；可回退 30 行自写 wrapper                                                                                                  |
| better-sqlite3 同步驱动在 fiber 内为阻塞调用                   | 维持串行语义（与现状一致），不追求 fiber 并行 DB 收益；如未来需要再评估 `@effect/sql`                                                 |
| tsgo typecheck 性能                                            | Effect 类型负担不轻，引入 pilot 时实测 tsgo 耗时                                                                                      |
| 团队学习曲线 / 双风格过渡期                                    | 按 Inato 迁移报告（fp-ts→Effect，50 万行，~2 个月，~10% 人力）的模式：新代码 Effect、存量按模块迁移、明确不迁边界（UI 样式 / shadcn） |

## 6. 落地前待确认项（不阻塞现状，后续排期时拍板）

1. 开始时机：锁 `4.0.0-rc.110` 起步，还是等 4.0 正式版；
2. zod → Schema 的迁移边界（CLI 全量 or 仅新增代码）；
3. zustand → atom 的排期；
4. 首个 pilot 模块范围（候选：IPC 错误通道 + `retrieval/coordinator.ts` + agent 调用链）。

## 6.1 传输层设计说明

传输层的隔离边界、公开面与验收标准见同目录 `ipc-transport-boundary.md`。

## 6.2 实施计划

分阶段落地（P0 收尾 → P1 垂直切片 Pilot → P2 基础设施 → P3 主进程域迁移 → P4 renderer → P5 CLI/zod → P6 v4 收口）见同目录 `implementation-plan.md`；第 1/2/5 项待确认项在计划内已给出归属阶段与门。

## 7. 参考

- 调研数据与全部来源：`research-notes.md`（同目录）
- 官方：Effect v4 Beta 公告、v4 Migration Guide、Caching 文档（`Cache` / Caching Effects）
- 社区：effect-query、foldkit、effect-tanstack-start、electron-effect-starter、kevin-courbet 系列仓库、Effect Discord / Reddit 讨论、Effect Days workshop 材料
