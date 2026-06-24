# Logging / Observability 调研与方案

> 日期：2026-06-24
>
> 状态：Proposal
>
> 目标：任何 bug 出现时，可以把诊断材料交给 AI，让 AI 自己按时间线、运行 ID、错误栈和上下文查日志并定位问题。

## 结论

Reflecta 现在已经有两类日志：

- 应用日志：Electron main 通过 `electron-log` 写 `main.log`，主要覆盖启动、少量 IPC、未捕获异常和 Electron 事件。
- Agent 会话日志：Pi session 通过 JSONL 存在 Content Storage Root 的 `Sessions/*.jsonl`，能重放 agent turn、tool call、approval 和 run 状态。

真正缺的是统一的结构化诊断事件。当前 `main.log` 是多行文本，适合人看，不适合 AI 稳定解析；Agent JSONL 很强，但和应用日志、IPC、DB、retrieval trace 没有统一 correlation id。

最小成熟方案：

1. 保留 `electron-log` 做桌面本地日志和 Electron crash/event 捕获。
2. 新增一份本地 `events.ndjson`，每行一个 JSON 诊断事件，字段对齐 OpenTelemetry log data model。
3. 把 `sessionId`、`runId`、`toolCallId`、`ipc.channel`、`requestId`、`traceId` 放进结构化字段。
4. 新增“导出诊断包”能力，打包最近 `events.ndjson`、`main.log`、相关 `Sessions/*.jsonl`、redacted config、DB/retrieval 状态。
5. 远端平台暂不接。需要线上错误聚合时再接 Sentry；需要 LLM 成本/质量/trace 平台时再接 Langfuse 或 LangSmith。

Skipped: 现在不上 ELK/Loki/OTel Collector。Add when 有多用户远端日志查询、告警和团队运维需求。

## 现状梳理

### 应用日志

入口是 `apps/electron/src/main/logger.ts`：

- 依赖：`electron-log/main`。
- App name：prod 用 `Reflecta`，dev profile 用 `Reflecta Dev`。
- 文件：`log.transports.file.getFile().path`，macOS 实际是 `~/Library/Logs/Reflecta/main.log` 或 `~/Library/Logs/Reflecta Dev/main.log`。
- 文件级别：`debug`。
- 控制台级别：dev runtime `debug`，production runtime `info`。
- 单文件大小：`5 * 1024 * 1024`。
- 格式：`[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {level}{scope} {text}`。
- 自动捕获：`log.errorHandler.startCatching({ showDialog: false })`。
- Electron 事件：`log.eventLogger.startLogging({ level: "warn", scope: "electron" })`。
- Scope：`appLog`、`agentLog`、`ipcLog`。

当前调用点很少：

- `index.ts`：`ipc.ping` debug。
- `ChatService.ts`：`chat.sendAgentCommand` info。
- `pi-agent-host.ts`：`pi.run.unhandledError`、`pi.run.cancelFailed`、`pi.run.assistantError`、`pi.run.failed`。
- `DiagnosticsService.ts`：只暴露 `getLogFilePath()` 和 `showLogFile()`。

实际 `main.log` 的对象是 pretty-printed 多行 JS 风格文本。问题：

- 一条事件不是一行，脚本和 AI 不好切分。
- 字段没有固定 schema。
- 错误栈、payload、事件名都混在文本里。
- 没有统一 `runId`/`requestId`/`traceId` 贯穿 IPC、Agent、DB、retrieval。

### Renderer 日志

`apps/electron/src/renderer/src/utils/logger.ts` 定义了 `loggerFor(scope)`，会优先走 `window.__electronLog`，否则 fallback 到 `console`。

当前只有 `chatLog` export，没有实际业务调用。`preload/index.ts` 引入 `electron-log/preload`，但 `initializeLogging()` 里设置了 `spyRendererConsole: false`，所以 renderer 的裸 `console.error` 不会自动成为稳定的主进程诊断事件。

Renderer 现在只在 IPC proxy 捕获业务错误时 `console.error("[IPC Error] ...")`。这对开发者 DevTools 有用，但不能保证进入本地诊断包。

### IPC 错误

`apps/electron/src/main/services/index.ts` monkey-patch 了 `ipcMain.handle`：

- 捕获所有 service 方法异常。
- 返回 `{ __isIpcError, code, message }` 给 renderer。
- 不记录 channel、耗时、参数形状、错误栈。

这是最划算的日志 seam。只要在 wrapper 层补 `ipc.request.failed` 和 `ipc.request.completed`，所有 IPC service 都受益，不需要每个 service 手工打点。

