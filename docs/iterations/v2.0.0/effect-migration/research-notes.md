# Effect TS 引入调研笔记（v2.0.0）

> 日期：2026-08-20
> 配套决策：`index.md`（同目录）
> 说明：本文记录调研过程、一手数据与来源链接。数据以 2026-08-20 拉取时点为准，作历史证据存档。

## 1. 调研轮次

| 轮次 | 问题                                      | 结论                                                                                                                                           |
| ---- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Effect 是什么、能否改善本仓库质量         | 能，但第一版判断"仅点状引入"——方向后被用户纠正为 Effect native                                                                                 |
| 2    | Effect native 架构与 React 生态           | 官方 v4 提供 atom / rpc / schema；renderer 数据层存在三路线；当时误判桥接路线出局                                                              |
| 3    | 社区对 TanStack Query + Effect 的真实用法 | 证明为主线组合（见 §3），修正第 2 轮误判                                                                                                       |
| 4    | 原生 query 最佳实践 vs 桥接的取舍         | Effect 官方只有缓存积木（Cache / withRequestCaching），无现成 query 层；完整原生框架仅 foldkit（pre-1.0）→ 定案保留 React Query + effect-query |

## 2. 现状证据（代码库自查）

- 领域层错误：`packages/server/src/domains/*/core.ts` 大量 `throw new Error("...")`，无结构化错误类型；校验层 `understanding-canvas/validate.ts` 自定义 Error 子类 + `assert*` 函数。
- IPC 边界：`apps/electron/src/main/services/index.ts` 将一切异常折叠为 `{ __isIpcError: true, code, message }`，code 无 `.code` 字段时恒为 `"UNKNOWN"`；renderer 侧 `utils/ipc.ts` 还原为 `Error` + `code`，`utils/errors.ts` 仅取 `message` 展示。
- 后台编排：`packages/server/src/domains/retrieval/coordinator.ts` 手写状态机（`running` promise 链、`runWithOneRetry`、`lastError`、`flush`、`stop`）。
- 数据层：`apps/electron/src/renderer/src/modules/capture/queries.ts` 等以 TanStack Query 组织，mutation 后手动 invalidate 多个 queryKey。

## 3. 社区主流证据：Effect + TanStack Query

| 来源                    | 内容                                                                                                                                                                                      | 链接                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Reddit r/reactjs        | 专门讨论帖 "Integrating Effect-TS with React Query: Worth It? Pros and Cons?"                                                                                                             | reddit.com/r/reactjs/comments/1gi1o46                           |
| Effect 官方 Discord     | 2023-02 起官方社区确认"很多成员在使用 Effect + React Query"                                                                                                                               | answeroverflow.com/m/1073415441738903613                        |
| production 仓库         | `kevin-courbet/effect-nextjs-architecture`（标注 production-tested，Next.js 15 + React Query + Effect 分层 DI）；`tanstack-effect-example`；`bitswired/quick-effect-tanstack-boilerplate` | github.com/kevin-courbet / bitswired                            |
| 教程视频                | "Build the perfect wrapper to use Effect HttpApi with Tanstack Query"                                                                                                                     | youtube.com/watch?v=sNSRT1oGgLs                                 |
| 持续维护对比文档        | "Effect TS + TanStack Query comparison"（明确分工表：缓存/加载归 Query，正确性/校验/重试/DI 归 Effect）                                                                                   | gist.github.com/adamthewilliam/b512afd84bf1e78d643d6dd6dba994dd |
| TanStack Start 集成方向 | `EthanShoeDev/effect-tanstack-start` WIP 设计文档，正面采用 effect-query 解决 loader 契约                                                                                                 | github.com/EthanShoeDev/effect-tanstack-start                   |

## 4. 候选库硬数据（2026-08-20 拉取）

### 4.1 npm 下载量（last-month / last-week）

| 包                                       |                                  月下载 |     周下载 |
| ---------------------------------------- | --------------------------------------: | ---------: |
| `effect`                                 |                             110,068,065 | 24,296,932 |
| `@effect/rpc`（v3 独立包，v4 并入 core） |                               2,924,184 |    641,998 |
| `@effect/sql`                            |                               2,229,685 |    449,652 |
| `@effect/atom-react`                     |                                 287,046 |     81,981 |
| `effect-query`                           |                                  32,756 |      3,389 |
| `foldkit`                                |                                  37,137 |     11,724 |
| `electron-effect-rpc`                    |                                     269 |        203 |
| `@effectify/react-query`                 |                                     103 |         19 |
| `@effect-react-query`（spiko-tech）      |                                  接近 0 |          — |
| `@effect/atom`                           | 独立包不存在（atoms 在 effect core 内） |          — |

