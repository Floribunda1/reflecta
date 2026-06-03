# Agent 对话 — 技术架构

> 创建时间：2025-07-17
> 状态：架构设计
> 前置文档：`drafts/agent-chat-discovery.md`（需求发现）

---

## 一、总览

```
┌──────────────────────────────────────────────────────────────────┐
│                     Renderer Process                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐   │
│  │ Capture  │  │Contemplate│  │  AgentView (/agent)          │   │
│  │  页面    │  │  页面     │  │  ┌──────────┬─────────────┐ │   │
│  │          │  │          │  │  │ Chat     │ Right Panel │ │   │
│  │  工具栏  │  │  工具栏   │  │  │ Panel    │ Browse/     │ │   │
│  │  [AI对话]│  │  [AI对话] │  │  │ (居中)   │ Graph/      │ │   │
│  │    │     │  │    │     │  │  │          │ Search/Refs │ │   │
│  └───┼──────┘  └───┼──────┘  │  └──────────┴─────────────┘ │   │
│      │              │         └──────────────────────────────┘   │
│      ▼              ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AgentDrawer (侧边栏抽屉，嵌入 Capture/Contemplate)       │   │
│  │  ┌────────────────────┬─────────────────────────────────┐│   │
│  │  │ Chat Panel         │ Right Panel (精简)              ││   │
│  │  └────────────────────┴─────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                         IPC Bridge                               │
│  ┌──────────────────────┐  ┌────────────────────────────────┐   │
│  │ electron-ipc-        │  │ Raw IPC push                   │   │
│  │ decorator (req/res)  │  │ chat:stream-event              │   │
│  │ 会话/消息 CRUD       │  │ 流式 delta + tool 确认事件     │   │
│  └──────────────────────┘  └────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                      Main Process                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ChatService (IPC facade)                                  │  │
│  │    ├─ ChatElectronBff (domain logic)                       │  │
│  │    └─ ChatAgent (LLM loop + tool execution + streaming)    │  │
│  │         ├─ OpenAI SDK (stream + function calling)          │  │
│  │         ├─ Tool Executors (读: 自主 / 写: 需确认)         │  │
│  │         └─ System Prompt Builder                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Existing Services (Thought / Context / Search / Category) │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│                     SQLite (Drizzle ORM + FTS5)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ thoughts │ │ contexts │ │ thought_conn │ │ conversations │  │
│  │          │ │          │ │              │ │ messages (NEW)│  │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**两种入口，共享核心组件：**

| 入口                       | 形态                              | 场景                                       |
| -------------------------- | --------------------------------- | ------------------------------------------ |
| `/agent` 独立路由          | 全屏 Chat 居中 + 完整 Right Panel | 沉浸式深度对话、浏览历史对话               |
| Capture/Contemplate 侧边栏 | Drawer 滑入 (~50% 宽度)           | 浏览知识库时"停下来聊"，自动携带当前上下文 |

---

## 二、后端架构（Main Process）

### 2.1 分层

```
packages/server/src/domains/chat/
  types.ts          — DTO、ToolCall、StreamEvent 联合类型
  core.ts           — 会话 & 消息 CRUD
  tools.ts          — 7 个工具定义 + 执行器
  agent.ts          — LLM 交互 + 流式控制 + 工具循环
  bff-electron.ts   — Electron IPC 层接口
  index.ts          — 导出

apps/electron/src/main/services/
  ChatService.ts    — IPC 门面（CRUD 走 decorator，流式走原始 IPC）
  core.ts           — 新增 chatService lazy init
  index.ts          — 注册 ChatService + 流式 IPC handler
