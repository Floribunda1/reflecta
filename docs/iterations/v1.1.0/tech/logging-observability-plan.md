# Logging / Observability Plan

> 日期：2026-06-24
>
> 状态：Implemented
>
> 目标：任何 bug 出现时，AI 可以直接读取本机日志和 Agent session，按时间线、运行 ID、错误栈和上下文定位问题。

## 目录

1. 决策
2. 目标和非目标
3. 低侵入策略
4. 目标架构
5. DiagnosticEvent 契约
6. P0 写入点
7. AI 调试入口
8. 落地顺序
9. 验收标准
10. 附录：现状和依据

## 1. 决策

应用日志改成 AI-first 的 JSONL 结构化日志，按天滚动，并放到 Content Storage Root：

```text
<contentStorageRoot>/logs/reflecta-YYYY-MM-DD.jsonl
```

每一行是一条完整 JSON event：

```json
{
  "ts": "2026-06-24T07:43:27.062Z",
  "level": "error",
  "event": "ipc.request.failed",
  "scope": "ipc",
  "context": { "requestId": "req_123" },
  "attrs": { "ipc.channel": "chat.sendAgentCommand", "error.message": "..." }
}
```

为什么放 Content Storage Root：

- Reflecta 的可调试状态都在这里：`reflecta.db`、`retrieval-index`、`Sessions/*.jsonl`。
- Agent session JSONL 已经在 Content Storage Root，应用日志放同一个 root 才能按 `sessionId/runId/toolCallId` 就地关联。
- 这个软件当前只有个人使用，不需要 OS 级日志目录、远端平台或客服导出路径。

保留 `electron-log`，但只用它接住 Electron 侧的未捕获异常和 runtime 事件，并转成 `DiagnosticEvent`。

`DiagnosticLog` 自己负责：

- 解析 Content Storage Root。
- 按本地日期选择日志文件。
- 追加 JSONL。
- 单日文件超限后的序号滚动。
- 保留最近 30 天。

应用自己的日志入口不再直接暴露 `electron-log` scope，而是通过一个小的 `DiagnosticLog` interface 写入 JSON event。

## 2. 目标和非目标

目标：

- AI 能从 `<contentStorageRoot>/logs/reflecta-YYYY-MM-DD.jsonl` 找到错误、时间线和跨模块上下文。
- AI 能用 `sessionId` / `runId` / `toolCallId` 从应用日志跳到 `Sessions/*.jsonl`。
- IPC、DB 初始化、Agent run/tool、renderer error 能被串起来；retrieval 通过 IPC 或 tool 入口追踪。
- 日志默认不泄露 API key、token、完整用户正文和完整模型输出。

非目标：

- 不新增 `events.ndjson`。
- 不增加 `exportDebugBundle()` 或诊断包导出功能。
- 不接任何远端观测平台。
- 不把日志写进业务 SQLite。
- 不铺满业务 CRUD 日志。
- 不优化应用日志的人工阅读体验。

## 3. 低侵入策略

日志是 cross-cutting concern，不应该散进业务逻辑。

Reflecta 的规则：

- 业务函数不直接调用 `writeDiagnosticEvent()`。
- 只在稳定边界打诊断日志：process/app fallback、renderer fallback、React ErrorBoundary、IPC wrapper、DB init、Agent session event append、tool execute wrapper。
- Agent 的完整对话、工具输入输出、approval 和文本 delta 仍以 `Sessions/*.jsonl` 为 source of truth。
- Diagnostic JSONL 只保存 AI 定位问题所需的索引信息：时间、错误、耗时、channel、sessionId、runId、toolCallId、toolName 和摘要。
- 不为了“完整”记录完整用户正文、完整模型输出或完整工具结果；需要细节时用 correlation id 跳到 session JSONL。

这不是少记日志，而是把日志放在高杠杆边界：覆盖完整链路，同时不污染业务代码。

## 4. 目标架构

### 4.1 存储

| 文件                        | 位置                               | 职责                                |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| `reflecta-YYYY-MM-DD.jsonl` | `<contentStorageRoot>/logs`        | 应用诊断事件，按天滚动的 JSONL      |
| `Sessions/*.jsonl`          | `<contentStorageRoot>/Sessions`    | Agent turn / tool / approval replay |
| `reflecta.db`               | `<contentStorageRoot>/reflecta.db` | 业务数据，必要时只查状态不全量读取  |
| `retrieval-index`           | `<contentStorageRoot>`             | 检索索引状态                        |

### 4.2 日志命名和滚动

应用日志按本地日期写入：

```text
logs/reflecta-2026-06-24.jsonl
logs/reflecta-2026-06-25.jsonl
```

规则：

- 文件名使用运行环境本地日期，格式固定为 `reflecta-YYYY-MM-DD.jsonl`。
- 一条 event 必须完整写在一行。
- 日切后新 event 写入新日期文件。
- 如果单日文件超过大小上限，追加序号：`reflecta-YYYY-MM-DD.1.jsonl`、`reflecta-YYYY-MM-DD.2.jsonl`。
- 默认保留最近 30 天日志。