### 4.2 GitHub 仓库

| 仓库                             |      ★ | issues | 最近 push  | 建档    | 备注                                                |
| -------------------------------- | -----: | -----: | ---------- | ------- | --------------------------------------------------- |
| Effect-TS/effect                 | 15,376 |    220 | 2026-08-20 | 2019-11 | 官方，周更                                          |
| foldkit/foldkit                  |    789 |    179 | 2026-08-20 | 2025-06 | pre-1.0，主维护者 1 人（devinjameson 1238 commits） |
| voidhashcom/effect-query         |    228 |      4 | 2026-08-11 | 2025-10 | 1.0.0                                               |
| devx-op/effectify                |     43 |     46 | 2026-08-14 | 2025-06 | 红牌：issues 数 > star 数、下载 ~100/月             |
| spiko-tech/effect-react-query    |      0 |      1 | 2026-05-24 | 2026-04 | 实质停更                                            |
| joaoeira/electron-effect-rpc     |      1 |      0 | 2026-08-15 | 2026-01 | 单人活维护，用户群过小                              |
| AdiRishi/electron-effect-starter |      2 |      0 | 2026-07-19 | 2026-07 | 参考架构（不引依赖）                                |

### 4.3 发布节奏与维护者

| 包                         | latest                 | 最近发布                           | 维护者                                            |
| -------------------------- | ---------------------- | ---------------------------------- | ------------------------------------------------- |
| `effect`（npm latest tag） | 3.22.1（v4 走 rc tag） | 2026-07-30                         | michael.arnaldi / effect-bot（官方）              |
| `effect-query`             | 1.0.0                  | 2026-03-02（npm），GitHub 8 月活跃 | kingdoxik（Dominik Vít）                          |
| `foldkit`                  | 0.148.1                | 2026-08-19                         | devin_jameson                                     |
| `electron-effect-rpc`      | 0.10.0                 | 2026-08-15                         | simbyotic                                         |
| `@effectify/react-query`   | 0.0.3                  | 2026-03-15（modified 07-12）       | andresdavidj                                      |
| `@effect/atom-react`       | 4.0.0-beta.107         | 2026-08-10                         | schickling / michael.arnaldi / effect-bot（官方） |

## 5. 关键事实核对

- **v4 状态**：官方 2026-08-12 宣布进入 Release Candidate（"final stretch before stable"）；beta 期官方口径"生产仍推荐 v3"，v3 已 feature freeze，v4 稳定后为 LTS。
- **unstable 模块机制**：v4 将 17 个模块（含 AI、HTTP、Schema、SQL、RPC、CLI、workflows、cluster 相关能力）放进 `effect/unstable/*`，minor release 内可破坏性变更，成熟后晋升稳定命名空间。rpc / atom 相关能力当前处于该范围。
- **官方原生缓存件存在但非现成 query 层**：`Effect.Cache`（官方文档 caching/cache，Effect Days 官方 workshop 正课内容）、`withRequestCaching`（请求级去重，Sandro Maglione 案例一行接入）、Caching Effects 文档节（函数记忆化）——均为原语/积木，需自行拼装 query 编排。
- **Foldkit 定位**：官方框架路线（Elm 架构 + AsyncData 六态 + "无 query client 的缓存"），pre-1.0，roadmap 以 1.0 为唯一主线——观察清单，非今日选项。
- **electron-effect-starter**（AdiRishi，2026-07 建仓）：Effect v4 + Electron + React，全链路 Schema 契约 + 监督 + 重连，作为本仓库 IPC 传输层自写时的架构参考。
- **工具链兼容**：Effect 官方支持 TS 7 / 自带 `@effect/tsgo`，与本仓库 tsgo/oxlint 工具链不冲突；typecheck 性能需 pilot 实测。

## 6. 决策相关的外部参考案例

- **Inato：fp-ts → Effect 迁移报告**（约 50 万行 TS，~2 个月、~10% 人力）：显式共存规则（新代码 Effect、存量按模块迁移）+ 桥接 helpers，双风格过渡期的现实模板。
- **Effect 官方播客生产案例**：Zendesk（增量、多语言环境）、Vercel Domains、MasterClass、Markprompt——多为服务端编排场景，renderer 侧主要走 React Query 组合。
