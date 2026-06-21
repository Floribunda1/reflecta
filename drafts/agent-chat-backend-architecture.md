# Agent 对话 — 后端架构

> 创建时间：2025-07-17
> 状态：架构设计
> 前置文档：`drafts/agent-chat-discovery.md`（需求）、`drafts/agent-chat-architecture.md`（总架构）

---

## 一、分层架构

```mermaid
graph TB
    subgraph Main Process
        subgraph IPC Layer["IPC Layer (apps/electron/src/main/services/)"]
            ChatService["ChatService<br/>IPC 门面"]
        end

        subgraph Domain Layer["Domain Layer (packages/server/src/domains/chat/)"]
            BFF["ChatElectronBff<br/>上下文组装 · 生命周期"]
            Agent["ChatAgent<br/>LLM 循环 · 流式控制"]
            Core["ChatCore<br/>会话/消息 CRUD"]
            Tools["tools.ts<br/>7 个工具定义 + 执行器"]
        end

        subgraph Existing["Existing Services (不变)"]
            ThoughtSvc["ThoughtService"]
            ContextSvc["ContextService"]
            SearchSvc["SearchService"]
            CategorySvc["CategoryService"]
            AICfg["AiProviderConfig"]
        end
    end

    subgraph DB["SQLite (Drizzle ORM)"]
        OldTables["thoughts / contexts / connections / categories"]
        NewTables["conversations / messages (NEW)"]
    end

    ChatService -->|"CRUD (decorator)"| BFF
    ChatService -->|"流式 (raw IPC)"| BFF
    BFF --> Agent
    BFF --> Core
    Agent --> Core
    Agent --> Tools
    Tools --> ThoughtSvc
    Tools --> ContextSvc
    Tools --> SearchSvc
    Tools --> CategorySvc
    Agent --> AICfg
    Core --> NewTables
    Tools --> OldTables
```

**两层 IPC 通道：**

- **CRUD：** `electron-ipc-decorator`（`@IpcMethod()` 装饰器，invoke/return）
- **流式：** 原始 IPC（`webContents.send` → `ipcRenderer.on`），因为 decorator 不支持 push

---

## 二、新增数据模型

```mermaid
erDiagram
    conversations {
        text id PK
        text title
        text created_at
        text updated_at
    }
    messages {
        text id PK
        text conversation_id FK
        text role "user | assistant | tool"
        text content
        text tool_calls "JSON, nullable"
        text tool_call_id "nullable"
        text created_at
    }
    conversations ||--o{ messages : contains
```

- `tool_calls` 用 JSON 字段存 OpenAI function calling 的完整调用信息，不另建关联表（数据量小）
- `tool_call_id` 仅 role=`"tool"` 时使用，关联回 assistant 消息中的具体 tool_call

---

## 三、Agent 状态机

```mermaid
stateDiagram-v2
    [*] --> BUILDING_CONTEXT : stream() 调用
    BUILDING_CONTEXT --> LLM_CALLING : 上下文组装完毕

    state LLM_CALLING {
        [*] --> waiting
        waiting --> text_delta : chunk.choices[].delta.content
        waiting --> tool_calls : chunk.choices[].delta.tool_calls
        waiting --> finished : finish_reason = "stop"

        text_delta --> waiting : 继续
        tool_calls --> check_tool_type : 收到完整 tool_call
        finished --> [*]
    }

    check_tool_type --> read_tool : type = "read"
    check_tool_type --> write_tool : type = "write"

    read_tool --> executing_read : 立即执行
    executing_read --> LLM_CALLING : 结果追加到 messages，继续

    write_tool --> paused : yield tool_pending，等待用户
    paused --> executing_write : confirm
    paused --> rejected : reject
    executing_write --> LLM_CALLING : 结果追加，继续
    rejected --> LLM_CALLING : 错误结果追加，继续

    LLM_CALLING --> [*] : yield done
```

---

## 四、工具执行协议

```mermaid
sequenceDiagram
    participant R as Renderer
    participant CS as ChatService (IPC)
    participant BFF as ChatElectronBff
    participant A as ChatAgent
    participant TR as ToolRegistry
    participant ES as Existing Services

    R->>CS: sendMessage(convId, content, refs)
    CS->>BFF: sendMessage(...)
    BFF->>A: stream(convId, content, refs, signal)
    BFF-->>CS: { requestId }
    CS-->>R: { requestId }

    loop Agent 循环
        A->>A: buildSystemPrompt(refs)
        A->>A: callLLM(messages, tools)

        alt text delta
            A-->>BFF: { type: "delta", content }
            BFF-->>R: chat:stream-event
        else 读工具
            A->>TR: execute(readTool)
            TR->>ES: 调用已有 Service
            ES-->>TR: result
            TR-->>A: result string
            Note over A: 结果追加到 messages，继续循环
        else 写工具
            A-->>BFF: { type: "tool_pending", toolCall }
            BFF-->>R: chat:stream-event（显示确认卡片）
            Note over BFF: 生成器暂停

            R->>CS: confirmToolCall(...)
            CS->>BFF: confirmToolCall(...)
            BFF->>A: 恢复生成器 (confirm)
            A->>TR: execute(writeTool)
            TR->>ES: createThought / addContext / ...
            ES-->>TR: result
            TR-->>A: result string
            Note over A: 结果追加到 messages，继续循环
        else 结束
            A-->>BFF: { type: "done", messageId }
            BFF-->>R: chat:stream-event
        end
    end
```

