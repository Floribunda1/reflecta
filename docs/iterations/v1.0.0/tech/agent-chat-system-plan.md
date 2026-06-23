# Reflecta V2 Agent Chat System Tech Plan

> 日期：2026-06-17
>
> 状态：Draft
>
> 职责：把 V2 Agent Chat System 的产品 feature set 落成具体技术方案、轮子选择和实现顺序。
>
> 上游文档：
>
> - `docs/iterations/v1.0.0/product/agent-tech-selection.md`
> - `docs/iterations/v1.0.0/product/agent-chat-system-feature-set.md`

## 1. 社区共识

Agent chat 已经是成熟场景，主流实现基本收敛成以下层次：

| 层级              | 社区共识                                                                              | Reflecta 选择                                                 |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Chat runtime      | 前端持有 `UIMessage[]`，后端用模型 SDK 产生 UI message stream。                       | `@ai-sdk/react` + `ai`。                                      |
| Transport         | runtime 和 UI 之间走 stream protocol；Web 用 HTTP/SSE，Electron 可适配成 IPC stream。 | 自定义 `ElectronChatTransport`，只做协议适配。                |
| Persistence       | 持久化 UI message parts，而不是把 assistant 文本拍平成 string。                       | `agent_messages.parts_json` 存 AI SDK `UIMessage.parts`。     |
| Tool calls        | tool input/output 是 message part；UI 按 part 渲染，不解析自然语言。                  | AI SDK tools + AI Elements Tool。                             |
| HITL approval     | 写入/危险动作必须暂停、展示确认、确认后继续。                                         | AI SDK approval lifecycle + `agent_tool_invocations` 投影表。 |
| Basic chat UX     | composer、auto-scroll、copy/retry/edit、stream markdown 都有成熟组件。                | AI Elements + Streamdown；不手写 Markdown parser。            |
| Workflow engine   | 长任务、分支、checkpoint、resume 才需要 LangGraph/Mastra。                            | V2 baseline 不上。                                            |
| Agent UI protocol | 多前端、多 agent backend 才需要 AG-UI。                                               | Electron 单前端先不上。                                       |

## 2. 轮子决策

### 2.1 直接采用

| 能力                   | 轮子                                 | 原因                                                                     |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| chat state / streaming | `@ai-sdk/react` `useChat`            | 已支持 transport 架构、`UIMessage[]`、status、stop、regenerate 触发。    |
| backend generation     | `ai` `streamText`                    | 直接产出 UI message stream，和 `useChat` 对齐。                          |
| provider               | `@ai-sdk/openai`                     | 当前 Settings 是 OpenAI-compatible；DeepSeek 用 `openai.chat(modelId)`。 |
| message persistence    | AI SDK `UIMessage` shape             | 社区示例和 Vercel Chatbot 都存 message parts / attachments。             |
| chat UI components     | AI Elements                          | 和 AI SDK 同源，组件可 copy 到项目，保持 shadcn 风格。                   |
| stream Markdown        | `streamdown`                         | 已安装；专门处理 incomplete / unterminated Markdown。                    |
| tool UI                | AI Elements Tool                     | 已覆盖 pending / running / completed / error / denied 状态。             |
| approval UI            | AI Elements Confirmation             | 已覆盖 approval requested / approved / rejected 状态。                   |
| query cache            | TanStack Query                       | 项目已使用；thread list / messages 继续用它。                            |
| context picker         | `cmdk` + 现有 search/browse services | 项目已使用；不用引入 mention 框架。                                      |

### 2.2 暂不采用

| 轮子          | 暂不上原因                                                                                       | 触发条件                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| assistant-ui  | 覆盖 Thread/Composer/Message/ThreadList，但会引入另一套 runtime context；当前 AI Elements 足够。 | 如果 copy/retry/edit/branch/thread UI 实现超过 2 天，或 fork/attachments/message branching 进入 P0，再评估。 |
| LangGraph     | checkpoint/interrupt 很强，但会把简单 chat 变成 workflow runtime。                               | 需要长任务、跨 app 恢复、分支重放、复杂多步状态机时再上。                                                    |
| Mastra memory | 适合 agent 平台 memory；Reflecta 已有 Understanding/Context 作为长期知识。                       | 需要跨 thread 用户偏好/长期记忆，且不能落到 Understanding/Context 时再上。                                   |
| AG-UI         | 适合多 agent backend / 多客户端协议统一。                                                        | 出现 Web + Electron + 外部 agent backend 共用协议时再上。                                                    |
| CopilotKit    | 适合 app-wide copilot 和共享 UI state。                                                          | Agent 变成全局 copilot，而不是独立 `/agent` 页面时再上。                                                     |

