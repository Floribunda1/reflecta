# v1.2.5 Agent Execution Module Design

> 状态：Planned
>
> 对应主计划：[Module 3：Agent 执行过程展示](./ui-package-storybook-migration-plan.md#8-module-3agent-执行过程展示)
>
> 组织逻辑：本文采用**递进型主线**，按“现有执行状态 → 展示数据收缩 → component interface → Agent Adapter → 状态验收”展开。原因是 `agent-turn-view.ts` 当前同时产生大量 UI 未使用字段，必须先从真实 JSX 反推最小 View Model；横向按 Reasoning、Tool Activity、Context Compaction、Pending 四种互斥 block 做 MECE 分类。

## 1. 结论

Agent Execution Module 负责展示不要求用户做写入决策的 Agent 过程状态：

- Reasoning；
- Read-only/普通 Tool Activity；
- Context Compaction receipt；
- 等待首个 assistant block 的 Pending placeholder。

公开 interface：

```text
@reflecta/ui/chat
  AgentExecutionBlock
  AgentExecutionBlockView
  AgentToolDetailsView
```

`agent-turn-view.ts` 继续留在 Electron，负责把原始 Agent blocks 和 tool-specific payload 翻译为 display-ready View Model。UI package 不识别 `web_search`、`read`、`graph`、`understanding_get` 等 tool name。

## 2. 当前组件与职责

### 2.1 迁移组件

| 当前实现                     | 新实现                   | 职责                                   |
| ---------------------------- | ------------------------ | -------------------------------------- |
| `ReasoningBlock`             | `ReasoningBlock`         | streaming/done 状态、折叠与 Markdown   |
| `ToolActivityGroup`          | `ToolActivityBlock`      | Activity summary、状态 badge、展开内容 |
| `ToolDetailRows`             | `ToolDetails`            | 全局 meta、rows、empty state           |
| `ToolDetailDescription`      | `ToolDetailContent`      | text/pre/Markdown、preview/full 展开   |
| `ContextCompactionReceipt`   | `ContextCompactionBlock` | token change 与 summary                |
| `RunningResponsePlaceholder` | `AgentPendingBlock`      | 首个 assistant block 产生前的反馈      |
| `hasToolDetails`             | internal helper          | 判断 detail section 是否显示           |
| `compactTokenCount`          | internal helper          | token 数字的人读格式                   |

这些 component 都迁移到 `packages/ui/src/chat/execution`，只有 `AgentExecutionBlock` 和必要 View Model 类型公开。

### 2.2 留在 Electron

| 当前实现或职责                                 | 原因                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| `buildAgentTurnView`                           | 输入是 App 私有 `AgentReducedAssistantBlock`    |
| `appendText`、`appendReasoning`、`appendTool`  | Agent block sequencing                          |
| `toolGroupType`                                | tool-specific policy                            |
| `toolRunningSummary`、`toolDoneSummary`        | 解释 tool name/input/output                     |
| `toolResultDetails` 及各 tool detail builder   | 解释 Search、Graph、Read、Bash 等 payload       |
| `detailRow`、`limitedRows`、preview truncation | 从不可信/大体积 tool output 构造安全 View Model |
| session running/stopped 判断                   | Thread state                                    |
| raw tool errors、input/output                  | 不能进入平台无关 UI interface                   |

### 2.3 从 UI View Model 删除的字段

当前类型中有多项 Renderer 从未读取，迁移时删除：

| 当前字段                        | 决策 | 原因                                       |
| ------------------------------- | ---- | ------------------------------------------ |
| `ToolActivityView.groupType`    | 删除 | 只在 Adapter 中决定 summary                |
| `ToolActivityView.title`        | 删除 | 当前 JSX 不显示                            |
| `ToolActivityView.statusLabel`  | 删除 | 可由 `status` 稳定推导                     |
| `ToolActivityItemView.toolName` | 删除 | UI 不按 tool name 分支                     |
| Item `status` / `statusLabel`   | 删除 | 当前 JSX 只显示 group status 和 item label |

删除这些字段让 Tool Module 的 interface 从 tool protocol 降为纯展示数据。

## 3. Public View Model

### 3.1 Tool detail content

```ts
export type AgentToolDetailContent =
  | {
      format: "text";
      value: string;
    }
  | {
      format: "pre" | "markdown";
      preview: string;
      full?: string;
    };

export type AgentToolDetailRowView = {
  id: string;
  label: string;
  title: string;
  content?: AgentToolDetailContent;
  meta?: readonly string[];
};

export type AgentToolDetailMetaView = {
  label: string;
  value: string;
};

export type AgentToolDetailsView = {
  meta?: readonly AgentToolDetailMetaView[];
  rows?: readonly AgentToolDetailRowView[];
  emptyText?: string;
};
```

设计变化：

- row 增加 Adapter 提供的稳定 `id`，UI 不再使用 `label + title + index` 猜 key；
- `content` 用 union 取代可选 `description/fullDescription/format` 组合；
- `text` 不支持 full/preview 展开；
- `pre` 与 `markdown` 显式提供 preview 和可选 full；
- 空数组可以省略，Story fixture 更简洁；
- View Model 不出现 raw output。

### 3.2 Tool activity

```ts
export type AgentExecutionStatus = "running" | "done" | "failed";

export type AgentToolActivityItemView = {
  id: string;
  label: string;
  details?: AgentToolDetailsView;
  error?: string;
};

export type AgentToolActivityView = {
  id: string;
  status: AgentExecutionStatus;
  summary: string;
  items: readonly AgentToolActivityItemView[];
};
```

稳定规则：

- `id` 使用 tool group 的 UI identity，不要求暴露 toolCallId 语义；
- `summary` 已经由 Electron Adapter 生成人读文本；
- status badge 文案由 UI Module 统一映射；
- 多 item 时显示 item label，单 item 时不重复 summary；
- `error` 只接受用户可见错误，不包含 stack、headers 或 secrets。

### 3.3 Reasoning

```ts
export type AgentReasoningView = {
  id: string;
  status: "streaming" | "done";
  markdown: string;
};
```

UI 行为：

- `streaming` 显示 spinner 和“正在思考”；
- `done` 显示“思考过程”；
- 默认折叠；
- 内容使用 `ChatMarkdown tone="muted"`；
- 空内容显示“等待模型输出思考内容”。

### 3.4 Context compaction

```ts
export type AgentContextCompactionView = {
  id: string;
  summary: string;
  tokensBefore?: number;
  estimatedTokensAfter?: number;
};
```

UI 使用 `Intl.NumberFormat` 生成人读 token change。`reason`、sessionId、runId、createdAt、contextWindow 等未参与展示的 App 字段不进入 interface。

### 3.5 Pending

```ts
export type AgentPendingView = {
  id: string;
  label?: string;
};
```

`label` 默认“正在思考”。不暴露 isBusy/isLastAssistant 两个布尔值；Electron Adapter 只在确实应显示 placeholder 时创建该 block。

### 3.6 Execution union

```ts
export type AgentExecutionBlockView =
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "tool-activity"; activity: AgentToolActivityView }
  | { kind: "context-compaction"; compaction: AgentContextCompactionView }
  | { kind: "pending"; pending: AgentPendingView };
```

所有 union member 的 UI identity 都在内部对象 `id` 上，避免额外重复 block id。

## 4. Component Interface

```ts
export type AgentExecutionBlockProps = {
  block: AgentExecutionBlockView;
  defaultExpanded?: boolean;
  entityBindings?: ChatEntityBindings;
};

export function AgentExecutionBlock(props: AgentExecutionBlockProps): React.ReactNode;
```

`ChatEntityBindings` 直接复用 Module 2 的公开类型，不在 Execution Module 重复定义：

```ts
import type { ChatEntityBindings } from "@reflecta/ui/chat";
```

Interface 规则：

- `defaultExpanded` 只控制 Tool Activity 初始状态；后续开关状态由 component 内部维护；
- Reasoning 和 Compaction 使用自己的固定默认行为；
- `entityBindings` 只传给内部 Markdown；
- 不接受 tool-specific render callback；
- 不接受自定义 status label、badge variant 或 class map；
- 不暴露 `ToolDetails` 子组件。

Module 5 内部组合时通过 package context 提供 `entityBindings`，不需要逐 block 重复传递；单独使用 `AgentExecutionBlock` 的 Story/消费者仍可显式传入。

## 5. Electron Adapter

### 5.1 原始 block 到 execution block

```text
Agent reasoning block
  -> trim/merge in Electron
  -> AgentReasoningView

Agent tool block
  -> tool-specific summary/details in Electron
  -> AgentToolActivityView

Agent context compaction event
  -> select summary/token fields
  -> AgentContextCompactionView

busy + no assistant block
  -> AgentPendingView
```

### 5.2 Adapter function

现有 `buildAgentTurnView` 最终改为返回 `@reflecta/ui/chat` 类型。建议保留一个 App-side mapper：

```ts
function buildAgentMessageBlocks(
  blocks: readonly AgentReducedAssistantBlock[],
  options: { assistantRunning: boolean },
): AgentMessageBlockView[];
```

Module 3 阶段可以暂时保留 `buildAgentTurnView` 名称，但 exported result 必须使用新的 execution types；Module 5 完成时再统一命名，避免同一提交同时改所有调用方。

### 5.3 Detail 映射

当前：

```ts
{
  (label, title, description, fullDescription, format, meta);
}
```

目标：

```ts
{
  id: `${toolCallId}:${rowIndex}`,
  label,
  title,
  content:
    format === "text"
      ? { format: "text", value: description }
      : { format, preview: description, full: fullDescription },
  meta
}
```

`full` 只在确实与 preview 不同时提供。所有截断继续由 Adapter 完成，UI 不读取大 output 后自行截断。

## 6. 内部 Component 行为

### 6.1 `ToolActivityBlock`

- status `running/done/failed` 映射为“运行中/完成/出错”；
- failed 使用 destructive tone；
- summary 单行 truncate；
- Chevron 在 hover/focus/open 时可见；
- 无 details 和 error 时展开区域为空，不渲染无意义容器；
- item 数量大于 1 时显示 item label；
- details 与 error 可以同时存在。

### 6.2 `ToolDetailContent`

```text
text
  最多两行，不提供展开

pre
  保留换行、monospace、可滚动
  有 full 时显示展开/收起输出

markdown
  使用 ChatMarkdown tone="muted"
  有 full 时显示展开/收起内容
```

展开状态以 row `id` 为 identity，父 Activity 更新其他 item 时不能错误复用。

### 6.3 `ContextCompactionBlock`

- 使用原生 `<details>`；
- summary 文案固定“已压缩较早的对话上下文”；
- token 数据完整时显示 `before → after tokens`；
- 缺少任一 token 时不显示虚假的 change；
- compaction summary 保留换行。

## 7. Storybook 状态矩阵

### 7.1 Reasoning

- streaming with text；
- streaming empty；
- done；
- Markdown reasoning；
- long reasoning；
- entity reference；
- light/dark。

### 7.2 Tool Activity

- running/done/failed；
- single/multiple items；
- no details；
- meta only；
- rows only；
- emptyText；
- item error；
- group failure with partial successful details；
- `text/pre/markdown`；
- preview/full；
- long filename/path/command；
- 320px width；
- default collapsed/expanded。

### 7.3 Compaction/Pending

- tokens before/after；
- missing token estimate；
- long multiline summary；
- pending default label；
- pending custom label。

Interaction checks：

- Activity 展开/收起；
- pre/Markdown full content 展开/收起；
- keyboard focus；
- Markdown entity callback。

## 8. 测试重新归属

| 当前测试行为                     | 新归属                                  |
| -------------------------------- | --------------------------------------- |
| tool block 顺序、group、summary  | Electron `agent-turn-view` Adapter test |
| tool-specific result detail      | Electron Adapter test                   |
| running/done/failed visual       | `packages/ui` component test/Story      |
| detail preview/full 展开         | `packages/ui` interaction test          |
| reasoning streaming/done mapping | Electron Adapter test                   |
| reasoning visual                 | `packages/ui` component test            |
| compaction 在 turn 中的位置      | Electron Adapter test                   |
| compaction receipt visual        | `packages/ui` component test/Story      |

UI tests 只构造 View Model，不构造 `AgentReducedAssistantBlock`。

## 9. Renderer 替换清单

- `ReasoningBlock` -> `AgentExecutionBlock`；
- `ToolActivityGroup` -> `AgentExecutionBlock`；
- `ContextCompactionReceipt` -> `AgentExecutionBlock`；
- `RunningResponsePlaceholder` -> pending View Model + `AgentExecutionBlock`；
- `ToolDetailRows` 和 `ToolDetailDescription` 从 Renderer 删除；
- `message-list.tsx` 中独立 compaction receipt 先通过 App mapper 生成 UI compaction block；
- `agent-turn-view.ts` 删除 UI 未使用字段；
- `agent-turn-view.test.ts` 更新 expected View Model；
- `message-list.test.tsx` 中纯视觉断言迁到 package。

## 10. Module 出口

- UI package 不出现 tool name、raw input、raw output 或 Agent block type；
- Tool Activity View Model 不再携带未渲染字段；
- Tool detail 用合法 union 表达，不存在矛盾可选字段组合；
- Reasoning、Tool、Compaction、Pending 都能独立 Story；
- Electron Adapter 仍是 tool payload 解释的唯一位置；
- Module 4 可以复用 package-internal `ToolDetails` 展示 proposal result。
