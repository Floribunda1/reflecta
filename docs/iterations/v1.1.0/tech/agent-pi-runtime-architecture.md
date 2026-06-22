# Reflecta 1.1.0 Agent Tech Architecture

> 日期：2026-06-22
>
> 状态：Draft
>
> 主题：把 Agent runtime 从 AI SDK chat runtime 迁到 Pi Agent，并明确后端、IPC、前端各自负责什么。
>
> 这份文档只讲整体技术架构和心智模型，不讲 implementation phases。

## 1. 一句话心智模型

Reflecta Agent 是：

```txt
Reflecta product shell around Pi Agent runtime.
```

Pi Agent 是后端运行内核。Reflecta 不重写 agent framework，只把 Pi Agent 放进自己的产品语义里。

```txt
Renderer
  -> IPC commands
  -> AgentService
  -> PiAgentHost
      -> Pi Agent Runtime
      -> Reflecta integration
  -> AgentViewBuilder
  -> IPC view/events
  -> Renderer
```

核心原则：

```txt
Pi owns generic agent mechanics.
Reflecta owns product meaning.
Backend owns agent runtime.
Frontend owns presentation.
```

## 2. Backend Architecture

后端负责运行 Agent。前端不运行 Agent。

```mermaid
flowchart TD
  subgraph Main["Electron Main"]
    Service["AgentService\nIPC facade"]
    Host["PiAgentHost\nReflecta host for Pi"]
    ViewBuilder["AgentViewBuilder\nPi session -> AgentView"]
  end

  subgraph Pi["Pi Agent Runtime"]
    Core["pi-agent-core\nloop"]
    AI["pi-ai\nmodel/provider"]
    Session["Pi SessionManager\nJSONL / resume / branch"]
    Skills["Pi skills"]
    Builtins["Pi builtin tools"]
  end

  subgraph Reflecta["Reflecta Backend Integration"]
    ContextProvider["ReflectaContextProvider"]
    ToolBridge["ReflectaToolBridge"]
    ApprovalPolicy["ApprovalPolicy"]
  end

  subgraph Domain["Reflecta Domain"]
    Thought["ThoughtService"]
    Context["ContextService"]
    Category["CategoryService"]
    Graph["GraphService"]
  end

  Service --> Host
  Service --> ViewBuilder
  Host --> Core
  Host --> Session
  Host --> Skills
  Host --> ContextProvider
  Host --> ToolBridge
  Core --> AI
  Core --> Session
  Core --> Builtins
  Core --> ToolBridge
  Builtins --> ApprovalPolicy
  ToolBridge --> ApprovalPolicy
  ToolBridge --> Thought
  ToolBridge --> Context
  ToolBridge --> Category
  ToolBridge --> Graph
  Session --> ViewBuilder
```

### 2.1 Backend Classes