### Agent 会话日志

`apps/electron/src/main/services/agent/pi-session-log.ts` 是当前最接近 AI-debug 的部分：

- 存储目录：`<contentStorageRoot>/Sessions`。
- 文件格式：Pi `SessionManager` 的 JSONL。
- Reflecta 自定义事件类型：`reflecta.agent.event`。
- 事件包括：`run.started`、`run.completed`、`run.failed`、`run.cancelled`、`user.message`、`assistant.text.delta`、`assistant.reasoning.delta`、`tool.started`、`tool.completed`、`tool.failed`、`approval.requested`、`approval.resolved`。
- `reduceAgentSession(events)` 可以把事件流还原成 UI 状态。

优点：

- JSONL 可流式读取。
- 有 `sessionId`、`runId`、`messageId`、`toolCallId`。
- 能重放 agent turn。
- 对 AI debug 很友好。

缺口：

- 只覆盖 agent conversation，不覆盖 app lifecycle、IPC、DB、retrieval index、renderer error。
- 和 `main.log` 没有统一事件 schema。
- Retrieval trace 只作为 tool output/return value存在，不稳定进入通用诊断流。
- 可能包含用户原文和模型输出，诊断导出需要显式隐私边界。

### Retrieval trace

`packages/server/src/domains/retrieval/types.ts` 定义了 `RetrievalTrace`，`SearchCore.retrieveKnowledge()` 每次返回：

- query
- embeddingModel
- projectionVersion
- dense/lexical hit count
- fusion/grouping/relation stats
- returnedCandidates

这是好设计：trace 负责“为什么搜到这些结果”。问题是它只随调用返回，不作为持久诊断事件存在。Agent debug 时应该能从 `runId + toolCallId` 找到本次 retrieval trace。

### CLI

CLI 的 stdout/stderr 已经是机器友好的 `json` / `jsonl`：

- `writeData()` 输出 JSON/JSONL。
- `writeError()` 输出 `{ code, message, details? }`。

但它不是应用日志系统。`--verbose` 现在出现在 help 里，但没有实际日志行为。短期不需要接入 Electron 日志；只要保持 CLI 输出稳定即可。

## 社区调研

### 成熟共识

成熟方案不是“更多字符串日志”，而是：

- 结构化日志：每条记录是可解析对象。
- Correlation：错误、请求、agent run、tool call、DB/retrieval 操作能用 ID 串起来。
- 明确 levels：debug/info/warn/error/fatal。
- 本地先完整，远端可选。
- 隐私和 redaction 是日志设计的一部分，不是后补。

### OpenTelemetry

OpenTelemetry Logs Data Model 是最适合借鉴的字段模型。官方定义了 `Timestamp`、`TraceId`、`SpanId`、`SeverityText`、`SeverityNumber`、`Body`、`Resource`、`InstrumentationScope`、`Attributes`、`EventName`，并说明属性用于承载请求上下文和错误详情。

参考：

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [OpenTelemetry JavaScript Node.js getting started](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)

取舍：

- 用 OTel 的字段语言和语义。
- 先不直接接 OTel JS logs SDK。官方 Node.js getting started 仍提示日志库在发展中，当前项目没必要为一个本地桌面 app 引入整套 OTel runtime。

### electron-log

`electron-log` 官方定位就是 Electron/Node/NW.js 简单本地日志，默认 console + file 两个 transport，且支持 main/renderer IPC 日志路径和 Electron event logging。

参考：

