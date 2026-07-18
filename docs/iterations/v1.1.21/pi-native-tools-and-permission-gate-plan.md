# Pi 内置工具与危险命令确认计划

> 版本：v1.1.21  
> 状态：Accepted  
> 范围：Electron Agent runtime、Agent session event、Agent tool UI

## 1. 背景

Reflecta 当前只使用了 Pi 的 Agent loop，自行实现了一个 `ResourceLoader` 空壳、`file_read` 和需要逐次审批的 `bash`。这造成了三个问题：

1. `ResourceLoader` 的多数方法只是返回空数组，重复实现了 Pi 已经提供的配置能力。
2. `file_read` 和 `bash` 重复维护路径解析、超时、截断和结果结构，能力仍弱于 Pi 内置工具。
3. 所有 Bash 命令都被当作知识写入提案审批；`ls`、`rg`、测试等连续只读操作也会反复打断用户。

Pi 的核心设计是提供完整的 `read`、`bash`、`edit`、`write` 工具，把资源加载交给 `DefaultResourceLoader`，并通过 extension 的 `tool_call` seam 添加宿主需要的确认逻辑。Reflecta 应沿用这个深模块，而不是继续维护平行实现。

## 2. 已达成共识

### 2.1 使用 Pi 官方 ResourceLoader 配置

删除手写的 `ResourceLoader` interface 实现，改用 Pi 的 `DefaultResourceLoader`：

- 通过 `systemPrompt` 注入 Reflecta Agent system prompt。
- 通过 `noExtensions`、`noSkills`、`noPromptTemplates`、`noThemes`、`noContextFiles` 关闭默认资源发现。
- 通过 `extensionFactories` 只加载 Reflecta 明确提供的 permission gate。
- 创建后显式调用 `reload()`，遵循 Pi SDK 的加载生命周期。

这不会开放用户机器上全局安装的任意 Pi extension，也不会加载当前目录的 `AGENTS.md` 或其他 Pi 资源。

### 2.2 使用 Pi 内置本地工具

Agent 启用 Pi 默认工具组：

```text
read
bash
edit
write
```

同时删除：

- Reflecta 自定义 `file_read` tool。
- Reflecta 自定义 `bash` approval tool。
- `local-tools.ts` 中重复的文件读取和 Bash 执行实现。
- 只服务上述重复实现的测试与 renderer 分支。

`attachment_read` 保留。它根据聊天附件 id 定位文件并提取 PDF 等内容，具有 Reflecta 附件语义，不等价于普通文件读取。

### 2.3 普通 Bash 不审批，危险命令才审批

不增加任务级本机访问授权，也不按每次 Bash 调用统一审批。

permission gate 在 Pi `tool_call` seam 检查完整 Bash command：

- 未命中危险规则：立即放行，由 Pi 内置 Bash 执行。
- 命中危险规则：发出 Reflecta durable `approval.requested` event，等待用户确认。
- 用户确认：extension 返回放行，原 Pi tool call 继续执行。
- 用户拒绝：extension block 该 tool call，Agent 收到拒绝原因后可以继续回复。

第一版规则采用 Pi 官方 `permission-gate` 示例与社区 permission-gate 已验证的最小集合：

- recursive `rm`
- `sudo`
- world-writable `chmod/chown 777`
- raw device redirect
- `git push --force`
- `git reset --hard`
- `git clean -f`
- discard-style `git checkout .` / `git restore`
- `curl` 或 `wget` pipe to shell
- destructive `gh repo` / `gh release` operations

规则匹配是减少误操作的 best-effort 护栏，不声明为安全沙箱。

### 2.4 Reflecta 领域写入继续审批

`understanding_*`、`domain_*`、`context_*` 的 create/update/delete 继续使用现有 semantic approval。

这些确认不是本机权限控制，而是产品原则“用户是大脑，AI 是辅助”的实现：AI 只能提出候选内容，用户确认后才能改变个人知识图谱。

### 2.5 本次不做

- 不增加任务级或 session 级本机访问授权。
- 不引入完整 allow/ask/deny 权限系统。
- 不安装或自动发现第三方 Pi extensions。
- 不实现 Shell AST、命令白名单或安全沙箱。
- 不引入新的 Agent workspace 概念；Pi `cwd` 在本 patch 保持现有配置。

## 3. 架构落点

