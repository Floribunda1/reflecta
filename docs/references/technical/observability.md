# 可观测性规范（日志 / 错误捕获 / Telemetry 接缝）

> 日期：2026-08-15
>
> 状态：Current
>
> 职责：定义 Reflecta 的日志写入、错误捕获与未来 telemetry 的统一规范。本文不定义具体功能 UI，不写业务页面。

## 总览

Reflecta 的可观测性由四层组成，职责互补：

1. **DiagnosticLog**：本地 JSONL 结构化日志，AI-first，按天滚动、30 天保留、密钥脱敏。
2. **错误捕获**：main / renderer / IPC / 原生崩溃四层兜底，任何未处理错误都有痕迹。
3. **错误聚合**：重复错误按指纹计数，输出 `error.aggregate` 汇总，日志既能看单条详情也能看频率。
4. **Telemetry 接缝**：所有事件都经过统一出口 `writeDiagnosticEvent`，将来接远端只是换/加 sink，不改调用点。

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
- **event** 是机器可读的事件名（如 `pi.run.failed`），是将来聚合分组的键，必须稳定。
- **attrs** 是事件附加字段；Error 对象用 `diagnosticErrorAttrs(error)` 序列化。

### withPrefix：实例级上下文

需要给同一模块下的一组调用附加上下文（如某个 run / 某个 session）时，用 `withPrefix` 收窄日志器：

```ts
const log = agentLog.withPrefix(runId);
log.error("pi.run.failed", { ... }); // message: "[run_abc] pi.run.failed"
```

- `withPrefix` 返回**新的** `DiagnosticLogger`，不改动原实例（可安全链式调用、复用）。
- 前缀写入 `message`（人类/AI 可读），`event` 保持不变（机器分组不受影响）。
- 超长前缀（>20 字符）自动截断为 `xxxx...`，防止日志膨胀。

### Level

`debug` / `info` / `warn` / `error`。error 只留给真正影响功能或数据的事件；可恢复的异常情况用 warn。

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
| 原生崩溃        | minidump             | `crashReporter`（Crashpad），打包构建启用，`uploadToServer: false` 只本地收集到 `<appConfigDir>/crash-dumps`                                                   |
| renderer 未捕获 | `renderer.error`     | preload 的 `window.error` / `unhandledrejection`，经 `diagnostic:renderer-error` IPC 上报                                                                      |
| React 渲染错误  | `renderer.error`     | `RendererErrorBoundary`，带 componentStack                                                                                                                     |
| React 根错误    | `renderer.error`     | `createRoot` 的 `onUncaughtError` / `onCaughtError`（source=react.uncaught / react.caught，带 componentStack）                                                 |
| feed 接收错误   | `renderer.error`     | preload port 回调 try/catch（source=feed.receive），附 `feed.kind` / `feed.sessionId` / `feed.revision`——从 port 回调逃逸的渲染错误（如 #185）在此带上帧上下文 |
| IPC 调用失败    | `ipc.request.failed` | `ipcMain.handle` 统一包装，带 requestId + durationMs + error attrs；成功为 `ipc.request.completed`(debug)                                                      |

约定：业务代码 `catch` 到错误后，**至少写一条 error 级日志**再决定是否给用户 toast；不要把错误对象丢弃。

## 4. 错误聚合

重复错误由 `ErrorAggregator`（`apps/electron/src/main/error-aggregator.ts`）计数：

- **指纹**：`scope|event|ipc.channel|source|error.name|error.message`，栈帧故意排除（跨构建稳定）。
- **触发**：同一指纹当天累计 ≥ 3 次后，输出 `error.aggregate`（error 级，scope=app），带 `error.count` / `error.firstSeen` / `error.lastSeen` / `error.fingerprint` 与首次样本 attrs。
- **周期**：60s 定时 flush + 退出前 flush；跨天自动切分（昨天的桶写完最终 count 后清理）。
- **不抑制**：每条原始错误照常记录，聚合只是附加的计数汇总——日志始终如实。

## 5. Telemetry 接缝（预留）

- 统一出口是 `writeDiagnosticEvent(event: DiagnosticEventInput)`（`apps/electron/src/main/diagnostic-log.ts` 定义契约），`onDiagnosticEvent(listener)` 订阅出口。
- 当前 sink 是本地 JSONL；`remote-diagnostics.ts` 提供 `forwardDiagnosticEvents(url, opts)`（JSON POST，出口处脱敏），由 `--reflecta-telemetry-url` 运行时参数显式开启，**默认关闭**。
- 隐私边界：远端上报必须是 opt-in 的产品决策；脱敏（redact）留在出口边界，保证任何 sink 都不携带用户内容。

## 6. 参考来源

本模块的 Logger 封装参考 Mattermost Desktop（Apache-2.0）的
[`src/common/log.ts`](https://github.com/mattermost/desktop/blob/master/src/common/log.ts)；
main/renderer 分离结构参考 GitHub Desktop（MIT）的
[`app/src/lib/logging/`](https://github.com/desktop/desktop/tree/development/app/src/lib/logging)；
聚合去重模式（buffer + 指纹 + count + flush）参考 VS Code（MIT）的
[`BaseErrorTelemetry`](https://github.com/microsoft/vscode/blob/e8db8ed8/src/vs/platform/telemetry/common/errorTelemetry.ts)。
