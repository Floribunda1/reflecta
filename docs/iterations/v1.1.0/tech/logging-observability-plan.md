# Logging / Observability Plan

> 日期：2026-06-24
>
> 状态：Proposal
>
> 目标：任何 bug 出现时，AI 可以直接读取本机日志和 Agent session，按时间线、运行 ID、错误栈和上下文定位问题。

## 目录

1. 决策
2. 目标和非目标
3. 目标架构
4. DiagnosticEvent 契约
5. P0 写入点
6. AI 调试入口
7. 落地顺序
8. 验收标准
9. 附录：现状和依据

## 1. 决策

`main.log` 改成 AI-first 的 JSONL 结构化日志，并放到 Content Storage Root：

```text
<contentStorageRoot>/logs/main.log
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
- Agent session JSONL 已经在 Content Storage Root，`main.log` 放同一个 root 才能按 `sessionId/runId/toolCallId` 就地关联。
- 这个软件当前只有个人使用，不需要 OS 级日志目录、远端平台或客服导出路径。

保留 `electron-log`，但只用它做两件事：

- 文件滚动和大小限制。
- 接住未捕获异常和 Electron runtime 事件。

应用自己的日志入口不再直接暴露 `electron-log` scope，而是通过一个小的 `DiagnosticLog` interface 写入 JSON event。

## 2. 目标和非目标

目标：

- AI 能从 `<contentStorageRoot>/logs/main.log` 找到错误、时间线和跨模块上下文。
- AI 能用 `sessionId` / `runId` / `toolCallId` 从 `main.log` 跳到 `Sessions/*.jsonl`。
- IPC、DB 初始化、Agent run/tool、retrieval trace 能被串起来。
- 日志默认不泄露 API key、token、完整用户正文和完整模型输出。

非目标：

- 不新增 `events.ndjson`。
- 不增加 `exportDebugBundle()` 或诊断包导出功能。
- 不接任何远端观测平台。
- 不把日志写进业务 SQLite。
- 不铺满业务 CRUD 日志。
- 不优化 `main.log` 的人工阅读体验。

## 3. 目标架构

### 3.1 存储

| 文件               | 位置                               | 职责                                |
| ------------------ | ---------------------------------- | ----------------------------------- |
| `main.log`         | `<contentStorageRoot>/logs`        | 应用诊断事件，JSONL                 |
| `Sessions/*.jsonl` | `<contentStorageRoot>/Sessions`    | Agent turn / tool / approval replay |
| `reflecta.db`      | `<contentStorageRoot>/reflecta.db` | 业务数据，必要时只查状态不全量读取  |
| `retrieval-index`  | `<contentStorageRoot>`             | 检索索引状态                        |

### 3.2 Modules

```text
Application code
  -> DiagnosticLog.write(event)
       -> redaction
       -> JSON.stringify(one line)
       -> <contentStorageRoot>/logs/main.log

Agent runtime
  -> DiagnosticLog.write(agent.run/tool events)
  -> AgentSessionLog.appendEvent(reflecta.agent.event)

AI debugger
  -> read logs/main.log
  -> follow sessionId/runId/toolCallId into Sessions/*.jsonl
  -> inspect status from DB/retrieval when needed
```

### 3.3 Interfaces

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

Interface 要小：调用方只知道 `write(event)`，不知道文件路径、滚动、redaction、JSON 序列化、`electron-log` transport。

## 4. DiagnosticEvent 契约

### 4.1 命名

`event` 用点分命名，稳定后不要随意改：

- `app.logging.initialized`
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
- `retrieval.query.completed`
- `retrieval.query.failed`
- `renderer.error`

### 4.2 字段规则

- `ts` 必须是 ISO string。
- `level` 只表达严重程度，不承载业务状态。
- `event` 是机器判断入口；`message` 只放短摘要。
- `context` 只放跨事件关联 ID。
- `attrs` 放事件细节，必须 JSON-safe。
- `error.name`、`error.message`、`error.stack` 放进 `attrs`。
- 默认不记录完整用户正文、完整模型输出、API key、token、authorization、password、`safe:v1:*`。

### 4.3 示例

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

## 5. P0 写入点

只在深 seam 写日志，不在每个业务函数里散打。

| Seam                             | Event                     | 必要字段                               |
| -------------------------------- | ------------------------- | -------------------------------------- |
| `logger.ts` 初始化               | `app.logging.initialized` | profile, version, logPath              |
| `db/index.ts` 初始化成功         | `app.db.initialized`      | dbPath, migrationMode                  |
| `db/index.ts` 初始化失败         | `app.db.failed`           | dbPath, error                          |
| `services/index.ts` IPC 成功     | `ipc.request.completed`   | requestId, channel, durationMs         |
| `services/index.ts` IPC 失败     | `ipc.request.failed`      | requestId, channel, durationMs, error  |
| `pi-agent-host.ts` run 生命周期  | `agent.run.*`             | sessionId, runId, model                |
| `pi-agent-host.ts` tool 生命周期 | `agent.tool.*`            | sessionId, runId, toolCallId, toolName |
| retrieval seam                   | `retrieval.query.*`       | runId, toolCallId, RetrievalTrace      |
| preload/renderer bridge          | `renderer.error`          | error, route if available              |

P0 不记录普通 CRUD 成功事件。AI debug 优先需要跨 seam 生命周期和失败点。

## 6. AI 调试入口

AI 不需要导出包。调试时直接读取同一个 Content Storage Root：

```text
<contentStorageRoot>/
  logs/main.log
  Sessions/*.jsonl
  reflecta.db
  retrieval-index/
```

调试顺序：

1. 查 `logs/main.log` 的 `level=error` / `level=warn`。
2. 用 `sessionId` / `runId` / `toolCallId` 跳到 session JSONL。
3. retrieval 问题查同一 `runId/toolCallId` 的 `retrieval.query.*`。
4. 启动/迁移问题查 `app.db.*` 和错误栈。
5. 只有需要确认数据状态时才查 DB 或 retrieval index，不默认扫全量用户内容。

## 7. 落地顺序

### P0：让 AI 能查核心故障

1. 新增 `DiagnosticEvent`、`DiagnosticContext`、`DiagnosticLog.write()`。
2. 把 `main.log` 写到 `<contentStorageRoot>/logs/main.log`。
3. 让 `main.log` 输出 JSONL。
4. 加 redaction helper。
5. 在 IPC wrapper、DB init、Agent run/tool、retrieval seam 写事件。
6. 加最小测试：JSONL 单行、redaction、IPC failure 事件。

### P1：补齐 renderer 和关联上下文

1. preload 捕获 renderer `window.onerror` / `unhandledrejection`。
2. renderer IPC proxy 的错误进入 `renderer.error`。
3. retrieval trace 挂上 `runId/toolCallId`。

## 8. 验收标准

- `main.log` 位于 `<contentStorageRoot>/logs/main.log`。
- IPC service 抛错时，`main.log` 有一条 `ipc.request.failed`，包含 channel、durationMs、error message、stack。
- Agent run 失败时，能从 `main.log` 用 `sessionId/runId` 找到对应 session JSONL。
- Tool 失败时，能从 `toolCallId` 找到 started/failed 事件和 session JSONL 里的 tool event。
- Retrieval 异常时，能找到同一 `runId/toolCallId` 下的 `RetrievalTrace`。
- `main.log` 不包含明文 API key、token、authorization、password、`safe:v1:*`。

## 9. 附录：现状和依据

### 9.1 当前现状

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
- 缺口：没有持久进入应用诊断日志，Agent debug 时不一定能按 `runId/toolCallId` 找回。

### 9.2 依据

采用：

- OpenTelemetry Logs Data Model 的字段思路：timestamp、severity、body/message、resource、attributes、trace context。
- JSONL：追加写简单、每行独立、AI 和脚本容易查。
- Content Storage Root：已有 DB、retrieval index、assets、Agent Sessions，是 Reflecta 用户数据和调试上下文的实际根目录。

暂不采用：

- OS log dir：会把应用日志和 Agent session 分开，AI debug 时还要跨路径找上下文。
- OpenTelemetry JS logs runtime：当前对个人本地桌面 app 过重。
- Pino/Winston/LogTape：现在标准库加 `electron-log` 已够，不加依赖。
- 远端观测平台：当前只有个人使用，先不接。

参考：

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [electron-log](https://github.com/megahertz/electron-log)