**读/写工具差异：**

|      | 读工具                                      | 写工具                                                                 |
| ---- | ------------------------------------------- | ---------------------------------------------------------------------- |
| 数量 | 3（search / get_detail / get_neighborhood） | 4（create_insight / update_thought / add_context / create_connection） |
| 执行 | Agent 自主执行                              | 用户确认后执行                                                         |
| 流式 | 不中断                                      | 暂停 → 确认/拒绝 → 恢复                                                |
| 渲染 | 无 UI                                       | ToolCallCard 确认卡片                                                  |

---

## 五、领域层文件职责

```mermaid
graph LR
    subgraph "packages/server/src/domains/chat/"
        types["types.ts<br/>DTO · ToolCall · StreamEvent"]
        core["core.ts<br/>ChatCore<br/>会话+消息 CRUD"]
        tools["tools.ts<br/>7 个工具定义<br/>ToolExecutorRegistry"]
        agent["agent.ts<br/>ChatAgent<br/>LLM 循环 · 流式 · Prompt 构建"]
        bff["bff-electron.ts<br/>ChatElectronBff<br/>上下文组装 · 生命周期 · 暂停控制"]
        index["index.ts<br/>统一导出"]
    end

    bff --> agent
    bff --> core
    agent --> core
    agent --> tools
    agent --> types
    core --> types
    tools --> types
```

| 文件              | 职责                                                           | 依赖外部                                                 |
| ----------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| `types.ts`        | DTO、StreamEvent 联合类型、AgentContextInput                   | 无                                                       |
| `core.ts`         | `ChatCore` — 会话 & 消息 CRUD，纯 DB 操作                      | `ReflectaDb`                                             |
| `tools.ts`        | 7 个工具的 function schema + `ToolExecutorRegistry`            | Thought/Context/Search/Category Service                  |
| `agent.ts`        | `ChatAgent` — System Prompt 构建 + LLM 调用循环 + 流式事件生成 | `ReflectaDb`、`AiProviderConfig`、`ToolExecutorRegistry` |
| `bff-electron.ts` | `ChatElectronBff` — 上下文组装、Agent 生命周期、暂停-恢复控制  | `ChatCore`、`ChatAgent`                                  |
| `index.ts`        | 统一导出                                                       | 上述所有                                                 |

---

## 六、与现有代码的关系

```mermaid
graph TB
    subgraph New["新增模块"]
        Chat["packages/server/src/domains/chat/"]
        ChatSvc["ChatService (IPC 门面)"]
        Mig["003_add_chat_tables"]
    end

    subgraph Modified["微调的现有文件"]
        Schema["db/schema.ts<br/>+conversations +messages"]
        ServerIndex["server/src/index.ts<br/>+export chat"]
        SvcCore["services/core.ts<br/>+chatBff lazy init"]
        SvcIndex["services/index.ts<br/>+ChatService + IPC handler"]
    end

    subgraph Untouched["不修改的现有模块"]
        ThoughtSvc2["ThoughtService"]
        ContextSvc2["ContextService"]
        SearchSvc2["SearchService"]
        CategorySvc2["CategoryService"]
        AICfg2["AiProviderConfig"]
        FTS5["FTS5 索引"]
    end

    Chat --> ThoughtSvc2
    Chat --> ContextSvc2
    Chat --> SearchSvc2
    Chat --> CategorySvc2
    Chat --> AICfg2
    Chat --> FTS5
```

**原则：** 所有新增能力放在新文件。对现有文件的修改仅限于注册/导出——不碰现有业务逻辑。

---

## 七、关键架构决策

| 决策           | 选择                    | 理由                                                     |
| -------------- | ----------------------- | -------------------------------------------------------- |
| Agent 运行位置 | Main Process            | 唯一访问 DB 的进程；API Key 安全；写工具需调现有 Service |
| 流式通道       | 原始 IPC push           | `electron-ipc-decorator` 只支持 req/res，不支持 push     |
| 写工具确认     | 生成器暂停-恢复         | 工具结果影响后续输出，不能预生成后替换                   |
| 知识检索       | FTS5（已有）            | ~50 条 thought，无需引入向量库                           |
| 工具存储       | JSON 字段               | 数据量小，避免 JOIN                                      |
| System Prompt  | 每次动态构建            | 上下文随 @ 的 thought 变化                               |
| 配置           | 复用 `AiProviderConfig` | 已有 API Key / Base URL / Model 配置                     |