```mermaid
classDiagram
  direction LR

  class AgentService {
    +sendMessage(input)
    +cancelRun(runId)
    +approveTool(toolCallId)
    +rejectTool(toolCallId)
    +resumeSession(sessionId)
    +listSessions()
    +readView(sessionId)
  }

  class PiAgentHost {
    +handle(command) AgentEventStream
    +readView(sessionId) AgentViewDTO
    -openSession(sessionId)
    -registerTools()
    -registerSkills()
  }

  class PiAgentCore {
    <<Pi>>
    +run(session, tools, skills)
  }

  class PiSessionManager {
    <<Pi>>
    +append(entry)
    +read(sessionId)
    +resume(sessionId)
    +branch(sessionId, entryId)
  }

  class PiAI {
    <<Pi>>
    +complete(request)
    +stream(request)
  }

  class PiSkillRegistry {
    <<Pi>>
    +load()
    +instructions()
    +tools()
  }

  class PiBuiltinTools {
    <<Pi>>
    +readFile()
    +readAttachment()
    +bash()
  }

  class ReflectaContextProvider {
    +buildContext(session, refs)
  }

  class ReflectaToolBridge {
    +toolDefinitions()
    +execute(toolCall)
    +resumeApproved(toolCallId)
  }

  class ApprovalPolicy {
    +decisionFor(toolCall)
  }

  class AgentViewBuilder {
    +fromSession(entries) AgentViewDTO
  }

  class PiSessionEntry {
    <<PiData>>
    +role
    +content
    +timestamp
  }

  class ReflectaSessionEntry {
    <<ReflectaData>>
    +type
    +payload
    +sourceRefs
  }

  class ThoughtService
  class ContextService
  class CategoryService
  class GraphService

  AgentService --> PiAgentHost : delegates commands
  AgentService --> AgentViewBuilder : reads view

  PiAgentHost *-- PiAgentCore : hosts
  PiAgentHost *-- PiSessionManager : opens sessions
  PiAgentHost *-- PiSkillRegistry : loads skills
  PiAgentHost *-- ReflectaContextProvider : injects context
  PiAgentHost *-- ReflectaToolBridge : registers tools
  PiAgentHost --> AgentViewBuilder : returns view

  PiAgentCore --> PiAI : model calls
  PiAgentCore --> PiSessionManager : appends entries
  PiAgentCore --> PiSkillRegistry : reads instructions/tools
  PiAgentCore --> PiBuiltinTools : calls builtin tools
  PiAgentCore --> ReflectaToolBridge : calls Reflecta tools

  PiSessionManager *-- PiSessionEntry : stores
  ReflectaSessionEntry --|> PiSessionEntry : custom entry
  PiSessionManager *-- ReflectaSessionEntry : stores

  AgentViewBuilder --> PiSessionManager : reads entries
  AgentViewBuilder --> ReflectaSessionEntry : interprets product entries

  ReflectaToolBridge --> ApprovalPolicy : checks
  ReflectaToolBridge --> ThoughtService : reads/writes
  ReflectaToolBridge --> ContextService : reads/writes
  ReflectaToolBridge --> CategoryService : reads/writes
  ReflectaToolBridge --> GraphService : reads
  PiBuiltinTools --> ApprovalPolicy : gated by Reflecta
```

### 2.2 What Each Backend Class Means

| Class                     | Meaning                                         | Why it exists                                                     |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| `AgentService`            | Thin Electron IPC facade.                       | Keeps IPC separate from runtime decisions.                        |
| `PiAgentHost`             | The class that runs Pi Agent inside Reflecta.   | One place knows both Pi runtime and Reflecta integration.         |
| `PiAgentCore`             | Pi-owned loop.                                  | We do not rewrite model/tool/model continuation.                  |
| `PiSessionManager`        | Pi-owned JSONL session/resume/branch.           | We use Pi's session model as agent history.                       |
| `ReflectaContextProvider` | Builds Reflecta context for a Pi run.           | Pi does not know Thought / Context / Category.                    |
| `ReflectaToolBridge`      | Exposes Reflecta tools to Pi.                   | Pi can call Reflecta domain actions through a controlled adapter. |
| `ApprovalPolicy`          | Decides which calls need user approval.         | Approval is a product rule, not a generic Pi rule.                |
| `AgentViewBuilder`        | Converts Pi session entries into renderer DTOs. | Frontend needs a product view, not raw Pi entries.                |

## 3. What AgentViewBuilder Is

`AgentViewBuilder` is the clearer name for what earlier drafts called `Projector`.

It is not a runtime. It does not call the model. It does not execute tools. It does not decide approval.

It is a pure converter:

```txt
Pi session JSONL entries
  + Reflecta custom entries
  -> AgentViewDTO
```

Example:

```txt
Pi assistant message entry
  -> assistant turn

Pi tool call entry
  -> tool activity row

Reflecta approval-requested entry
  -> approval card

Reflecta mutation-result entry
  -> result ref in the UI
```

Why this class exists:

- Pi session history is good for runtime/debug.
- Raw Pi session entries are not a frontend interface.
- The renderer needs stable UI DTOs: turns, tool cards, approval cards, result refs.
- If the app reloads, `AgentViewBuilder` can rebuild the same UI from session history.

