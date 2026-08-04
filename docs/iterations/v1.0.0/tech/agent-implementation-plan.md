# Reflecta V2 Agent Implementation Plan

> 日期：2026-06-18
>
> 状态：Implemented
>
> 职责：把 V2 Agent 已收版的产品决策落成具体实现步骤、代码边界和验收顺序。
>
> 上游文档：
>
> - `docs/iterations/v1.0.0/product/agent-value-proposition.md`
> - `docs/iterations/v1.0.0/product/agent-tools-and-ui-discussion.md`
> - `docs/iterations/v1.0.0/test-cases/`

## 1. 当前代码基线（实施前）

当前仓库已经有一条可运行的 Agent 主链路：

- Renderer：`apps/electron/src/renderer/src/modules/chat/index.tsx`
  - Agent 页面、Thread list、Chat stream、Composer、`@context` picker、stream markdown、copy/edit/regenerate/stop。
- Main runtime：`apps/electron/src/main/services/agent/runtime.ts`
  - `streamText`、IPC stream、run cancel、message persistence、approval execution。
- Agent repository：`apps/electron/src/main/services/agent/repository.ts`
  - `agent_threads`、`agent_messages`、`agent_tool_invocations`、`agent_runs`。
- Current tools：`apps/electron/src/main/services/agent/tools.ts`
  - 旧工具名：`search_knowledge_base`、`get_understanding_detail`、`get_graph_neighborhood`、`propose_*`。
- Feature tests：`docs/iterations/v1.0.0/test-cases/*.feature`
  - 当前作为实现验收清单，不是自动化测试入口。

主要差距：

- Tools 还没有和 CLI action 同构。
- Candidate UI 仍是通用 JSON ToolCard。
- Candidate 输出没有按 Understanding / Connection / Context / Update diff 分组件展示。
- `@` 选择器触发词仍是 `@context`，不是自然 `@` 心智。
- ToolActivity 还没有折叠成用户可读活动摘要。
- `domain_inspect`、`snapshot_project`、`graph_path` 等 CLI 同构能力未接入 Electron Agent tools。

## 2. Implementation Principles

1. 不重写 Agent runtime。
   - 现有 `streamText` + `useChat` + IPC stream 已经够用。

2. 不新增 workflow engine。
   - V2 继续用 AI SDK tool calling；不引入 LangGraph / Mastra / AG-UI。

3. Tools 与 CLI action 同构。
   - `reflecta understanding get` -> `understanding_get`
   - `reflecta search all` -> `search_all`
   - `reflecta graph neighborhood` -> `graph_neighborhood`

4. 只读 tool 可自动执行。
   - UI 只展示折叠 ToolActivity。

5. 写入只走 Candidate。
   - tool 只创建 proposal。
   - approval 后调用 domain service 写入。

6. 不做固定右侧 Inspector。
   - 所有 V2 UI 都在 Chat stream 内完成。

## 3. Phase Plan

### Phase 1: Align Agent Tools With CLI Actions

目标：把当前旧工具名替换成 CLI 同构工具名，并补齐 P0 只读 tool。

#### 1.1 补齐 service 边界

文件：

- `apps/electron/src/main/services/core.ts`
- `packages/server/src/domains/snapshot/bff-cli.ts`
- `packages/server/src/domains/domain/bff-cli.ts`
- `packages/server/src/domains/context/bff-cli.ts`
- `packages/server/src/domains/graph/bff-cli.ts`

动作：

- 在 `core.ts` 中新增 lazy service：
  - `snapshotService = new SnapshotCliBff(getDBInstance())`
  - `domainCliService = new DomainCliBff(getDBInstance())` 或把 `inspectDomain` 下沉到 Electron BFF。
  - `contextCliService = new ContextCliBff(getDBInstance())` 或复用 Electron BFF 的 `listContextsByUnderstanding` / `getContextById`。
- 保留现有 Electron BFF 给 UI 使用，不为了 Agent 重写 UI service。

验收：

- main process 可以直接调用：
  - `snapshotService.projectSnapshot()`
  - `domainCliService.inspectDomain(...)`
  - `contextCliService.listContexts(...)`
  - `contextCliService.getContext(...)`

#### 1.2 替换 read tools

文件：

- `apps/electron/src/main/services/agent/tools.ts`

删除旧 read tools：

- `search_knowledge_base`
- `get_understanding_detail`
- `get_graph_neighborhood`

新增 P0 read tools：

- `snapshot_project`
- `domain_list`
- `understanding_list`
- `understanding_get`
- `context_list`
- `search_all`
- `graph_neighborhood`

P1 如果顺手补：

- `domain_inspect`
- `context_get`
- `search_understandings`
- `search_contexts`
- `graph_path`

注意：

- tool input schema 尽量贴 CLI options。
- `understanding_get` 用 `includeContexts` / `includeReferences` / `includeReferencedBys`，不要引入 `fields[]`。
- search query 继续走现有 normalized FTS，不让模型理解 FTS5 语法。