## 3. 目标架构

```mermaid
flowchart TD
  subgraph Renderer["Renderer"]
    Page["AgentPage"]
    ThreadList["ThreadList\nTanStack Query"]
    Chat["useChat\n@ai-sdk/react"]
    UI["AI Elements\nConversation / Message / PromptInput / Tool / Confirmation"]
    Markdown["Streamdown"]
  end

  subgraph IPC["Electron IPC"]
    Transport["ElectronChatTransport\nChatTransport adapter"]
    Events["agent:stream\nUIMessageChunk"]
  end

  subgraph Main["Main"]
    Service["ChatService\nIPC facade"]
    Runtime["AgentRuntime\nstreamText"]
    Repos["Agent repositories"]
    Tools["Reflecta tools"]
  end

  subgraph Domain["Reflecta domain"]
    Understanding["Understanding service"]
    Context["Context service"]
    Search["Search service"]
    Domain["Domain service"]
  end

  subgraph DB["SQLite"]
    AgentTables["agent_threads\nagent_messages\nagent_tool_invocations\nagent_runs"]
    Knowledge["understandings\ncontexts\ncategories\nunderstanding_connections"]
  end

  Page --> ThreadList
  Page --> Chat
  Chat --> UI
  UI --> Markdown
  Chat <--> Transport
  Transport <--> Service
  Service --> Runtime
  Runtime --> Repos
  Runtime --> Tools
  Repos --> AgentTables
  Tools --> Understanding
  Tools --> Context
  Tools --> Search
  Tools --> Domain
  Understanding --> Knowledge
  Context --> Knowledge
  Search --> Knowledge
  Domain --> Knowledge
  Runtime --> Events
  Events --> Transport
```

## 4. 数据模型

保留当前四张 agent 表，不新增表：

- `agent_threads`
- `agent_messages`
- `agent_tool_invocations`
- `agent_runs`

需要补齐的字段使用现有 JSON 字段承载：

| 数据                | 存储位置                                                   | 说明                                             |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| message parts       | `agent_messages.parts_json`                                | UI source of truth。                             |
| attachments         | `agent_messages.attachments_json`                          | P0 可为空，后续兼容附件。                        |
| context refs        | `agent_messages.metadata_json.contextRefs`                 | 用户选择的 Understanding / Context / Domain ID。 |
| model info          | `agent_messages.metadata_json.model` 或 `agent_runs.model` | run 维度为准。                                   |
| active thread       | renderer localStorage                                      | 用户本机状态，不进 DB。                          |
| tool approval state | `agent_tool_invocations`                                   | 可查询、可恢复、可回链。                         |

不要把聊天记录当知识库。用户确认后的写入只进入 Understanding / Context / Connection。

## 5. Runtime Plan

### 5.1 Renderer

1. `ChatPage` 只负责布局和 active thread。
2. `ThreadList` 通过 TanStack Query 读写 thread。
3. `ThreadView` 使用 `useChat({ id: threadId, messages, transport })`。
4. `ElectronChatTransport` 实现 AI SDK `ChatTransport`：
   - `sendMessages()` 调 `ipcClient.chat.sendMessage({ threadId, messages })`。
   - 返回 `ReadableStream<UIMessageChunk>`。
   - 监听 `agent:stream`，按 `requestId` 过滤 chunk。
   - `cancel()` 调 `ipcClient.chat.cancelStream({ requestId })`。
5. UI 使用 AI Elements：
   - `Conversation` / `ConversationContent` / `ConversationScrollButton`
   - `Message` / `MessageContent` / `MessageResponse`
   - `PromptInput` / `PromptInputTextarea` / `PromptInputSubmit`
   - `Tool`
   - `Confirmation`
6. Markdown 文本统一走 `streamdown` 或 AI Elements `MessageResponse` 内部的 Streamdown。

### 5.2 Main