So the rule is:

```txt
Pi session is the backend history.
AgentViewDTO is the frontend view.
AgentViewBuilder converts between them.
```

## 4. IPC Seam

IPC is the only seam between backend and frontend.

```mermaid
flowchart LR
  Renderer["Renderer"]
  Service["AgentService"]
  Host["PiAgentHost"]
  ViewBuilder["AgentViewBuilder"]

  Renderer -->|"AgentCommand"| Service
  Renderer -->|"AgentQuery"| Service
  Service --> Host
  Service --> ViewBuilder
  Service -->|"AgentEvent"| Renderer
  Service -->|"AgentViewDTO"| Renderer
```

IPC shapes:

| Shape          | Direction           | Meaning                                             |
| -------------- | ------------------- | --------------------------------------------------- |
| `AgentCommand` | Renderer -> Backend | User intent: send, cancel, approve, reject, resume. |
| `AgentQuery`   | Renderer -> Backend | Read sessions or one session view.                  |
| `AgentEvent`   | Backend -> Renderer | Live event for the active session.                  |
| `AgentViewDTO` | Backend -> Renderer | Full view model for rendering.                      |

IPC must not expose:

- raw Pi session entries
- provider SDK chunks
- Pi internal tool objects
- AI SDK `UIMessage`

## 5. Frontend Architecture

前端负责展示和发命令。前端不负责 agent loop，也不直接理解 Pi session。

```mermaid
flowchart TD
  subgraph Renderer["Renderer"]
    Page["AgentPage"]
    Session["session/\nqueries + event subscription"]
    Composer["composer/\ndraft + refs + files"]
    Messages["messages/\nrender turns"]
    Tools["tools/\nrender tool and approval cards"]
    Context["context/\nref picker and inspector"]
    LocalUI["local UI data\npanel / draft / selection"]
  end

  IPC["Agent IPC"]

  Page --> Session
  Page --> Composer
  Page --> Messages
  Page --> Tools
  Page --> Context
  Session --> Messages
  Session --> Tools
  Composer --> IPC
  Tools --> IPC
  Context --> Composer
  Session --> IPC
  Page --> LocalUI
```

### 5.1 Frontend Classes / Modules

```mermaid
classDiagram
  direction LR

  class AgentPage {
    +render()
  }

  class AgentSessionController {
    +loadSession(sessionId)
    +subscribe(sessionId)
    +send(command)
  }

  class AgentViewDTO {
    +sessions
    +turns
    +toolActivities
    +pendingApprovals
  }

  class Composer {
    +draft
    +selectedRefs
    +submit()
  }

  class MessageList {
    +render(turns)
  }

  class ToolPanel {
    +render(toolActivities)
    +approve(toolCallId)
    +reject(toolCallId)
  }

  class ContextPicker {
    +selectRef()
  }

  class AgentIPCClient {
    +command(command)
    +query(query)
    +subscribe(sessionId)
  }

  AgentPage *-- AgentSessionController
  AgentPage *-- Composer
  AgentPage *-- MessageList
  AgentPage *-- ToolPanel
  AgentPage *-- ContextPicker

  AgentSessionController --> AgentIPCClient
  AgentSessionController --> AgentViewDTO
  MessageList --> AgentViewDTO
  ToolPanel --> AgentViewDTO
  Composer --> AgentIPCClient : sends AgentCommand
  ToolPanel --> AgentIPCClient : approve/reject
  ContextPicker --> Composer : selected refs
```

Frontend modules:

| Module      | Owns                                                                    | Does not own                        |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `session/`  | Fetching `AgentViewDTO`, subscribing to `AgentEvent`, sending commands. | Pi session parsing, tool execution. |
| `composer/` | Draft text, selected refs before submit, files before submit.           | Prompt building, model input.       |
| `messages/` | Rendering turns from `AgentViewDTO`.                                    | Runtime history.                    |
| `tools/`    | Rendering tool activity and approval controls.                          | Approval truth.                     |
| `context/`  | Picking Thought / Context / Category refs.                              | Expanding refs into model context.  |

