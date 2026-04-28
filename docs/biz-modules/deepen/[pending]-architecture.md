# 技术架构文档

**项目类型：** Electron + Vue 3 本地优先知识库管理应用
**更新日期：** 2026-04-22

---

## 技术栈总览

| 层级         | 职责                           | 选型                                     |
| ------------ | ------------------------------ | ---------------------------------------- |
| UI 交互层    | 流式对话、消息状态管理         | Vercel AI SDK `@ai-sdk/vue`              |
| Agent 运行时 | 工具调用循环、Session 管理     | `pi-agent`                               |
| LLM 抽象层   | 多 Provider / 本地模型统一接入 | `pi-ai`                                  |
| 知识检索层   | RAG、向量检索、Insight 提取    | LlamaIndex.TS                            |
| 数据响应式层 | SQLite 变更 → Vue UI 自动同步  | ElectricSQL + TanStack DB                |
| 数据存储层   | 知识库持久化 + 向量存储        | SQLite (`better-sqlite3` + `sqlite-vec`) |

---

## 架构图

```
┌─────────────────────────────────────────────┐
│   Renderer Process (Vue 3)                  │
│                                             │
│   Vercel AI SDK useChat                     │
│   TanStack DB (响应式知识库视图)              │
└──────────────────┬──────────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────▼──────────────────────────┐
│   Main Process (Node.js)                    │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  pi-agent                           │   │
│   │  · 工具调用循环                      │   │
│   │  · Session 树（支持分支 / 回溯）      │   │
│   ├─────────────────────────────────────┤   │
│   │  Tools                              │   │
│   │  · LlamaIndex.TS QueryEngine        │   │
│   │  · SQLite 读写工具                   │   │
│   │  · Workflow 状态工具                 │   │
│   ├─────────────────────────────────────┤   │
│   │  pi-ai                              │   │
│   │  · OpenAI / Anthropic / Google      │   │
│   │  · Ollama（本地模型）                │   │
│   ├─────────────────────────────────────┤   │
│   │  ElectricSQL live queries           │   │
│   │  SQLite + sqlite-vec                │   │
│   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## 核心模块说明

### Agent 运行时 — pi-agent

- 以工具调用循环驱动所有 AI 任务
- Session 采用**树状结构**，天然支持苏格拉底式对话的分支追问与回溯
- 所有知识库操作均通过 Tool 接口进行，Agent 不直接操作数据库

### 知识检索 — LlamaIndex.TS

- 使用 `SQLiteVectorStore` 直接对接现有 SQLite 知识库
- 本地 Embedding 模型通过 Ollama 接入，无需联网
- `QueryEngine` 封装为 pi-agent Tool，供 Agent 按需调用

### Workflow — pi-agent Session 树

- 苏格拉底式对话等有状态流程通过 Session 分支实现
- 每个对话阶段（提问 → 追问 → 反驳 → 综合）对应一个 Session 节点
- Workflow 状态持久化至 SQLite，支持中断恢复

### 数据响应式 — ElectricSQL + TanStack DB

- ElectricSQL 监听 SQLite 变更，实时推送至渲染进程
- TanStack DB 在渲染进程维护响应式内存集合
- Agent 异步写入知识库后，Vue 组件无需手动刷新自动更新

---

## 依赖清单

```jsonc
// Main Process
"pi-agent": "latest",
"pi-ai": "latest",
"llamaindex": "latest",
"better-sqlite3": "latest",
"sqlite-vec": "latest",
"electric-sql": "latest",

// Renderer Process
"@ai-sdk/vue": "latest",
"@tanstack/db": "latest",

// Shared
"typescript": "latest"
```