1. `sendMessage` 创建 `requestId` 和 `AbortController`。
2. 取最后一条 user message，先 append 到 `agent_messages`。
3. 创建 `agent_run(status = "streaming")`。
4. 读取 thread history，转 `convertToModelMessages(messages)`。
5. 调 `streamText({ model, system, messages, tools, abortSignal })`。
6. `result.toUIMessageStream({ originalMessages, onFinish, onError })`。
7. 逐 chunk 通过 `webContents.send("agent:stream", { requestId, chunk })`。
8. `onFinish` append assistant message，更新 run/thread preview。
9. catch error 时更新 run 状态并发 error chunk。

## 6. Tool Plan

### 6.1 Read tools

Read tool 可以自动执行：

- `search_knowledge_base`
- `get_understanding_detail`
- `get_graph_neighborhood`

规则：

- 输入用 `zod` schema。
- 输出必须是结构化 JSON。
- UI 可以展示 Tool card，但不需要用户确认。
- 不允许 read tool 直接拼 SQL，走现有 domain service。

### 6.2 Write proposal tools

Write tool 不直接写知识库：

- `propose_create_understanding`
- `propose_update_understanding`
- `propose_add_context`
- `propose_create_connection`

流程：

1. tool 产生结构化 proposal。
2. 写 `agent_tool_invocations(approval_status = "pending")`。
3. stream `tool-*` part，UI 渲染 Confirmation / Proposal card。
4. 用户 approve/reject。
5. approve 后 `AgentApprovalService` 调 Reflecta domain service。
6. 写 `result_ref_type/result_ref_id`。
7. 通过 AI SDK approval/tool output 机制让模型知道结果。

第一版只支持单个 pending write tool。并发多个 approval 是 later，避免状态机变复杂。

## 7. Basic Chat UX Plan

| 功能                   | 实现方式                                                                | 不自己写的部分                                 |
| ---------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Markdown stream-render | `streamdown`                                                            | 不用 `react-markdown` 处理 incomplete stream。 |
| auto-scroll            | AI Elements `Conversation` + scroll button                              | 不手写复杂 sticky bottom 逻辑；只补产品规则。  |
| composer               | AI Elements `PromptInput`                                               | Enter / Shift+Enter / status submit 交给组件。 |
| IME                    | 在 `onKeyDown` 判断 `event.nativeEvent.isComposing`，并用组件行为兜底。 | 不写自定义 textarea 框架。                     |
| copy                   | Message action button + Clipboard API                                   | 一行原生 API。                                 |
| regenerate             | `useChat` regenerate trigger / 重发最后 user message                    | 不重建 runtime。                               |
| edit user message      | 本地编辑 draft，提交时截断该 message 后的后续消息并重新 send。          | 不做 branch tree。                             |
| retry failed turn      | 保留失败 user message，重新 send 当前 turn。                            | 不做全 run replay。                            |
| stop                   | `chat.stop()` -> IPC cancel                                             | 不支持 resume 同时开启。                       |
| delete thread          | soft delete 或 archive + delete action                                  | 不做 undo。                                    |
| restore active thread  | localStorage 存 `agent.activeThreadId`                                  | 不进 DB。                                      |

## 8. 大坑与处理

| 坑                                  | 风险                                                 | 处理                                                                                 |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/responses` vs `/chat/completions` | DeepSeek 404。                                       | OpenAI-compatible provider 必须用 `openai.chat(modelId)`。                           |
| 流式 Markdown                       | incomplete code fence/table/math 会闪烁或错渲染。    | 用 Streamdown。                                                                      |
| auto-scroll                         | 用户向上看历史时被强拉到底。                         | 用 Conversation scroll primitive；验收“用户滚上去不抢滚动”。                         |
| message persistence                 | 只存 text 会丢 tool parts / approval / attachments。 | 存完整 `UIMessage.parts`。                                                           |
| tool approval                       | 写入前后状态难恢复。                                 | `agent_tool_invocations` 做可查询投影。                                              |
| stream resume + abort               | AI SDK 文档明确二者冲突。                            | V2 选择 abort/stop；resume 放 Later。                                                |
| 多模型 provider                     | 不同 provider 支持的 API 不一致。                    | 第一版只支持 OpenAI-compatible chat completions。                                    |
| error handling                      | SDK error 原始信息不可读。                           | main process 映射成 `CONFIG_MISSING / API_NOT_FOUND / NETWORK / ABORTED / UNKNOWN`。 |
| context refs                        | 让模型解析 `@xxx` 不可靠。                           | 前端选择对象 ID，后端展开。                                                          |
| write tool idempotency              | 重试可能重复创建对象。                               | tool invocation 有唯一 `tool_call_id`；confirm 前检查状态。                          |

## 9. Implementation Phases

### Phase 0: 修正当前主链路

- `getAgentModel()` 使用 `openai.chat(modelId)`。
- `baseURL` 只存基础地址，例如 `https://api.deepseek.com`。
- `typecheck:node` 通过。