```text
Pi DefaultResourceLoader
├── Reflecta system prompt
├── resource discovery disabled
└── Reflecta dangerous Bash gate (inline extension)

Pi built-in tools
├── read
├── bash ── dangerous match ──> Reflecta approval events/UI
├── edit
└── write

Reflecta custom tools
├── knowledge read/retrieval tools
├── attachment_read / web_fetch
└── knowledge mutation tools ──> semantic approval events/UI
```

permission gate 的外部 interface 只包含两件事：

1. 给定 command，返回命中的危险规则。
2. 命中时调用宿主提供的异步确认函数。

规则、Pi extension 注册和 block 结果留在同一 module 内。Electron host 只负责把确认请求翻译成已有的 session event，并等待 UI 回应。

## 4. Session event 与 UI 语义

危险 Bash 复用既有 durable approval event：

```text
approval.requested(toolName=bash)
approval.resolved(approved=true|false)
```

批准后不由 Reflecta 另行执行 Bash，也不产生 `tool.execution.*`；原 Pi tool call 会继续产生：

```text
tool.started
tool.completed | tool.failed
```

Reducer 与 accumulator 必须把同一个 `toolCallId` 的普通 tool events 合并回 approval block，避免出现一张审批卡和一张永远 running 的重复工具卡：

- approved + tool completed -> approval block completed
- approved + tool failed -> approval block failed
- rejected + Pi blocked result -> approval block 保持 rejected

安全 Bash 只显示普通 tool activity，不出现 approval card。

Renderer 增加 Pi 内置 `read`、`edit`、`write` 的用户可读标题、路径和结果摘要；Bash 结果适配 Pi 的 `content + details` 结构。

## 5. 实施步骤

### Task 1：记录验收场景

更新现有 Agent proposal feature：

- 普通 Bash 无需确认即可完成。
- 危险 Bash 显示确认卡，确认后继续执行并完成回复。
- 危险 Bash 被拒绝后不执行，卡片保持已拒绝。

不新增平行 test-case 文档。

### Task 2：切换官方 ResourceLoader

1. 用 `DefaultResourceLoader` 替换手写空壳。
2. 配置 Reflecta system prompt 与所有 `no*` 开关。
3. 支持 named inline permission gate factory。
4. 更新 loader 行为测试。

### Task 3：切换 Pi 内置工具

1. 从 approval tool specs 删除 `bash`。
2. 从 read-only tool specs 删除 `file_read`。
3. 在 session tool allowlist 加入 `read`、`bash`、`edit`、`write`。
4. 删除 `local-tools.ts` 及其测试。
5. 保留 `attachment_read`。

### Task 4：实现危险 Bash gate

1. 建立集中、可测试的危险规则表。
2. 实现 command -> matched labels 的纯规则。
3. 注册 Pi `tool_call` handler。
4. 由 Electron host 生成 durable approval request 并等待 resolve。
5. 扩展 pending approval state，使 semantic mutation 与 paused Bash gate 使用不同 resolve 语义。

### Task 5：统一事件归并与展示

1. 对危险 Bash 的 `tool.started/completed/failed` 合并 approval block。
2. 拒绝后忽略 Pi 生成的 blocked tool failure，保持 rejected 状态。
3. 规范化 Pi 内置 tool output，保留 Bash/read 文本与 edit diff。
4. 更新内置工具标题、路径、结果和长输出折叠展示。

### Task 6：验证与发布

至少执行：

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent src/renderer/src/modules/chat
rtk bun run typecheck
rtk bun run test
rtk bun run fmt:check
```

根据真实 Agent E2E 环境可用性运行危险 Bash 确认主路径。最后同步 v1.1.21 版本、CHANGELOG，创建 Angular Convention release commit 与 tag，并按项目发布流程推送。

## 6. 验收标准

- Reflecta 不再包含自定义 `ResourceLoader` 空壳、`file_read` 或自定义 Bash executor。
- Agent active tools 包含 Pi 内置 `read`、`bash`、`edit`、`write`。
- 普通 Bash 不产生 approval request。
- 每个危险 Bash 只产生一条 durable approval request。
- 确认后由原 Pi tool call 执行；拒绝后命令不执行。
- approval 与后续 tool event 在历史恢复和 live UI 中保持单一卡片、正确状态。
- Reflecta knowledge mutation approval 行为保持不变。
- 用户现有 system prompt 改动被保留并提交。
- typecheck、unit/integration tests、format check 通过。
- v1.1.21 patch release 元数据、commit 与 tag 完成。