### 4.3 Modules

```text
Boundary instrumentation
  -> logger.ts fallback hooks
  -> services/index.ts IPC wrapper
  -> db/index.ts init boundary
  -> AgentSessionLog.appendEvent mirror
  -> ToolDefinition.execute wrapper
       -> DiagnosticLog.write(event)
       -> redaction
       -> JSON.stringify(one line)
       -> <contentStorageRoot>/logs/reflecta-YYYY-MM-DD.jsonl

Agent runtime
  -> AgentSessionLog.appendEvent(reflecta.agent.event)

AI debugger
  -> read logs/reflecta-*.jsonl for the date range
  -> follow sessionId/runId/toolCallId into Sessions/*.jsonl
  -> inspect status from DB/retrieval when needed
```

### 4.4 Interfaces

`DiagnosticLog` 是应用日志的唯一 interface：

```ts
type DiagnosticEvent = {
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  scope: "app" | "ipc" | "db" | "agent" | "retrieval" | "renderer";
  message?: string;
  context?: DiagnosticContext;
  attrs?: Record<string, unknown>;
};

type DiagnosticContext = {
  requestId?: string;
  traceId?: string;
  sessionId?: string;
  runId?: string;
  messageId?: string;
  toolCallId?: string;
};
```

Interface 要小：调用方只知道 `write(event)`，不知道文件路径、日切、大小滚动、保留策略、redaction、JSON 序列化。

## 5. DiagnosticEvent 契约

### 5.1 命名

`event` 用点分命名，稳定后不要随意改：

- `app.logging.initialized`
- `app.fallback.error`
- `app.db.initialized`
- `app.db.failed`
- `ipc.request.completed`
- `ipc.request.failed`
- `agent.run.started`
- `agent.run.completed`
- `agent.run.failed`
- `agent.tool.started`
- `agent.tool.completed`
- `agent.tool.failed`
- `renderer.error`

`retrieval.query.*` 暂不作为 P0 诊断事件。检索从 UI 触发时由 IPC wrapper 覆盖；从 Agent tool 触发时由 `agent.tool.*` 和 session JSONL 覆盖。

### 5.2 字段规则

- `ts` 必须是 ISO string。
- `level` 只表达严重程度，不承载业务状态。
- `event` 是机器判断入口；`message` 只放短摘要。
- `context` 只放跨事件关联 ID。
- `attrs` 放事件细节，必须 JSON-safe。
- `error.name`、`error.message`、`error.stack` 放进 `attrs`。
- 默认不记录完整用户正文、完整模型输出、API key、token、authorization、password、`safe:v1:*`。

### 5.3 示例

```json
{
  "ts": "2026-06-24T07:43:27.062Z",
  "level": "error",
  "event": "agent.run.failed",
  "scope": "agent",
  "message": "Agent run failed",
  "context": {
    "sessionId": "019ef895-6505-7c0e-8c59-458bd2cf1229",
    "runId": "run_bXgHqi47Y6AO6ch8AsUhY"
  },
  "attrs": {
    "model.provider": "opencode-go",
    "model.id": "deepseek-v4-flash",
    "error.message": "Agent response was empty",
    "error.stack": "..."
  }
}
```

## 6. P0 写入点

只在深 seam 写日志，不在每个业务函数里散打。

| Seam                                                        | Event                     | 必要字段                              |
| ----------------------------------------------------------- | ------------------------- | ------------------------------------- |
| `logger.ts` 初始化                                          | `app.logging.initialized` | profile, version, logPath             |
| `logger.ts` fallback hooks                                  | `app.fallback.error`      | source, error/process detail          |
| `db/index.ts` 初始化成功                                    | `app.db.initialized`      | dbPath, migrationMode                 |
| `db/index.ts` 初始化失败                                    | `app.db.failed`           | dbPath, error                         |
| `services/index.ts` IPC 成功                                | `ipc.request.completed`   | requestId, channel, durationMs        |
| `services/index.ts` IPC 失败                                | `ipc.request.failed`      | requestId, channel, durationMs, error |
| `AgentSessionLog.appendEvent`                               | `agent.run.*`             | sessionId, runId, error/summary       |
| `AgentSessionLog.appendEvent`                               | `agent.approval.*`        | sessionId, runId, approvalId          |
| `ToolDefinition.execute` wrapper                            | `agent.tool.*`            | toolCallId, toolName, durationMs      |
| preload / React ErrorBoundary / main renderer error channel | `renderer.error`          | error, route if available             |

P0 不记录普通 CRUD 成功事件。AI debug 优先需要跨 seam 生命周期和失败点。

## 7. AI 调试入口

AI 不需要导出包。调试时直接读取同一个 Content Storage Root：

```text
<contentStorageRoot>/
  logs/reflecta-YYYY-MM-DD.jsonl
  Sessions/*.jsonl
  reflecta.db
  retrieval-index/
```

调试顺序：

