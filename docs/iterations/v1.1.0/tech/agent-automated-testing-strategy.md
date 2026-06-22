# Reflecta 1.1.0 Agent Automated Testing Strategy

> 日期：2026-06-22
>
> 状态：Draft
>
> 范围：Pi Agent runtime 迁移后的工程自动化测试策略。
>
> 这份文档只讨论代码里的自动化测试：unit、integration、E2E。不讨论测试团队写的 Test Case。

## 1. 一句话心智模型

```txt
Test Case defines the user path.
Automated tests prove the implementation.
Test layer choice is a cost decision.
```

Test Case 的唯一来源是 Cucumber / Gherkin feature 文件：

```txt
apps/electron/e2e/agent/agent.feature
```

自动化测试应该引用 feature 里的 scenario tag，例如 `@AG-CHAT-001`。

一个 scenario 可以由多层自动化测试共同覆盖。它不等于一条 E2E。

目标不是“测试越简单越好”，而是：

```txt
用最低维护成本，自动证明关键 Agent 链路真的能跑通。
```

这里的成本包括：

- 运行时间。
- flake 概率。
- 失败后的定位难度。
- 重构时的维护成本。
- 测试环境搭建成本。

## 2. 分层原则

同一个行为，放到能证明它的最低成本层级。

```txt
能用 unit 证明，就不要用 E2E。
unit 证明不了跨模块链路，就用 integration。
integration 证明不了真实窗口 / IPC / 进程 / 重启，就用 E2E。
```

不要先把所有 unit test 和 E2E test 全部写完。按 TDD 的 vertical slice 做：

```txt
one failing test
  -> minimal implementation
  -> passing test
  -> next behavior
```

## 3. 每层负责什么

| Layer               | 负责证明什么                                        | 不负责什么                         |
| ------------------- | --------------------------------------------------- | ---------------------------------- |
| Unit test           | 纯逻辑、确定性转换、小决策。                        | 跨进程、真实持久化、真实窗口行为。 |
| Backend integration | Agent 后端链路：命令、Pi host、JSONL、DTO、工具。   | 浏览器布局、真实 Electron 窗口。   |
| Renderer test       | 给定 DTO 后，前端显示和发出的命令是否正确。         | Agent loop、JSONL、domain writes。 |
| E2E                 | 真实 Electron 窗口、IPC、持久化、重启恢复能否串通。 | 细节逻辑、AI 输出内容、所有分支。  |

Agent 1.1.0 的主力应该是 backend integration test，不是 E2E。

原因：

- Agent 的核心风险在后端 runtime、session、tool、approval、resume。
- backend integration 可以用真实临时 JSONL / DB / domain service。
- backend integration 比 E2E 更快、更稳定、失败更容易定位。
- E2E 只需要证明真实应用壳能把这些链路串起来。

## 4. Unit Test 怎么写

Unit test 只测稳定、确定、便宜的逻辑。

适合写 unit test：

- `AgentViewBuilder`: Pi session entries -> `AgentViewDTO`。
- `ApprovalPolicy`: 哪些 tool call 需要用户确认。
- command / query validation。
- DTO schema transform。
- renderer 纯组件：给定 `AgentViewDTO`，应该渲染消息、工具状态、approval card。

不适合写 unit test：

- `PiAgentHost` 内部调用顺序。
- Pi loop 内部步骤。
- tool bridge 是否调用了某个内部 service 方法。
- AI 回复具体文字。

判断标准：

```txt
如果重构内部实现但产品行为没变，这个测试应该继续通过。
```

## 5. Backend Integration Test 怎么写

Backend integration test 是 1.1.0 Agent 自动化测试的主层。

它应该尽量使用真实 Reflecta 后端模块：

- 真实 `PiAgentHost`。
- 真实 `PiSessionManager` 或临时 JSONL session。
- 真实 `AgentViewBuilder`。
- 真实 `ReflectaToolBridge`。
- 真实临时 DB / content storage root。

只 fake 系统边界：

- fake AI provider。
- fake model stream。
- 必要时 fake Pi loop 的最外层行为。
- clock / random。

不要 mock Reflecta 自己的内部模块来证明 Agent 行为。否则测试只是在证明 mock 的调用关系。

优先覆盖三条 tracer bullet：

```txt
sendMessage
  -> fake assistant reply
  -> JSONL session write
  -> AgentViewDTO rebuilt
```

```txt
approval-gated tool
  -> pending approval entry
  -> approve command
  -> tool resumes
  -> AgentViewDTO updated
```

```txt
existing JSONL session
  -> resume / reload
  -> same AgentViewDTO rebuilt
```

## 6. Renderer Test 怎么写

Renderer test 不理解 Pi，不读 JSONL，不跑 Agent loop。

它只证明：

- `AgentViewDTO.turns` 能渲染成消息列表。
- `AgentViewDTO.toolActivities` 能渲染成工具状态。
- `AgentViewDTO.pendingApprovals` 能渲染成 approval controls。
- 点击 approve / reject / send 会发出正确 `AgentCommand`。

Renderer test 的输入应该是固定 DTO fixture，不应该拼接 Pi session entry。

## 7. E2E 怎么写

E2E 只保留少量 smoke path。

适合 E2E：

- 打开真实 Electron Agent 页面。
- 发送消息后，renderer -> main IPC 真的通。
- fake assistant reply 能显示在真实窗口里。
- 重启应用后，session 还能从持久化数据恢复。
- approval 按钮能从 UI 走到 backend resume。

不适合 E2E：

- 每个 tool 的所有参数分支。
- `AgentViewBuilder` 的每种 entry 映射。
- approval policy 的组合矩阵。
- AI 自然语言内容。

E2E 必须使用 fake AI / fake model runtime。不要打真实模型。

## 8. 1.1.0 最小自动化集合

第一批只需要这些：

1. Backend integration: send message writes session and returns view.
2. Backend integration: approval pauses and resumes tool call.
3. Backend integration: reload rebuilds view from JSONL.
4. Renderer test: view DTO renders messages, tools, approvals.
5. E2E smoke: real Electron window sends one message and shows fake reply.

这五条跑通后，Agent runtime 迁移才算有自动化保护。

后续每加一个 Agent 能力，先问：

```txt
这个风险在哪一层最便宜地证明？
```

然后只在那一层补测试。