### Phase 1: P0 Runtime 稳定化

- 拆出 repositories：thread / message / run。
- `sendMessage` 只接收最后一条 user message，避免前端整段历史重复写入。
- `onFinish` 持久化完整 assistant `UIMessage`。
- error chunk 会关闭前端 stream。
- thread preview 和自动标题稳定更新。

验收：

- 新建 thread -> 发送 -> 流式回复 -> 重启 app -> 历史恢复。
- stop 后 run 状态为 cancelled，前端不一直 streaming。
- API 404 能展示可读错误。

### Phase 2: P3 Basic Chat UX

- 引入 / copy AI Elements：
  - conversation
  - message
  - prompt-input
  - tool
  - confirmation
- 文本渲染使用 Streamdown。
- 补 copy / regenerate / edit-resend / retry。
- active thread localStorage。
- delete thread。

验收：

- Markdown 在流式 code fence 未闭合时仍能稳定显示。
- 用户向上滚动时新 chunk 不强制拉到底。
- 中文输入法组合态 Enter 不发送。
- 失败后点 retry 能重新跑当前轮。

### Phase 3: P1 Knowledge Read Tools

- `@context` picker：Understanding / Context / Domain。
- message metadata 写入 `contextRefs`。
- 后端 prompt builder 用 ID 展开上下文。
- 实现 read tools 并渲染 Tool card。

验收：

- 用户选择一个 Understanding，Agent 能引用其真实内容回答。
- search tool 结果是结构化 JSON。
- tool running / completed / error 都可见。

### Phase 4: P2 Proposal Approval

- 实现 proposal tools。
- 写 `agent_tool_invocations`。
- UI 渲染 proposal confirmation。
- confirm/reject IPC。
- confirm 后调用 domain service，写 result refs。

验收：

- Agent 提议创建 Understanding，用户确认后知识库出现真实 Understanding。
- 用户拒绝后不写库，Agent 能继续解释或调整。
- 刷新页面后 pending proposal 状态仍可恢复。

### Phase 5: Hardening

- run 状态回收：启动时把遗留 `streaming` 标成 `failed` 或 `cancelled`。
- tool idempotency：confirm 同一个 `tool_call_id` 只能执行一次。
- token pruning：超过窗口时按最近消息 + selected context 优先级裁剪。
- 最小测试：
  - repository append/list 顺序。
  - duplicate message/tool idempotency。
  - provider URL path 不再走 `/responses`。

## 10. 不做的事

- 不做 stream resume。当前更需要 stop/cancel；resume 和 abort 冲突，等长任务出现再做。
- 不做 fork / branch tree。edit-resend 先直接截断后续消息。
- 不做 vector memory。先用 `@context` + FTS/read tools。
- 不做多 approval 并发。第一版一次只处理一个 pending write tool。
- 不做 AG-UI。Electron 内部 IPC 足够。
- 不做 workflow engine。普通 chat loop + approval 已覆盖 V2 baseline。

## 11. References

- AI SDK `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- AI SDK message persistence: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- AI SDK tool usage: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
- AI SDK resume streams: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
- AI Elements Tool: https://elements.ai-sdk.dev/components/tool
- AI Elements Confirmation: https://elements.ai-sdk.dev/components/confirmation
- AI Elements Prompt Input: https://elements.ai-sdk.dev/components/prompt-input
- Streamdown: https://github.com/vercel/streamdown
- assistant-ui primitives: https://www.assistant-ui.com/docs/primitives
- assistant-ui thread auto-scroll: https://www.assistant-ui.com/docs/primitives/thread
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- Mastra memory: https://mastra.ai/docs/memory/overview
- OpenAI Agents SDK sessions: https://openai.github.io/openai-agents-python/sessions/
- AG-UI introduction: https://docs.ag-ui.com/introduction