```

### 2.2 新增数据表

```sql
-- 会话
CREATE TABLE conversations (
  id         TEXT PRIMARY KEY NOT NULL,
  title      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 消息
CREATE TABLE messages (
  id              TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,          -- "user" | "assistant" | "tool"
  content         TEXT NOT NULL DEFAULT '',
  tool_calls      TEXT,                   -- JSON | null (assistant 消息的工具调用)
  tool_call_id    TEXT,                   -- tool 消息关联的工具调用 ID
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_messages_conv ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

### 2.3 工具体系

七个工具，按执行模式分两类：

**读工具（Agent 自主执行，无需用户确认）：**

| 工具                     | 功能                                         | 依赖现有服务                     |
| ------------------------ | -------------------------------------------- | -------------------------------- |
| `search_knowledge_base`  | FTS5 搜索 thought 正文 + context             | SearchService                    |
| `get_thought_detail`     | 获取 thought 完整内容 + context + connection | ThoughtService                   |
| `get_graph_neighborhood` | 获取节点的 1-hop 邻居 + category 归属        | ThoughtService + CategoryService |

**写工具（暂停流式，弹出确认卡片，用户确认后执行）：**

| 工具                        | 功能                        | 依赖现有服务                    |
| --------------------------- | --------------------------- | ------------------------------- |
| `propose_create_insight`    | 提议创建 insight            | ThoughtService.createThought    |
| `propose_update_thought`    | 提议修改 thought 正文       | ThoughtService.updateThought    |
| `propose_add_context`       | 提议为 thought 添加 Context | ContextService.createContext    |
| `propose_create_connection` | 提议创建 thought 间连线     | ThoughtService (add connection) |

### 2.4 Agent 循环

```
ChatAgent.stream(convId, userMessage, referenceIds)
  │
  ├─ 1. 构建 System Prompt
  │     ├─ Agent 角色定义（认知伙伴，催化剂而非替代者）
  │     ├─ 自动加载 @ 引用的 thought 完整上下文：
  │     │   ├─ 正文 + title + type
  │     │   ├─ 所有 Context 内容
  │     │   ├─ 图谱连线（上下游节点摘要）
  │     │   └─ Category 归属
  │     └─ 最近 N 轮对话历史
  │
  ├─ 2. 存储 user message 到 DB
  │
  └─ 3. LLM 调用 + 事件循环
        │
        ├─ text delta → { type: "delta", content }
        │
        ├─ tool_call (读工具)
        │     → 立即执行 → 结果追加到 messages
        │     → 继续 LLM（不中断流式）
        │
        ├─ tool_call (写工具)
        │     → { type: "tool_pending", toolCall }
        │     → 暂停，等待外部 confirm / reject
        │     → confirm: 执行工具 → 结果追加 → 继续 LLM
        │     → reject:  错误结果追加 → 继续 LLM
        │
        └─ finish_reason=stop
              → 存储 assistant message 到 DB
              → { type: "done", messageId }
```

### 2.5 IPC 通道设计

```
会话 CRUD（标准 IPC，走 electron-ipc-decorator）:
  chat.listConversations()   → ConversationDTO[]
  chat.getConversation(id)   → ConversationDetailDTO
  chat.createConversation()  → ConversationDTO
  chat.deleteConversation(id)
  chat.renameConversation(id, title)
  chat.getMessages(convId)   → MessageDTO[]
  chat.editMessage(msgId, content)

流式对话 + 工具确认（混合模式）:
  Renderer                          Main
    │                                 │
    │── invoke('chat.sendMessage') ──►│ 立即返回 { requestId }
    │                                 │ 启动 ChatAgent.stream()
    │                                 │
    │◄── on('chat:stream-event') ────│ 持续推送 StreamEvent:
    │    { requestId, event }         │   delta / tool_pending / done / error
    │                                 │
    │── invoke('chat.confirmTool') ──►│ 恢复 Agent 循环
    │── invoke('chat.rejectTool') ──► │
    │── invoke('chat.cancelStream') ─►│ 中止
```

**设计依据：** `electron-ipc-decorator` 只支持 request/response，流式需要主进程主动 push，只能用 `webContents.send` + `ipcRenderer.on`。CRUD 继续走 decorator，流式走原始 IPC —— 最小侵入。

### 2.6 复用现有模块（不修改）

| 现有模块              | Agent 如何使用                                                   |
| --------------------- | ---------------------------------------------------------------- |
| `ThoughtElectronBff`  | 写工具执行：`createThought` / `updateThought` / `getThoughtById` |
| `ContextElectronBff`  | `propose_add_context` 时调用 `createContext`                     |
| `SearchElectronBff`   | `search_knowledge_base` 调用 `search()`（已有 FTS5）             |
| `CategoryElectronBff` | `get_graph_neighborhood` 获取 category 信息                      |
| `AiProviderConfig`    | Agent 复用同一份 API Key / Base URL / Model 配置                 |
| `ReflectaDb` 实例     | ChatCore 使用同一个 Drizzle 实例                                 |
| FTS5 索引             | `fts_thoughts` / `fts_contexts` 已覆盖正文和 Context             |

---

## 三、前端架构（Renderer Process）

### 3.1 组件树

```
AgentView（路由 /agent）
  └─ Splitter (PrimeVue)
       ├─ ChatPanel（flex: 1，居中主线）
       │   ├─ MessageList
       │   │   ├─ MessageBubble (user)
       │   │   │   ├─ Markdown 渲染
       │   │   │   └─ 操作：Fork / Edit
       │   │   ├─ MessageBubble (assistant)
       │   │   │   ├─ Markdown 渲染 + 流式打字效果
       │   │   │   └─ 操作：复制 / 重新生成
       │   │   └─ ToolCallCard（propose_* 触发时显示）
       │   │       ├─ CreateInsightCard     — 标题 + 正文预览
       │   │       ├─ UpdateThoughtCard     — 目标 thought + diff
       │   │       ├─ AddContextCard        — 目标 thought + sourceType + 内容
       │   │       └─ CreateConnectionCard  — source → target
       │   │          每个卡片：确认 / 拒绝 按钮
       │   │
       │   └─ ChatInput
       │       ├─ Textarea（自动增高）
       │       ├─ ThoughtMentionOverlay（@ 触发浮动搜索弹窗）
       │       ├─ ReferenceChips（已 @ 的 thought 标签，可移除）
       │       └─ SendButton / StopButton（流式中切换）
       │
       └─ RightPanel（width: ~360px，可收折）
           ├─ TabBar：[浏览] [图谱] [搜索] [引用]
           ├─ BrowseTab      — CategoryTree → 展开 → ThoughtList → 点击查看详情
           ├─ GraphTab       — 局部子图（已 @ 节点 + 1-hop 邻居），节点可点击
           ├─ SearchTab      — 搜索框 → 结果列表 → 点击查看详情
           └─ ReferencesTab  — 当前对话已 @ 的 thought 列表，可查看 / 移除
```

### 3.2 组件目录

```
apps/electron/src/renderer/src/modules/agent/
  index.tsx                    — AgentView（/agent 路由入口）
  context.tsx                  — useAgentProvide（状态注入，与 capture/contemplate 一致）
  types.ts                     — 前端专用类型

  chat-panel/
    index.tsx                  — ChatPanel（居中面板，可独立嵌入 AgentView 或 AgentDrawer）
    MessageList.tsx            — 消息列表（滚动容器 + 自动滚底）
    MessageBubble.tsx          — 单条消息气泡
    ToolCallCard.tsx           — 确认卡片容器 + CreateInsightCard / UpdateThoughtCard / ...
    ChatInput.tsx              — 输入区 + @ 弹窗 + 发送/停止
    ThoughtMentionOverlay.tsx  — @ 触发时的浮动搜索弹窗

  right-panel/
    index.tsx                  — RightPanel（tab 容器）
    BrowseTab.tsx              — 复用 CategoryTree + ThoughtList
    GraphTab.tsx               — 复用 AntV G6 局部子图渲染
    SearchTab.tsx              — 搜索框 + 结果列表
    ReferencesTab.tsx          — 已 @ thought 清单

  drawer/
    AgentDrawer.tsx            — Drawer 容器（嵌入 Capture / Contemplate 时使用）
```

### 3.3 状态管理

```typescript
// context.tsx — useAgentProvide（createInjectionState 模式）

interface AgentState {
  // 会话
  conversations: ConversationDTO[];
  activeConvId: string | null;

  // 消息
  messages: MessageDTO[];
  isStreaming: boolean;
  streamingContent: string; // 当前流式 delta 累积（未存库）

  // 工具确认
  pendingToolCall: AgentToolCall | null; // 等待用户确认的工具调用

  // 右侧面板
  rightPanelMode: "browse" | "graph" | "search" | "references";
  references: ThoughtSummaryDTO[]; // 已 @ 的 thought

  // 搜索
  searchQuery: string;
  searchResults: SearchResult | null;
}
```

### 3.4 流式消费

```typescript
// useChatStream() — 封装流式 IPC 订阅

function useChatStream() {
  // 发送消息 → chat.sendMessage()，立即拿到 requestId
  // 注册 ipcRenderer.on('chat:stream-event', handler)
  //   - delta          → append streamingContent
  //   - tool_pending   → set pendingToolCall
  //   - done           → finalize message, clear streaming
  //   - error          → toast error
  // 取消 → chat.cancelStream(requestId)
  // 确认/拒绝工具 → chat.confirmTool / chat.rejectTool
}
```

### 3.5 两个入口的上下文传递

**独立 /agent 页面：** 无预设上下文，用户通过 @ 手动注入 thought。

**Capture / Contemplate 侧边栏：**

```
[Capture]
  用户选中某条 thought → 点击工具栏 [AI 对话] 按钮
    → 打开 AgentDrawer
    → 自动 @ 当前选中的 thought
    → 如果 thought 有 context/connection，自动旁加载

[Contemplate]
  用户在图谱中选中节点 + 视野内有子图
    → 点击工具栏 [AI 对话] 按钮
    → 打开 AgentDrawer
    → 自动 @ 选中的节点 + 视野内可见节点
    → 自动旁加载它们的 context + connection + category
```

两种入口共享 `ChatPanel` 和 `RightPanel` 组件，通过 props 控制：

- `embedded: boolean` — 是否为侧边栏模式（略窄，RightPanel 可收折）
- `initialReferences: string[]` — 初始 @ 的 thought ID 列表

### 3.6 新增路由与导航

```typescript
// router/index.ts
{ path: "/agent", name: "Agent", component: AgentView }

// AppLayout.tsx — 导航栏新增入口
// 图标 + 文字 "Agent"，点击跳转 /agent
```

### 3.7 复用现有前端模块（不修改或最小修改）

| 现有模块                                   | Agent 前端如何使用                        |
| ------------------------------------------ | ----------------------------------------- |
| `CategoryTree` (capture)                   | BrowseTab 中复用，展示 category 树        |
| `ThoughtCard` / `ThoughtList` (capture)    | BrowseTab 中复用，展示 thought 列表       |
| `ThoughtDetail` (capture)                  | BrowseTab 中点击 thought 展开详情         |
| `GraphCanvas` (contemplate)                | GraphTab 中复用，但限制交互（无拖拽重构） |
| `GlobalSearch` (shared)                    | SearchTab 中复用                          |
| `useCategory` / `useThought` hooks         | BrowseTab / ReferencesTab 中复用          |
| `MdPreview` (shared)                       | MessageBubble 中复用，渲染 Markdown       |
| PrimeVue `Splitter` / `Drawer` / `TabView` | 布局容器                                  |

---

## 四、关键架构决策

| 决策           | 选择                              | 理由                                                         |
| -------------- | --------------------------------- | ------------------------------------------------------------ |
| Agent 运行位置 | **Main Process**                  | 唯一能访问 DB 的进程；API Key 安全；写工具需调用现有 Service |
| 流式通道       | **原始 IPC push**（非 decorator） | decorator 只支持 req/res；流式需主进程主动推事件             |
| 工具确认模式   | **暂停-恢复**（非预生成-替换）    | 工具结果可能改变后续输出，预生成会导致内容跳变               |
| 知识检索方案   | **FTS5**（非向量数据库）          | 用户 ~50 条 thought，FTS5 够用；省去 embedding 复杂度        |
| 工具调用存储   | **JSON 字段**（非关联表）         | 个人工具，数据量小；避免额外 JOIN                            |
| System Prompt  | **每次动态构建**（不存库）        | 每次对话上下文不同（@ 的 thought 不同），需实时组装          |
| 配置           | **复用现有 AiProviderConfig**     | API Key / Base URL / Model 已配好，不重复造轮子              |

---

## 五、需修改的现有文件

| 文件                                                                 | 修改                                  | 风险 |
| -------------------------------------------------------------------- | ------------------------------------- | ---- |
| `packages/server/src/db/schema.ts`                                   | 新增 `conversations` + `messages` 表  | 低   |
| `packages/server/src/db/migration.ts`                                | 新增 003 migration                    | 低   |
| `packages/server/src/index.ts`                                       | 新增 `export * from "./domains/chat"` | 低   |
| `apps/electron/src/main/services/core.ts`                            | 新增 `chatService` lazy init          | 低   |
| `apps/electron/src/main/services/index.ts`                           | 注册 ChatService + 流式 IPC handler   | 低   |
| `apps/electron/src/renderer/src/router/index.ts`                     | 新增 `/agent` 路由                    | 低   |
| `apps/electron/src/renderer/src/modules/shared/layout/AppLayout.tsx` | 导航加 Agent 入口                     | 低   |
| `apps/electron/src/renderer/src/modules/capture/index.tsx`           | 工具栏加 [AI 对话] 按钮               | 低   |
| `apps/electron/src/renderer/src/modules/contemplate/index.tsx`       | 工具栏加 [AI 对话] 按钮               | 低   |

**原则：** 所有新增能力放在新文件。对现有文件的修改仅限注册/路由/按钮——不碰现有业务逻辑。

---

## 六、待定问题

1. **Token 预算管理** — 当用户 @ 多条 thought + context + 邻居时可能超出模型上下文窗口。需要优先级策略：正文 > context snippet > 邻居摘要。
2. **Fork 实现** — 从某条消息分叉出新对话。技术上是从该消息之前的 history + 该消息作为起点创建新 conversation。
3. **局部子图渲染** — GraphTab 复用 Contemplate 的 G6 渲染，但需限制交互（无拖拽重构、无全局视角）。
4. **模型降级** — 用户配置的模型可能不支持 function calling → Agent 降级为纯文本对话（无工具调用）。