1. 按日期范围读取 `logs/reflecta-*.jsonl`。
2. 查 `level=error` / `level=warn`。
3. 用 `sessionId` / `runId` / `toolCallId` 跳到 session JSONL。
4. Tool 或 retrieval 问题先查 `agent.tool.*`，再用 `toolCallId` 跳到 session JSONL 的 tool event。
5. 启动/迁移问题查 `app.db.*` 和错误栈。
6. 只有需要确认数据状态时才查 DB 或 retrieval index，不默认扫全量用户内容。

## 8. 落地顺序

### P0：让 AI 能查核心故障

1. 新增 `DiagnosticEvent`、`DiagnosticContext`、`DiagnosticLog.write()`。
2. 把应用日志写到 `<contentStorageRoot>/logs/reflecta-YYYY-MM-DD.jsonl`。
3. 让应用日志输出 JSONL。
4. 加 redaction helper。
5. 在 IPC wrapper、DB init、Agent session append、tool execute wrapper 写事件。
6. 加最小测试：JSONL 单行、redaction、fallback error、renderer error、agent failed event、tool completed event。

### P1：补齐 renderer 和关联上下文

1. preload 捕获 renderer `window.onerror` / `unhandledrejection`。
2. preload/main renderer error channel 写入 `renderer.error`。
3. React ErrorBoundary 捕获 render tree 错误并上报 `renderer.error`。
4. 如果 session JSONL 对 retrieval 不够用，再把 retrieval trace 摘要挂到 tool wrapper，而不是散进 search 业务函数。

## 9. 验收标准

- 应用日志位于 `<contentStorageRoot>/logs/reflecta-YYYY-MM-DD.jsonl`。
- 跨日期运行会写入不同日期文件。
- IPC service 抛错时，当天应用日志有一条 `ipc.request.failed`，包含 channel、durationMs、error message、stack。
- Agent run 失败时，能从应用日志用 `sessionId/runId` 找到对应 session JSONL。
- Tool 失败时，能从 `toolCallId` 找到 started/failed 事件和 session JSONL 里的 tool event。
- Retrieval 异常时，能通过 IPC failure 或 agent tool failure 找到错误入口，并用 `toolCallId` 查 session JSONL。
- 应用日志不包含明文 API key、token、authorization、password、`safe:v1:*`。

## 10. 附录：现状和依据

### 10.1 当前现状

应用日志：

- 入口：`apps/electron/src/main/logger.ts`。
- 依赖：`electron-log/main`。
- 当前文件：`~/Library/Logs/Reflecta/main.log` 或 `~/Library/Logs/Reflecta Dev/main.log`。
- 当前格式：多行 pretty text，不适合 AI 稳定解析。
- 当前 scope：`appLog`、`agentLog`、`ipcLog`。

Agent 会话日志：

- 入口：`apps/electron/src/main/services/agent/pi-session-log.ts`。
- 存储：`<contentStorageRoot>/Sessions/*.jsonl`。
- 事件：`reflecta.agent.event`。
- 优点：已有 `sessionId`、`runId`、`messageId`、`toolCallId`，能 replay agent turn。
- 缺口：不覆盖 app lifecycle、IPC、DB、retrieval index、renderer error。

IPC 错误：

- 入口：`apps/electron/src/main/services/index.ts`。
- 当前只包装错误返回 `{ __isIpcError, code, message }`。
- 缺口：没有记录 channel、duration、args shape、stack。

Retrieval trace：

- 类型：`packages/server/src/domains/retrieval/types.ts` 的 `RetrievalTrace`。
- 当前随 `SearchCore.retrieveKnowledge()` 返回。
- P0 决策：不单独持久成 `retrieval.query.*`。Agent 调用时 trace 在 tool output/session JSONL；UI 调用时由 IPC wrapper 记录失败入口。

### 10.2 依据

采用：

- OpenTelemetry Logs Data Model 的字段思路：timestamp、severity、body/message、resource、attributes、trace context。
- JSONL：追加写简单、每行独立、AI 和脚本容易查。
- Content Storage Root：已有 DB、retrieval index、assets、Agent Sessions，是 Reflecta 用户数据和调试上下文的实际根目录。
- Express middleware / NestJS interceptor / OpenTelemetry instrumentation 的共同原则：日志这类横切关注点优先放在边界层，而不是散进业务方法。

暂不采用：

- OS log dir：会把应用日志和 Agent session 分开，AI debug 时还要跨路径找上下文。
- OpenTelemetry JS logs runtime：当前对个人本地桌面 app 过重。
- Pino/Winston/LogTape：现在标准库加 `electron-log` 已够，不加依赖。
- 远端观测平台：当前只有个人使用，先不接。

参考：

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [OpenTelemetry Instrumentation](https://opentelemetry.io/docs/concepts/instrumentation/)
- [Express middleware](https://expressjs.com/en/5x/guide/using-middleware/)
- [NestJS interceptors](https://github.com/nestjs/docs.nestjs.com/blob/master/content/interceptors.md)
- [Electron app events](https://electronjs.org/docs/latest/api/app)
- [React Error Boundaries](https://legacy.reactjs.org/docs/error-boundaries.html)
- [electron-log](https://github.com/megahertz/electron-log)