The frontend consumes:

```txt
AgentViewDTO
AgentEvent
```

The frontend does not consume:

```txt
PiSessionEntry
ReflectaSessionEntry
UIMessage
provider stream chunks
```

## 6. Backend Data Vs Frontend Data

### Backend keeps

- Pi JSONL sessions.
- Pi run/session metadata.
- Reflecta custom session entries.
- Approval decisions.
- Tool results.
- Knowledge writes through domain modules.

### Frontend keeps

- Composer draft.
- Currently selected refs before submit.
- Panel open/closed data.
- Scroll and visual preferences.
- Cached `AgentViewDTO` from the backend.

Rule:

```txt
If it must survive app restart or explain a run, backend keeps it.
If it only affects the current screen, frontend keeps it.
```

## 7. Main Flows

### 7.1 Send Message

```mermaid
sequenceDiagram
  participant UI as Renderer
  participant IPC as AgentService
  participant Host as PiAgentHost
  participant Session as PiSessionManager
  participant Pi as PiAgentCore
  participant Tools as ReflectaToolBridge
  participant Domain as Reflecta Domain
  participant View as AgentViewBuilder

  UI->>IPC: AgentCommand.sendMessage
  IPC->>Host: handle(command)
  Host->>Session: append user message + Reflecta refs
  Host->>Pi: run(session, tools, skills)
  Pi->>Tools: tool call
  Tools->>Domain: read or approved write
  Domain-->>Tools: result
  Tools-->>Pi: tool result
  Pi->>Session: append assistant/tool entries
  IPC->>View: read view
  View-->>UI: AgentViewDTO
```

### 7.2 Approval

```txt
Pi calls an approval-gated tool
  -> ReflectaToolBridge appends a Reflecta approval entry into Pi session
  -> AgentViewBuilder turns that entry into an approval card
  -> frontend sends approve/reject command
  -> PiAgentHost resumes the pending tool call
  -> ReflectaToolBridge performs or rejects the operation
  -> Pi session records the outcome
  -> AgentViewBuilder returns the updated AgentViewDTO
```

The approval card is not the source of truth. The session entry is.

### 7.3 Resume

```txt
App opens
  -> PiAgentHost reads Pi sessions
  -> AgentViewBuilder rebuilds AgentViewDTO
  -> unfinished runs are marked interrupted or resumed by PiAgentHost policy
```

The first target is not necessarily "continue a half-open stream". The architectural target is:

```txt
The whole Agent UI can be rebuilt from Pi session history.
```

## 8. What Pi Agent Does Here

| Pi part          | Responsibility in Reflecta                                |
| ---------------- | --------------------------------------------------------- |
| `pi-agent-core`  | Runs the model/tool/model loop and stop conditions.       |
| `pi-ai`          | Provides model/provider abstraction for the loop.         |
| Pi session JSONL | Stores agent history for debug, resume, branch, replay.   |
| Pi skills        | Provides reusable instructions/tool bundles.              |
| Pi builtin tools | Supplies generic local tools where Reflecta enables them. |

Reflecta adds:

- Thought / Context / Category context.
- Reflecta tools.
- Approval policy.
- Domain writes.
- Frontend view DTOs.

## 9. Architecture Review Checks

- Does this belong to backend runtime or frontend presentation?
- Is this generic agent behaviour? If yes, why is Pi not owning it?
- Is this Reflecta product meaning? If yes, is it represented as a Reflecta custom session entry?
- Is the frontend reading `AgentViewDTO`, not raw Pi entries?
- Can the UI rebuild from Pi session history?
- Does approval truth live in session history, not button-local data?
- Does every knowledge write go through Reflecta domain modules?
- If Pi changes internally, is the blast radius mostly `PiAgentHost`, `ReflectaToolBridge`, or `AgentViewBuilder`?
