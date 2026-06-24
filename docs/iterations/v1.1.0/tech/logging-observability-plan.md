# Logging / Observability Plan

> 日期：2026-06-24
>
> 状态：Proposal
>
> 目标：任何 bug 出现时，可以把诊断材料交给 AI，让 AI 按时间线、运行 ID、错误栈和上下文自己查日志并定位问题。

## 目录

1. 决策
2. 目标和非目标
3. 目标架构
4. DiagnosticEvent 契约
5. P0 写入点
6. 诊断包
7. 落地顺序
8. 验收标准
9. 附录：现状和调研依据

## 1. 决策

`main.log` 改成 AI-first 的 JSONL 结构化日志。

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

不再新增 `events.ndjson`。它只有在需要同时保留“人看的 `main.log`”和“AI 查的结构化日志”时才有价值。现在目标是 AI 解析方便，所以只保留一份应用日志。

保留 `electron-log`，但只用它做三件事：

- 管理 Electron 平台上的日志路径。
- 管理文件滚动和大小。
- 接住未捕获异常和 Electron runtime 事件。

应用自己的日志入口不再直接暴露 `electron-log` scope，而是通过一个小的 `DiagnosticLog` interface 写入 JSON event。

## 2. 目标和非目标

目标：

- AI 能从 `main.log` 找到错误、时间线和跨模块上下文。
- AI 能用 `sessionId` / `runId` / `toolCallId` 从 `main.log` 跳到对应 `Sessions/*.jsonl`。
- IPC、DB 初始化、Agent run/tool、retrieval trace 都能被串起来。
- 日志默认不泄露 API key、token、完整用户正文和完整模型输出。
- 用户可以导出一个诊断包交给 AI，不需要 AI 访问全量本地数据库。

非目标：

- 不上 ELK / Loki / OpenTelemetry Collector。
- 不默认上传 Sentry / Langfuse / LangSmith。
- 不把日志写进业务 SQLite。
- 不铺满业务 CRUD 日志。
- 不优化 `main.log` 的人工阅读体验。

## 3. 目标架构

### 3.1 存储

| 文件               | 位置                            | 职责                                |
| ------------------ | ------------------------------- | ----------------------------------- |
| `main.log`         | `~/Library/Logs/<app>/main.log` | 应用诊断事件，JSONL                 |
| `Sessions/*.jsonl` | `<contentStorageRoot>/Sessions` | Agent turn / tool / approval replay |
| debug bundle       | 用户显式导出                    | 一次 bug 的可交付诊断材料           |

### 3.2 Modules

```text
Application code
  -> DiagnosticLog.write(event)
       -> redaction
       -> JSON.stringify(one line)
       -> electron-log file transport

Agent runtime
  -> DiagnosticLog.write(agent.run/tool events)
  -> AgentSessionLog.appendEvent(reflecta.agent.event)

DiagnosticsService
  -> exportDebugBundle()
       -> main.log slice
       -> related Sessions/*.jsonl
       -> redacted config
       -> db/retrieval status
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
- 高基数字段如 `runId`、`toolCallId` 是普通字段，不作为未来 Loki/Elastic label。
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

## 6. 诊断包

`DiagnosticsService.exportDebugBundle(input)`：

```ts
type ExportDebugBundleInput = {
  since?: string;
  sessionId?: string;
  includeUserContent?: boolean;
};
```

导出内容：

| 文件                         | 内容                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `manifest.json`              | app version、profile、platform、导出时间、路径摘要        |
| `main.log`                   | 按 `since` 截取或 tail 的 JSONL 应用日志                  |
| `sessions/<sessionId>.jsonl` | 指定 session 的 Agent JSONL                               |
| `config.redacted.json`       | 去掉密钥后的 provider/model/path 配置                     |
| `status.json`                | DB path exists、migration version、retrieval index status |

AI debug 顺序：

1. 读 `manifest.json` 确认版本和环境。
2. 查 `main.log` 的 `level=error` / `level=warn`。
3. 用 `sessionId` / `runId` / `toolCallId` 跳到 session JSONL。
4. retrieval 问题查同一 `runId/toolCallId` 的 `retrieval.query.*`。
5. 启动/迁移问题查 `app.db.*` 和错误栈。

## 7. 落地顺序

### P0：让 AI 能查核心故障

1. 新增 `DiagnosticEvent`、`DiagnosticContext`、`DiagnosticLog.write()`。
2. 让 `main.log` 输出 JSONL。
3. 加 redaction helper。
4. 在 IPC wrapper、DB init、Agent run/tool、retrieval seam 写事件。
5. 新增 `exportDebugBundle()`。
6. 加最小测试：JSONL 单行、redaction、IPC failure 事件。

### P1：补齐 renderer 和关联上下文

1. preload 捕获 renderer `window.onerror` / `unhandledrejection`。
2. renderer IPC proxy 的错误进入 `renderer.error`。
3. retrieval trace 挂上 `runId/toolCallId`。
4. 设置页加“导出诊断包”。

### P2：远端平台

只在真实需要时增加 adapter：

- 需要 release 维度线上错误聚合：Sentry。
- 需要 LLM 成本、prompt、质量评估：Langfuse / LangSmith。
- 需要团队集中查询：OpenTelemetry Collector + Loki/Elastic。

## 8. 验收标准

- IPC service 抛错时，`main.log` 有一条 `ipc.request.failed`，包含 channel、durationMs、error message、stack。
- Agent run 失败时，能从 `main.log` 用 `sessionId/runId` 找到对应 session JSONL。
- Tool 失败时，能从 `toolCallId` 找到 started/failed 事件和 session JSONL 里的 tool event。
- Retrieval 异常时，能找到同一 `runId/toolCallId` 下的 `RetrievalTrace`。
- 诊断包不包含明文 API key、token、authorization、password、`safe:v1:*`。
- AI 只读诊断包，不访问全量业务 DB，也能判断启动、IPC、Agent、retrieval 问题的第一原因。

## 9. 附录：现状和调研依据

### 9.1 当前现状

应用日志：

- 入口：`apps/electron/src/main/logger.ts`。
- 依赖：`electron-log/main`。
- 文件：`~/Library/Logs/Reflecta/main.log` 或 `~/Library/Logs/Reflecta Dev/main.log`。
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

CLI：

- stdout/stderr 已经是 JSON/JSONL。
- 暂不并入 Electron 应用日志。

### 9.2 社区依据

采用：

- OpenTelemetry Logs Data Model 的字段思路：timestamp、severity、body/message、resource、attributes、trace context。
- JSONL：追加写简单、每行独立、AI 和脚本容易查。
- Loki/Elastic 的经验：低基数字段才能做 label/index，高基数 ID 放属性。

暂不采用：

- OpenTelemetry JS logs runtime：当前对本地桌面 app 过重。
- Pino/Winston/LogTape：现在标准库加 `electron-log` 已够，不加依赖。
- Sentry/Langfuse/LangSmith：默认远端上传和 Reflecta 本地优先/隐私目标冲突，只能做 opt-in adapter。

参考：

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [electron-log](https://github.com/megahertz/electron-log)
- [Grafana Loki label best practices](https://grafana.com/docs/loki/latest/get-started/labels/bp-labels/)
- [Elastic Common Schema](https://www.elastic.co/docs/reference/ecs)
- [Sentry Electron structured logs](https://docs.sentry.io/platforms/javascript/guides/electron/logs/)
- [Langfuse OpenTelemetry integration](https://langfuse.com/integrations/native/opentelemetry)
- [LangSmith Observability](https://docs.langchain.com/langsmith/observability)
