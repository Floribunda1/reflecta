# 可观测性规范（日志 / 错误捕获）

> 日期：2026-08-15
>
> 状态：Current
>
> 职责：定义 Reflecta 的日志写入与错误捕获的统一规范。本文不定义具体功能 UI，不写业务页面。

## 总览

Reflecta 的可观测性由两层组成，职责互补：

1. **DiagnosticLog**：本地 JSONL 结构化日志，AI-first，按天滚动、30 天保留、密钥脱敏。
2. **错误捕获**：main / renderer / IPC 兜底，任何未处理错误都有痕迹。

日志采用 **spring-log-like 的管线**：业务代码经 scope 日志器写入（类似 slf4j 的 logger category），同一条日志同时流向 dev 控制台（pattern 格式化，开发期人读）与 JSONL 文件（机器/AI 读）。

> 原则：**任何被 catch 的错误都不应被静默吞掉**——至少要有对应的 error 级日志。
> 原则：**system crash 不进 toast**。`window.onerror` / `unhandledrejection` 只进日志（preload 上报）；toast 只用于业务操作失败（如「导出失败」），由业务代码主动弹出。

## 1. 日志写入

### Logger 用法

所有业务日志都通过 scope 日志器写入（`apps/electron/src/main/logger.ts`）：

```ts
import { appLog, agentLog, ipcLog } from "../logger";

appLog.info("update.check.started", { manual: true });
agentLog.error("pi.run.failed", { runId, ...diagnosticErrorAttrs(error) });
ipcLog.warn("chat.sendAgentCommand.timeout", { durationMs });
```

- **scope** 固定为 `app` / `ipc` / `db` / `agent` / `retrieval` / `renderer`，对应 `DiagnosticScope`。
- **event** 是机器可读的事件名（如 `pi.run.failed`），是将来的分组键，必须稳定。
- **attrs** 是事件附加字段；Error 对象用 `diagnosticErrorAttrs(error)` 序列化。

### 实例上下文（Effect-native）

在 Effect 代码里，run / session / request 级上下文用 `Effect.annotateLogs` 表达（等价于 logback 的 MDC，且 fiber 局部自动传播、自动清理）：

```ts
Effect.annotateLogs({ scope: "agent", runId, sessionId })(effect);
```

- annotations 会被拆进 JSONL 的 `context` 字段（`requestId` / `traceId` / `sessionId` / `runId` / `messageId` / `toolCallId`），保持结构化、可检索。
- 只在 fiber 及其子 fiber 内生效，结束即清理，无 MDC 的「忘记 remove」泄漏问题。

### Level

`debug` / `info` / `warn` / `error`。error 只留给真正影响功能或数据的事件；可恢复的异常情况用 warn。默认 dev 为 `debug`、生产为 `info`，可用 `REFLECTA_LOG_LEVEL` 环境变量覆盖。

## 2. 日志文件

- 路径：`<appConfigDir>/logs/reflecta-YYYY-MM-DD.jsonl`（App Config Dir，见 CONTEXT.md）。
- 格式：每行一条完整 JSON `DiagnosticEvent`：`{ ts, level, event, scope, message?, context?, attrs? }`。
- 滚动：单日文件超 5MB 后按 `.1`、`.2` 序号滚动；保留最近 30 天。
- 脱敏：写入前统一 `redactDiagnosticEvent`，key 匹配 `api_key/token/authorization/password/secret` 的值替换为 `[redacted]`。
- 用户入口：设置中「显示日志文件」（`DiagnosticsService.showLogFile`）。

## 3. 错误捕获路径

| 路径            | 事件                 | 说明                                                                                                                                                           |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| main 未捕获     | `app.fallback.error` | `uncaughtExceptionMonitor` / `unhandledRejection`                                                                                                              |
| 进程崩溃        | `app.fallback.error` | `render-process-gone` / `child-process-gone`（含 reason/exitCode）                                                                                             |
| renderer 未捕获 | `renderer.error`     | preload 的 `window.error` / `unhandledrejection`，经 `diagnostic:renderer-error` IPC 上报                                                                      |
| React 渲染错误  | `renderer.error`     | `RendererErrorBoundary`，带 componentStack                                                                                                                     |
| React 根错误    | `renderer.error`     | `createRoot` 的 `onUncaughtError` / `onCaughtError`（source=react.uncaught / react.caught，带 componentStack）                                                 |
| feed 接收错误   | `renderer.error`     | preload port 回调 try/catch（source=feed.receive），附 `feed.kind` / `feed.sessionId` / `feed.revision`——从 port 回调逃逸的渲染错误（如 #185）在此带上帧上下文 |
| IPC 调用失败    | `ipc.request.failed` | `ipcMain.handle` 统一包装，带 requestId + durationMs + error attrs；成功为 `ipc.request.completed`(debug)                                                      |

renderer 错误同时输出到 dev 控制台（便于开发期即时可见），并落 JSONL；上报中的未知字段（如 `feed.*`）原样透传。

约定：业务代码 `catch` 到错误后，**至少写一条 error 级日志**再决定是否给用户 toast；不要把错误对象丢弃。

## 4. 参考来源

main/renderer 分离结构参考 GitHub Desktop（MIT）的
[`app/src/lib/logging/`](https://github.com/desktop/desktop/tree/development/app/src/lib/logging)。