验收：

- Agent 可以从 `snapshot_project` 开始探索项目。
- Agent 可以 `search_all -> understanding_get -> context_list` 完成知识库读取。
- Tool output 是结构化 JSON，不拼自然语言。

#### 1.3 更新 system prompt

文件：

- `apps/electron/src/main/services/agent/runtime.ts`

动作：

- 把 system prompt 中的 `propose_*` 说明改成新 proposal tool 名。
- 明确：
  - 用户 `@` 的对象只是轻量 ref。
  - 需要真实内容时调用 tools。
  - 只读 tools 可主动用。
  - 写入必须调用 Candidate proposal tools。

验收：

- 模型不再调用旧工具名。
- 模型不会把 `@title` 当作真实内容自行脑补。

### Phase 2: Rename Proposal Tools And Keep Approval Stable

目标：把 proposal tools 从旧 `propose_*` 命名迁移到产品计划里的 Candidate 命名，同时保持 approval 数据可恢复。

#### 2.1 新增 proposal tool names

文件：

- `apps/electron/src/main/services/agent/tools.ts`
- `apps/electron/src/main/services/agent/runtime.ts`

新增：

- `understanding_create_proposal`
- `understanding_update_proposal`
- `context_create_proposal`
- `connection_create_proposal`

旧名兼容策略：

- 新 run 只暴露新工具名。
- `executeApprovedProposal()` 暂时兼容旧 `propose_*` 名，避免已有 pending tool invocation 失效。

#### 2.2 标准化 proposal output

输出结构：

```ts
type ProposalOutput = {
  proposalType:
    "understanding_create" | "understanding_update" | "context_create" | "connection_create";
  approvalStatus: "pending" | "approved" | "rejected" | "failed";
  resultRefType?: "understanding" | "context" | "connection";
  resultRefId?: string;
};
```

各 proposal 额外字段：

- Understanding create：`title`、`body`、`domainIds?`、`sourceRefs?`
- Understanding update：`understandingId`、`before?`、`after`、`reason?`
- Context create：`understandingId`、`medium`、`title?`、`content`
- Connection create：`sourceId`、`targetId`、`reason?`

验收：

- pending proposal 写入 `agent_tool_invocations`。
- approval 后 patch message part output。
- 刷新后 approved / rejected 状态仍可见。

### Phase 3: Candidate Cards In Chat Stream

目标：替换通用 JSON ToolCard，让写入提案成为用户可读、可确认、可拒绝的 Candidate 卡片。

文件：

- `apps/electron/src/renderer/src/modules/chat/index.tsx`

建议先在同文件内拆小组件，避免过早建目录：

- `ToolActivity`
- `CandidateUnderstandingCard`
- `CandidateConnectionCard`
- `CandidateContextCard`
- `UpdateUnderstandingDiffCard`

#### 3.1 ToolActivity

只读 tools 显示为折叠摘要：

```txt
AI 读取了 3 条 Understanding
AI 搜索了 8 条内容
AI 查看了 1 个关联图谱
```

展开后显示：

- tool name
- input 摘要
- output 对象列表 / 数量
- errorText

不展示模型内部推理。

#### 3.2 CandidateUnderstandingCard

展示：

- 标题
- 正文
- suggested Domain
- context refs
- 保存 / 拒绝

用户可以先不做复杂 inline editor。V2 最小版允许编辑 title/body 两个字段即可。

#### 3.3 CandidateConnectionCard

展示：

- From Understanding
- To Understanding
- reason
- 确认连接 / 拒绝

文案使用“候选关联”，不要写“AI 发现关联”。

#### 3.4 CandidateContextCard

展示：

- target Understanding
- medium / title
- content 摘要
- 保存为 Context / 拒绝

#### 3.5 UpdateUnderstandingDiffCard

展示：

- target Understanding
- before
- after
- reason
- 确认修改 / 拒绝

第一版 diff 可以用 before / after 两块文本，不引入 diff library。

验收：

- feature cases in `agent-candidates.feature` 全部能人工验收。
- Candidate 卡片不是 JSON dump。
- approved 后卡片显示真实对象链接。

### Phase 4: `@` Picker UX

目标：把现有 `@context` token 改成自然 `@` 选择对象，同时保持轻量 ref。

文件：

- `apps/electron/src/renderer/src/modules/chat/index.tsx`
- `apps/electron/src/preload/typings/chat.d.ts`

动作：

- `extractContextQuery()` 改成识别尾部 `@query`。
- `clearContextToken()` 清掉最近一个 `@query` token。
- picker candidates 保持 Understanding / Context / Domain。
- 发送消息时 metadata 只保留：
  - `type`
  - `id`
  - `title`

不做：

