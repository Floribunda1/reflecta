# Reflecta V2 Agent Chat System Feature Set

> 日期：2026-06-17
>
> 状态：Draft
>
> 职责：定义 V2 Agent Chat System 的最小产品边界。本文不替代技术选型，不定义视觉细节。

## 1. Value Proposition Input

Reflecta Agent Chat 的价值不是“再做一个聊天窗口”，而是：

> 让用户能用自然语言和自己的知识库一起工作，并且所有写入个人知识库的动作都由用户确认。

上游约束：

- Agent 不能绕过用户直接改知识库。
- Agent 不能把聊天记录变成第二套知识库。
- Agent 必须能引用 Reflecta 里的真实对象，而不是靠模型猜测字符串。
- Agent 的回答必须能回到 Understanding / Context / Connection 等产品对象。
- 第一版先做可靠主链路，不做完整工作流引擎。

## 2. JTBD

当我在 Reflecta 里沉淀了一批 Understanding / Context / Connection，
但不知道下一步该怎么追问、比较、补充或整理时，
我想直接和这些已有材料对话，
以便更快找到值得补充、连接或沉淀的新理解。

## 3. Product Requirements

为了完成这个 JTBD，Agent Chat System 至少要承载：

- 对话：用户能发送消息，看到流式回复，并能继续多轮上下文。
- 历史：对话 thread 可恢复，消息不会因为刷新或重启丢失。
- 引用：用户能把 Understanding / Context / Domain 作为上下文交给 Agent。
- 读取：Agent 能搜索和读取知识库对象。
- 提案：Agent 能提出创建 / 更新 / 连接知识对象的建议。
- 确认：所有写入类动作必须先展示可读预览，再由用户确认或拒绝。
- 结果回链：确认后的结果必须能链接回真实 Reflecta 对象。
- 失败处理：模型、工具、网络、取消都要有明确状态。

## 4. User Mental Model

可以借力的用户心智：

- 用户理解 chat thread。
- 用户理解消息里的引用和链接。
- 用户理解 `@` 选择对象。
- 用户理解“AI 建议，我确认后写入”。
- 用户理解工具状态：搜索中、已找到、等待确认、已写入、失败。

需要避免的新心智：

- 不引入 workflow / checkpoint / run replay 等概念给用户。
- 不要求用户理解模型 tool call。
- 不把 Agent 解释成自动整理知识库的后台机器人。

## 5. Product Shape Options

| Shape Option        | 如何承载价值                            | 主要风险                        |
| ------------------- | --------------------------------------- | ------------------------------- |
| 独立 Agent 页面     | 最小 chat 主链路，容易验证对话价值      | 离 Capture / Graph 工作流较远   |
| 嵌入式 Agent Drawer | 在具体 Understanding / Graph 场景中对话 | 入口和上下文规则更复杂          |
| 全局 Copilot        | 随时唤起，覆盖全 app                    | 太宽，容易变成泛用助手          |
| 自动整理后台 Agent  | Agent 主动扫描并提建议                  | 用户控制感弱，写入风险高        |
| Graph-first Agent   | 以图谱操作作为主要入口                  | 第一版实现重，chat 主链路会失焦 |

## 6. Shape Selection

第一版选择：

> 独立 Agent 页面 + 手动 `@context`。

原因：

- 它最小，能先验证“和知识库对话”是否成立。
- Thread / message / streaming / approval 是所有后续形态的共用底座。
- 手动 `@context` 比自动猜上下文可靠。
- 嵌入式 Drawer、全局 Copilot、Graph-first 都可以复用这条主链路。

## 7. Minimum Feature Set

### P0: 可用聊天底座

- Agent 页面。
- Thread list：创建、选择、重命名、归档。
- Message list：渲染 user / assistant / tool / proposal parts。
- Composer：输入、发送、停止。
- Streaming：流式文本、完成、取消、错误。
- Persistence：thread、message、run 落库并可恢复。
- Model config：复用 Settings 里的 API Key / Base URL / Model。

### P1: 知识库读取

- `@context` picker：选择 Understanding / Context / Domain。
- 后端用对象 ID 展开上下文，写入 message metadata。
- Read tools：
  - search knowledge base
  - get understanding detail
  - get graph neighborhood
- Tool result 结构化返回，UI 不解析自然语言。

### P2: 写入提案与确认

- Proposal tools：
  - propose create understanding
  - propose update understanding
  - propose add context
  - propose create connection
- Proposal card：展示目标、变更内容、风险提示、确认 / 拒绝。
- Confirm 后调用正常 Reflecta domain service 写入。
- Reject 后把拒绝结果回传给 Agent。
- Tool invocation 表记录 pending / approved / rejected / failed。

### P3: 基础可用性

- 自动 thread title：优先使用第一条 user message 的短摘要。
- Message actions：复制、重新生成最后一轮、编辑 user message 后重发。
- Markdown stream-render：assistant 流式输出时增量渲染 Markdown，不等完整回复结束。
- Scroll behavior：新消息自动滚到底部；用户向上看历史时不强制拉回底部。
- Stop behavior：停止生成后保留已生成内容，并标记本轮已取消。
- Error recovery：失败后允许重试当前用户消息。
- Error classification：区分模型配置缺失、API 404、网络失败、取消。
- Composer basics：多行输入、`Enter` 发送、`Shift+Enter` 换行、中文 IME 输入时不误发送。
- Thread state：页面重启后恢复当前 active thread。
- Thread actions：删除 thread；归档保留但不代替删除。
- Empty state：提示用户选择 `@context` 或直接提问。

## 8. Support / Later / Not Now

### Support

- Tool running / result 状态。
- Proposal 状态跨刷新恢复。
- 多模型通过 OpenAI-compatible provider 使用。

### Later

- Capture / Contemplate 里的 Agent Drawer。
- 自动带入当前 Understanding / Graph selection。
- Graph custom renderer。
- Fork conversation。
- 长任务 resume / stream reconnect。
- 多 provider 专用配置。

### Not Now

- 自动扫描知识库并主动发起建议。
- 独立 vector memory 表。
- LangGraph / Mastra / workflow checkpoint。
- AG-UI 协议层。
- 多 Agent 协作。
- 用户行为偏好长期记忆。

## 9. Validation

第一版只验证三件事：

1. 用户能稳定完成一轮多轮对话，并恢复历史。
2. 用户能明确选择上下文，Agent 能基于真实 Reflecta 对象回答。
3. Agent 提出的写入建议能被用户确认后落到真实知识库对象。

如果这三件事没有跑顺，先不要加 Drawer、Graph-first、自动整理或 workflow engine。