- [electron-log GitHub](https://github.com/megahertz/electron-log)

取舍：

- 保留它。它已经解决桌面文件路径、主进程捕获、Electron 事件这些问题。
- 不强行把它改造成完整 observability 平台。
- 结构化诊断事件可以单独写 `events.ndjson`，避免破坏现有 `main.log` 的人工可读性。

### Pino / Winston / LogTape

Pino 是 Node 服务端高性能 JSON logger 的成熟选择；Winston 的强项是多 transport；LogTape 是更新的 TypeScript/Bun/browser-friendly 结构化 logger，主打 library-first、结构化字段、redaction、Sentry/OTel sinks。

参考：

- [Pino GitHub](https://github.com/pinojs/pino)
- [LogTape](https://logtape.org/)
- [LogTape structured logging](https://logtape.org/manual/struct)

取舍：

- 如果 Reflecta 以后要统一 Node/Bun/browser/library 日志，LogTape 比 Pino 更贴合 monorepo 和 Electron renderer。
- 现在不加依赖。当前只需要一个本地 JSONL writer 和 schema，标准库就够。

### Sentry

Sentry Electron Logs 支持 structured logs，并把 logs 和 errors/traces 放在一起查。Sentry AI monitoring 也覆盖 agent runs、tool calls、model interactions。

参考：

- [Sentry Electron structured logs](https://docs.sentry.io/platforms/javascript/guides/electron/logs/)
- [Sentry AI Agent monitoring](https://docs.sentry.io/ai/monitoring/agents/)

取舍：

- 适合“用户机器上偶发 bug，需要远端 issue 聚合和 release 维度定位”。
- 默认不上。Reflecta 是本地优先、个人理解产品，日志可能含用户内容和 AI 对话，远端上传必须是显式 opt-in。

### Langfuse / LangSmith

Langfuse 和 LangSmith 更偏 LLM/agent observability：trace、generation、token/cost、prompt、tool execution、质量评估。

参考：

- [Langfuse OpenTelemetry integration](https://langfuse.com/integrations/native/opentelemetry)
- [LangSmith Observability](https://docs.langchain.com/langsmith/observability)

取舍：

- 如果未来要评估 agent 质量、成本、prompt/tool 失败分布，可以接。
- 它们不是通用 app log 的替代品；应作为 agent trace adapter。

### Loki / Elastic

Loki 和 Elastic 是成熟的集中式日志存储/查询方案。Loki 官方特别强调 labels 要低基数，不要把 trace id、order id 这种一次性 ID 当 label；Elastic Common Schema 提供统一字段命名。

参考：

- [Grafana Loki label best practices](https://grafana.com/docs/loki/latest/get-started/labels/bp-labels/)
- [Elastic Common Schema reference](https://www.elastic.co/docs/reference/ecs)

取舍：

- 当前过重。Reflecta 不是多实例服务端。
- 可以借鉴“低基数索引，高基数字段放结构化 metadata”的原则。

## 目标架构

### 日志分层

| 层                      | 用途                            | 存储                                    |
| ----------------------- | ------------------------------- | --------------------------------------- |
| Human log               | 本地人工查看、Electron 默认捕获 | `~/Library/Logs/<app>/main.log`         |
| Diagnostic event log    | AI/脚本稳定解析                 | `~/Library/Logs/<app>/events.ndjson`    |
| Agent session event log | 重放 agent turn/tool/approval   | `<contentStorageRoot>/Sessions/*.jsonl` |
| Diagnostic bundle       | 一次 bug 的可交付证据包         | 用户显式导出，zip 或目录                |

### DiagnosticEvent schema

每行一个 JSON：

```json
{
  "ts": "2026-06-24T07:43:27.062Z",
  "level": "info",
  "severityNumber": 9,
  "event": "agent.run.started",
  "scope": "agent",
  "message": "Agent run started",
  "app": {
    "name": "Reflecta",
    "version": "1.1.0",
    "profile": "dev",
    "runtime": "electron-main"
  },
  "context": {
    "sessionId": "019ef895-6505-7c0e-8c59-458bd2cf1229",
    "runId": "run_bXgHqi47Y6AO6ch8AsUhY",
    "requestId": "req_...",
    "traceId": "..."
  },
  "attrs": {
    "model.provider": "opencode-go",
    "model.id": "deepseek-v4-flash"
  }
}
```

字段规则：

- `event` 必须稳定，使用点分命名：`app.started`、`ipc.request.failed`、`agent.run.failed`、`retrieval.query.completed`。
- `message` 给人看；AI 以 `event` 和 `attrs` 为准。
- `attrs` 只能放 JSON-safe 值。
- `error.message`、`error.stack`、`error.name` 放在 `attrs`，不要塞进 message。
- `sessionId`、`runId`、`toolCallId`、`messageId` 是属性，不是文件名和 Loki label。
- 默认不记录 API key、token、完整用户内容、完整模型输出。

### 推荐事件

P0 只打这些：

| Event                                  | 位置                    | 目的                                  |
| -------------------------------------- | ----------------------- | ------------------------------------- |
| `app.logging.initialized`              | `logger.ts`             | 记录日志路径/profile/version          |
| `app.db.initialized` / `app.db.failed` | `db/index.ts`           | 定位启动和 migration 问题             |
| `ipc.request.completed`                | `services/index.ts`     | 记录 channel、durationMs              |
| `ipc.request.failed`                   | `services/index.ts`     | 捕获所有 service 错误和 stack         |
| `agent.run.started`                    | `pi-agent-host.ts`      | 关联 session/run/model                |
| `agent.run.completed`                  | `pi-agent-host.ts`      | 记录耗时                              |
| `agent.run.failed`                     | `pi-agent-host.ts`      | 记录错误                              |
| `agent.tool.started/completed/failed`  | `pi-agent-host.ts`      | 关联 toolCallId                       |
| `retrieval.query.completed/failed`     | search/retrieval seam   | 持久化 RetrievalTrace                 |
| `renderer.error`                       | preload/renderer bridge | 捕获 window error/unhandled rejection |

不要先铺满业务 CRUD 日志。真正能 debug 的，是跨 seam 的生命周期和失败事件。

### 展示格式

文件格式：

- `main.log`：保留现在的人类可读格式。
- `events.ndjson`：一行一个 JSON，给 AI、`jq`、诊断导出使用。
- `Sessions/*.jsonl`：保留 Pi session 原格式。

未来 UI 如果要做 Log Viewer，只需要：

- 左侧过滤：level、scope、event、sessionId、runId。
- 主列表：time、level、event、message。
- 详情：pretty JSON attrs 和关联 session file。
- 默认不展示 raw user content，除非用户打开诊断详情。

### 存储与保留

短期：

- `main.log` 继续由 `electron-log` 管理。
- `events.ndjson` 放同一个 OS log dir。
- 单文件滚动 5-10MB，保留最近 3-5 个文件即可。
- Agent session JSONL 跟随 Content Storage Root，因为它属于用户内容/会话历史。

不要现在把日志写 SQLite。JSONL 顺序写更简单、更不容易和业务 DB 一起坏；AI 读文件也更直接。

### 诊断包

新增 `DiagnosticsService.exportDebugBundle(input)`：

```ts
type ExportDebugBundleInput = {
  since?: string;
  sessionId?: string;
  includeUserContent?: boolean;
};
```

Bundle 内容：

- `manifest.json`：app version、profile、platform、log paths、content root hash、导出时间。
- `events.ndjson`：按 `since` 截取。
- `main.log`：按 `since` 附近截取或 tail。
- `sessions/<sessionId>.jsonl`：如果提供 sessionId。
- `config.redacted.json`：去掉 API key/token，保留 provider id/model id/paths 是否存在。
- `status.json`：DB path exists、migration version、retrieval index status、active embedding config id。

这样 AI 拿到 bundle 后的查询顺序很明确：

1. 看 `manifest.json` 确认版本和路径。
2. 查 `events.ndjson` 的 `level >= error`。
3. 用 `sessionId/runId/toolCallId` 跳到 session JSONL。
4. 如果是检索问题，查同 run 下的 `retrieval.query.*`。
5. 如果是启动/迁移问题，查 `app.db.*` 和 `main.log` stack。

## 落地顺序

### P0：本地 AI-debug 可用

1. 新增 `DiagnosticEvent` 类型和 `writeDiagnosticEvent()`。
2. 新增 `events.ndjson` writer，使用 Node `fs`，不加依赖。
3. 在 IPC wrapper、DB init、agent run/tool、retrieval seam 写关键事件。
4. 新增 redaction helper：屏蔽 apiKey、token、authorization、password、safe:v1。
5. 新增 `exportDebugBundle()`，先导出目录也可以，zip 不是必须。
6. 加最小测试：JSONL 单行、redaction、IPC failure 会写事件。

### P1：补齐 renderer 和 retrieval

1. Renderer `window.onerror` / `unhandledrejection` 通过 preload 发到 main。
2. IPC proxy 的 renderer error 不只 `console.error`，也进入 diagnostic event。
3. Agent read tools 的 retrieval trace 挂上 `runId/toolCallId`。
4. 设置页加“打开日志目录 / 导出诊断包”。

### P2：远端和专业平台

只有出现这些需求才做：

- 需要 release 维度线上错误聚合：接 Sentry。
- 需要 LLM cost、prompt、token、质量评估：接 Langfuse/LangSmith。
- 需要团队多机器集中查询：接 OpenTelemetry Collector + Loki/Elastic。

## 验收标准

- 任意 IPC service 抛错，`events.ndjson` 都有一条 `ipc.request.failed`，包含 channel、durationMs、error message、stack。
- 任意 Agent run 失败，能从 `events.ndjson` 用 `sessionId/runId` 找到 session JSONL 中同一轮的 user/tool/model 事件。
- Retrieval 结果异常时，能找到同一 `runId/toolCallId` 下的 `RetrievalTrace`。
- 诊断包不包含明文 API key/token。
- AI 只读诊断包，不访问用户全量数据库，也能判断大多数启动、IPC、agent、retrieval 问题的第一原因。