- 不自动注入全文。
- 不支持复杂 mention 编辑器。
- 不支持 inline rich mention token。Badge 在输入框上方显示即可。

验收：

- `@反馈延迟` 能选择 Understanding。
- `@交易心理` 能选择 Domain。
- `@某段 Context` 能选择 Context。
- 消息 metadata 只有轻量 ref。

### Phase 5: Thread And Chat UX Finish

目标：补齐 feature tests 中的 P0/P1 基础体验。

文件：

- `apps/electron/src/renderer/src/modules/chat/index.tsx`
- `apps/electron/src/main/services/ChatService.ts`
- `apps/electron/src/main/services/agent/repository.ts`

动作：

- Thread rename UI。
- Archive thread UI。
- Delete thread 加确认。
- active thread restore 已有，补回归测试或人工验收。
- copy message 已有，确认不复制 hidden tool payload。
- Composer IME 行为已有，补人工验收。
- error recovery 已有，确认 error mapping 能覆盖 API 404 / network / config。

验收：

- `agent-core-chat.feature` P0 通过人工验收。
- P1 操作没有破坏主链路。

### Phase 6: Tests

自动化测试只覆盖稳定逻辑，不把 LLM 行为写死。

#### Unit tests

文件：

- `apps/electron/src/main/services/agent/tools.test.ts`
- `apps/electron/src/main/services/agent/runtime.test.ts`
- `apps/electron/src/main/services/agent/repository.test.ts`

覆盖：

- new tool names exist and old read tool names are not exposed。
- proposal output shape。
- approved / rejected / repeated approval idempotency。
- interrupted run marking。
- message truncation after edited user message。

#### Renderer tests

如果当前没有 renderer test harness，不强行补。

最小替代：

- 用 feature files 做人工验收。
- 对纯函数提取后测：
  - mention token parsing。
  - tool part -> Candidate card type detection。
  - ToolActivity summary。

#### Commands

每个 phase 至少跑：

```bash
bun run --filter '@reflecta/electron' typecheck
bun run --filter '@reflecta/electron' test
```

最终跑：

```bash
bun run typecheck
bun run test
```

## 4. Implementation Order

严格按这个顺序做，避免 UI 先行后返工：

1. Service boundary and CLI-like tools。
2. Proposal tool rename with backward compatibility。
3. Candidate card rendering。
4. `@` picker token UX。
5. Thread UX polish。
6. Tests and manual feature pass。

## 5. Risk Register

| Risk                                       | Why it matters                                         | Mitigation                                                                       |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Tool rename breaks pending proposals       | Existing DB may hold old `propose_*` tool invocations. | New runs expose new names; approval executor supports old names for one version. |
| Domain inspect duplicates CLI logic        | Electron BFF and CLI BFF may drift.                    | Reuse CLI BFF where cheap; otherwise move shared logic to server core.           |
| Candidate cards become a form builder      | Too much editing UI slows V2.                          | Only title/body/reason/content fields; no rich editor in cards.                  |
| Agent overuses tools                       | More tool calls increase latency.                      | Keep tool output small and ToolActivity folded; do not add workflow tools.       |
| Model calls old tool names from history    | Previous messages may include old tool parts.          | System prompt names new tools; old parts still render as generic ToolActivity.   |
| Context refs become hidden prompt stuffing | Violates token control and user expectation.           | `@` stores light refs only; tool reads are visible in ToolActivity.              |

## 6. Acceptance Checklist

- Agent can answer with streamed Markdown and recover history.
- User can `@` Understanding / Context / Domain.
- Agent can use CLI-like read tools:
  - `snapshot_project`
  - `understanding_get`
  - `context_list`
  - `search_all`
  - `graph_neighborhood`
- Candidate cards exist for:
  - create Understanding
  - update Understanding
  - create Context
  - create Connection
- Candidate approval writes through domain services.
- Candidate rejection writes no knowledge object.
- Pending Candidate survives refresh.
- No fixed right Inspector.
- No external search tool.
- `bun run --filter '@reflecta/electron' typecheck` passes.
- `bun run --filter '@reflecta/electron' test` passes.

## 7. Implementation Evidence

Implemented in:

- `apps/electron/src/main/services/core.ts`
- `apps/electron/src/main/services/agent/tools.ts`
- `apps/electron/src/main/services/agent/runtime.ts`
- `apps/electron/src/main/services/agent/context.ts`
- `apps/electron/src/preload/typings/chat.d.ts`
- `apps/electron/src/renderer/src/modules/chat/index.tsx`

Tests added:

- `apps/electron/src/main/services/agent/tools.test.ts`
- `apps/electron/src/main/services/agent/context.test.ts`

Verification:

- `bun run --filter '@reflecta/electron' typecheck` passed.
- `bun run --filter '@reflecta/electron' test` passed.
- `bun run typecheck` passed.
- `bun run test` should run against isolated CLI test databases after the path model cleanup.
